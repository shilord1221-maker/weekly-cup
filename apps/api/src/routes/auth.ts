import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '@/db.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenExpiryDate } from '@/utils/jwt.js';
import { requireAuth } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';

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
  app.post('/api/auth/register', async (req, reply) => {
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
      prisma.staticId.findUnique({ where: { value: staticId } }),
    ]);

    if (existingUser) {
      return reply.code(409).send({
        error: 'USER_EXISTS',
        message: existingUser.username === username ? 'Этот ник уже занят' : 'Этот email уже зарегистрирован',
      });
    }
    if (existingStaticId) {
      return reply.code(409).send({ error: 'STATIC_ID_TAKEN', message: 'Этот Static ID уже привязан к другому аккаунту' });
    }

    const passwordHash = await argon2.hash(password);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

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
  });

  // ───────── LOGIN ─────────
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Введите email и пароль' });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, include: { staticId: true } });
    if (!user) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
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
  });

  // ───────── REFRESH ─────────
  app.post('/api/auth/refresh', async (req, reply) => {
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

  // ───────── BIND / UPDATE STATIC ID ─────────
  const StaticIdSchema = z.object({
    staticId: z.string().regex(/^\d{2,}$/, 'Static ID должен состоять минимум из 2 цифр'),
  });

  app.patch('/api/auth/static-id', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = StaticIdSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Некорректный Static ID' });
    }

    const taken = await prisma.staticId.findUnique({ where: { value: parsed.data.staticId } });
    if (taken && taken.userId !== req.user!.id) {
      return reply.code(409).send({ error: 'STATIC_ID_TAKEN', message: 'Этот Static ID уже привязан к другому аккаунту' });
    }

    const result = await prisma.staticId.upsert({
      where: { userId: req.user!.id },
      update: { value: parsed.data.staticId },
      create: { userId: req.user!.id, value: parsed.data.staticId },
    });

    await logAudit({
      actorId: req.user!.id,
      action: 'STATIC_ID_UPDATED',
      entityType: 'StaticId',
      entityId: result.id,
      payload: { value: parsed.data.staticId },
    });

    reply.send({ staticId: result.value });
  });
}
