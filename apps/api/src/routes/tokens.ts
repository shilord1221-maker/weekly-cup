import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { COSMETICS_CATALOG, CATALOG_BY_KEY } from '@/services/cosmetics.js';

export async function tokenRoutes(app: FastifyInstance) {
  // Каталог косметики — публичный
  app.get('/api/shop/catalog', async (req, reply) => {
    reply.send(COSMETICS_CATALOG);
  });

  // Баланс и купленная косметика текущего пользователя
  app.get('/api/shop/my', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { tokenBalance: true, activeUsernameEffect: true, cosmetics: { select: { cosmeticKey: true, purchasedAt: true } } },
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

  // Купить косметику
  app.post('/api/shop/buy', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ cosmeticKey: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const item = CATALOG_BY_KEY.get(parsed.data.cosmeticKey);
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Косметика не найдена' });

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

    await prisma.user.update({ where: { id: req.user!.id }, data: { activeUsernameEffect: parsed.data.cosmeticKey } });
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
