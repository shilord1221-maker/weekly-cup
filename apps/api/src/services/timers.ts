import { redis } from '@/redis.js';

/**
 * Все таймеры хранятся в Redis с TTL — клиент при переподключении запрашивает
 * оставшееся время через getRemainingMs(), поэтому обновление страницы ничего не ломает.
 */

const key = (kind: string, matchId: string) => `timer:${kind}:${matchId}`;

export async function setMatchStartTimer(matchId: string, startTimeMs: number) {
  const ttlSeconds = Math.max(1, Math.floor((startTimeMs - Date.now()) / 1000));
  await redis.set(key('start', matchId), startTimeMs, 'EX', ttlSeconds + 300); // +5 мин запас
}

export async function setFinalZoneWindow(matchId: string, durationMs = 120_000) {
  const closesAt = Date.now() + durationMs;
  await redis.set(key('finalzone', matchId), closesAt, 'EX', Math.ceil(durationMs / 1000) + 60);
  return closesAt;
}

export async function setReminderTimer(matchId: string, atMs: number) {
  await redis.set(key('reminder', matchId), atMs, 'EX', Math.max(1, Math.floor((atMs - Date.now()) / 1000)) + 60);
}

export async function getRemainingMs(kind: 'start' | 'finalzone' | 'reminder', matchId: string): Promise<number | null> {
  const value = await redis.get(key(kind, matchId));
  if (!value) return null;
  const remaining = Number(value) - Date.now();
  return remaining > 0 ? remaining : 0;
}

export async function clearMatchTimers(matchId: string) {
  await redis.del(key('start', matchId), key('finalzone', matchId), key('reminder', matchId));
}
