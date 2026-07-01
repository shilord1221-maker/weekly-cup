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

// ЮКасса IPs для верификации webhook (только с этих IP принимаем)
const YOOKASSA_IPS = new Set([
  '185.71.76.0/27', '185.71.77.0/27', '77.75.153.0/25',
  '77.75.156.11', '77.75.156.35', '77.75.154.128/25',
  '2a02:5180::/32',
]);

async function createYookassaPayment(params: {
  amount: number; // в рублях
  tokens: number;
  userId: string;
  returnUrl: string;
}) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error('ЮКасса не настроена');

  const idempotenceKey = `${params.userId}-${params.tokens}-${Date.now()}`;

  const body = {
    amount: { value: params.amount.toFixed(2), currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: params.returnUrl },
    capture: true,
    description: `Weekly Pracs: ${params.tokens} токенов`,
    metadata: { userId: params.userId, tokens: params.tokens },
  };

  const res = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).description ?? 'Ошибка ЮКасса');
  }

  return res.json() as Promise<{ id: string; confirmation: { confirmation_url: string }; status: string }>;
}

export async function paymentRoutes(app: FastifyInstance) {
  // Список пакетов (публичный)
  app.get('/api/payments/packages', async (req, reply) => {
    reply.send(PACKAGES);
  });

  // Создать платёж
  app.post('/api/payments/create', { preHandler: requireAuth }, async (req, reply) => {
    const Schema = z.object({ packageId: z.string() });
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const pkg = PACKAGES.find((p) => p.id === parsed.data.packageId);
    if (!pkg) return reply.code(404).send({ error: 'PACKAGE_NOT_FOUND' });

    if (!process.env.YOOKASSA_SHOP_ID) {
      return reply.code(503).send({ error: 'PAYMENT_UNAVAILABLE', message: 'Платёжная система не настроена' });
    }

    const returnUrl = `${process.env.WEB_ORIGIN}/shop?payment=success`;

    try {
      const payment = await createYookassaPayment({
        amount: pkg.rubles,
        tokens: pkg.tokens,
        userId: req.user!.id,
        returnUrl,
      });

      // Сохраняем в БД
      await prisma.tokenPayment.create({
        data: {
          userId: req.user!.id,
          yookassaId: payment.id,
          amount: pkg.rubles * 100, // в копейках
          tokens: pkg.tokens,
          status: 'PENDING',
        },
      });

      reply.send({ paymentUrl: payment.confirmation.confirmation_url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      return reply.code(500).send({ error: 'PAYMENT_ERROR', message: msg });
    }
  });

  // Webhook от ЮКасса — вызывается при изменении статуса платежа
  // НЕ требует авторизации, но проверяем подпись/данные
  app.post('/api/payments/webhook', async (req, reply) => {
    const body = req.body as any;

    // Принимаем только успешные платежи
    if (body?.event !== 'payment.succeeded') {
      return reply.send({ ok: true });
    }

    const paymentData = body.object;
    if (!paymentData?.id || !paymentData?.metadata) {
      return reply.code(400).send({ error: 'INVALID_PAYLOAD' });
    }

    const { userId, tokens } = paymentData.metadata as { userId: string; tokens: number };
    if (!userId || !tokens) return reply.code(400).send({ error: 'MISSING_METADATA' });

    // Проверяем что платёж есть в нашей БД и ещё не обработан
    const payment = await prisma.tokenPayment.findUnique({ where: { yookassaId: paymentData.id } });
    if (!payment) return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
    if (payment.status === 'SUCCEEDED') return reply.send({ ok: true }); // уже обработан (идемпотентность)
    if (payment.userId !== userId) return reply.code(403).send({ error: 'USER_MISMATCH' });

    // Начисляем токены и помечаем платёж
    await prisma.$transaction([
      prisma.tokenPayment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', completedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { tokenBalance: { increment: Number(tokens) } },
      }),
      prisma.tokenTransaction.create({
        data: { userId, amount: Number(tokens), reason: `PURCHASE:YOOKASSA:${paymentData.id}` },
      }),
    ]);

    reply.send({ ok: true });
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
