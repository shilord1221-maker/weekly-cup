import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

const CreateMapSchema = z.object({
  name: z.string().min(2).max(64),
  imageUrl: z.string().min(1, 'Укажите путь или ссылку на изображение'),
});

const CreateZoneSchema = z.object({
  name: z.string().min(1).max(64),
  adjacentIds: z.array(z.string().uuid()).default([]),
  coordinates: z.any().optional(),
});

export async function mapRoutes(app: FastifyInstance) {
  app.get('/api/maps', async (req, reply) => {
    const maps = await prisma.gameMap.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    reply.send(maps);
  });

  app.get('/api/maps/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const map = await prisma.gameMap.findUnique({ where: { id }, include: { zones: true } });
    if (!map) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send(map);
  });

  app.get('/api/maps/:id/zones', async (req, reply) => {
    const { id } = req.params as { id: string };
    const zones = await prisma.zone.findMany({ where: { mapId: id } });
    reply.send(zones);
  });

  // ───────── ADMIN ONLY ─────────
  app.post('/api/maps', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const parsed = CreateMapSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const map = await prisma.gameMap.create({ data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'MAP_CREATED', entityType: 'GameMap', entityId: map.id });
    reply.code(201).send(map);
  });

  app.patch('/api/maps/:id', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const Schema = z.object({ name: z.string().optional(), imageUrl: z.string().min(1).optional(), isActive: z.boolean().optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const map = await prisma.gameMap.update({ where: { id }, data: parsed.data });
    reply.send(map);
  });

  // Зоны не хардкодятся — загружаются администратором с указанием adjacencyMap (adjacentIds)
  app.post('/api/maps/:id/zones', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = CreateZoneSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const zone = await prisma.zone.create({ data: { mapId: id, ...parsed.data } });
    await logAudit({ actorId: req.user!.id, action: 'ZONE_CREATED', entityType: 'Zone', entityId: zone.id });
    reply.code(201).send(zone);
  });

  app.patch('/api/maps/:id/zones/:zoneId', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { zoneId } = req.params as { id: string; zoneId: string };
    const Schema = z.object({ name: z.string().optional(), adjacentIds: z.array(z.string().uuid()).optional(), coordinates: z.any().optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const zone = await prisma.zone.update({ where: { id: zoneId }, data: parsed.data });
    reply.send(zone);
  });
}
