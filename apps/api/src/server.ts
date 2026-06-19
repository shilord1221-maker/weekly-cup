import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '@/env.js';
import { redisPub, redisSub } from '@/redis.js';
import { registerSocketHandlers } from '@/sockets/index.js';
import { createMatchEventsWorker } from '@/jobs/matchQueue.js';

import { authRoutes } from '@/routes/auth.js';
import { matchRoutes } from '@/routes/matches.js';
import { lobbyRoutes } from '@/routes/lobby.js';
import { mapRoutes } from '@/routes/maps.js';
import { complaintRoutes } from '@/routes/complaints.js';
import { newsRoutes, mediaRoutes, profileRoutes, winsRoutes, auditRoutes, userRoutes } from '@/routes/content.js';

async function main() {
  const app = Fastify({
    logger: {
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ───────── HTTP SERVER + SOCKET.IO ─────────
  const io = new SocketServer(app.server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });
  io.adapter(createAdapter(redisPub, redisSub));
  registerSocketHandlers(io);

  // ───────── ROUTES ─────────
  await app.register(authRoutes);
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

  // ───────── BACKGROUND WORKER (запуск в этом же процессе для простоты MVP;
  // при масштабировании выносится в отдельный процесс/контейнер) ─────────
  createMatchEventsWorker(io);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Weekly Cup API запущен на порту ${env.PORT}`);
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
