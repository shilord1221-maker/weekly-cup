import { Queue, Worker, type Job } from 'bullmq';
import { env } from '@/env.js';
import { prisma } from '@/db.js';
import type { Server as SocketServer } from 'socket.io';

const connection = { connection: { host: undefined, url: env.REDIS_URL } } as any;

export const matchQueue = new Queue('match-events', { connection: { url: env.REDIS_URL } });

type JobData =
  | { kind: 'MATCH_STARTED'; matchId: string }
  | { kind: 'MATCH_REMINDER'; matchId: string }
  | { kind: 'START_ZONE_CLOSE'; matchId: string }
  | { kind: 'FINAL_ZONE_CLOSE'; matchId: string };

export async function scheduleMatchStart(matchId: string, startTime: Date) {
  const delay = Math.max(0, startTime.getTime() - Date.now());
  await matchQueue.add('start', { kind: 'MATCH_STARTED', matchId } satisfies JobData, {
    delay,
    jobId: `start-${matchId}`,
    removeOnComplete: true,
  });
}

export async function scheduleMatchReminder(matchId: string, startTime: Date) {
  // Через 2 минуты после старта — второе звуковое уведомление
  const delay = Math.max(0, startTime.getTime() - Date.now() + 2 * 60 * 1000);
  await matchQueue.add('reminder', { kind: 'MATCH_REMINDER', matchId } satisfies JobData, {
    delay,
    jobId: `reminder-${matchId}`,
    removeOnComplete: true,
  });
}

export async function scheduleFinalZoneClose(matchId: string, durationMs = 120_000) {
  await matchQueue.add('final-zone-close', { kind: 'FINAL_ZONE_CLOSE', matchId } satisfies JobData, {
    delay: durationMs,
    jobId: `finalzone-${matchId}-${Date.now()}`,
    removeOnComplete: true,
  });
}

export async function scheduleStartZoneClose(matchId: string, durationMs = 120_000) {
  await matchQueue.add('start-zone-close', { kind: 'START_ZONE_CLOSE', matchId } satisfies JobData, {
    delay: durationMs,
    jobId: `startzone-${matchId}-${Date.now()}`,
    removeOnComplete: true,
  });
}

export async function cancelScheduledJobs(matchId: string) {
  const jobs = await matchQueue.getJobs(['delayed', 'waiting']);
  for (const job of jobs) {
    if (job.data?.matchId === matchId) await job.remove();
  }
}

/**
 * Worker запускается в отдельном процессе (см. src/jobs/worker.ts), но фабрика тут,
 * чтобы внедрить io для realtime-эмита.
 */
export function createMatchEventsWorker(io: SocketServer) {
  return new Worker<JobData>(
    'match-events',
    async (job: Job<JobData>) => {
      const { kind, matchId } = job.data;

      switch (kind) {
        case 'MATCH_STARTED': {
          const match = await prisma.match.update({
            where: { id: matchId },
            data: { status: 'LIVE' },
          });
          io.to(`lobby:${matchId}`).emit('match:started', { matchId, startTime: match.startTime });
          await notifyLobbyMembers(io, matchId, 'notify:match_started', { matchId });
          break;
        }
        case 'MATCH_REMINDER': {
          io.to(`lobby:${matchId}`).emit('match:reminder', { matchId });
          break;
        }
        case 'START_ZONE_CLOSE': {
          const m = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } });
          if (m?.status === 'PAUSED') break; // защита от редкой гонки: job был active в момент паузы
          await prisma.match.update({ where: { id: matchId }, data: { startZoneClosesAt: new Date() } });
          io.to(`lobby:${matchId}`).emit('lobby:start_zone_closed', { matchId });
          break;
        }
        case 'FINAL_ZONE_CLOSE': {
          const m = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } });
          if (m?.status === 'PAUSED') break;
          await prisma.match.update({ where: { id: matchId }, data: { finalZoneClosesAt: new Date() } });
          io.to(`lobby:${matchId}`).emit('lobby:final_zone_closed', { matchId });
          await notifyLobbyMembers(io, matchId, 'notify:final_zone', { matchId, closed: true });
          break;
        }
      }
    },
    { connection: { url: env.REDIS_URL } }
  );
}

async function notifyLobbyMembers(io: SocketServer, matchId: string, event: string, payload: Record<string, unknown>) {
  const lobby = await prisma.lobby.findUnique({
    where: { matchId },
    include: { teams: { include: { members: true } } },
  });
  if (!lobby) return;

  const userIds = lobby.teams.flatMap((t) => t.members.map((m) => m.userId));
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type: event, payload: payload as any })),
  });
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}
