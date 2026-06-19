import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireOrganizerOrAdmin } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

const CreateComplaintSchema = z.object({
  nick: z.string().min(1).max(64),
  staticIdValue: z.string().max(64).optional(),
  text: z.string().min(5).max(2000),
});

const UpdateComplaintSchema = z.object({
  status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
  adminComment: z.string().max(2000).optional(),
});

export async function complaintRoutes(app: FastifyInstance) {
  // Player видит только свои жалобы, Admin/Organizer — все
  app.get('/api/complaints', { preHandler: requireAuth }, async (req, reply) => {
    const isStaff = req.user!.role === 'ADMIN' || req.user!.role === 'ORGANIZER';
    const complaints = await prisma.complaint.findMany({
      where: isStaff ? {} : { authorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, username: true } }, reviewer: { select: { id: true, username: true } } },
    });
    reply.send(complaints);
  });

  app.post('/api/complaints', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateComplaintSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const complaint = await prisma.complaint.create({
      data: { ...parsed.data, authorId: req.user!.id, status: 'NEW' },
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
    reply.send(complaint);
  });
}
