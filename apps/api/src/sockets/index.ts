import type { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '@/utils/jwt.js';
import { prisma } from '@/db.js';

interface AuthedSocket extends Socket {
  data: {
    userId?: string;
    username?: string;
    role?: string;
  };
}

export function registerSocketHandlers(io: SocketServer) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Разрешаем анонимное подключение только для чтения публичных событий (напр. лента побед)
      return next();
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    // ───────── USER NOTIFICATIONS ROOM ─────────
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
    }

    // ───────── LOBBY ROOM ─────────
    socket.on('lobby:subscribe', async ({ matchId }: { matchId: string }) => {
      socket.join(`lobby:${matchId}`);
      const lobby = await prisma.lobby.findUnique({
        where: { matchId },
        include: { teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } } } }, match: true },
      });
      if (lobby) {
        const unassignedMembers = await prisma.lobbyMember.findMany({
          where: { lobbyId: lobby.id, teamId: null },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        });
        socket.emit('lobby:state', { ...lobby, unassignedMembers });
      } else {
        socket.emit('lobby:state', lobby);
      }
    });

    socket.on('lobby:unsubscribe', ({ matchId }: { matchId: string }) => {
      socket.leave(`lobby:${matchId}`);
    });

    // ───────── GLOBAL CHAT ─────────
    socket.on('chat:join', async () => {
      socket.join('chat:global');
      const history = await prisma.chatMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      });
      socket.emit('chat:history', history.reverse());
    });

    socket.on('chat:send', async ({ text }: { text: string }) => {
      if (!socket.data.userId) {
        return socket.emit('chat:error', { message: 'Войдите, чтобы писать в чат' });
      }
      const trimmed = text?.trim().slice(0, 500);
      if (!trimmed) return;

      const message = await prisma.chatMessage.create({
        data: { authorId: socket.data.userId, text: trimmed },
        include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      });

      io.to('chat:global').emit('chat:message', message);
    });

    socket.on('disconnect', () => {
      // no-op; socket.io снимает все room-подписки автоматически
    });
  });
}
