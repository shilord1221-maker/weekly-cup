import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/db.js';
import { requireAuth, requireRole } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';
import { generateUniqueReferralCode } from '@/services/referral.js';

export async function amnestyRoutes(app: FastifyInstance) {
  // Список заявок — видят только Admin/Owner (requireRole уже пропускает OWNER через иерархию)
  app.get('/api/amnesty', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const requests = await prisma.amnestyRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        conflictUser: { select: { id: true, username: true, email: true, createdAt: true } },
        reviewer: { select: { id: true, username: true } },
      },
    });

    const isOwner = req.user!.role === 'OWNER';
    reply.send(
      // IP-адрес регистрации видят только Owner — у Admin его не должно быть даже в ответе API.
      isOwner ? requests : requests.map(({ registrationIp, ...rest }) => rest)
    );
  });

  // Статус конкретной заявки — публично доступен по id, чтобы фронт мог показать игроку
  // "ваша заявка ещё на рассмотрении" без авторизации (у него ведь пока нет аккаунта).
  app.get('/api/amnesty/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const amnesty = await prisma.amnestyRequest.findUnique({
      where: { id },
      select: { id: true, status: true, staticId: true, createdAt: true, resolvedAt: true, adminComment: true },
    });
    if (!amnesty) return reply.code(404).send({ error: 'NOT_FOUND' });
    reply.send(amnesty);
  });

  const ReviewSchema = z.object({ comment: z.string().max(1000).optional() });

  // Одобрить — создаёт реальный аккаунт из сохранённых данных заявки и сразу логинит игрока
  app.post('/api/amnesty/:id/approve', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const amnesty = await prisma.amnestyRequest.findUnique({ where: { id } });
    if (!amnesty) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (amnesty.status !== 'PENDING') return reply.code(400).send({ error: 'ALREADY_RESOLVED', message: 'Эта заявка уже обработана' });

    // Username/email могли быть заняты кем-то другим за время ожидания — проверяем заново
    const conflict = await prisma.user.findFirst({ where: { OR: [{ username: amnesty.username }, { email: amnesty.email }] } });
    if (conflict) {
      return reply.code(409).send({ error: 'USER_EXISTS', message: 'Ник или email уже заняты другим аккаунтом — заявку нельзя одобрить автоматически' });
    }

    // При одобрении Static ID переходит новому аккаунту — старый аккаунт лишается этого Static ID,
    // чтобы не было дублей. Это осознанное решение: одобрение значит "это реальный владелец ID".
    const referralCode = await generateUniqueReferralCode();
    const newUser = await prisma.$transaction(async (tx) => {
      await tx.staticId.deleteMany({ where: { value: amnesty.staticId } });
      const created = await tx.user.create({
        data: {
          username: amnesty.username,
          email: amnesty.email,
          passwordHash: amnesty.passwordHash,
          role: 'PLAYER',
          registrationIp: amnesty.registrationIp,
          lastLoginIp: amnesty.registrationIp,
          referralCode,
          staticId: { create: { value: amnesty.staticId } },
        },
        include: { staticId: true },
      });
      await tx.amnestyRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewerId: req.user!.id, adminComment: parsed.data.comment ?? null, resolvedAt: new Date() },
      });
      return created;
    });

    await logAudit({ actorId: req.user!.id, action: 'AMNESTY_APPROVED', entityType: 'AmnestyRequest', entityId: id, payload: { newUserId: newUser.id } });

    reply.send({ success: true, userId: newUser.id });
  });

  // Отклонить — заявка закрывается, аккаунт не создаётся
  app.post('/api/amnesty/:id/reject', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });

    const amnesty = await prisma.amnestyRequest.findUnique({ where: { id } });
    if (!amnesty) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (amnesty.status !== 'PENDING') return reply.code(400).send({ error: 'ALREADY_RESOLVED', message: 'Эта заявка уже обработана' });

    await prisma.amnestyRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewerId: req.user!.id, adminComment: parsed.data.comment ?? null, resolvedAt: new Date() },
    });

    await logAudit({ actorId: req.user!.id, action: 'AMNESTY_REJECTED', entityType: 'AmnestyRequest', entityId: id });
    reply.send({ success: true });
  });
}
