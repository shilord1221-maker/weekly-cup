import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { redis } from '@/redis.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { COSMETICS_CATALOG, CATALOG_BY_KEY } from '@/services/cosmetics.js';

const PRICES_KEY = 'shop:prices';
const PROFILE_BG_PRICE_KEY = 'shop:price:PROFILE_BG';

async function getItemPrice(key: string, defaultPrice: number): Promise<number> {
  const override = await redis.hget(PRICES_KEY, key);
  return override ? Number(override) : defaultPrice;
}

export async function tokenRoutes(app: FastifyInstance) {
  // Каталог косметики с актуальными ценами
  app.get('/api/shop/catalog', async (req, reply) => {
    const overrides = await redis.hgetall(PRICES_KEY) ?? {};
    const catalog = COSMETICS_CATALOG.map((item) => ({
      ...item,
      price: overrides[item.key] ? Number(overrides[item.key]) : item.price,
    }));
    // Добавляем виртуальный предмет "Фон профиля"
    const bgPrice = overrides['PROFILE_BG'] ? Number(overrides['PROFILE_BG']) : 500;
    catalog.push({ key: 'PROFILE_BG', name: 'Фон профиля 🖼️', description: 'Загрузи своё изображение — оно появится на твоём профиле после модерации', price: bgPrice, type: 'profile', preview: '', color: undefined, gradient: undefined });
    reply.send(catalog);
  });

  // Текущие цены (для отображения в управлении)
  app.get('/api/shop/prices', { preHandler: [requireAuth, requireRole('OWNER')] }, async (req, reply) => {
    const overrides = await redis.hgetall(PRICES_KEY) ?? {};
    reply.send(overrides);
  });

  // Изменить цену — только Owner
  app.patch('/api/shop/prices', { preHandler: [requireAuth, requireRole('OWNER')] }, async (req, reply) => {
    const Schema = z.record(z.string(), z.number().int().min(0).max(100000));
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
    const entries = Object.entries(parsed.data);
    if (entries.length > 0) {
      await redis.hset(PRICES_KEY, ...entries.flatMap(([k, v]) => [k, String(v)]));
    }
    reply.send({ success: true });
  });

  // Баланс и купленная косметика текущего пользователя
  app.get('/api/shop/my', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { tokenBalance: true, activeUsernameEffect: true, activeFrameEffect: true, profileBgStatus: true, cosmetics: { select: { cosmeticKey: true, purchasedAt: true } } },
    });
    reply.send(user);
  });

  // История транзакций
  app.get('/api/shop/transactions', { preHandler: requireAuth }, async (req, reply) => {
    const txs = await prisma.tokenTransaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    reply.send(txs);
  });

  // Купить фон профиля (отдельный flow — нужна ссылка на картинку)
  app.post('/api/shop/buy-profile-bg', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ imageUrl: z.string().url() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const overrides = await redis.hgetall(PRICES_KEY) ?? {};
    const price = overrides['PROFILE_BG'] ? Number(overrides['PROFILE_BG']) : 500;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { tokenBalance: true } });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (user.tokenBalance < price) return reply.code(402).send({ error: 'NOT_ENOUGH_TOKENS', message: `Недостаточно токенов. Нужно: ${price}, у вас: ${user.tokenBalance}` });

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user!.id }, data: { tokenBalance: { decrement: price }, pendingProfileBg: parsed.data.imageUrl, profileBgStatus: 'PENDING' } }),
      prisma.tokenTransaction.create({ data: { userId: req.user!.id, amount: -price, reason: 'PURCHASE:PROFILE_BG' } }),
    ]);

    reply.send({ success: true, message: 'Фон отправлен на модерацию' });
  });

  // Фоны на модерации — Admin/Owner
  app.get('/api/shop/profile-bg/pending', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const users = await prisma.user.findMany({
      where: { profileBgStatus: 'PENDING' },
      select: { id: true, username: true, pendingProfileBg: true, profileBg: true },
      orderBy: { updatedAt: 'asc' },
    });
    reply.send(users);
  });

  // Одобрить фон
  app.post('/api/shop/profile-bg/:userId/approve', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target?.pendingProfileBg) return reply.code(404).send({ error: 'NOT_FOUND' });
    await prisma.user.update({ where: { id: userId }, data: { profileBg: target.pendingProfileBg, pendingProfileBg: null, profileBgStatus: 'APPROVED', profileBgReviewedById: req.user!.id } });
    reply.send({ success: true });
  });

  // Отклонить фон
  app.post('/api/shop/profile-bg/:userId/reject', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const Schema = z.object({ reason: z.string().max(500).optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
    await prisma.user.update({ where: { id: userId }, data: { pendingProfileBg: null, profileBgStatus: 'REJECTED', profileBgReviewedById: req.user!.id, profileBgRejectedReason: parsed.data.reason ?? null } });
    reply.send({ success: true });
  });

  // Купить косметику
  app.post('/api/shop/buy', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ cosmeticKey: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const baseItem = CATALOG_BY_KEY.get(parsed.data.cosmeticKey);
    if (!baseItem) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Косметика не найдена' });
    const overrides = await redis.hgetall(PRICES_KEY) ?? {};
    const item = { ...baseItem, price: overrides[baseItem.key] ? Number(overrides[baseItem.key]) : baseItem.price };

    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { tokenBalance: true } });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (user.tokenBalance < item.price) {
      return reply.code(402).send({ error: 'NOT_ENOUGH_TOKENS', message: `Недостаточно токенов. Нужно: ${item.price}, у вас: ${user.tokenBalance}` });
    }

    const already = await prisma.userCosmetic.findUnique({ where: { userId_cosmeticKey: { userId: req.user!.id, cosmeticKey: item.key } } });
    if (already) return reply.code(409).send({ error: 'ALREADY_OWNED', message: 'Этот эффект уже куплен' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user!.id }, data: { tokenBalance: { decrement: item.price } } }),
      prisma.userCosmetic.create({ data: { userId: req.user!.id, cosmeticKey: item.key } }),
      prisma.tokenTransaction.create({ data: { userId: req.user!.id, amount: -item.price, reason: `PURCHASE:${item.key}` } }),
    ]);

    reply.send({ success: true, newBalance: user.tokenBalance - item.price });
  });

  // Активировать эффект ника (или убрать — null)
  app.patch('/api/shop/active-effect', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ cosmeticKey: z.string().nullable() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    if (parsed.data.cosmeticKey !== null) {
      const owned = await prisma.userCosmetic.findUnique({ where: { userId_cosmeticKey: { userId: req.user!.id, cosmeticKey: parsed.data.cosmeticKey } } });
      if (!owned) return reply.code(403).send({ error: 'NOT_OWNED', message: 'Этот эффект не куплен' });
    }

    const item = parsed.data.cosmeticKey ? CATALOG_BY_KEY.get(parsed.data.cosmeticKey) : null;
    if (item?.type === 'frame') {
      await prisma.user.update({ where: { id: req.user!.id }, data: { activeFrameEffect: parsed.data.cosmeticKey } });
    } else {
      await prisma.user.update({ where: { id: req.user!.id }, data: { activeUsernameEffect: parsed.data.cosmeticKey } });
    }
    reply.send({ success: true });
  });

  // Начислить токены вручную — только Owner/Admin (для тестов или подарков)
  app.post('/api/shop/grant', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const Schema = z.object({ userId: z.string(), amount: z.number().int().min(1).max(10000) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: parsed.data.userId }, data: { tokenBalance: { increment: parsed.data.amount } } }),
      prisma.tokenTransaction.create({ data: { userId: parsed.data.userId, amount: parsed.data.amount, reason: 'ADMIN_GRANT' } }),
    ]);
    reply.send({ success: true });
  });

  // Получить эффект конкретного пользователя — публичный (для отображения в лобби/чате)
  app.get('/api/users/:userId/effect', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeUsernameEffect: true } });
    reply.send({ effect: user?.activeUsernameEffect ?? null });
  });
}
