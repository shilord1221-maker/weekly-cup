import { prisma } from '@/db.js';
import { isDiscordBotConfigured, checkGuildMembership } from '@/services/discordBot.js';

export type DiscordGateResult =
  | { ok: true; discordId: string }
  | { ok: false; code: string; message: string };

/**
 * Проверяет, может ли пользователь участвовать в лобби прямо сейчас — обязательная
 * Discord-привязка + актуальное членство на сервере (п.10–11). Всегда обращается
 * к Discord API заново, а не доверяет старым данным из БД. Если бот не настроен
 * (DISCORD_TOKEN/DISCORD_GUILD_ID не заданы), проверка пропускается полностью,
 * чтобы не блокировать сайт там, где Discord-интеграция ещё не подключена.
 */
export async function checkDiscordGate(userId: string): Promise<DiscordGateResult> {
  if (!isDiscordBotConfigured()) {
    return { ok: true, discordId: '' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!user?.discordId) {
    return { ok: false, code: 'DISCORD_NOT_LINKED', message: 'Для участия необходимо привязать Discord аккаунт.' };
  }

  const membership = await checkGuildMembership(user.discordId);
  if (!membership.ok) {
    switch (membership.reason) {
      case 'NOT_IN_GUILD':
        return { ok: false, code: 'DISCORD_NOT_IN_GUILD', message: 'Вы должны вступить в Discord сервер.' };
      case 'BANNED':
        return { ok: false, code: 'DISCORD_BANNED', message: 'Вы не можете участвовать в лобби.' };
      case 'BOT_OFFLINE':
        return { ok: true, discordId: user.discordId };
      default:
        return { ok: false, code: 'DISCORD_CHECK_FAILED', message: 'Ваш Discord аккаунт не найден на сервере.' };
    }
  }

  return { ok: true, discordId: user.discordId };
}
