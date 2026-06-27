import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

const CreateStackSchema = z.object({
  name: z.string().min(2).max(64),
  tag: z.string().min(1).max(4).regex(/^[a-zA-Z0-9]+$/, 'Тег — только буквы и цифры'),
  tagColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Неверный формат цвета').default('#4f7fff'),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
});

const UpdateStackSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  tag: z.string().min(1).max(4).regex(/^[a-zA-Z0-9]+$/).optional(),
  tagColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().nullable(),
});

function stackSelect() {
  return {
    id: true, name: true, tag: true, tagColor: true, logoUrl: true, description: true, createdAt: true,
    captainId: true,
    captain: { select: { id: true, username: true, avatarUrl: true } },
    members: {
      include: { user: { select: { id: true, username: true, avatarUrl: true, staticId: { select: { value: true } } } } },
      orderBy: { joinedAt: 'asc' as const },
    },
    _count: { select: { wins: true, members: true } },
  };
}

export async function stackRoutes(app: FastifyInstance) {
  // ── LEADERBOARD ──
  app.get('/api/stacks', async (req, reply) => {
    const stacks = await prisma.stack.findMany({
      select: {
        id: true, name: true, tag: true, tagColor: true, logoUrl: true, description: true,
        captainId: true,
        captain: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { wins: true, members: true } },
      },
      orderBy: { wins: { _count: 'desc' } },
      take: 100,
    });
    reply.send(stacks);
  });

  // ── GET ONE ──
  app.get('/api/stacks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const stack = await prisma.stack.findUnique({ where: { id }, select: stackSelect() });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send(stack);
  });

  // ── CREATE ──
  app.post('/api/stacks', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateStackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const existing = await prisma.stackMember.findUnique({ where: { userId: req.user!.id } });
    if (existing) return reply.code(409).send({ error: 'ALREADY_IN_STACK', message: 'Сначала выйдите из текущего стака' });

    const captainStack = await prisma.stack.findUnique({ where: { captainId: req.user!.id } });
    if (captainStack) return reply.code(409).send({ error: 'ALREADY_CAPTAIN', message: 'Вы уже являетесь капитаном другого стака' });

    const stack = await prisma.$transaction(async (tx) => {
      const s = await tx.stack.create({
        data: { ...parsed.data, captainId: req.user!.id },
      });
      await tx.stackMember.create({ data: { stackId: s.id, userId: req.user!.id } });
      return s;
    });

    await logAudit({ actorId: req.user!.id, action: 'STACK_CREATED', entityType: 'Stack', entityId: stack.id, payload: { name: stack.name, tag: stack.tag } });
    reply.code(201).send(stack);
  });

  // ── UPDATE (captain only) ──
  app.patch('/api/stacks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    const isStaff = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    if (stack.captainId !== req.user!.id && !isStaff) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только капитан может редактировать стак' });
    }
    const parsed = UpdateStackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const updated = await prisma.stack.update({ where: { id }, data: parsed.data });
    reply.send(updated);
  });

  // ── DELETE (captain / admin / owner) ──
  app.delete('/api/stacks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    const isStaff = req.user!.role === 'OWNER' || req.user!.role === 'ADMIN';
    if (stack.captainId !== req.user!.id && !isStaff) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    await prisma.stack.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'STACK_DELETED', entityType: 'Stack', entityId: id });
    reply.send({ success: true });
  });

  // ── JOIN REQUEST ──
  app.post('/api/stacks/:id/join', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { message } = (req.body as any) ?? {};

    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });

    const alreadyMember = await prisma.stackMember.findUnique({ where: { userId: req.user!.id } });
    if (alreadyMember) return reply.code(409).send({ error: 'ALREADY_IN_STACK', message: 'Вы уже состоите в стаке' });

    const existing = await prisma.stackJoinRequest.findUnique({ where: { stackId_userId: { stackId: id, userId: req.user!.id } } });
    if (existing) {
      if (existing.status === 'PENDING') return reply.code(409).send({ error: 'REQUEST_PENDING', message: 'Заявка уже отправлена' });
      // Повторная заявка после отклонения
      await prisma.stackJoinRequest.update({ where: { id: existing.id }, data: { status: 'PENDING', message: message?.slice(0, 256) ?? null, createdAt: new Date() } });
      return reply.send({ success: true });
    }

    await prisma.stackJoinRequest.create({ data: { stackId: id, userId: req.user!.id, message: message?.slice(0, 256) ?? null } });
    reply.send({ success: true });
  });

  // ── CANCEL OWN REQUEST ──
  app.delete('/api/stacks/:id/join', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.stackJoinRequest.deleteMany({ where: { stackId: id, userId: req.user!.id, status: 'PENDING' } });
    reply.send({ success: true });
  });

  // ── GET REQUESTS (captain only) ──
  app.get('/api/stacks/:id/requests', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (stack.captainId !== req.user!.id && req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const requests = await prisma.stackJoinRequest.findMany({
      where: { stackId: id, status: 'PENDING' },
      include: { user: { select: { id: true, username: true, avatarUrl: true, staticId: { select: { value: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    reply.send(requests);
  });

  // ── APPROVE REQUEST ──
  app.post('/api/stacks/:id/requests/:reqId/approve', { preHandler: requireAuth }, async (req, reply) => {
    const { id, reqId } = req.params as { id: string; reqId: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (stack.captainId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') return reply.code(403).send({ error: 'FORBIDDEN' });

    const joinReq = await prisma.stackJoinRequest.findUnique({ where: { id: reqId } });
    if (!joinReq || joinReq.stackId !== id) return reply.code(404).send({ error: 'NOT_FOUND' });

    const alreadyMember = await prisma.stackMember.findUnique({ where: { userId: joinReq.userId } });
    if (alreadyMember) {
      await prisma.stackJoinRequest.update({ where: { id: reqId }, data: { status: 'REJECTED' } });
      return reply.code(409).send({ error: 'ALREADY_IN_STACK', message: 'Игрок уже состоит в другом стаке' });
    }

    await prisma.$transaction([
      prisma.stackJoinRequest.update({ where: { id: reqId }, data: { status: 'APPROVED' } }),
      prisma.stackMember.create({ data: { stackId: id, userId: joinReq.userId } }),
    ]);

    await prisma.notification.create({ data: { userId: joinReq.userId, type: 'notify:stack_approved', payload: { stackId: id, stackName: stack.name } } });
    reply.send({ success: true });
  });

  // ── REJECT REQUEST ──
  app.post('/api/stacks/:id/requests/:reqId/reject', { preHandler: requireAuth }, async (req, reply) => {
    const { id, reqId } = req.params as { id: string; reqId: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (stack.captainId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') return reply.code(403).send({ error: 'FORBIDDEN' });

    const joinReq = await prisma.stackJoinRequest.findUnique({ where: { id: reqId } });
    if (!joinReq || joinReq.stackId !== id) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.stackJoinRequest.update({ where: { id: reqId }, data: { status: 'REJECTED' } });
    await prisma.notification.create({ data: { userId: joinReq.userId, type: 'notify:stack_rejected', payload: { stackId: id, stackName: stack.name } } });
    reply.send({ success: true });
  });

  // ── KICK MEMBER ──
  app.delete('/api/stacks/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (stack.captainId !== req.user!.id && req.user!.role !== 'OWNER' && req.user!.role !== 'ADMIN') return reply.code(403).send({ error: 'FORBIDDEN' });
    if (userId === stack.captainId) return reply.code(400).send({ error: 'CANNOT_KICK_CAPTAIN' });

    await prisma.stackMember.deleteMany({ where: { stackId: id, userId } });
    reply.send({ success: true });
  });

  // ── LEAVE ──
  app.post('/api/stacks/:id/leave', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stack = await prisma.stack.findUnique({ where: { id } });
    if (!stack) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (stack.captainId === req.user!.id) return reply.code(400).send({ error: 'CAPTAIN_CANNOT_LEAVE', message: 'Капитан не может выйти — сначала передайте роль или удалите стак' });

    await prisma.stackMember.deleteMany({ where: { stackId: id, userId: req.user!.id } });
    reply.send({ success: true });
  });

  // ── MY STACK ──
  app.get('/api/stacks/my', { preHandler: requireAuth }, async (req, reply) => {
    const membership = await prisma.stackMember.findUnique({
      where: { userId: req.user!.id },
      include: { stack: { select: stackSelect() } },
    });
    reply.send(membership?.stack ?? null);
  });

  // ── USER'S STACK ──
  app.get('/api/users/:userId/stack', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const membership = await prisma.stackMember.findUnique({
      where: { userId },
      include: { stack: { select: { id: true, name: true, tag: true, tagColor: true, logoUrl: true } } },
    });
    reply.send(membership?.stack ?? null);
  });
}
