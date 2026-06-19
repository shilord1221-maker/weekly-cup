import { prisma } from '@/db.js';
import type { MatchMode } from '@prisma/client';

export function teamCapacityForMode(mode: MatchMode): number {
  switch (mode) {
    case 'MODE_2X2':
      return 2;
    case 'MODE_3X3':
      return 3;
    case 'MODE_4X4':
      return 4;
    case 'MODE_5X5':
      return 5;
  }
}

export function teamCountForMode(mode: MatchMode): number {
  // По умолчанию 4 команды в лобби; организатор может изменить позже через ручное управление.
  return 4;
}

/**
 * Игрок присоединяется к лобби. Без команды — просто участник лобби (зрительская зона/очередь).
 * Гарантии:
 * - один пользователь не может быть в лобби дважды (unique [lobbyId, userId])
 * - один пользователь не может быть одновременно в двух LIVE/IN_PROGRESS матчах
 */
export async function joinLobby(lobbyId: string, userId: string) {
  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId }, include: { match: true } });
  if (!lobby) throw new ApiError('LOBBY_NOT_FOUND', 'Лобби не найдено', 404);
  if (lobby.state === 'FINISHED' || lobby.state === 'CANCELLED') {
    throw new ApiError('LOBBY_CLOSED', 'Лобби закрыто', 400);
  }

  const activeElsewhere = await prisma.lobbyMember.findFirst({
    where: {
      userId,
      lobbyId: { not: lobbyId },
      lobby: { is: { state: { in: ['OPEN', 'READY', 'IN_PROGRESS'] } } },
    },
  });
  if (activeElsewhere) {
    throw new ApiError('ALREADY_IN_ANOTHER_LOBBY', 'Вы уже участвуете в другом активном лобби', 409);
  }

  const existing = await prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } });
  if (existing) return existing;

  return prisma.lobbyMember.create({ data: { lobbyId, userId } });
}

export async function leaveLobby(lobbyId: string, userId: string) {
  await prisma.lobbyMember.deleteMany({ where: { lobbyId, userId } });
}

/**
 * Выбор/смена команды игроком. Запрещает:
 * - переполненные команды (capacity по режиму матча)
 * - дублирование/участие в нескольких командах одновременно (upsert по lobbyId+userId гарантирует одну запись)
 */
export async function setPlayerTeam(lobbyId: string, userId: string, teamId: string) {
  const [lobby, team, member] = await Promise.all([
    prisma.lobby.findUnique({ where: { id: lobbyId }, include: { match: true } }),
    prisma.team.findUnique({ where: { id: teamId }, include: { members: true } }),
    prisma.lobbyMember.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } }),
  ]);

  if (!lobby || !team || team.lobbyId !== lobbyId) {
    throw new ApiError('NOT_FOUND', 'Лобби или команда не найдены', 404);
  }
  if (!member) {
    throw new ApiError('NOT_IN_LOBBY', 'Сначала войдите в лобби', 400);
  }

  const capacity = teamCapacityForMode(lobby.match.mode);
  const currentSize = team.members.filter((m) => m.userId !== userId).length;
  if (currentSize >= capacity) {
    throw new ApiError('TEAM_FULL', `Команда заполнена (максимум ${capacity} игроков)`, 409);
  }

  return prisma.lobbyMember.update({
    where: { lobbyId_userId: { lobbyId, userId } },
    data: { teamId },
  });
}

/**
 * Авто-распределение игроков без команды по доступным слотам, равномерно.
 */
export async function autoAssignPlayers(lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { match: true, teams: { include: { members: true } } },
  });
  if (!lobby) throw new ApiError('LOBBY_NOT_FOUND', 'Лобби не найдено', 404);

  const capacity = teamCapacityForMode(lobby.match.mode);
  const unassigned = await prisma.lobbyMember.findMany({ where: { lobbyId, teamId: null } });

  // Сортируем команды по текущему заполнению (по возрастанию) для равномерного распределения
  const teamsState = lobby.teams.map((t) => ({ id: t.id, count: t.members.length }));

  for (const member of unassigned) {
    teamsState.sort((a, b) => a.count - b.count);
    const target = teamsState.find((t) => t.count < capacity);
    if (!target) break; // все команды заполнены
    await prisma.lobbyMember.update({ where: { id: member.id }, data: { teamId: target.id } });
    target.count++;
  }

  return prisma.lobby.findUnique({ where: { id: lobbyId }, include: { teams: { include: { members: { include: { user: true } } } } } });
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
