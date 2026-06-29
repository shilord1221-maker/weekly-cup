import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';

const SettingsSchema = z.object({
  // Мышь
  mouseDpi:       z.number().int().min(100).max(32000).optional().nullable(),
  sensitivity:    z.number().min(0).max(10).optional().nullable(),
  aimSensitivity: z.number().min(0).max(10).optional().nullable(),
  zoomSensitivity:z.number().min(0).max(10).optional().nullable(),
  // Железо
  cpu:     z.string().max(64).optional().nullable(),
  gpu:     z.string().max(64).optional().nullable(),
  ram:     z.number().int().min(1).max(512).optional().nullable(),
  monitor: z.string().max(64).optional().nullable(),
  mouse:   z.string().max(64).optional().nullable(),
  mousepad:z.string().max(64).optional().nullable(),
  headset: z.string().max(64).optional().nullable(),
  keyboard:z.string().max(64).optional().nullable(),
  // GTA
  fov:           z.number().int().min(60).max(130).optional().nullable(),
  resolution:    z.string().max(16).optional().nullable(),
  graphicsPreset:z.string().max(32).optional().nullable(),
  fps:           z.number().int().min(30).max(999).optional().nullable(),
});

export async function playerSettingsRoutes(app: FastifyInstance) {
  // Получить свои настройки
  app.get('/api/settings/my', { preHandler: requireAuth }, async (req, reply) => {
    const settings = await prisma.playerSettings.findUnique({ where: { userId: req.user!.id } });
    reply.send(settings ?? null);
  });

  // Получить настройки любого игрока (публично)
  app.get('/api/settings/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const settings = await prisma.playerSettings.findUnique({ where: { userId } });
    reply.send(settings ?? null);
  });

  // Сохранить/обновить свои настройки
  app.put('/api/settings/my', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.flatten().fieldErrors });

    const settings = await prisma.playerSettings.upsert({
      where: { userId: req.user!.id },
      update: parsed.data,
      create: { userId: req.user!.id, ...parsed.data },
    });
    reply.send(settings);
  });
}
