import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';
import type { Server as SocketServer } from 'socket.io';

const MediaUrlsSchema = z.array(z.string().url()).max(10).default([]);

const CreateComplaintSchema = z.object({
  nick: z.string().min(1).max(64),
  staticIdValue: z.string().max(64).optional(),
  text: z.string().min(5).max(2000),
  mediaUrls: MediaUrlsSchema.optional(),
});

const UpdateComplaintSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
  adminComment: z.string().max(2000).optional(),
});

const ReplySchema = z.object({
  text: z.string().min(1).max(2000),
  mediaUrls: MediaUrlsSchema.optional(),
});

// "Staff" — все, кто видит все жалобы, а не только свои: Organizer, Admin, Owner (иерархия ролей).
function isStaffRole(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'ORGANIZER';
}

export async function complaintRoutes(app: FastifyInstance, opts: { io: SocketServer }) {
  const { io } = opts;

  // Player видит только свои жалобы, Organizer/Admin/Owner — все
  app.get('/api/complaints', { preHandler: requireAuth }, async (req, reply) => {
    const isStaff = isStaffRole(req.user!.role);
    const complaints = await prisma.complaint.findMany({
      where: isStaff ? {} : { authorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true } },
        reviewer: { select: { id: true, username: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, username: true, role: true } } },
        },
      },
    });
    reply.send(complaints);
  });

  app.post('/api/complaints', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateComplaintSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const complaint = await prisma.complaint.create({
      data: { ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], authorId: req.user!.id, status: 'NEW' },
    });

    await logAudit({ actorId: req.user!.id, action: 'COMPLAINT_CREATED', entityType: 'Complaint', entityId: complaint.id });
    reply.code(201).send(complaint);
  });

  app.patch('/api/complaints/:id', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateComplaintSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const complaint = await prisma.complaint.update({
      where: { id },
      data: { ...parsed.data, reviewerId: req.user!.id },
    });

    await logAudit({ actorId: req.user!.id, action: 'COMPLAINT_UPDATED', entityType: 'Complaint', entityId: id, payload: parsed.data });

    // Уведомляем автора жалобы об изменении статуса
    io.to(`user:${complaint.authorId}`).emit('notify:complaint_updated', { complaintId: id, status: complaint.status });
    await prisma.notification.create({
      data: { userId: complaint.authorId, type: 'notify:complaint_updated', payload: { complaintId: id, status: complaint.status } },
    });

    reply.send(complaint);
  });

  // Удаление жалобы — только Admin/Owner (требуется и текущая roleHierarchy через requireRole('ADMIN'))
  app.delete('/api/complaints/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Жалоба не найдена' });

    await prisma.complaint.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'COMPLAINT_DELETED', entityType: 'Complaint', entityId: id });
    reply.send({ success: true });
  });

  // Organizer/Admin/Owner отправляет ответ на жалобу — сохраняется в истории, автор получает уведомление
  app.post('/api/complaints/:id/reply', { preHandler: [requireAuth, requireOrganizerOrAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ReplySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Жалоба не найдена' });

    const replyRecord = await prisma.complaintReply.create({
      data: {
        complaintId: id,
        authorId: req.user!.id,
        text: parsed.data.text,
        mediaUrls: parsed.data.mediaUrls ?? [],
      },
      include: { author: { select: { id: true, username: true, role: true } } },
    });

    await logAudit({ actorId: req.user!.id, action: 'COMPLAINT_REPLY_SENT', entityType: 'Complaint', entityId: id });

    io.to(`user:${complaint.authorId}`).emit('notify:complaint_reply', { complaintId: id, reply: replyRecord });
    await prisma.notification.create({
      data: { userId: complaint.authorId, type: 'notify:complaint_reply', payload: { complaintId: id } },
    });

    reply.code(201).send(replyRecord);
  });
}
