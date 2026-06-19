import Redis from 'ioredis';
import { env } from '@/env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Отдельные коннекты для Socket.io adapter (pub/sub требует выделенных соединений)
export const redisPub = new Redis(env.REDIS_URL);
export const redisSub = new Redis(env.REDIS_URL);
