import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

const CreateMapSchema = z.object({
  name: z.string().min(2).max(64),
  imageUrl: z.string().min(1, 'Укажите путь или ссылку на изображение'),
});

const CoordinatesSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().finite().optional(),
    height: z.number().positive().finite().optional(),
  })
  .passthrough()
  .optional();

const CreateZoneSchema = z.object({
  name: z.string().min(1).max(64),
  adjacentIds: z.array(z.string().uuid()).default([]),
  coordinates: CoordinatesSchema,
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

  app.patch('/api/maps/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Редактировать карты может только Owner' });
    }
    const { id } = req.params as { id: string };
    const Schema = z.object({ name: z.string().optional(), imageUrl: z.string().min(1).optional(), isActive: z.boolean().optional() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const existing = await prisma.gameMap.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const map = await prisma.gameMap.update({ where: { id }, data: parsed.data });
    await logAudit({ actorId: req.user!.id, action: 'MAP_UPDATED', entityType: 'GameMap', entityId: id, payload: parsed.data });
    reply.send(map);
  });

  // Полное удаление карты — строго Owner. Зоны удаляются каскадно (Zone.map onDelete: Cascade в схеме).
  // Карты, уже использованные в матчах, не удаляются — иначе сломались бы исторические данные о прошедших матчах.
  app.delete('/api/maps/:id', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Удалять карты может только Owner' });
    }
    const { id } = req.params as { id: string };
    const existing = await prisma.gameMap.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Карта не найдена' });

    const usedInMatches = await prisma.match.count({ where: { mapId: id } });
    if (usedInMatches > 0) {
      return reply.code(409).send({
        error: 'MAP_IN_USE',
        message: `Эту карту нельзя удалить — она использована в ${usedInMatches} матче(ах). Можно деактивировать вместо удаления.`,
      });
    }

    await prisma.gameMap.delete({ where: { id } });
    await logAudit({ actorId: req.user!.id, action: 'MAP_DELETED', entityType: 'GameMap', entityId: id, payload: { name: existing.name } });
    reply.send({ success: true });
  });

  // Зоны не хардкодятся — загружаются администратором с указанием adjacencyMap (adjacentIds)
  app.post('/api/maps/:id/zones', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = CreateZoneSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const zone = await prisma.zone.create({ data: { mapId: id, ...parsed.data, coordinates: parsed.data.coordinates as any } });
    await logAudit({ actorId: req.user!.id, action: 'ZONE_CREATED', entityType: 'Zone', entityId: zone.id });
    reply.code(201).send(zone);
  });

  app.patch('/api/maps/:id/zones/:zoneId', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Редактировать зоны может только Owner' });
    }
    const { zoneId } = req.params as { id: string; zoneId: string };
    const Schema = z.object({ name: z.string().optional(), adjacentIds: z.array(z.string().uuid()).optional(), coordinates: CoordinatesSchema });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const existing = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });

    const zone = await prisma.zone.update({ where: { id: zoneId }, data: { ...parsed.data, coordinates: parsed.data.coordinates as any } });
    await logAudit({ actorId: req.user!.id, action: 'ZONE_UPDATED', entityType: 'Zone', entityId: zoneId, payload: parsed.data });
    reply.send(zone);
  });

  // Удаление зоны — строго Owner. Если зона уже выбрана в каком-то матче (selectedZones/finalZone),
  // удаление безопасно блокируется — иначе сломались бы исторические данные прошедших матчей.
  app.delete('/api/maps/:id/zones/:zoneId', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user!.role !== 'OWNER') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Удалять зоны может только Owner' });
    }
    const { zoneId } = req.params as { id: string; zoneId: string };
    const existing = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Зона не найдена' });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.zone.delete({ where: { id: zoneId } });
        const referencing = await tx.zone.findMany({ where: { mapId: existing.mapId, adjacentIds: { has: zoneId } } });
        for (const ref of referencing) {
          await tx.zone.update({ where: { id: ref.id }, data: { adjacentIds: ref.adjacentIds.filter((zid) => zid !== zoneId) } });
        }
      });
    } catch {
      return reply.code(409).send({ error: 'ZONE_IN_USE', message: 'Эта зона уже использована в матче и не может быть удалена' });
    }

    await logAudit({ actorId: req.user!.id, action: 'ZONE_DELETED', entityType: 'Zone', entityId: zoneId, payload: { name: existing.name } });
    reply.send({ success: true });
  });
}
