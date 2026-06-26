import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin } from '@/middleware/auth.js';
import { validateFinalZone } from '@/services/zones.js';
import { logAudit } from '@/services/audit.js';
import { scheduleMatchStart, scheduleMatchReminder, scheduleStartZoneClose, scheduleFinalZoneClose, cancelScheduledJobs } from '@/jobs/matchQueue.js';
import { setMatchStartTimer, setStartZoneWindow, setFinalZoneWindow, clearMatchTimers, getRemainingMs } from '@/services/timers.js';
import type { Server as SocketServer } from 'socket.io';

const CreateMatchSchema = z.object({
  mapId: z.string().uuid(),
  mode: z.enum(['MODE_2X2', 'MODE_3X3', 'MODE_4X4', 'MODE_5X5']),
  startTime: z.string().datetime(), // ISO UTC string from client
  zoneIds: z.array(z.string().uuid()).optional(), // зоны можно выбрать сразу при создании матча
});

const ZonesSchema = z.object({
  zoneIds: z.array(z.string().uuid()).min(1),
});

const FinalZoneSchema = z.object({
  zoneId: z.string().uuid(),
});

const FinishSchema = z.object({
  winnerTeamId: z.string().uuid(),
});

export async function matchRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  // ───────── LIST ─────────
  app.get('/api/matches', async (req, reply) => {
    const matches = await prisma.match.findMany({
      orderBy: { startTime: 'desc' },
      take: 50,
      include: {
        map: true,
        organizer: { select: { id: true, username: true } },
        winnerTeam: true,
        lobby: { include: { teams: { include: { members: true } } } },
      },
    });
    reply.send(matches);
  });

  // ───────── GET ONE ─────────
  app.get('/api/matches/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        map: { include: { zones: true } },
        selectedZones: true,
        finalZone: true,
        organizer: { select: { id: true, username: true } },
        winnerTeam: true,
        lobby: { include: { teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true, staticId: { select: { value: true } } } } } } } } } },
      },
    });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Матч не найден' });
    reply.send(match);
  });

  // ───────── CREATE (Organizer+) ─────────
  app.post('/api/matches', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const parsed = CreateMatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });
    }
    const { mapId, mode, startTime, zoneIds } = parsed.data;

    const map = await prisma.gameMap.findUnique({ where: { id: mapId } });
    if (!map) return reply.code(404).send({ error: 'MAP_NOT_FOUND', message: 'Карта не найдена' });

    const match = await prisma.match.create({
      data: {
        mapId,
        mode,
        startTime: new Date(startTime),
        organizerId: req.user!.id,
        status: 'SCHEDULED',
        ...(zoneIds && zoneIds.length > 0 ? { selectedZones: { connect: zoneIds.map((id) => ({ id })) } } : {}),
        lobby: { create: { state: 'OPEN' } }, // команды теперь создают сами игроки через /api/lobby/:matchId/teams
      },
      include: { lobby: { include: { teams: true } } },
    });

    await scheduleMatchStart(match.id, match.startTime);
    await scheduleMatchReminder(match.id, match.startTime);
    await setMatchStartTimer(match.id, match.startTime.getTime());

    await logAudit({ actorId: req.user!.id, action: 'MATCH_CREATED', entityType: 'Match', entityId: match.id, payload: { mapId, mode, startTime } });

    reply.code(201).send(match);
  });

  // ───────── UPDATE TIME/MODE (Organizer+) ─────────
  app.patch('/api/matches/:id', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ startTime: z.string().datetime().optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (match.status === 'LIVE' || match.status === 'PAUSED' || match.status === 'FINISHED') {
      return reply.code(409).send({ error: 'MATCH_ALREADY_STARTED', message: 'Нельзя изменить время уже начавшегося или завершённого матча' });
    }

    const data: any = {};
    if (parsed.data.startTime) {
      data.startTime = new Date(parsed.data.startTime);
      await cancelScheduledJobs(id);
      await scheduleMatchStart(id, data.startTime);
      await scheduleMatchReminder(id, data.startTime);
      await setMatchStartTimer(id, data.startTime.getTime());
    }

    const updated = await prisma.match.update({ where: { id }, data });
    await logAudit({ actorId: req.user!.id, action: 'MATCH_TIME_CHANGED', entityType: 'Match', entityId: id, payload: data });

    io.to(`lobby:${id}`).emit('lobby:state', { matchId: id, startTime: updated.startTime });
    reply.send(updated);
  });

  // ───────── SELECT ZONES (Organizer+, adjacencyMap enforced) ─────────
  app.post('/api/matches/:id/zones', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ZonesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.match.update({
      where: { id },
      data: { selectedZones: { set: parsed.data.zoneIds.map((zid) => ({ id: zid })) } },
    });

    await logAudit({ actorId: req.user!.id, action: 'ZONES_SELECTED', entityType: 'Match', entityId: id, payload: { zoneIds: parsed.data.zoneIds } });

    io.to(`lobby:${id}`).emit('lobby:zones_selected', { matchId: id, zoneIds: parsed.data.zoneIds });
    reply.send({ zoneIds: parsed.data.zoneIds });
  });

  // ───────── ROLL FINAL ZONE (случайная) — выбор происходит на сервере, чтобы организатор
  // не мог заранее узнать результат или подменить его через devtools ─────────
  app.post('/api/matches/:id/roll-final-zone', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.findUnique({ where: { id }, include: { selectedZones: true } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!match.selectedZones.length) return reply.code(400).send({ error: 'NO_ZONES', message: 'Нет выбранных зон для финала' });

    const randomZone = match.selectedZones[Math.floor(Math.random() * match.selectedZones.length)];
    const durationMs = match.zoneEntrySeconds * 1000;
    const closesAt = await setFinalZoneWindow(id, durationMs);
    await scheduleFinalZoneClose(id, durationMs);

    await prisma.match.update({
      where: { id },
      data: { finalZoneId: randomZone.id, finalZoneOpenedAt: new Date(), finalZoneClosesAt: new Date(closesAt) },
    });

    await logAudit({ actorId: req.user!.id, action: 'FINAL_ZONE_SELECTED', entityType: 'Match', entityId: id, payload: { zoneId: randomZone.id, rolled: true } });
    io.to(`lobby:${id}`).emit('lobby:final_zone_selected', { matchId: id, zoneId: randomZone.id, closesAt });
    reply.send({ zoneId: randomZone.id, closesAt });
  });

  // ───────── SELECT FINAL ZONE — triggers 2-min window + sound notifications ─────────
  app.post('/api/matches/:id/final-zone', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = FinalZoneSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const match = await prisma.match.findUnique({ where: { id }, include: { selectedZones: true } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });

    const selectedIds = match.selectedZones.map((z) => z.id);
    const validation = await validateFinalZone(match.mapId, selectedIds, parsed.data.zoneId);
    if (!validation.valid) {
      return reply.code(400).send({ error: 'INVALID_FINAL_ZONE', message: validation.reason });
    }

    const durationMs = match.zoneEntrySeconds * 1000;
    const closesAt = await setFinalZoneWindow(id, durationMs);
    await scheduleFinalZoneClose(id, durationMs);

    await prisma.match.update({
      where: { id },
      data: {
        finalZoneId: parsed.data.zoneId,
        finalZoneOpenedAt: new Date(),
        finalZoneClosesAt: new Date(closesAt),
      },
    });

    await logAudit({ actorId: req.user!.id, action: 'FINAL_ZONE_SELECTED', entityType: 'Match', entityId: id, payload: { zoneId: parsed.data.zoneId } });

    // Серверное состояние — клиент проигрывает звук по этому событию
    io.to(`lobby:${id}`).emit('lobby:final_zone_selected', { matchId: id, zoneId: parsed.data.zoneId, closesAt });
    reply.send({ zoneId: parsed.data.zoneId, closesAt });
  });

  // ───────── START (manual, Organizer+) — запускает матч и открывает окно входа в зону.
  // Длительность окна — match.zoneEntrySeconds (по умолчанию 120с), можно передать custom
  // значение в теле запроса, чтобы изменить его на будущее для этого матча.
  const StartSchema = z.object({ zoneEntrySeconds: z.number().int().min(10).max(900).optional() });
  app.post('/api/matches/:id/start', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = StartSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const existing = await prisma.match.findUnique({ where: { id }, select: { zoneEntrySeconds: true, status: true } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (existing.status === 'LIVE' || existing.status === 'PAUSED') {
      return reply.code(409).send({ error: 'ALREADY_LIVE', message: 'Матч уже идёт' });
    }
    if (existing.status === 'FINISHED') {
      return reply.code(409).send({ error: 'ALREADY_FINISHED', message: 'Матч уже завершён' });
    }

    const zoneEntrySeconds = parsed.data.zoneEntrySeconds ?? existing.zoneEntrySeconds;
    const durationMs = zoneEntrySeconds * 1000;

    const closesAt = await setStartZoneWindow(id, durationMs);
    await scheduleStartZoneClose(id, durationMs);

    const match = await prisma.match.update({
      where: { id },
      data: { status: 'LIVE', startZoneOpenedAt: new Date(), startZoneClosesAt: new Date(closesAt), zoneEntrySeconds },
    });
    await prisma.lobby.update({ where: { matchId: id }, data: { state: 'IN_PROGRESS' } });

    await logAudit({ actorId: req.user!.id, action: 'MATCH_STARTED_MANUAL', entityType: 'Match', entityId: id, payload: { zoneEntrySeconds } });

    // Серверное состояние — клиент проигрывает звук и показывает таймер на заход
    io.to(`lobby:${id}`).emit('match:started', { matchId: id, closesAt });
    reply.send(match);
  });

  // ───────── EXTEND ZONE WINDOW (Organizer+) — добавляет секунды к текущему открытому окну ─────────
  const ExtendSchema = z.object({ additionalSeconds: z.number().int().min(10).max(3600) });
  app.post('/api/matches/:id/extend-zone', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ExtendSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (match.status !== 'LIVE') return reply.code(409).send({ error: 'NOT_LIVE', message: 'Матч не идёт' });

    const addMs = parsed.data.additionalSeconds * 1000;
    const isFinalZone = !!match.finalZoneOpenedAt;

    let closesAt: number;
    if (isFinalZone) {
      const current = match.finalZoneClosesAt ? Math.max(match.finalZoneClosesAt.getTime(), Date.now()) : Date.now();
      closesAt = await setFinalZoneWindow(id, current + addMs - Date.now());
      await scheduleFinalZoneClose(id, closesAt - Date.now());
      await prisma.match.update({ where: { id }, data: { finalZoneClosesAt: new Date(closesAt) } });
      io.to(`lobby:${id}`).emit('lobby:final_zone_extended', { matchId: id, closesAt });
    } else {
      const current = match.startZoneClosesAt ? Math.max(match.startZoneClosesAt.getTime(), Date.now()) : Date.now();
      closesAt = await setStartZoneWindow(id, current + addMs - Date.now());
      await scheduleStartZoneClose(id, closesAt - Date.now());
      await prisma.match.update({ where: { id }, data: { startZoneClosesAt: new Date(closesAt) } });
      io.to(`lobby:${id}`).emit('lobby:start_zone_extended', { matchId: id, closesAt });
    }

    await logAudit({ actorId: req.user!.id, action: 'ZONE_TIME_EXTENDED', entityType: 'Match', entityId: id, payload: { additionalSeconds: parsed.data.additionalSeconds, isFinalZone } });
    reply.send({ closesAt });
  });

  // ───────── PAUSE (Organizer+) — замораживает отсчёт текущего окна на заход в зону ─────────
  app.post('/api/matches/:id/pause', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (match.status !== 'LIVE') {
      return reply.code(400).send({ error: 'NOT_LIVE', message: 'Матч можно поставить на паузу только во время игры' });
    }

    // Финальная зона приоритетнее, если уже была открыта — иначе ставим на паузу стартовое окно.
    const kind: 'finalzone' | 'startzone' = match.finalZoneOpenedAt ? 'finalzone' : 'startzone';
    const remainingMs = await getRemainingMs(kind, id);

    await cancelScheduledJobs(id);
    await prisma.match.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date(), remainingZoneSeconds: remainingMs !== null ? Math.ceil(remainingMs / 1000) : null },
    });

    await logAudit({ actorId: req.user!.id, action: 'MATCH_PAUSED', entityType: 'Match', entityId: id });
    io.to(`lobby:${id}`).emit('match:paused', { matchId: id });
    reply.send({ success: true });
  });

  // ───────── RESUME (Organizer+) — снимает паузу, пересчитывает таймер от текущего момента ─────────
  app.post('/api/matches/:id/resume', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (match.status !== 'PAUSED') {
      return reply.code(400).send({ error: 'NOT_PAUSED', message: 'Матч не на паузе' });
    }

    const remainingMs = (match.remainingZoneSeconds ?? 0) * 1000;
    const isFinalZoneWindow = !!match.finalZoneOpenedAt;

    let closesAt: number | null = null;
    if (remainingMs > 0) {
      if (isFinalZoneWindow) {
        closesAt = await setFinalZoneWindow(id, remainingMs);
        await scheduleFinalZoneClose(id, remainingMs);
        await prisma.match.update({ where: { id }, data: { finalZoneClosesAt: new Date(closesAt) } });
      } else {
        closesAt = await setStartZoneWindow(id, remainingMs);
        await scheduleStartZoneClose(id, remainingMs);
        await prisma.match.update({ where: { id }, data: { startZoneClosesAt: new Date(closesAt) } });
      }
    }

    await prisma.match.update({ where: { id }, data: { status: 'LIVE', pausedAt: null, remainingZoneSeconds: null } });

    await logAudit({ actorId: req.user!.id, action: 'MATCH_RESUMED', entityType: 'Match', entityId: id });
    io.to(`lobby:${id}`).emit('match:resumed', { matchId: id, closesAt });
    reply.send({ success: true, closesAt });
  });

  // ───────── CHANGE ZONES MID-MATCH (Organizer+) — позволяет скорректировать набор зон,
  // даже когда матч уже идёт (например, если организатор передумал или была ошибка) ─────────
  const ChangeZonesSchema = z.object({ zoneIds: z.array(z.string().uuid()).min(1) });
  app.patch('/api/matches/:id/zones-live', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ChangeZonesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.match.update({ where: { id }, data: { selectedZones: { set: parsed.data.zoneIds.map((zid) => ({ id: zid })) } } });
    await logAudit({ actorId: req.user!.id, action: 'ZONES_CHANGED_LIVE', entityType: 'Match', entityId: id, payload: { zoneIds: parsed.data.zoneIds } });

    io.to(`lobby:${id}`).emit('lobby:zones_selected', { matchId: id, zoneIds: parsed.data.zoneIds });
    reply.send({ success: true, zoneIds: parsed.data.zoneIds });
  });

  // ───────── FINISH — records win for all team members, updates achievements ─────────
  app.post('/api/matches/:id/finish', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = FinishSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const matchWithLobby = await prisma.match.findUnique({ where: { id }, include: { lobby: true } });
    if (!matchWithLobby?.lobby) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Матч или лобби не найдены' });
    if (matchWithLobby.status === 'FINISHED') {
      return reply.code(409).send({ error: 'ALREADY_FINISHED', message: 'Матч уже завершён' });
    }

    const team = await prisma.team.findUnique({
      where: { id: parsed.data.winnerTeamId },
      include: { members: { include: { user: true } }, lobby: true },
    });
    if (!team) return reply.code(404).send({ error: 'TEAM_NOT_FOUND' });

    // Команда обязательно должна принадлежать лобби именно этого матча — иначе можно было бы
    // указать команду из чужого матча и записать победу не тем людям.
    if (team.lobbyId !== matchWithLobby.lobby.id) {
      return reply.code(400).send({ error: 'TEAM_NOT_IN_MATCH', message: 'Эта команда не принадлежит данному матчу' });
    }

    const match = await prisma.match.update({
      where: { id },
      data: { status: 'FINISHED', finishedAt: new Date(), winnerTeamId: team.id },
    });
    await prisma.lobby.update({ where: { matchId: id }, data: { state: 'FINISHED' } });
    await clearMatchTimers(id);
    await cancelScheduledJobs(id);

    // Победа всем участникам команды + достижение
    await prisma.$transaction(
      team.members.flatMap((m) => [
        prisma.win.create({ data: { userId: m.userId, matchId: id, teamId: team.id } }),
        prisma.achievement.create({
          data: { userId: m.userId, type: 'MATCH_WIN', title: `Победа в Weekly Pracs` },
        }),
      ])
    );

    await logAudit({ actorId: req.user!.id, action: 'MATCH_FINISHED', entityType: 'Match', entityId: id, payload: { winnerTeamId: team.id } });

    io.to(`lobby:${id}`).emit('match:finished', { matchId: id, winnerTeamId: team.id });
    for (const m of team.members) {
      io.to(`user:${m.userId}`).emit('notify:win', { matchId: id });
      await prisma.notification.create({ data: { userId: m.userId, type: 'notify:win', payload: { matchId: id } } });
    }

    reply.send(match);
  });

  // ───────── DELETE (Organizer+) ─────────
  app.delete('/api/matches/:id', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Матч не найден' });

    await clearMatchTimers(id);
    await cancelScheduledJobs(id);
    await prisma.match.delete({ where: { id } }); // Lobby/Team/LobbyMember/Win удаляются каскадно через onDelete: Cascade

    await logAudit({ actorId: req.user!.id, action: 'MATCH_DELETED', entityType: 'Match', entityId: id, payload: { mapId: match.mapId, mode: match.mode } });

    io.to(`lobby:${id}`).emit('match:deleted', { matchId: id });
    reply.send({ success: true });
  });
}
