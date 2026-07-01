import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';

// Пакеты токенов: 2 токена = 1 рубль
const PACKAGES = [
  { id: 'p100',  tokens: 100,  rubles: 50   },
  { id: 'p500',  tokens: 500,  rubles: 250  },
  { id: 'p1000', tokens: 1000, rubles: 500  },
  { id: 'p2500', tokens: 2500, rubles: 1250 },
  { id: 'p5000', tokens: 5000, rubles: 2500 },
] as const;

// DonationAlerts ссылка
const DA_LINK = process.env.DONATIONALERTS_LINK || 'https://www.donationalerts.com/r/masterlycs2';

export async function paymentRoutes(app: FastifyInstance) {
  // Список пакетов (публичный)
  app.get('/api/payments/packages', async (req, reply) => {
    reply.send(PACKAGES);
  });

  // Создать платёж → редирект на DonationAlerts
  app.post('/api/payments/create', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ packageId: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const pkg = PACKAGES.find((p) => p.id === parsed.data.packageId);
    if (!pkg) return reply.code(404).send({ error: 'PACKAGE_NOT_FOUND' });

    const user = req.user!;
    const message = encodeURIComponent(`${user.email}_${pkg.tokens}tokens`);
    const paymentUrl = `${DA_LINK}?amount=${pkg.rubles}&message=${message}`;

    reply.send({ paymentUrl });
  });

  // История платежей пользователя
  app.get('/api/payments/history', { preHandler: requireAuth }, async (req, reply) => {
    const payments = await prisma.tokenPayment.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    reply.send(payments);
  });
}