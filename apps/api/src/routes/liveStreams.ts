import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { redis } from '@/redis.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';

const REDIS_KEY = 'live_streams';
const TTL_SECONDS = 8 * 60 * 60; // 8 часов — авто-удаляется если забыли выключить

interface LiveStream {
  id: string;
  channel: string;
  title: string;
  thumbUrl?: string;
  addedById: string;
  addedByUsername: string;
  startedAt: string;
}

async function getAll(): Promise<LiveStream[]> {
  const raw = await redis.hgetall(REDIS_KEY);
  if (!raw) return [];
  return Object.values(raw)
    .map((v) => { try { return JSON.parse(v) as LiveStream; } catch { return null; } })
    .filter((s): s is LiveStream => s !== null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

const AddSchema = z.object({
  channel: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/, 'Только буквы, цифры и _'),
  title: z.string().min(1).max(128),
  thumbUrl: z.string().url().optional(),
});

export async function liveStreamsRoutes(app: FastifyInstance) {
  // Публичное чтение — фронт лобби читает без авторизации
  app.get('/api/live-streams', async (req, reply) => {
    reply.send(await getAll());
  });

  // Добавить стрим — только Admin/Owner
  app.post('/api/live-streams', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const parsed = AddSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const stream: LiveStream = {
      id: `${req.user!.id}-${Date.now()}`,
      channel: parsed.data.channel.toLowerCase(),
      title: parsed.data.title,
      thumbUrl: parsed.data.thumbUrl,
      addedById: req.user!.id,
      addedByUsername: req.user!.username,
      startedAt: new Date().toISOString(),
    };

    await redis.hset(REDIS_KEY, stream.id, JSON.stringify(stream));
    // TTL на весь хэш обновляем при каждом добавлении
    await redis.expire(REDIS_KEY, TTL_SECONDS);

    reply.code(201).send(stream);
  });

  // Удалить свой стрим — Admin/Owner, только свой (Owner может любой)
  app.delete('/api/live-streams/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const raw = await redis.hget(REDIS_KEY, id);
    if (!raw) return reply.code(404).send({ error: 'NOT_FOUND' });

    const stream = JSON.parse(raw) as LiveStream;
    if (stream.addedById !== req.user!.id && req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Можно удалять только свой стрим' });
    }

    await redis.hdel(REDIS_KEY, id);
    reply.send({ success: true });
  });
}
