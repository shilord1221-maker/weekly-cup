import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

const NewsSchema = z.object({
  title: z.string().min(2).max(255),
  slug: z.string().min(2).max(128).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().max(500).optional(),
  body: z.string().min(1),
  coverUrl: z.string().url().optional(),
  published: z.boolean().default(true),
});

const MediaSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['youtube', 'twitch', 'embed', 'link']),
  url: z.string().url(),
  thumbUrl: z.string().url().optional(),
});

export async function newsRoutes(app: FastifyInstance) {
  app.get('/api/news', async (req, reply) => {
    const news = await prisma.news.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });
    reply.send(news);
  });

  app.get('/api/news/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const item = await prisma.news.findUnique({ where: { slug } });
    if (!item) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send(item);
  });

  app.post('/api/news', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const parsed = NewsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const news = await prisma.news.create({ data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'NEWS_CREATED', entityType: 'News', entityId: news.id });
    reply.code(201).send(news);
  });

  app.patch('/api/news/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const news = await prisma.news.update({ where: { id }, data: req.body as any });
    reply.send(news);
  });

  app.delete('/api/news/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Новость не найдена' });

    await prisma.news.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'NEWS_DELETED', entityType: 'News', entityId: id, payload: { title: news.title } });
    reply.send({ success: true });
  });
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/api/media', async (req, reply) => {
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' } });
    reply.send(media);
  });

  app.post('/api/media', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const parsed = MediaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const media = await prisma.media.create({ data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'MEDIA_CREATED', entityType: 'Media', entityId: media.id });
    reply.code(201).send(media);
  });
}

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profile', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        staticId: true,
        achievements: { orderBy: { earnedAt: 'desc' } },
        wins: { include: { match: { include: { map: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send(user);
  });

  app.patch('/api/profile', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ avatarUrl: z.string().url().optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const user = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
    reply.send(user);
  });
}

export async function winsRoutes(app: FastifyInstance) {
  // Публичная лента последних побед
  app.get('/api/wins', async (req, reply) => {
    const wins = await prisma.win.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { id: true, username: true, avatarUrl: true } }, match: { include: { map: true } }, team: true },
    });
    reply.send(wins);
  });

  app.get('/api/wins/user/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wins = await prisma.win.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: { match: { include: { map: true } }, team: true },
    });
    reply.send(wins);
  });

  app.get('/api/achievements/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const achievements = await prisma.achievement.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } });
    reply.send(achievements);
  });
}

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/audit-log', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, username: true } } },
    });
    reply.send(logs);
  });
}

export async function userRoutes(app: FastifyInstance) {
  // Поиск по нику или Static ID — для админ-панели
  app.get('/api/users', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { q } = req.query as { q?: string };

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { staticId: { value: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      include: { staticId: true },
      take: 200,
    });
    reply.send(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        staticId: u.staticId?.value ?? null,
        staticIdProofUrl: u.staticId?.proofUrl ?? null,
        isBanned: u.isBanned,
        bannedReason: u.bannedReason,
        registrationIp: u.registrationIp,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
      }))
    );
  });

  app.patch('/api/users/:id/role', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'ORGANIZER', 'PLAYER']) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });

    // Только OWNER может управлять другим OWNER — снимать, менять или назначать роль OWNER.
    if ((targetUser.role === 'OWNER' || parsed.data.role === 'OWNER') && req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только Owner может управлять ролью Owner' });
    }

    const user = await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
    await logAudit({ actorId: req.user!.id, action: 'USER_ROLE_CHANGED', entityType: 'User', entityId: id, payload: { role: parsed.data.role } });
    reply.send({ id: user.id, role: user.role });
  });

  // Бан пользователя — опционально банит и все остальные аккаунты с тем же IP регистрации/входа
  const BanSchema = z.object({
    reason: z.string().max(500).optional(),
    banByIp: z.boolean().default(false),
  });

  app.post('/api/users/:id/ban', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = BanSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });
    if (target.role === 'OWNER' && req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только Owner может банить Owner' });
    }

    const banData = { isBanned: true, bannedAt: new Date(), bannedReason: parsed.data.reason ?? null, bannedById: req.user!.id };

    if (parsed.data.banByIp) {
      const ips = [target.registrationIp, target.lastLoginIp].filter((ip): ip is string => !!ip);
      if (ips.length > 0) {
        await prisma.user.updateMany({
          where: { OR: [{ registrationIp: { in: ips } }, { lastLoginIp: { in: ips } }] },
          data: banData,
        });
      } else {
        await prisma.user.update({ where: { id }, data: banData });
      }
    } else {
      await prisma.user.update({ where: { id }, data: banData });
    }

    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
    await logAudit({ actorId: req.user!.id, action: 'USER_BANNED', entityType: 'User', entityId: id, payload: { reason: parsed.data.reason, banByIp: parsed.data.banByIp } });
    reply.send({ success: true });
  });

  app.post('/api/users/:id/unban', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { isBanned: false, bannedAt: null, bannedReason: null, bannedById: null } });
    await logAudit({ actorId: req.user!.id, action: 'USER_UNBANNED', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });
}
