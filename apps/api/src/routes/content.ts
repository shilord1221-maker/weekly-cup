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
    const news = await prisma.news.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 100 });
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

  app.patch('/api/news/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Редактировать новости может только Owner' });
    }
    const { id } = req.params as { id: string };
    const parsed = NewsSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const news = await prisma.news.update({ where: { id }, data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'NEWS_UPDATED', entityType: 'News', entityId: id, payload: parsed.data });
    reply.send(news);
  });

  app.delete('/api/news/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Удалять новости может только Owner' });
    }
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
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    reply.send(media);
  });

  app.post('/api/media', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const parsed = MediaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const media = await prisma.media.create({ data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'MEDIA_CREATED', entityType: 'Media', entityId: media.id });
    reply.code(201).send(media);
  });

  // Редактирование и удаление медиа — строго Owner (намеренно строже, чем создание, которое доступно Admin)
  app.patch('/api/media/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Редактировать медиа может только Owner' });
    }
    const { id } = req.params as { id: string };
    const parsed = MediaSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const existing = await prisma.media.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const media = await prisma.media.update({ where: { id }, data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'MEDIA_UPDATED', entityType: 'Media', entityId: id, payload: parsed.data });
    reply.send(media);
  });

  app.delete('/api/media/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Удалять медиа может только Owner' });
    }
    const { id } = req.params as { id: string };
    const existing = await prisma.media.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Медиа не найдено' });

    await prisma.media.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'MEDIA_DELETED', entityType: 'Media', entityId: id, payload: { title: existing.title } });
    reply.send({ success: true });
  });
}

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profile', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        pendingAvatarUrl: true,
        avatarStatus: true,
        avatarRejectedReason: true,
        createdAt: true,
        discordId: true,
        discordUsername: true,
        discordAvatar: true,
        discordLinkedAt: true,
        referralCode: true,
        staticId: true,
        tokenBalance: true,
        activeUsernameEffect: true,
        activeFrameEffect: true,
        profileBg: true,
        profileBgPosition: true,
        pendingProfileBg: true,
        profileBgStatus: true,
        stackMembership: { select: { stack: { select: { id: true, name: true, tag: true, tagColor: true } } } },
        profileBgRejectedReason: true,
        achievements: { orderBy: { earnedAt: 'desc' } },
        wins: { include: { match: { include: { map: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { referrals: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send({ ...user, referralCount: user._count.referrals });
  });

  // Загрузка новой аватарки — не меняет видимую avatarUrl сразу, создаёт заявку на модерацию.
  // Пользователь может загрузить новую аватарку, даже если предыдущая ещё на рассмотрении —
  // это просто заменяет pendingAvatarUrl, не плодя дублирующиеся заявки.
  const SubmitAvatarSchema = z.object({ avatarUrl: z.string().url('Некорректная ссылка на изображение') });
  app.post('/api/profile/avatar', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = SubmitAvatarSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        pendingAvatarUrl: parsed.data.avatarUrl,
        avatarStatus: 'PENDING',
        avatarReviewedById: null,
        avatarRejectedReason: null,
      },
    });

    await logAudit({ actorId: req.user!.id, action: 'AVATAR_SUBMITTED', entityType: 'User', entityId: req.user!.id });
    reply.send({ success: true, status: 'PENDING' });
  });

  // Очередь модерации аватарок — видят Admin/Owner
  app.get('/api/avatars/pending', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const users = await prisma.user.findMany({
      where: { avatarStatus: 'PENDING' },
      select: { id: true, username: true, pendingAvatarUrl: true, avatarUrl: true },
      orderBy: { updatedAt: 'asc' },
    });
    reply.send(users);
  });

  app.post('/api/avatars/:id/approve', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!target.pendingAvatarUrl) return reply.code(400).send({ error: 'NO_PENDING_AVATAR', message: 'Нет аватарки на рассмотрении' });

    await prisma.user.update({
      where: { id },
      data: {
        avatarUrl: target.pendingAvatarUrl,
        pendingAvatarUrl: null,
        avatarStatus: 'APPROVED',
        avatarReviewedById: req.user!.id,
        avatarRejectedReason: null,
      },
    });

    await logAudit({ actorId: req.user!.id, action: 'AVATAR_APPROVED', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });

  const RejectAvatarSchema = z.object({ reason: z.string().max(500).optional() });
  app.post('/api/avatars/:id/reject', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = RejectAvatarSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.user.update({
      where: { id },
      data: {
        pendingAvatarUrl: null,
        avatarStatus: 'REJECTED',
        avatarReviewedById: req.user!.id,
        avatarRejectedReason: parsed.data.reason ?? null,
      },
    });

    await logAudit({ actorId: req.user!.id, action: 'AVATAR_REJECTED', entityType: 'User', entityId: id, payload: { reason: parsed.data.reason } });
    reply.send({ success: true });
  });
}

export async function winsRoutes(app: FastifyInstance) {
  // Публичная лента последних побед + тег стака победителя
  app.get('/api/wins', async (req, reply) => {
    const wins = await prisma.win.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { id: true, username: true, avatarUrl: true, activeUsernameEffect: true, activeFrameEffect: true } }, match: { include: { map: true } }, team: true },
    });
    // Подтягиваем стак каждого победителя за один запрос
    const userIds = [...new Set(wins.map((w) => w.userId))];
    const memberships = await prisma.stackMember.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, stack: { select: { id: true, name: true, tag: true, tagColor: true } } },
    });
    const stackByUser = new Map(memberships.map((m) => [m.userId, m.stack]));
    reply.send(wins.map((w) => ({ ...w, userStack: stackByUser.get(w.userId) ?? null })));
  });

  // Топ игроков по общему числу побед (лидерборд)
  app.get('/api/wins/leaderboard', async (req, reply) => {
    const wins = await prisma.win.findMany({
      select: { userId: true, user: { select: { id: true, username: true, avatarUrl: true, activeUsernameEffect: true, activeFrameEffect: true, stackMembership: { include: { stack: { select: { id: true, name: true, tag: true, tagColor: true } } } } } } },
    });

    const counts = new Map<string, { user: typeof wins[0]['user']; count: number }>();
    for (const w of wins) {
      const e = counts.get(w.userId);
      if (e) e.count++;
      else counts.set(w.userId, { user: w.user, count: 1 });
    }

    const top = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(({ user, count }) => ({
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        activeUsernameEffect: user.activeUsernameEffect,
        activeFrameEffect: user.activeFrameEffect,
        stack: user.stackMembership?.stack ?? null,
        count,
      }));

    reply.send(top);
  });

  // Топ игроков за сегодня по числу побед
  app.get('/api/wins/today-top', async (req, reply) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const wins = await prisma.win.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { userId: true, user: { select: { id: true, username: true, avatarUrl: true, activeUsernameEffect: true, activeFrameEffect: true } } },
    });

    const counts = new Map<string, { user: typeof wins[0]['user']; count: number }>();
    for (const w of wins) {
      const existing = counts.get(w.userId);
      if (existing) existing.count++;
      else counts.set(w.userId, { user: w.user, count: 1 });
    }

    const top = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ user, count }) => ({ userId: user.id, username: user.username, avatarUrl: user.avatarUrl, activeUsernameEffect: user.activeUsernameEffect, activeFrameEffect: user.activeFrameEffect, count }));

    reply.send(top);
  });

  app.get('/api/wins/user/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wins = await prisma.win.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, username: true, avatarUrl: true, activeUsernameEffect: true, activeFrameEffect: true } }, match: { include: { map: true } }, team: true },
    });
    reply.send(wins);
  });

  app.get('/api/achievements/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const achievements = await prisma.achievement.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' }, take: 100 });
    reply.send(achievements);
  });
}

export async function publicProfileRoutes(app: FastifyInstance) {
  app.get('/api/users/:userId/profile', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        activeUsernameEffect: true,
        activeFrameEffect: true,
        tokenBalance: true,
        profileBg: true,
        profileBgPosition: true,
        staticId: { select: { value: true } },
        achievements: { orderBy: { earnedAt: 'desc' }, take: 20 },
        wins: {
          include: { match: { include: { map: true } }, team: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        stackMembership: { include: { stack: { select: { id: true, name: true, tag: true, tagColor: true, logoUrl: true } } } },
        _count: { select: { wins: true } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });
    reply.send(user);
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
    const { q, role, banned } = req.query as { q?: string; role?: string; banned?: string };

    const where: any = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { staticId: { value: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (role && ['OWNER', 'ADMIN', 'ORGANIZER', 'PLAYER'].includes(role)) {
      where.role = role;
    }
    if (banned === 'true') where.isBanned = true;
    if (banned === 'false') where.isBanned = false;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, email: true, role: true,
        avatarUrl: true,
        staticId: { select: { value: true, proofUrl: true } },
        isBanned: true, bannedReason: true,
        isSuspended: true, suspendedReason: true, suspendedUntil: true,
        registrationIp: true, lastLoginIp: true, createdAt: true,
        tokenBalance: true,
        stackMembership: { select: { stackId: true, stack: { select: { id: true, name: true, tag: true, tagColor: true } } } },
      },
      take: 200,
    });
    const isOwner = req.user!.role === 'OWNER';
    reply.send(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        ...(isOwner ? { email: u.email } : {}),
        role: u.role,
        staticId: u.staticId?.value ?? null,
        staticIdProofUrl: u.staticId?.proofUrl ?? null,
        isBanned: u.isBanned,
        bannedReason: u.bannedReason,
        isSuspended: u.isSuspended,
        suspendedReason: u.suspendedReason,
        suspendedUntil: u.suspendedUntil,
        tokenBalance: u.tokenBalance,
        stack: (u as any).stackMembership?.stack ?? null,
        ...(isOwner ? { registrationIp: u.registrationIp, lastLoginIp: u.lastLoginIp } : {}),
        createdAt: u.createdAt,
      }))
    );
  });

  // Общее число пользователей + разбивка по ролям/банам — для счётчика в админке,
  // отдельно от основного списка, чтобы не тянуть все 200 строк только за цифрой.
  app.get('/api/users/count', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const [total, banned, byRole] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
    ]);

    const roleCounts: Record<string, number> = { OWNER: 0, ADMIN: 0, ORGANIZER: 0, PLAYER: 0 };
    for (const row of byRole) roleCounts[row.role] = row._count.role;

    reply.send({ total, banned, byRole: roleCounts });
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

  // Отстранение от игр — мягче полного бана: аккаунт остаётся рабочим (логин, чат, сайт),
  // но запрещено участвовать в лобби/командах/матчах (проверяется в services/lobby.ts).
  const SuspendSchema = z.object({ reason: z.string().max(500).optional(), durationDays: z.number().int().min(1).max(3650).optional() });
  app.post('/api/users/:id/suspend', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = SuspendSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });
    if (target.role === 'OWNER' && req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только Owner может отстранять Owner' });
    }

    const suspendedUntil = parsed.data.durationDays ? new Date(Date.now() + parsed.data.durationDays * 24 * 60 * 60 * 1000) : null;

    await prisma.user.update({
      where: { id },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedUntil,
        suspendedReason: parsed.data.reason ?? null,
        suspendedById: req.user!.id,
      },
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: id,
      payload: { reason: parsed.data.reason, durationDays: parsed.data.durationDays },
    });
    reply.send({ success: true });
  });

  app.post('/api/users/:id/unsuspend', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({
      where: { id },
      data: { isSuspended: false, suspendedAt: null, suspendedUntil: null, suspendedReason: null, suspendedById: null },
    });
    await logAudit({ actorId: req.user!.id, action: 'USER_UNSUSPENDED', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });

  // Изменение Static ID игрока — строго Owner, не доступно даже Admin/Organizer.
  // Static ID — это закреплённый игровой идентификатор, самостоятельная смена игроком запрещена.
  const StaticIdSchema = z.object({
    staticId: z.string().regex(/^\d{2,}$/, 'Static ID должен состоять минимум из 2 цифр'),
  });

  app.patch('/api/users/:id/static-id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только Owner может изменять Static ID' });
    }

    const { id } = req.params as { id: string };
    const parsed = StaticIdSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Некорректный Static ID' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });

    const taken = await prisma.staticId.findUnique({ where: { value: parsed.data.staticId } });
    if (taken && taken.userId !== id) {
      return reply.code(409).send({ error: 'STATIC_ID_TAKEN', message: 'Этот Static ID уже привязан к другому аккаунту' });
    }

    const result = await prisma.staticId.upsert({
      where: { userId: id },
      update: { value: parsed.data.staticId },
      create: { userId: id, value: parsed.data.staticId },
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'STATIC_ID_CHANGED_BY_OWNER',
      entityType: 'StaticId',
      entityId: result.id,
      payload: { value: parsed.data.staticId, targetUserId: id },
    });

    reply.send({ staticId: result.value });
  });

  // Удаление аккаунта пользователя — строго Owner
  app.delete('/api/users/:id/account', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = req.params as { id: string };
    if (id === req.user!.id) return reply.code(400).send({ error: 'CANNOT_DELETE_SELF', message: 'Нельзя удалить собственный аккаунт' });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (target.role === 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN', message: 'Нельзя удалить другого Owner' });
    await prisma.user.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'USER_DELETED_BY_OWNER', entityType: 'User', entityId: id, payload: { username: target.username } });
    reply.send({ success: true });
  });

  // Смена email пользователя — строго Owner
  app.patch('/api/users/:id/email', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = req.params as { id: string };
    const Schema = z.object({ email: z.string().email('Некорректный email') });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message });
    const taken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (taken && taken.id !== id) return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Email уже используется' });
    await prisma.user.update({ where: { id }, data: { email: parsed.data.email } });
    await logAudit({ actorId: req.user!.id, action: 'USER_EMAIL_CHANGED_BY_OWNER', entityType: 'User', entityId: id, payload: { email: parsed.data.email } });
    reply.send({ success: true });
  });

  // Смена пароля пользователя — строго Owner
  app.patch('/api/users/:id/password', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = req.params as { id: string };
    const Schema = z.object({ newPassword: z.string().min(8, 'Минимум 8 символов') });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message });
    const hash = await argon2.hash(parsed.data.newPassword);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    // Отзываем все сессии пользователя
    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
    await logAudit({ actorId: req.user!.id, action: 'USER_PASSWORD_CHANGED_BY_OWNER', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });

  // Прямая установка аватарки — строго Owner (без модерации)
  app.patch('/api/users/:id/avatar-direct', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = req.params as { id: string };
    const Schema = z.object({ avatarUrl: z.string().url().nullable() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    await prisma.user.update({ where: { id }, data: { avatarUrl: parsed.data.avatarUrl, avatarStatus: parsed.data.avatarUrl ? 'APPROVED' : null, pendingAvatarUrl: null } });
    await logAudit({ actorId: req.user!.id, action: 'AVATAR_SET_BY_OWNER', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });

  // Удалить пользователя из стака — строго Owner
  app.delete('/api/users/:id/stack', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = req.params as { id: string };
    await prisma.stackMember.deleteMany({ where: { userId: id } });
    await logAudit({ actorId: req.user!.id, action: 'USER_REMOVED_FROM_STACK', entityType: 'User', entityId: id });
    reply.send({ success: true });
  });

  // Изменение ника игрока — строго Owner. Обычные игроки не могут сами поменять ник на сайте,
  // только через обращение в поддержку — это и есть тот процесс, реализованный здесь технически.
  const UsernameSchema = z.object({
    username: z
      .string()
      .min(3, 'Ник должен быть не короче 3 символов')
      .max(32, 'Ник должен быть не длиннее 32 символов')
      .regex(/^[a-zA-Z0-9_ ]+$/, 'Ник может содержать буквы, цифры, пробел и подчёркивание'),
  });

  app.patch('/api/users/:id/username', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только Owner может изменять ник игрока' });
    }

    const { id } = req.params as { id: string };
    const parsed = UsernameSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Некорректный ник' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Пользователь не найден' });

    const taken = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (taken && taken.id !== id) {
      return reply.code(409).send({ error: 'USERNAME_TAKEN', message: 'Этот ник уже занят другим аккаунтом' });
    }

    const oldUsername = targetUser.username;
    const updated = await prisma.user.update({ where: { id }, data: { username: parsed.data.username } });

    await logAudit({
      actorId: req.user!.id,
      action: 'USERNAME_CHANGED_BY_OWNER',
      entityType: 'User',
      entityId: id,
      payload: { oldUsername, newUsername: parsed.data.username },
    });

    reply.send({ username: updated.username });
  });

  // Реферальный топ — кто привёл больше всего игроков. Видят Admin/Owner (через requireRole иерархию).
  app.get('/api/users/referral-leaderboard', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const referrers = await prisma.user.groupBy({
      by: ['referredById'],
      where: { referredById: { not: null } },
      _count: { referredById: true },
    });

    const referrerIds = referrers.map((r) => r.referredById).filter((id): id is string => !!id);
    const referrerUsers = await prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, username: true, role: true, referralCode: true, createdAt: true },
    });
    const userById = new Map(referrerUsers.map((u) => [u.id, u]));

    const leaderboard = referrers
      .map((r) => {
        const u = userById.get(r.referredById!);
        if (!u) return null;
        return { id: u.id, username: u.username, role: u.role, referralCode: u.referralCode, referredAt: u.createdAt, count: r._count.referredById };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.count - a.count);

    reply.send(leaderboard);
  });
}
