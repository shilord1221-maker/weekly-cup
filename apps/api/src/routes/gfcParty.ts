import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';
import type { Server as SocketServer } from 'socket.io';

const PARTY_SIZE = 5;

function partyInclude() {
  return {
    captain: { select: { id: true, username: true, avatarUrl: true } },
    members: {
      include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true, activeUsernameEffect: true } } },
      orderBy: { joinedAt: 'asc' as const },
    },
    invites: {
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    },
  };
}

export async function gfcPartyRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  // Получить мою пати
  app.get('/api/gfc/party/my', { preHandler: requireAuth }, async (req, reply) => {
    // Проверяем — капитан ли я
    const asCapt = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id }, include: partyInclude() });
    if (asCapt) return reply.send(asCapt);

    // Или участник
    const asMember = await prisma.gfcPartyMember.findUnique({
      where: { userId: req.user!.id },
      include: { party: { include: partyInclude() } },
    });
    if (asMember) return reply.send(asMember.party);

    reply.send(null);
  });

  // Мои входящие приглашения
  app.get('/api/gfc/party/invites', { preHandler: requireAuth }, async (req, reply) => {
    const invites = await prisma.gfcPartyInvite.findMany({
      where: { userId: req.user!.id, status: 'PENDING' },
      include: {
        party: {
          include: {
            captain: { select: { id: true, username: true, avatarUrl: true } },
            members: { select: { userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(invites);
  });

  // Создать пати
  app.post('/api/gfc/party', { preHandler: requireAuth }, async (req, reply) => {
    // Уже в пати?
    const existing = await prisma.gfcPartyMember.findUnique({ where: { userId: req.user!.id } });
    if (existing) return reply.code(409).send({ error: 'ALREADY_IN_PARTY', message: 'Выйдите из текущей пати' });
    const existingCapt = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id } });
    if (existingCapt) return reply.code(409).send({ error: 'ALREADY_CAPTAIN', message: 'Вы уже капитан пати' });

    const party = await prisma.$transaction(async (tx) => {
      const p = await tx.gfcParty.create({ data: { captainId: req.user!.id } });
      await tx.gfcPartyMember.create({ data: { partyId: p.id, userId: req.user!.id } });
      return p;
    });

    const full = await prisma.gfcParty.findUnique({ where: { id: party.id }, include: partyInclude() });
    io.to(`gfc-party:${party.id}`).emit('party:state', full);
    reply.code(201).send(full);
  });

  // Пригласить игрока
  app.post('/api/gfc/party/invite', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ username: z.string().min(1) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const party = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id }, include: { members: true, invites: { where: { status: 'PENDING' } } } });
    if (!party) return reply.code(403).send({ error: 'NOT_CAPTAIN', message: 'Сначала создайте пати' });

    const totalSlots = party.members.length + party.invites.length;
    if (totalSlots >= PARTY_SIZE) return reply.code(409).send({ error: 'PARTY_FULL', message: 'Пати заполнена' });

    const target = await prisma.user.findFirst({ where: { username: { equals: parsed.data.username, mode: 'insensitive' } } });
    if (!target) return reply.code(404).send({ error: 'USER_NOT_FOUND', message: 'Игрок не найден' });
    if (target.id === req.user!.id) return reply.code(400).send({ error: 'CANNOT_INVITE_SELF' });

    // Уже в пати?
    const inParty = await prisma.gfcPartyMember.findUnique({ where: { userId: target.id } });
    if (inParty) return reply.code(409).send({ error: 'ALREADY_IN_PARTY', message: `${target.username} уже в другой пати` });

    // Уже приглашён?
    const existingInvite = await prisma.gfcPartyInvite.findUnique({ where: { partyId_userId: { partyId: party.id, userId: target.id } } });
    if (existingInvite?.status === 'PENDING') return reply.code(409).send({ error: 'ALREADY_INVITED', message: 'Уже приглашён' });

    await prisma.gfcPartyInvite.upsert({
      where: { partyId_userId: { partyId: party.id, userId: target.id } },
      update: { status: 'PENDING', createdAt: new Date() },
      create: { partyId: party.id, userId: target.id },
    });

    // Уведомление приглашённому
    await prisma.notification.create({ data: { userId: target.id, type: 'gfc:party_invite', payload: { partyId: party.id, captainUsername: req.user!.username } } });
    io.to(`user:${target.id}`).emit('gfc:party_invite', { partyId: party.id, captainUsername: req.user!.username });

    const full = await prisma.gfcParty.findUnique({ where: { id: party.id }, include: partyInclude() });
    io.to(`gfc-party:${party.id}`).emit('party:state', full);
    reply.send({ success: true });
  });

  // Принять/отклонить приглашение
  app.post('/api/gfc/party/invites/:partyId/respond', { preHandler: requireAuth }, async (req, reply) => {
    const { partyId } = req.params as { partyId: string };
    const Schema = z.object({ accept: z.boolean() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const invite = await prisma.gfcPartyInvite.findUnique({ where: { partyId_userId: { partyId, userId: req.user!.id } } });
    if (!invite || invite.status !== 'PENDING') return reply.code(404).send({ error: 'INVITE_NOT_FOUND' });

    if (!parsed.data.accept) {
      await prisma.gfcPartyInvite.update({ where: { id: invite.id }, data: { status: 'DECLINED' } });
      return reply.send({ success: true });
    }

    // Принимаем — добавляем в пати
    const party = await prisma.gfcParty.findUnique({ where: { id: partyId }, include: { members: true } });
    if (!party) return reply.code(404).send({ error: 'PARTY_NOT_FOUND' });
    if (party.members.length >= PARTY_SIZE) return reply.code(409).send({ error: 'PARTY_FULL' });

    const inParty = await prisma.gfcPartyMember.findUnique({ where: { userId: req.user!.id } });
    if (inParty) return reply.code(409).send({ error: 'ALREADY_IN_PARTY', message: 'Сначала выйдите из текущей пати' });

    await prisma.$transaction([
      prisma.gfcPartyInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } }),
      prisma.gfcPartyMember.create({ data: { partyId, userId: req.user!.id } }),
    ]);

    const full = await prisma.gfcParty.findUnique({ where: { id: partyId }, include: partyInclude() });
    io.to(`gfc-party:${partyId}`).emit('party:state', full);
    io.to(`gfc-party:${partyId}`).emit('party:member_joined', { username: req.user!.username });
    reply.send({ success: true });
  });

  // Выйти из пати
  app.post('/api/gfc/party/leave', { preHandler: requireAuth }, async (req, reply) => {
    const member = await prisma.gfcPartyMember.findUnique({ where: { userId: req.user!.id } });
    if (!member) return reply.send({ success: true });

    const party = await prisma.gfcParty.findUnique({ where: { id: member.partyId } });
    if (!party) return reply.send({ success: true });

    if (party.captainId === req.user!.id) {
      // Капитан выходит — удаляем всю пати
      await prisma.gfcParty.delete({ where: { id: party.id } });
      io.to(`gfc-party:${party.id}`).emit('party:disbanded', { reason: 'Капитан покинул пати' });
    } else {
      await prisma.gfcPartyMember.delete({ where: { id: member.id } });
      const full = await prisma.gfcParty.findUnique({ where: { id: party.id }, include: partyInclude() });
      io.to(`gfc-party:${party.id}`).emit('party:state', full);
    }
    reply.send({ success: true });
  });

  // Кикнуть участника (только капитан)
  app.delete('/api/gfc/party/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const party = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id } });
    if (!party) return reply.code(403).send({ error: 'NOT_CAPTAIN' });

    await prisma.gfcPartyMember.deleteMany({ where: { partyId: party.id, userId } });
    const full = await prisma.gfcParty.findUnique({ where: { id: party.id }, include: partyInclude() });
    io.to(`gfc-party:${party.id}`).emit('party:state', full);
    io.to(`user:${userId}`).emit('party:kicked', { partyId: party.id });
    reply.send({ success: true });
  });

  // Начать поиск (капитан ставит всю пати в очередь)
  app.post('/api/gfc/party/search', { preHandler: requireAuth }, async (req, reply) => {
    const party = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id }, include: { members: true } });
    if (!party) return reply.code(403).send({ error: 'NOT_CAPTAIN' });
    if (party.members.length < 2) return reply.code(400).send({ error: 'NOT_ENOUGH', message: 'Нужно минимум 2 игрока' });
    if (party.members.length > PARTY_SIZE) return reply.code(400).send({ error: 'TOO_MANY' });

    // Ставим всех участников в очередь
    await prisma.gfcParty.update({ where: { id: party.id }, data: { status: 'SEARCHING' } });
    for (const m of party.members) {
      await prisma.gfcQueue.upsert({
        where: { userId: m.userId },
        update: { queueType: 'STACK', stackId: party.id, joinedAt: new Date() },
        create: { userId: m.userId, queueType: 'STACK', stackId: party.id },
      });
    }

    // Ищем противника (другую пати в поиске)
    const opponents = await prisma.gfcQueue.findMany({
      where: { queueType: 'STACK', stackId: { not: party.id } },
      orderBy: { joinedAt: 'asc' },
    });

    // Группируем по stackId
    const stackMap = new Map<string, typeof opponents>();
    for (const q of opponents) {
      if (!q.stackId) continue;
      const arr = stackMap.get(q.stackId) ?? [];
      arr.push(q);
      stackMap.set(q.stackId, arr);
    }

    // Ищем пати с таким же размером
    let opponentStackId: string | null = null;
    for (const [sid, members] of stackMap.entries()) {
      if (members.length === party.members.length) { opponentStackId = sid; break; }
    }

    if (opponentStackId) {
      const myMembers = party.members.map((m) => m.userId);
      const oppMembers = stackMap.get(opponentStackId)!.map((q) => q.userId);

      const lobby = await prisma.gfcLobby.create({
        data: {
          mapPool: ['tattoo', 'sandy', 'mexico', 'shop247', 'trailers'],
          createdById: req.user!.id,
          players: {
            create: [
              ...myMembers.map((uid) => ({ userId: uid, teamNum: 1 })),
              ...oppMembers.map((uid) => ({ userId: uid, teamNum: 2 })),
            ],
          },
        },
      });

      await prisma.gfcQueue.deleteMany({ where: { userId: { in: [...myMembers, ...oppMembers] } } });
      await prisma.gfcParty.updateMany({ where: { id: { in: [party.id, opponentStackId] } }, data: { status: 'FORMING' } });

      for (const uid of [...myMembers, ...oppMembers]) {
        io.to(`user:${uid}`).emit('gfc:match_found', { lobbyId: lobby.id });
      }
    }

    io.to(`gfc-party:${party.id}`).emit('party:searching', { searching: true });
    reply.send({ success: true, searching: !opponentStackId });
  });

  // Отменить поиск
  app.post('/api/gfc/party/search/cancel', { preHandler: requireAuth }, async (req, reply) => {
    const party = await prisma.gfcParty.findUnique({ where: { captainId: req.user!.id }, include: { members: true } });
    if (!party) return reply.send({ success: true });

    await prisma.gfcQueue.deleteMany({ where: { userId: { in: party.members.map((m) => m.userId) } } });
    await prisma.gfcParty.update({ where: { id: party.id }, data: { status: 'FORMING' } });
    io.to(`gfc-party:${party.id}`).emit('party:searching', { searching: false });
    reply.send({ success: true });
  });
}
