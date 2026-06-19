import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin } from '@/middleware/auth.js';
import { validateZoneSelection, validateFinalZone } from '@/services/zones.js';
import { teamCountForMode } from '@/services/lobby.js';
import { logAudit } from '@/services/audit.js';
import { scheduleMatchStart, scheduleMatchReminder, scheduleFinalZoneClose, cancelScheduledJobs } from '@/jobs/matchQueue.js';
import { setMatchStartTimer, setFinalZoneWindow, clearMatchTimers } from '@/services/timers.js';
import type { Server as SocketServer } from 'socket.io';

const CreateMatchSchema = z.object({
  mapId: z.string().uuid(),
  mode: z.enum(['MODE_2X2', 'MODE_3X3', 'MODE_4X4', 'MODE_5X5']),
  startTime: z.string().datetime(), // ISO UTC string from client
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
        lobby: { include: { teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } } } } } },
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
    const { mapId, mode, startTime } = parsed.data;

    const map = await prisma.gameMap.findUnique({ where: { id: mapId } });
    if (!map) return reply.code(404).send({ error: 'MAP_NOT_FOUND', message: 'Карта не найдена' });

    const teamCount = teamCountForMode(mode);

    const match = await prisma.match.create({
      data: {
        mapId,
        mode,
        startTime: new Date(startTime),
        organizerId: req.user!.id,
        status: 'SCHEDULED',
        lobby: {
          create: {
            state: 'OPEN',
            teams: {
              create: Array.from({ length: teamCount }, (_, i) => ({
                name: `Team ${i + 1}`,
                slot: i + 1,
              })),
            },
          },
        },
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

    const validation = await validateZoneSelection(match.mapId, parsed.data.zoneIds);
    if (!validation.valid) {
      return reply.code(400).send({ error: 'INVALID_ZONE_SELECTION', message: validation.reason });
    }

    await prisma.match.update({
      where: { id },
      data: { selectedZones: { set: parsed.data.zoneIds.map((zid) => ({ id: zid })) } },
    });

    await logAudit({ actorId: req.user!.id, action: 'ZONES_SELECTED', entityType: 'Match', entityId: id, payload: { zoneIds: parsed.data.zoneIds } });

    io.to(`lobby:${id}`).emit('lobby:zones_selected', { matchId: id, zoneIds: parsed.data.zoneIds });
    reply.send({ zoneIds: parsed.data.zoneIds });
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

    const closesAt = await setFinalZoneWindow(id, 120_000);
    await scheduleFinalZoneClose(id, 120_000);

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

  // ───────── START (manual override, Organizer+) ─────────
  app.post('/api/matches/:id/start', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const match = await prisma.match.update({ where: { id }, data: { status: 'LIVE' } });
    await prisma.lobby.update({ where: { matchId: id }, data: { state: 'IN_PROGRESS' } });

    await logAudit({ actorId: req.user!.id, action: 'MATCH_STARTED_MANUAL', entityType: 'Match', entityId: id });

    io.to(`lobby:${id}`).emit('match:started', { matchId: id });
    reply.send(match);
  });

  // ───────── FINISH — records win for all team members, updates achievements ─────────
  app.post('/api/matches/:id/finish', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = FinishSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const team = await prisma.team.findUnique({
      where: { id: parsed.data.winnerTeamId },
      include: { members: { include: { user: true } }, lobby: true },
    });
    if (!team) return reply.code(404).send({ error: 'TEAM_NOT_FOUND' });

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
          data: { userId: m.userId, type: 'MATCH_WIN', title: `Победа в Weekly Cup` },
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
}
