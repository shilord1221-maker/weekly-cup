import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin, requireRole } from '@/middleware/auth.js';
import { joinLobby, leaveLobby, setPlayerTeam, autoAssignPlayers, ApiError, MODE_TEAM_LIMITS } from '@/services/lobby.js';
import { logAudit } from '@/services/audit.js';
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
        teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true, activeUsernameEffect: true, staticId: { select: { value: true } }, stackMembership: { select: { stack: { select: { id: true, name: true, tag: true, tagColor: true, logoUrl: true } } } } } } } } }, orderBy: { slot: 'asc' } },
      },
    });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Лобби не найдено' });

    // Игроки, вошедшие в лобби, но ещё не выбравшие команду — иначе их не видно ни в одном team.members,
    // и фронт ошибочно считает, что они "не в лобби", хотя запись уже существует.
    const unassignedMembers = await prisma.lobbyMember.findMany({
      where: { lobbyId: lobby.id, teamId: null },
      include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true, activeUsernameEffect: true, staticId: { select: { value: true } }, stackMembership: { select: { stack: { select: { id: true, name: true, tag: true, tagColor: true, logoUrl: true } } } } } } },
    });

    reply.send({ ...lobby, unassignedMembers });
  });

  // ───────── JOIN ─────────
  // Динамический ID — личный номер игрока на сервере в этой сессии, обязателен при входе в лобби.
  const JoinSchema = z.object({ dynamicId: z.string().regex(/^\d{1,8}$/, 'Динамический ID должен состоять из 1–8 цифр') });
  app.post('/api/lobby/:matchId/join', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = JoinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Укажите корректный динамический ID' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    try {
      await joinLobby(lobby.id, req.user!.id, parsed.data.dynamicId);
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

    io.to(`lobby:${matchId}`).emit('lobby:player_left', { matchId, userId: req.user!.id });
    reply.send({ success: true });
  });

  // ───────── CREATE TEAM (любой игрок, уже состоящий в лобби) — создаёт команду со своим
  // названием и автоматически становится её капитаном и первым участником ─────────
  const CreateTeamSchema = z.object({
    name: z
      .string()
      .min(1, 'Укажите название команды')
      .max(64, 'Название слишком длинное')
      .regex(/^[\p{L}0-9 _\-]+$/u, 'Название может содержать буквы, цифры, пробел, дефис и подчёркивание'),
  });
  app.post('/api/lobby/:matchId/teams', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = CreateTeamSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Некорректное название' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId }, include: { match: true, teams: true } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Игрок должен сначала войти в лобби, прежде чем создавать команду
    const membership = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId: lobby.id, userId: req.user!.id } } });
    if (!membership) {
      return reply.code(403).send({ error: 'NOT_IN_LOBBY', message: 'Сначала войдите в лобби' });
    }
    if (membership.teamId) {
      return reply.code(400).send({ error: 'ALREADY_IN_TEAM', message: 'Вы уже состоите в команде — выйдите из неё, чтобы создать новую' });
    }

    const limit = MODE_TEAM_LIMITS[lobby.match.mode];

    let team: Awaited<ReturnType<typeof prisma.team.create>>;
    try {
      team = await prisma.$transaction(async (tx) => {
        const currentTeams = await tx.team.findMany({ where: { lobbyId: lobby.id } });
        if (currentTeams.length >= limit) {
          throw Object.assign(new Error(`Достигнут лимит команд для этого режима (${limit})`), { code: 'TEAM_LIMIT_REACHED', status: 409 });
        }
        if (currentTeams.some((t) => t.name.toLowerCase() === parsed.data.name.toLowerCase())) {
          throw Object.assign(new Error('Команда с таким названием уже есть в этом лобби'), { code: 'TEAM_NAME_TAKEN', status: 409 });
        }
        const created = await tx.team.create({
          data: { lobbyId: lobby.id, name: parsed.data.name, slot: currentTeams.length + 1, createdById: req.user!.id },
        });
        await tx.lobbyMember.update({ where: { id: membership.id }, data: { teamId: created.id } });
        return created;
      });
    } catch (e: any) {
      if (e?.code && e?.status) return reply.code(e.status).send({ error: e.code, message: e.message });
      throw e;
    }

    io.to(`lobby:${matchId}`).emit('lobby:team_created', { matchId, team });
    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: req.user!.id, teamId: team.id });
    reply.code(201).send(team);
  });

  // ───────── KICK FROM TEAM BY CAPTAIN — отдельно от админского кика, доступно создателю команды ─────────
  const CaptainKickSchema = z.object({ userId: z.string().uuid() });
  app.post('/api/lobby/:matchId/teams/:teamId/kick', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId, teamId } = req.params as { matchId: string; teamId: string };
    const parsed = CaptainKickSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Команда не найдена' });
    if (team.createdById !== req.user!.id) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Кикать может только создатель команды' });
    }
    if (parsed.data.userId === req.user!.id) {
      return reply.code(400).send({ error: 'CANNOT_KICK_SELF', message: 'Нельзя кикнуть самого себя — используйте выход из команды' });
    }

    const member = await prisma.lobbyMember.findFirst({ where: { teamId, userId: parsed.data.userId } });
    if (!member) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Этот игрок не состоит в команде' });

    await prisma.lobbyMember.update({ where: { id: member.id }, data: { teamId: null } });

    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: parsed.data.userId, teamId: null });
    io.to(`user:${parsed.data.userId}`).emit('notify:kicked', { matchId });
    reply.send({ success: true });
  });

  // ───────── DELETE TEAM (Organizer+) — удаляет команду целиком, участники остаются
  // в лобби без команды (не выкидываются из лобби) ─────────
  app.delete('/api/lobby/:matchId/teams/:teamId', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { matchId, teamId } = req.params as { matchId: string; teamId: string };

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.lobbyId !== lobby.id) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Команда не найдена в этом лобби' });
    }

    const affectedMembers = await prisma.lobbyMember.findMany({ where: { teamId }, select: { userId: true } });

    // Сначала освобождаем участников (teamId = null), затем удаляем саму команду —
    // иначе foreign key не даст удалить команду, пока на неё есть ссылки.
    await prisma.lobbyMember.updateMany({ where: { teamId }, data: { teamId: null } });
    await prisma.team.delete({ where: { id: teamId } });

    await logAudit({ actorId: req.user!.id, action: 'TEAM_DELETED', entityType: 'Team', entityId: teamId, payload: { name: team.name, matchId } });

    io.to(`lobby:${matchId}`).emit('lobby:team_deleted', { matchId, teamId });
    for (const member of affectedMembers) {
      io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: member.userId, teamId: null });
    }
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

    io.to(`lobby:${matchId}`).emit('lobby:team_changed', { matchId, userId: req.user!.id, teamId: parsed.data.teamId });
    reply.send(member);
  });

  // ───────── READY TOGGLE ("Мы готовы") ─────────
  const ReadySchema = z.object({ teamId: z.string().uuid(), ready: z.boolean() });
  app.post('/api/lobby/:matchId/ready', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = ReadySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    // Только капитан (создатель) команды может переключать готовность
    const teamCheck = await prisma.team.findUnique({ where: { id: parsed.data.teamId } });
    if (!teamCheck) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Команда не найдена' });
    if (teamCheck.createdById !== req.user!.id) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Только капитан команды может переключать готовность' });
    }

    const team = await prisma.team.update({ where: { id: parsed.data.teamId }, data: { isReady: parsed.data.ready } });

    io.to(`lobby:${matchId}`).emit('lobby:ready_changed', { matchId, teamId: team.id, ready: team.isReady });
    reply.send(team);
  });

  // ───────── ELIMINATED TOGGLE ("Мы умерли") — игрок отмечает себя выбывшим, организатор видит
  // живой счёт по команде/лобби в реальном времени ─────────
  const EliminatedSchema = z.object({ eliminated: z.boolean() });
  app.post('/api/lobby/:matchId/eliminated', { preHandler: requireAuth }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const parsed = EliminatedSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const member = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId: lobby.id, userId: req.user!.id } } });
    if (!member) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Вы не состоите в этом лобби' });

    const updated = await prisma.lobbyMember.update({ where: { id: member.id }, data: { isEliminated: parsed.data.eliminated } });

    io.to(`lobby:${matchId}`).emit('lobby:eliminated_changed', { matchId, userId: req.user!.id, eliminated: updated.isEliminated });
    reply.send({ success: true, eliminated: updated.isEliminated });
  });

  // ───────── AUTO-ASSIGN (Organizer+) — "Авто-раскидать" ─────────
  app.post('/api/lobby/:matchId/auto-assign', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const lobby = await prisma.lobby.findUnique({ where: { matchId } });
    if (!lobby) return reply.code(404).send({ error: 'NOT_FOUND' });

    const result = await autoAssignPlayers(lobby.id);
    await logAudit({ actorId: req.user!.id, action: 'AUTO_ASSIGN', entityType: 'Lobby', entityId: lobby.id });

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
}
