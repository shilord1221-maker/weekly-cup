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

/**
 * Простой троттлер на уровне socket — HTTP rate-limit (@fastify/rate-limit) не покрывает
 * WebSocket-события вообще, поэтому без этого любой клиент может слать chat:send/poll:vote
 * без всякого ограничения и забить базу данных запросами в обход HTTP-лимита.
 */
function createThrottle(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= maxPerWindow) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}

const canSendChat = createThrottle(10, 10_000); // 10 сообщений за 10 секунд
const canVote = createThrottle(15, 10_000);
const canSubscribeLobby = createThrottle(20, 10_000);
const canCreatePoll = createThrottle(5, 60_000);

export function registerSocketHandlers(io: SocketServer) {
  io.use(async (socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Разрешаем анонимное подключение только для чтения публичных событий (напр. лента побед)
      return next();
    }
    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, role: true, isBanned: true } });
      if (!user || user.isBanned) return next(new Error('FORBIDDEN'));
      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.role = user.role;
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
      const throttleKey = socket.data.userId ?? socket.id;
      if (!canSubscribeLobby(throttleKey)) return;

      socket.join(`lobby:${matchId}`);
      const lobby = await prisma.lobby.findUnique({
        where: { matchId },
        include: { teams: { include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true } } } } } }, match: true },
      });
      if (lobby) {
        const unassignedMembers = await prisma.lobbyMember.findMany({
          where: { lobbyId: lobby.id, teamId: null },
          include: { user: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true } } },
        });
        socket.emit('lobby:state', { ...lobby, unassignedMembers });
      } else {
        socket.emit('lobby:state', lobby);
      }
    });

    socket.on('lobby:unsubscribe', ({ matchId }: { matchId: string }) => {
      socket.leave(`lobby:${matchId}`);
    });

    // ───────── CHAT (общий, лобби-чат, и теперь чат команды — три уровня одной системы) ─────────
    // chatRoom: 'chat:global' / 'chat:lobby:<matchId>' / 'chat:team:<teamId>'
    function chatRoomFor(matchId?: string, teamId?: string) {
      if (teamId) return `chat:team:${teamId}`;
      if (matchId) return `chat:lobby:${matchId}`;
      return 'chat:global';
    }
    function chatHistoryEventFor(matchId?: string, teamId?: string) {
      if (teamId) return 'teamChat:history';
      return matchId ? 'lobbyChat:history' : 'chat:history';
    }
    function chatMessageEventFor(matchId?: string, teamId?: string) {
      if (teamId) return 'teamChat:message';
      return matchId ? 'lobbyChat:message' : 'chat:message';
    }
    function chatDeletedEventFor(matchId?: string, teamId?: string) {
      if (teamId) return 'teamChat:message_deleted';
      return matchId ? 'lobbyChat:message_deleted' : 'chat:message_deleted';
    }

    /** Чат команды видят только её реальные участники — проверяем перед join/send/delete. */
    async function isTeamMember(userId: string | undefined, teamId: string): Promise<boolean> {
      if (!userId) return false;
      const member = await prisma.lobbyMember.findFirst({ where: { teamId, userId } });
      return !!member;
    }

    socket.on('chat:join', async ({ matchId, teamId }: { matchId?: string; teamId?: string } = {}) => {
      if (teamId && !(await isTeamMember(socket.data.userId, teamId))) {
        return socket.emit('chat:error', { message: 'Вы не состоите в этой команде' });
      }
      socket.join(chatRoomFor(matchId, teamId));

      const history = await prisma.chatMessage.findMany({
        where: teamId ? { teamId } : matchId ? { lobbyMatchId: matchId, teamId: null } : { lobbyMatchId: null, teamId: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { author: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true } } },
      });
      const withPolls = await Promise.all(
        history.map(async (msg) => {
          if (!msg.pollId) return msg;
          const poll = await prisma.poll.findUnique({
            where: { id: msg.pollId },
            include: { options: { include: { votes: true } } },
          });
          return { ...msg, poll };
        })
      );
      socket.emit(chatHistoryEventFor(matchId, teamId), withPolls.reverse());
    });

    socket.on('chat:leave', ({ matchId, teamId }: { matchId?: string; teamId?: string } = {}) => {
      socket.leave(chatRoomFor(matchId, teamId));
    });

    socket.on('chat:send', async ({ text, matchId, teamId }: { text: string; matchId?: string; teamId?: string }) => {
      if (!socket.data.userId) {
        return socket.emit('chat:error', { message: 'Войдите, чтобы писать в чат' });
      }
      if (teamId && !(await isTeamMember(socket.data.userId, teamId))) {
        return socket.emit('chat:error', { message: 'Вы не состоите в этой команде' });
      }
      if (!canSendChat(socket.data.userId)) {
        return socket.emit('chat:error', { message: 'Слишком много сообщений, подождите немного' });
      }
      const trimmed = text?.trim().slice(0, 500);
      if (!trimmed) return;

      const message = await prisma.chatMessage.create({
        data: { authorId: socket.data.userId, text: trimmed, lobbyMatchId: teamId ? undefined : matchId ?? null, teamId: teamId ?? null },
        include: { author: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true } } },
      });

      io.to(chatRoomFor(matchId, teamId)).emit(chatMessageEventFor(matchId, teamId), message);
    });

    // Удаление сообщения — только Admin/Owner, работает во всех трёх чатах
    socket.on('chat:delete', async ({ messageId, matchId, teamId }: { messageId: string; matchId?: string; teamId?: string }) => {
      if (socket.data.role !== 'ADMIN' && socket.data.role !== 'OWNER') {
        return socket.emit('chat:error', { message: 'Недостаточно прав для удаления сообщения' });
      }
      await prisma.chatMessage.delete({ where: { id: messageId } }).catch(() => {});
      io.to(chatRoomFor(matchId, teamId)).emit(chatDeletedEventFor(matchId, teamId), { messageId });
    });

    // Создание голосования за карту/режим — только Admin/Owner, публикуется как сообщение в общем чате
    socket.on('poll:create', async ({ title, options }: { title: string; options: string[] }) => {
      if (socket.data.role !== 'ADMIN' && socket.data.role !== 'OWNER') {
        return socket.emit('chat:error', { message: 'Недостаточно прав для создания голосования' });
      }
      if (!canCreatePoll(socket.data.userId!)) {
        return socket.emit('chat:error', { message: 'Слишком много голосований, подождите немного' });
      }
      const cleanOptions = options.map((o) => o.trim()).filter(Boolean).slice(0, 8);
      if (!title?.trim() || cleanOptions.length < 2) {
        return socket.emit('chat:error', { message: 'Укажите название и минимум 2 варианта' });
      }

      const poll = await prisma.poll.create({
        data: {
          title: title.trim(),
          createdById: socket.data.userId!,
          options: { create: cleanOptions.map((label) => ({ label })) },
        },
        include: { options: { include: { votes: true } } },
      });

      const message = await prisma.chatMessage.create({
        data: { authorId: socket.data.userId!, text: `📊 ${poll.title}`, pollId: poll.id },
        include: { author: { select: { id: true, username: true, avatarUrl: true, activeFrameEffect: true } } },
      });

      io.to('chat:global').emit('chat:message', { ...message, poll });
      io.emit('poll:created', poll);
    });

    // Голос за вариант — один голос на весь опрос (повторный голос переносит на новый вариант)
    socket.on('poll:vote', async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!socket.data.userId) {
        return socket.emit('chat:error', { message: 'Войдите, чтобы голосовать' });
      }
      if (!canVote(socket.data.userId)) {
        return socket.emit('chat:error', { message: 'Слишком много голосов, подождите немного' });
      }
      const pollOptions = await prisma.pollOption.findMany({ where: { pollId } });
      const optionIds = pollOptions.map((o) => o.id);

      // Снимаем предыдущий голос и ставим новый атомарно — иначе параллельные события
      // от одного пользователя могут создать дубли (deleteMany + create не атомарны без транзакции).
      await prisma.$transaction(async (tx) => {
        await tx.pollVote.deleteMany({ where: { userId: socket.data.userId, optionId: { in: optionIds } } });
        await tx.pollVote.create({ data: { optionId, userId: socket.data.userId! } });
      });

      const updatedOptions = await prisma.pollOption.findMany({ where: { pollId }, include: { votes: true } });
      io.to('chat:global').emit('poll:updated', { pollId, options: updatedOptions });
    });

    // ───────── GFC LOBBY ROOMS ─────────
    socket.on('gfc:subscribe', ({ lobbyId }: { lobbyId: string }) => {
      socket.join(`gfc:${lobbyId}`);
    });
    socket.on('gfc:unsubscribe', ({ lobbyId }: { lobbyId: string }) => {
      socket.leave(`gfc:${lobbyId}`);
    });

    socket.on('disconnect', () => {
      // no-op; socket.io снимает все room-подписки автоматически
    });
  });
}
