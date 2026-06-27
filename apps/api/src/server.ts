import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '@/env.js';
import { redis, redisPub, redisSub } from '@/redis.js';
import { registerSocketHandlers } from '@/sockets/index.js';
import { createMatchEventsWorker } from '@/jobs/matchQueue.js';

import { authRoutes } from '@/routes/auth.js';
import { amnestyRoutes } from '@/routes/amnesty.js';
import { matchRoutes } from '@/routes/matches.js';
import { lobbyRoutes } from '@/routes/lobby.js';
import { mapRoutes } from '@/routes/maps.js';
import { complaintRoutes } from '@/routes/complaints.js';
import { newsRoutes, mediaRoutes, profileRoutes, winsRoutes, auditRoutes, userRoutes, publicProfileRoutes } from '@/routes/content.js';
import { uploadRoutes } from '@/routes/upload.js';
import { discordRoutes } from '@/routes/discord.js';
import { pollRoutes } from '@/routes/polls.js';
import { liveStreamsRoutes } from '@/routes/liveStreams.js';
import { stackRoutes } from '@/routes/stacks.js';
import { tokenRoutes } from '@/routes/tokens.js';
import { gfcRoutes } from '@/routes/gfc.js';
import { startDiscordBot } from '@/services/discordBot.js';

async function main() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  // Лимит файла — 8MB, совпадает с пределом в storage.ts; защищает от гигантских multipart-запросов
  // ещё на уровне парсинга, до того как файл попадёт в код обработчика.
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });
  // Лимит привязан к Redis, а не к памяти процесса — иначе сбрасывается при каждом деплое
  // и не работает корректно, если когда-нибудь будет больше одной реплики.
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute', redis });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ───────── HTTP SERVER + SOCKET.IO ─────────
  const io = new SocketServer(app.server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
    maxHttpBufferSize: 16 * 1024, // 16KB — защита от мегабайтных payload в одном событии
  });
  io.adapter(createAdapter(redisPub, redisSub));
  registerSocketHandlers(io);

  // ───────── ROUTES ─────────
  await app.register(authRoutes);
  await app.register(uploadRoutes);
  await app.register(amnestyRoutes);
  await app.register((instance) => matchRoutes(instance, { io }));
  await app.register((instance) => lobbyRoutes(instance, { io }));
  await app.register(mapRoutes);
  await app.register((instance) => complaintRoutes(instance, { io }));
  await app.register(newsRoutes);
  await app.register(mediaRoutes);
  await app.register(profileRoutes);
  await app.register(winsRoutes);
  await app.register(auditRoutes);
  await app.register(userRoutes);
  await app.register(publicProfileRoutes);
  await app.register(discordRoutes);
  await app.register((instance) => pollRoutes(instance, { io }));
  await app.register(liveStreamsRoutes);
  await app.register(stackRoutes);
  await app.register(tokenRoutes);
  await app.register((instance) => gfcRoutes(instance, { io }));

  // ───────── DISCORD BOT (запускается вместе с проектом; не блокирует старт сайта,
  // если Discord временно недоступен — ошибка логируется, остальной сайт работает) ─────────
  startDiscordBot().catch((err) => {
    console.error('[discord] Не удалось запустить бота при старте:', err);
  });

  // ───────── BACKGROUND WORKER (запуск в этом же процессе для простоты MVP;
  // при масштабировании выносится в отдельный процесс/контейнер) ─────────
  createMatchEventsWorker(io);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Weekly Pracs API запущен на порту ${env.PORT}`);
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
