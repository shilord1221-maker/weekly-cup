import { prisma } from '@/db.js';

export type DiscordGateResult = { ok: true; discordId: string };

/**
 * Discord больше не обязателен для участия в лобби — эта проверка отключена по решению
 * владельца проекта. Функция оставлена (а не удалена) ради совместимости с местами,
 * которые её вызывают: всегда пропускает пользователя, но если Discord привязан —
 * возвращает discordId, чтобы автоматическая синхронизация Voice-ролей продолжала
 * работать для тех, кто привязку всё же сделал добровольно.
 */
export async function checkDiscordGate(userId: string): Promise<DiscordGateResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  return { ok: true, discordId: user?.discordId ?? '' };
}
