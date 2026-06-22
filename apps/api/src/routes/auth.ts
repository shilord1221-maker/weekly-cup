import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '@/db.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenExpiryDate } from '@/utils/jwt.js';
import { requireAuth } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';
import { verifyStaticIdProof } from '@/services/proofCheck.js';

// Ник и Static ID — обязательные поля при регистрации.
const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Ник должен быть не короче 3 символов')
    .max(32, 'Ник должен быть не длиннее 32 символов')
    .regex(/^[a-zA-Z0-9_ ]+$/, 'Ник может содержать буквы, цифры, пробел и подчёркивание'),
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
  staticId: z.string().regex(/^\d{2,}$/, 'Static ID должен состоять минимум из 2 цифр'),
  staticIdProofUrl: z.string().url('Укажите ссылку на скриншот (например, через yapix)').optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  // Frontend и backend живут на разных поддоменах Railway — это cross-site запрос с точки зрения браузера.
  // SameSite=Lax тихо блокирует такие cookie, из-за чего refresh_token никогда не доходил до сервера,
  // и access-токен (живёт 15 минут) истекал без возможности автообновления.
  // SameSite=None требует Secure=true — это уже обеспечено через HTTPS на Railway в продакшене.
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function authRoutes(app: FastifyInstance) {
  // ───────── REGISTER ─────────
  // Жёсткий лимит — иначе можно автоматизированно создавать сотни аккаунтов в минуту.
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Проверьте правильность заполнения полей',
          issues: parsed.error.flatten().fieldErrors,
        });
      }
      const { username, email, password, staticId } = parsed.data;

      const [existingUser, existingStaticId] = await Promise.all([
        prisma.user.findFirst({ where: { OR: [{ username }, { email }] } }),
        prisma.staticId.findUnique({ where: { value: staticId }, include: { user: true } }),
      ]);

      if (existingUser) {
        return reply.code(409).send({
          error: 'USER_EXISTS',
          message: existingUser.username === username ? 'Этот ник уже занят' : 'Этот email уже зарегистрирован',
        });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

      // Если есть скрин-пруф — проверяем, что на нём действительно тот же Static ID,
      // который человек ввёл в форму. Если проверка недоступна (нет ключа API, скрин не открылся
      // и т.д.) — не блокируем регистрацию, просто проходим без верификации.
      let detectedStaticId: string | null = null;
      if (parsed.data.staticIdProofUrl) {
        const proofResult = await verifyStaticIdProof(parsed.data.staticIdProofUrl);
        if (proofResult.ok) {
          detectedStaticId = proofResult.detectedStaticId;
          if (detectedStaticId !== staticId) {
            return reply.code(400).send({
              error: 'PROOF_MISMATCH',
              message: `На скрине найден Static ID #${detectedStaticId}, а в форме указан #${staticId}. Проверьте, что вы загрузили правильный скриншот.`,
            });
          }
        }
        // Остальные исходы (NO_API_KEY/FETCH_FAILED/NOT_AN_IMAGE/NOT_DETECTED/API_ERROR) —
        // намеренно не блокируют регистрацию, чтобы технический сбой не мешал реальным игрокам.
      }

      // Static ID уже привязан к ДРУГОМУ аккаунту — это новый игрок не пропускаем сразу,
      // а заводим заявку на «амнистию»: админ разбирается вручную, кому реально принадлежит этот ID.
      if (existingStaticId) {
        const passwordHash = await argon2.hash(password);
        const amnesty = await prisma.amnestyRequest.create({
          data: {
            username,
            email,
            passwordHash,
            staticId,
            proofUrl: parsed.data.staticIdProofUrl ?? null,
            detectedStaticId,
            conflictUserId: existingStaticId.userId,
            registrationIp: clientIp,
          },
        });
        await logAudit({ actorId: null, action: 'AMNESTY_REQUEST_CREATED', entityType: 'AmnestyRequest', entityId: amnesty.id, payload: { staticId } });

        return reply.code(409).send({
          error: 'STATIC_ID_TAKEN',
          message: 'Этот Static ID уже привязан к другому аккаунту',
          amnestyRequestId: amnesty.id,
        });
      }

      const passwordHash = await argon2.hash(password);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role: 'PLAYER',
          registrationIp: clientIp,
          lastLoginIp: clientIp,
          staticId: { create: { value: staticId, proofUrl: parsed.data.staticIdProofUrl ?? null } },
        },
        include: { staticId: true },
      });

      const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username });
      const refreshToken = signRefreshToken(user.id);
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: refreshTokenExpiryDate() },
      });

      await logAudit({ actorId: user.id, action: 'USER_REGISTERED', entityType: 'User', entityId: user.id });

      reply
        .setCookie('access_token', accessToken, ACCESS_COOKIE_OPTS)
        .setCookie('refresh_token', refreshToken, { ...ACCESS_COOKIE_OPTS, path: '/api/auth' })
        .code(201)
        .send({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            staticId: user.staticId?.value ?? null,
          },
          accessToken,
        });
    }
  );

  // ───────── LOGIN ─────────
  // Жёсткий лимит — защита от брутфорса пароля.
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Введите email и пароль' });
      }
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email }, include: { staticId: true } });

      // Защита от timing-атаки: если пользователь не найден, всё равно выполняем verify против
      // фиктивного хеша — иначе время ответа отличается, и по нему можно перебором узнать,
      // какие email зарегистрированы в системе.
      const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0ZHVtbXlzYWx0$ZHVtbXlkdW1teWR1bW15ZHVtbXlkdW1teWR1bW15ZHVtbXk';
      const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);

      if (!user || !valid) {
        return reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' });
      }

      if (user.isBanned) {
        return reply.code(403).send({ error: 'BANNED', message: user.bannedReason ? `Вы заблокированы: ${user.bannedReason}` : 'Ваш аккаунт заблокирован' });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginIp: clientIp } });

      const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username });
      const refreshToken = signRefreshToken(user.id);
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: refreshTokenExpiryDate() },
      });

      reply
        .setCookie('access_token', accessToken, ACCESS_COOKIE_OPTS)
        .setCookie('refresh_token', refreshToken, { ...ACCESS_COOKIE_OPTS, path: '/api/auth' })
        .send({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            staticId: user.staticId?.value ?? null,
          },
          accessToken,
        });
    }
  );

  // ───────── REFRESH ─────────
  app.post('/api/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const token = req.cookies?.refresh_token ?? (req.body as any)?.refreshToken;
    if (!token) {
      return reply.code(401).send({ error: 'NO_REFRESH_TOKEN', message: 'Refresh-токен отсутствует' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN', message: 'Сессия истекла, войдите снова' });
    }

    try {
      verifyRefreshToken(token);
    } catch {
      return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN', message: 'Сессия истекла, войдите снова' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      return reply.code(401).send({ error: 'USER_NOT_FOUND' });
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, username: user.username });
    reply.setCookie('access_token', accessToken, ACCESS_COOKIE_OPTS).send({ accessToken });
  });

  // ───────── LOGOUT ─────────
  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies?.refresh_token;
    if (token) {
      await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
    }
    reply
      .clearCookie('access_token', { path: '/' })
      .clearCookie('refresh_token', { path: '/api/auth' })
      .send({ success: true });
  });

  // ───────── ME ─────────
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { staticId: true },
    });
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });

    reply.send({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      staticId: user.staticId?.value ?? null,
      createdAt: user.createdAt,
    });
  });

  // Static ID больше нельзя менять самому игроку — это закреплённый игровой идентификатор,
  // изменить его может только Owner через админ-панель (см. PATCH /api/users/:id/static-id ниже).
}
