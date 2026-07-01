import type { FastifyInstance } from 'fastify';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';
import { randomBytes } from 'crypto';

const REF_PERCENT = 0.10; // 10%

export async function referralRoutes(app: FastifyInstance) {
  // Мой реферальный код
  app.get('/api/referral/my-code', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { referralCode2: true, referralBalance: true },
    });

    let code = user?.referralCode;
    if (!code) {
      code = randomBytes(4).toString('hex').toUpperCase();
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { referralCode2: code },
      });
    }

    const stats = await prisma.referral.aggregate({
      where: { referrerId: req.user!.id },
      _sum: { totalEarned: true },
      _count: { referredId: true },
    });

    reply.send({
      code,
      link: `${process.env.WEB_ORIGIN}/register?ref=${code}`,
      balance: user?.referralBalance || 0,
      totalEarned: stats._sum.totalEarned || 0,
      referralsCount: stats._count?.referredId || 0,
    });
  });

  // Список рефералов
  app.get('/api/referral/list', { preHandler: requireAuth }, async (req, reply) => {
    const refs = await prisma.referral.findMany({
      where: { referrerId: req.user!.id },
      include: { referred: { select: { username: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(refs);
  });

  // Применить реферальный код при регистрации (вызывается из auth)
  app.post('/api/referral/apply', async (req, reply) => {
    const { code, newUserId } = req.body as { code: string; newUserId: string };

    const referrer = await prisma.user.findUnique({
      where: { referralCode2: code },
    });

    if (!referrer || referrer.id === newUserId) {
      return reply.code(400).send({ error: 'Invalid referral code' });
    }

    const existing = await prisma.referral.findFirst({
      where: { referredId: newUserId },
    });

    if (existing) {
      return reply.code(400).send({ error: 'Already referred' });
    }

    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUserId,
        code,
      },
    });

    reply.send({ success: true });
  });
}

// Функция для начисления реферального бонуса (вызывается при ручном зачислении токенов)
export async function processReferralBonus(userId: string, amount: number) {
  const referral = await prisma.referral.findFirst({
    where: { referredId: userId, isActive: true },
  });

  if (!referral) return;

  const bonus = Math.floor(amount * REF_PERCENT);

  await prisma.$transaction([
    prisma.referralTransaction.create({
      data: {
        referralId: referral.id,
        amount: bonus,
        sourceType: 'purchase',
      },
    }),
    prisma.referral.update({
      where: { id: referral.id },
      data: { totalEarned: { increment: bonus } },
    }),
    prisma.user.update({
      where: { id: referral.referrerId },
      data: { referralBalance: { increment: bonus } },
    }),
  ]);
}