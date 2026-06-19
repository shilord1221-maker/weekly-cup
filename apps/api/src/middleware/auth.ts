import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@/utils/jwt.js';
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
    req.user = { id: payload.sub, role: payload.role, username: payload.username };
  } catch {
    return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Токен недействителен или истёк' });
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    }
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Недостаточно прав' });
    }
  };
}

// Роль ADMIN всегда проходит проверку ORGANIZER (иерархия прав)
export function requireOrganizerOrAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Требуется авторизация' });
    }
    if (req.user.role !== 'ORGANIZER' && req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Требуется роль Organizer или Admin' });
    }
  };
}
