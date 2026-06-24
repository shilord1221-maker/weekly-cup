import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@/utils/jwt.js';
import { prisma } from '@/db.js';
import type { Role } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      role: Role;
      username: string;
    };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.access_token;

  if (!token) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
  }

  try {
    const payload = verifyAccessToken(token);

    // Роль и бан-статус берём из БД, а не из самого JWT — иначе при повышении до
    // Organizer/Admin/Owner пользователь продолжал бы получать 403 до тех пор,
    // пока не разлогинится и не зайдёт заново (старый токен ещё несёт прежнюю роль).
    const dbUser = await prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, isBanned: true, bannedReason: true } });
    if (!dbUser) {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Пользователь не найден' });
    }
    if (dbUser.isBanned) {
      return reply.code(403).send({ error: 'BANNED', message: dbUser.bannedReason ? `Вы заблокированы: ${dbUser.bannedReason}` : 'Ваш аккаунт заблокирован' });
    }

    req.user = { id: payload.sub, role: dbUser.role, username: payload.username };
  } catch {
    return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Токен недействителен или истёк' });
  }
}

// Иерархия ролей: OWNER выше ADMIN, ADMIN выше ORGANIZER, ORGANIZER выше PLAYER.
// requireRole('ADMIN') должен пропускать и OWNER — это не отдельная ветка прав, а более высокий уровень той же иерархии.
const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  ORGANIZER: 1,
  PLAYER: 0,
};

function hasAtLeastRole(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    }
    // OWNER проходит любую проверку ролей — он стоит выше всех в иерархии.
    if (req.user.role === 'OWNER') return;
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Недостаточно прав' });
    }
  };
}

// Роль ADMIN и OWNER всегда проходят проверку ORGANIZER (иерархия прав)
export function requireOrganizerOrAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    }
    if (!hasAtLeastRole(req.user.role, 'ORGANIZER')) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Требуется роль Organizer, Admin или Owner' });
    }
  };
}

// Только OWNER — управление администраторами, настройки системы
export function requireOwner() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    }
    if (req.user.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Требуется роль Owner' });
    }
  };
}
