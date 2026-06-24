import type { FastifyInstance } from 'fastify';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';
import type { Server as SocketServer } from 'socket.io';

export async function pollRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  app.get('/api/polls/active', async (req, reply) => {
    const polls = await prisma.poll.findMany({
      where: { isClosed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { options: { include: { votes: true } } },
    });
    reply.send(polls);
  });

  app.post('/api/polls/:id/close', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const poll = await prisma.poll.findUnique({ where: { id } });
    if (!poll) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.poll.update({ where: { id }, data: { isClosed: true, closedAt: new Date() } });
    await logAudit({ actorId: req.user!.id, action: 'POLL_CLOSED', entityType: 'Poll', entityId: id });
    io.emit('poll:closed', { pollId: id });
    reply.send({ success: true });
  });
}
