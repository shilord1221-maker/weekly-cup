import type { FastifyInstance } from 'fastify';
import { prisma } from '@/db.js';
import { requireAuth } from '@/middleware/auth.js';
import { logAudit } from '@/services/audit.js';
import { isDiscordOAuthConfigured, buildDiscordAuthUrl, exchangeDiscordCode, discordAvatarUrl } from '@/services/discordOAuth.js';
import { signDiscordOAuthState, verifyDiscordOAuthState } from '@/utils/jwt.js';
import { grantRoleByName } from '@/services/discordBot.js';
import { env } from '@/env.js';

export async function discordRoutes(app: FastifyInstance) {
  app.get('/api/discord/status', async (req, reply) => {
    reply.send({ enabled: isDiscordOAuthConfigured() });
  });

  app.get('/api/discord/link', { preHandler: requireAuth }, async (req, reply) => {
    if (!isDiscordOAuthConfigured()) {
      return reply.code(503).send({ error: 'DISCORD_NOT_CONFIGURED', message: 'Привязка Discord временно недоступна' });
    }
    const state = signDiscordOAuthState(req.user!.id);
    reply.send({ url: buildDiscordAuthUrl(state) });
  });

  app.get('/api/discord/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const webOrigin = env.WEB_ORIGIN;

    if (!code || !state) {
      return reply.redirect(`${webOrigin}/profile?discord=error&reason=missing_params`);
    }

    let userId: string;
    try {
      const payload = verifyDiscordOAuthState(state);
      userId = payload.sub;
    } catch {
      return reply.redirect(`${webOrigin}/profile?discord=error&reason=invalid_state`);
    }

    try {
      const identity = await exchangeDiscordCode(code);

      const existing = await prisma.user.findUnique({ where: { discordId: identity.id } });
      if (existing && existing.id !== userId) {
        return reply.redirect(`${webOrigin}/profile?discord=error&reason=already_linked`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          discordId: identity.id,
          discordUsername: identity.username,
          discordAvatar: discordAvatarUrl(identity.id, identity.avatar),
          discordLinkedAt: new Date(),
        },
      });

      // Выдаём роль "Player" на самом Discord-сервере сразу после успешной привязки.
      // Сбой здесь не должен мешать привязке — она уже сохранена в БД, просто логируем ошибку.
      const roleResult = await grantRoleByName(identity.id, 'Player');
      if (!roleResult.ok) {
        req.log.warn({ reason: roleResult.reason, discordId: identity.id }, '[discord] Не удалось выдать роль Player после привязки');
      }

      await logAudit({ actorId: userId, action: 'DISCORD_LINKED', entityType: 'User', entityId: userId, payload: { discordId: identity.id } });
      reply.redirect(`${webOrigin}/profile?discord=success`);
    } catch (err) {
      req.log.error(err, 'Discord OAuth callback failed');
      reply.redirect(`${webOrigin}/profile?discord=error&reason=exchange_failed`);
    }
  });

  app.post('/api/discord/unlink', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.discordId) {
      return reply.code(400).send({ error: 'NOT_LINKED', message: 'Discord не привязан' });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { discordId: null, discordUsername: null, discordAvatar: null, discordLinkedAt: null, discordCurrentVoiceRole: null },
    });

    await logAudit({ actorId: req.user!.id, action: 'DISCORD_UNLINKED', entityType: 'User', entityId: req.user!.id });
    reply.send({ success: true });
  });
}
