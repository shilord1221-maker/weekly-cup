import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';

export async function promoRoutes(app: FastifyInstance) {
  // Применить промокод
  app.post('/api/promo/apply', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ code: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const code = parsed.data.code.toUpperCase();
    const userId = req.user!.id;

    const promo = await prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) {
      return reply.code(400).send({ error: 'Invalid promo code' });
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return reply.code(400).send({ error: 'Expired' });
    }
    if (promo.usedCount >= promo.maxUses) {
      return reply.code(400).send({ error: 'Limit reached' });
    }

    const alreadyUsed = await prisma.promoCodeUse.findUnique({
      where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
    });
    if (alreadyUsed) {
      return reply.code(400).send({ error: 'Already used' });
    }

    await prisma.$transaction([
      prisma.promoCodeUse.create({ data: { promoCodeId: promo.id, userId } }),
      prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
      prisma.user.update({ where: { id: userId }, data: { tokenBalance: { increment: promo.value } } }),
      prisma.tokenTransaction.create({
        data: {
          userId,
          amount: promo.value,
          reason: `PROMO:${code}`,
        },
      }),
    ]);

    reply.send({ success: true, tokens: promo.value });
  });

  // Список активных промокодов (публичный)
  app.get('/api/promo/list', async (req, reply) => {
    const promos = await prisma.promoCode.findMany({
      where: { isActive: true },
      select: { code: true, value: true, usedCount: true, maxUses: true },
    });
    reply.send(promos);
  });
}