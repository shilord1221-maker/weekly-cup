import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin, requireRole } from '@/middleware/auth.js';
import { joinLobby, leaveLobby, setPlayerTeam, autoAssignPlayers, ApiError } from '@/services/lobby.js';
import { logAudit } from '@/services/audit.js';
import { checkDiscordGate } from '@/services/discordGate.js';
import { syncVoiceRole, syncTeamVoiceRoleForUser } from '@/services/discordBot.js';
import type { Server as SocketServer } from 'socket.io';

function handleApiError(reply: any, e: unknown) {
  if (e instanceof ApiError) {
    return reply.code(e.statusCode).send({ error: e.code, message: e.message });
  }
  throw e;
}

export async function lobbyRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  // ───────── GET LOBBY STATE ─────────
  // Авторизация не обязательна для просмотра — гость должен видеть карту/зоны/составы до входа.
  app.get('/api/lobby/:matchId', async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const lobby = await prisma.lobby.findUnique({
      where: { matchId },
      include: {
        match: {
          include: {
            map: { include: { zones: true } },
            selectedZones: true,
            finalZone: true,
            winnerTeam: true,
          },
        },
        teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true, staticId: { select: { value: true } } } } } } }, orderBy: { slot: 'asc' } },
      },
    });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Лобби не найдено' });

    // Игроки, вошедшие в лобби, но ещё не выбравшие команду — иначе их не видно ни в одном team.members,
    // и фронт ошибочно считает, что они "не в лобби", хотя запись уже существует.
    const unassignedMembers = await prisma.lobbyMember.findMany({
      where: { lobbyId: lobby.id, teamId: null },
      include: { user: { select: { id: true, username: true, avatarUrl: true, staticId: { select: { value: true } } } } },
    });

    reply.send({ ...lobby, unassignedMembers });
  });

  // ───────── JOIN ─────────
  app.post('/api/lobby/:matchId/join', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Discord обязателен для участия — проверяется заново на каждый вход, не из кэша/БД (п.10–11)
    const gate = await checkDiscordGate(req.user!.id);
    if (!gate.ok) return reply.code(403).send({ error: gate.code, message: gate.message });

    try {
      await joinLobby(lobby.id, req.user!.id);
    } catch (e) {
      return handleApiError(reply, e);
    }

    io.to(`lobby:${matchId}`).emit('lobby:player_joined', { matchId, userId: req.user!.id, username: req.user!.username });
    reply.send({ success: true });
  });

  // ───────── LEAVE ─────────
  app.post('/api/lobby/:matchId/leave', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    await leaveLobby(lobby.id, req.user!.id);

    // Покинул лобби — снимаем все Voice-роли (п.5)
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { discordId: true } });
    if (user?.discordId) {
      await syncVoiceRole(user.discordId, null).catch((err) => console.error('[discord] leave role sync failed:', err));
      await prisma.user.update({ where: { id: req.user!.id }, data: { discordCurrentVoiceRole: null } }).catch(() => {});
    }

    io.to(`lobby:${matchId}`).emit('lobby:player_left', { matchId, userId: req.user!.id });
    reply.send({ success: true });
  });

  // ───────── CHOOSE / CHANGE TEAM ─────────
  const TeamSchema = z.object({ teamId: z.string().uuid() });
  app.patch('/api/lobby/:matchId/team', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = TeamSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId }, include: { match: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Discord проверяется заново перед каждой сменой команды (п.11), не только при входе в лобби
    const gate = await checkDiscordGate(req.user!.id);
    if (!gate.ok) return reply.code(403).send({ error: gate.code, message: gate.message });

    const targetTeam = await prisma.team.findUnique({ where: { id: parsed.data.teamId } });
    if (!targetTeam || targetTeam.lobbyId !== lobby.id) {
      return reply.code(400).send({ error: 'TEAM_NOT_IN_LOBBY', message: 'Эта команда не принадлежит данному лобби' });
    }

    let member;
    try {
      member = await setPlayerTeam(lobby.id, req.user!.id, parsed.data.teamId);
    } catch (e) {
      return handleApiError(reply, e);
    }

    // Синхронизация Voice-роли: снять все старые, выдать ровно одну новую (п.4/п.14)
    if (gate.discordId) {
      const syncResult = await syncTeamVoiceRoleForUser(req.user!.id, gate.discordId, lobby.match.mode, targetTeam.slot);
      if (!syncResult.ok) {
        req.log.warn({ reason: syncResult.reason, userId: req.user!.id }, '[discord] Voice role sync failed on team change');
      }
    }

    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: req.user!.id, teamId: parsed.data.teamId });
    reply.send(member);
  });

  // ───────── READY TOGGLE ("Мы готовы") ─────────
  const ReadySchema = z.object({ teamId: z.string().uuid(), ready: z.boolean() });
  app.post('/api/lobby/:matchId/ready', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = ReadySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    // Только участник команды может переключать готовность своей команды
    const membership = await prisma.lobbyMember.findFirst({
      where: { teamId: parsed.data.teamId, userId: req.user!.id },
    });
    if (!membership) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Вы не состоите в этой команде' });
    }

    const team = await prisma.team.update({ where: { id: parsed.data.teamId }, data: { isReady: parsed.data.ready } });

    io.to(`lobby:${matchId}`).emit('lobby:ready_changed', { matchId, teamId: team.id, ready: team.isReady });
    reply.send(team);
  });

  // ───────── AUTO-ASSIGN (Organizer+) — "Авто-раскидать" ─────────
  app.post('/api/lobby/:matchId/auto-assign', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const result = await autoAssignPlayers(lobby.id);
    await logAudit({ actorId: req.user!.id, action: 'AUTO_ASSIGN', entityType: 'Lobby', entityId: lobby.id });

    // Синхронизируем Voice-роли для всех, кто получил команду через авто-распределение (п.3/п.4)
    if (result) {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (match) {
        for (const team of result.teams) {
          for (const member of team.members) {
            if (member.user.discordId) {
              await syncTeamVoiceRoleForUser(member.userId, member.user.discordId, match.mode, team.slot).catch((err) =>
                req.log.warn({ err, userId: member.userId }, '[discord] auto-assign role sync failed')
              );
            }
          }
        }
      }
    }

    io.to(`lobby:${matchId}`).emit('lobby:auto_assigned', { matchId, lobby: result });
    reply.send(result);
  });

  // ───────── MOVE PLAYER (Organizer+) ─────────
  const MoveSchema = z.object({ userId: z.string().uuid(), teamId: z.string().uuid().nullable() });
  app.patch('/api/lobby/:matchId/move-player', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = MoveSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    // teamId должен принадлежать именно этому лобби — иначе игрока можно перенести
    // в команду совершенно другого матча.
    if (parsed.data.teamId) {
      const team = await prisma.team.findUnique({ where: { id: parsed.data.teamId } });
      if (!team || team.lobbyId !== lobby.id) {
        return reply.code(400).send({ error: 'TEAM_NOT_IN_LOBBY', message: 'Эта команда не принадлежит данному лобби' });
      }
    }

    const updated = await prisma.lobbyMember.update({
      where: { lobbyId_userId: { lobbyId: lobby.id, userId: parsed.data.userId } },
      data: { teamId: parsed.data.teamId },
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'PLAYER_MOVED',
      entityType: 'Lobby',
      entityId: lobby.id,
      payload: { userId: parsed.data.userId, teamId: parsed.data.teamId },
    });

    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: parsed.data.userId, teamId: parsed.data.teamId });
    reply.send(updated);
  });

  // ───────── KICK FROM TEAM (только Admin/Owner) — убирает игрока из команды, оставляя в лобби без команды ─────────
  const KickSchema = z.object({ userId: z.string().uuid() });
  app.post('/api/lobby/:matchId/kick', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = KickSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const member = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId: lobby.id, userId: parsed.data.userId } } });
    if (!member) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Игрок не найден в этом лобби' });

    await prisma.lobbyMember.update({ where: { id: member.id }, data: { teamId: null } });

    // Кикнут из команды — снимаем Voice-роль (п.5)
    const kickedUser = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { discordId: true } });
    if (kickedUser?.discordId) {
      await syncVoiceRole(kickedUser.discordId, null).catch((err) => req.log.warn({ err }, '[discord] kick role removal failed'));
      await prisma.user.update({ where: { id: parsed.data.userId }, data: { discordCurrentVoiceRole: null } }).catch(() => {});
    }

    await logAudit({
      actorId: req.user!.id,
      action: 'PLAYER_KICKED',
      entityType: 'Lobby',
      entityId: lobby.id,
      payload: { userId: parsed.data.userId },
    });

    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: parsed.data.userId, teamId: null });
    io.to(`user:${parsed.data.userId}`).emit('notify:kicked', { matchId });
    reply.send({ success: true });
  });

  // ───────── SET VOICE URL (Organizer+) — Discord invite per team ─────────
  const VoiceSchema = z.object({ voiceUrl: z.string().url() });
  app.patch('/api/lobby/:matchId/voice-url/:teamId', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { matchId, teamId } = req.params as { matchId: string; teamId: string };
    const parsed = VoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Укажите корректную ссылку на Discord' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Команда должна принадлежать именно этому лобби — иначе можно было бы менять voice-ссылку
    // произвольной команды другого матча, подобрав/угадав её id.
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.lobbyId !== lobby.id) {
      return reply.code(404).send({ error: 'TEAM_NOT_FOUND', message: 'Команда не найдена в этом лобби' });
    }

    const updated = await prisma.team.update({ where: { id: teamId }, data: { voiceUrl: parsed.data.voiceUrl } });
    reply.send(updated);
  });
}
