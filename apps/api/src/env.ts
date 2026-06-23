import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  // Нужен для распознавания Static ID на скрине-пруфе через Claude vision.
  // Если не задан — проверка скрина просто отключается, регистрация продолжает работать без неё.
  ANTHROPIC_API_KEY: z.string().optional(),
  // S3-совместимое хранилище (Cloudflare R2) — для загрузки файлов (медиа, скрины) прямо с компьютера.
  // Если не задано — загрузка файлов отключается, остаётся только ввод ссылки вручную.
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  // Публичный домен, через который раздаются загруженные файлы (R2 public bucket URL или кастомный домен)
  S3_PUBLIC_URL: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
