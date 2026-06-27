import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin } from '@/middleware/auth.js';
import { GFC_MAPS, GFC_MAP_KEYS, BAN_ORDER, TOTAL_BANS, getRoundConfig } from '@/services/gfcMaps.js';
import type { Server as SocketServer } from 'socket.io';

const TEAM_SIZE = 5;

function lobbyInclude() {
  return {
    createdBy: { select: { id: true, username: true } },
    players: {
      include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true, activeUsernameEffect: true, staticId: { select: { value: true } }, stackMembership: { select: { stack: { select: { tag: true, tagColor: true, name: true } } } } } } },
      orderBy: { joinedAt: 'asc' as const },
    },
    rounds: { orderBy: { roundNum: 'asc' as const } },
  };
}

export async function gfcRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  // Каталог карт
  app.get('/api/gfc/maps', async (req, reply) => reply.send(GFC_MAPS));

  // Список лобби
  app.get('/api/gfc', async (req, reply) => {
    const lobbies = await prisma.gfcLobby.findMany({
      where: { status: { in: ['WAITING', 'BAN_PICK', 'SIDE_PICK', 'IN_PROGRESS'] } },
      include: lobbyInclude(),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    reply.send(lobbies.map((l) => ({ ...l, hasPassword: !!l.password, password: undefined })));
  });

  // Получить лобби
  app.get('/api/gfc/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send({ ...lobby, hasPassword: !!lobby.password, password: undefined });
  });

  // Создать лобби
  app.post('/api/gfc', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const Schema = z.object({
      team1Name: z.string().min(1).max(64).default('Team 1'),
      team2Name: z.string().min(1).max(64).default('Team 2'),
      mapPool: z.array(z.string()).min(3).max(6),
      password: z.string().max(64).optional(),
    });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const invalidMaps = parsed.data.mapPool.filter((k) => !GFC_MAP_KEYS.has(k));
    if (invalidMaps.length) return reply.code(400).send({ error: 'INVALID_MAPS', message: `Неизвестные карты: ${invalidMaps.join(', ')}` });

    const lobby = await prisma.gfcLobby.create({
      data: {
        team1Name: parsed.data.team1Name,
        team2Name: parsed.data.team2Name,
        mapPool: parsed.data.mapPool,
        password: parsed.data.password ?? null,
        createdById: req.user!.id,
      },
      include: lobbyInclude(),
    });

    reply.code(201).send({ ...lobby, hasPassword: !!lobby.password, password: undefined });
  });

  // Войти в лобби
  app.post('/api/gfc/:id/join', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ teamNum: z.number().int().min(1).max(2), password: z.string().optional(), dynamicId: z.string().regex(/^\d{1,8}$/).optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: { players: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (lobby.status !== 'WAITING') return reply.code(409).send({ error: 'LOBBY_NOT_OPEN', message: 'Лобби уже началось' });

    if (lobby.password && lobby.password !== parsed.data.password) {
      return reply.code(403).send({ error: 'WRONG_PASSWORD', message: 'Неверный пароль' });
    }

    const alreadyIn = lobby.players.find((p) => p.userId === req.user!.id);
    if (alreadyIn) return reply.code(409).send({ error: 'ALREADY_IN', message: 'Вы уже в лобби' });

    const teamPlayers = lobby.players.filter((p) => p.teamNum === parsed.data.teamNum);
    if (teamPlayers.length >= TEAM_SIZE) return reply.code(409).send({ error: 'TEAM_FULL', message: 'Команда заполнена' });

    await prisma.gfcPlayer.create({
      data: { lobbyId: id, userId: req.user!.id, teamNum: parsed.data.teamNum, dynamicId: parsed.data.dynamicId ?? null },
    });

    const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    io.to(`gfc:${id}`).emit('gfc:state', updated);
    reply.send({ success: true });
  });

  // Выйти
  app.post('/api/gfc/:id/leave', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.gfcPlayer.deleteMany({ where: { lobbyId: id, userId: req.user!.id } });
    const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    io.to(`gfc:${id}`).emit('gfc:state', updated);
    reply.send({ success: true });
  });

  // Готов
  app.post('/api/gfc/:id/ready', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ ready: z.boolean() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const player = await prisma.gfcPlayer.findUnique({ where: { lobbyId_userId: { lobbyId: id, userId: req.user!.id } } });
    if (!player) return reply.code(404).send({ error: 'NOT_IN_LOBBY' });

    await prisma.gfcPlayer.update({ where: { id: player.id }, data: { isReady: parsed.data.ready } });

    // Проверяем — все ли готовы (2 команды по 5)?
    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: { players: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const t1 = lobby.players.filter((p) => p.teamNum === 1);
    const t2 = lobby.players.filter((p) => p.teamNum === 2);
    const allReady = t1.length === TEAM_SIZE && t2.length === TEAM_SIZE && lobby.players.every((p) => p.isReady);

    if (allReady && lobby.status === 'WAITING') {
      await prisma.gfcLobby.update({ where: { id }, data: { status: 'BAN_PICK', banTurn: 1 } });
      io.to(`gfc:${id}`).emit('gfc:ban_pick_start', { lobbyId: id });
    }

    const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    io.to(`gfc:${id}`).emit('gfc:state', updated);
    reply.send({ success: true });
  });

  // Забанить карту
  app.post('/api/gfc/:id/ban', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ mapKey: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: { players: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (lobby.status !== 'BAN_PICK') return reply.code(409).send({ error: 'WRONG_PHASE' });

    const player = lobby.players.find((p) => p.userId === req.user!.id);
    if (!player) return reply.code(403).send({ error: 'NOT_IN_LOBBY' });
    if (player.teamNum !== lobby.banTurn) return reply.code(403).send({ error: 'NOT_YOUR_TURN', message: 'Сейчас не ваша очередь банить' });

    if (!lobby.mapPool.includes(parsed.data.mapKey)) return reply.code(400).send({ error: 'MAP_NOT_IN_POOL' });
    if (lobby.bans.includes(parsed.data.mapKey)) return reply.code(400).send({ error: 'ALREADY_BANNED' });

    const newBans = [...lobby.bans, parsed.data.mapKey];
    const banIdx = newBans.length - 1;
    const nextTurn = banIdx < TOTAL_BANS - 1 ? BAN_ORDER[banIdx + 1] : null;

    if (newBans.length >= TOTAL_BANS) {
      // Бан-пик завершён — выбираем оставшуюся карту
      const remaining = lobby.mapPool.filter((k) => !newBans.includes(k));
      // Если осталось несколько — берём первую (или можно дать выбор)
      const selectedMap = remaining[0] ?? lobby.mapPool[0];
      await prisma.gfcLobby.update({ where: { id }, data: { bans: newBans, status: 'SIDE_PICK', selectedMap, banTurn: 1 } });
      const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
      io.to(`gfc:${id}`).emit('gfc:state', updated);
      io.to(`gfc:${id}`).emit('gfc:side_pick_start', { lobbyId: id, selectedMap });
    } else {
      await prisma.gfcLobby.update({ where: { id }, data: { bans: newBans, banTurn: nextTurn ?? 1 } });
      const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
      io.to(`gfc:${id}`).emit('gfc:state', updated);
    }

    reply.send({ success: true });
  });

  // Выбрать сторону (команда 1 выбирает первой)
  app.post('/api/gfc/:id/pick-side', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ side: z.enum(['ATTACK', 'DEFENSE']) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: { players: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (lobby.status !== 'SIDE_PICK') return reply.code(409).send({ error: 'WRONG_PHASE' });

    const player = lobby.players.find((p) => p.userId === req.user!.id);
    if (!player || player.teamNum !== 1) return reply.code(403).send({ error: 'FORBIDDEN', message: 'Сторону выбирает команда 1' });

    // Создаём раунды
    const rounds = [];
    for (let i = 1; i <= 4; i++) {
      const cfg = getRoundConfig(i, parsed.data.side);
      rounds.push({ lobbyId: id, roundNum: i, team1Role: cfg.team1Role });
    }

    await prisma.$transaction([
      prisma.gfcLobby.update({ where: { id }, data: { status: 'IN_PROGRESS', team1Side: parsed.data.side } }),
      prisma.gfcRound.createMany({ data: rounds }),
    ]);

    const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    io.to(`gfc:${id}`).emit('gfc:state', updated);
    io.to(`gfc:${id}`).emit('gfc:match_started', { lobbyId: id });
    reply.send({ success: true });
  });

  // Отметить результат раунда
  app.post('/api/gfc/:id/round/:roundNum/result', { preHandler: requireAuth }, async (req, reply) => {
    const { id, roundNum } = req.params as { id: string; roundNum: string };
    const Schema = z.object({ winnerTeam: z.number().int().min(1).max(2) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.gfcLobby.findUnique({ where: { id }, include: { players: true, rounds: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (lobby.status !== 'IN_PROGRESS') return reply.code(409).send({ error: 'WRONG_PHASE' });

    const player = lobby.players.find((p) => p.userId === req.user!.id);
    if (!player) return reply.code(403).send({ error: 'NOT_IN_LOBBY' });

    const round = lobby.rounds.find((r) => r.roundNum === Number(roundNum));
    if (!round) return reply.code(404).send({ error: 'ROUND_NOT_FOUND' });
    if (round.winnerTeam !== null) return reply.code(409).send({ error: 'ALREADY_REPORTED' });

    // Обновляем раунд
    await prisma.gfcRound.update({ where: { id: round.id }, data: { winnerTeam: parsed.data.winnerTeam, reportedById: req.user!.id } });

    // Пересчитываем счёт
    const updatedRounds = await prisma.gfcRound.findMany({ where: { lobbyId: id } });
    const t1Score = updatedRounds.filter((r) => r.winnerTeam === 1).length;
    const t2Score = updatedRounds.filter((r) => r.winnerTeam === 2).length;

    let newStatus = lobby.status;
    let winnerTeam: number | null = null;

    if (t1Score >= 3 || t2Score >= 3) {
      winnerTeam = t1Score >= 3 ? 1 : 2;
      newStatus = 'FINISHED';
    } else if (t1Score === 2 && t2Score === 2) {
      // Добавляем 5й решающий раунд если ещё нет
      const has5th = updatedRounds.find((r) => r.roundNum === 5);
      if (!has5th) {
        const team1Side = lobby.team1Side as 'ATTACK' | 'DEFENSE';
        await prisma.gfcRound.create({ data: { lobbyId: id, roundNum: 5, team1Role: team1Side } });
        io.to(`gfc:${id}`).emit('gfc:deciding_round', { lobbyId: id });
      }
    }

    await prisma.gfcLobby.update({ where: { id }, data: { team1Score: t1Score, team2Score: t2Score, status: newStatus, winnerTeam } });

    const updated = await prisma.gfcLobby.findUnique({ where: { id }, include: lobbyInclude() });
    io.to(`gfc:${id}`).emit('gfc:state', updated);

    if (newStatus === 'FINISHED') {
      io.to(`gfc:${id}`).emit('gfc:match_finished', { lobbyId: id, winnerTeam });
    }

    reply.send({ success: true });
  });

  // Удалить лобби
  app.delete('/api/gfc/:id', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.gfcLobby.delete({ where: { id } });
    io.to(`gfc:${id}`).emit('gfc:deleted', { lobbyId: id });
    reply.send({ success: true });
  });

  // Очередь матчмейкинга
  app.post('/api/gfc/queue/join', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ type: z.enum(['SOLO', 'STACK']) });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    await prisma.gfcQueue.upsert({
      where: { userId: req.user!.id },
      update: { queueType: parsed.data.type, joinedAt: new Date() },
      create: { userId: req.user!.id, queueType: parsed.data.type },
    });

    // Проверяем можно ли создать матч
    const queue = await prisma.gfcQueue.findMany({ where: { queueType: parsed.data.type }, orderBy: { joinedAt: 'asc' } });

    if (queue.length >= TEAM_SIZE * 2) {
      const team1 = queue.slice(0, TEAM_SIZE);
      const team2 = queue.slice(TEAM_SIZE, TEAM_SIZE * 2);

      const lobby = await prisma.gfcLobby.create({
        data: {
          mapPool: ['tattoo', 'sandy', 'mexico', 'shop247', 'trailers'],
          createdById: req.user!.id,
          players: {
            create: [
              ...team1.map((q) => ({ userId: q.userId, teamNum: 1 })),
              ...team2.map((q) => ({ userId: q.userId, teamNum: 2 })),
            ],
          },
        },
      });

      await prisma.gfcQueue.deleteMany({ where: { userId: { in: [...team1, ...team2].map((q) => q.userId) } } });

      for (const q of [...team1, ...team2]) {
        io.to(`user:${q.userId}`).emit('gfc:match_found', { lobbyId: lobby.id });
      }
    }

    reply.send({ success: true, queueSize: queue.length + 1 });
  });

  app.post('/api/gfc/queue/leave', { preHandler: requireAuth }, async (req, reply) => {
    await prisma.gfcQueue.deleteMany({ where: { userId: req.user!.id } });
    reply.send({ success: true });
  });

  app.get('/api/gfc/queue/status', { preHandler: requireAuth }, async (req, reply) => {
    const entry = await prisma.gfcQueue.findUnique({ where: { userId: req.user!.id } });
    const soloCount = await prisma.gfcQueue.count({ where: { queueType: 'SOLO' } });
    const stackCount = await prisma.gfcQueue.count({ where: { queueType: 'STACK' } });
    reply.send({ inQueue: !!entry, type: entry?.queueType ?? null, soloCount, stackCount });
  });
}
