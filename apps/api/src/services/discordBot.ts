import { Client, GatewayIntentBits, type Guild, type GuildMember } from 'discord.js';
import { env } from '@/env.js';
import { prisma } from '@/db.js';

let client: Client | null = null;
let ready = false;

export function isDiscordBotConfigured(): boolean {
  return !!(env.DISCORD_TOKEN && env.DISCORD_GUILD_ID);
}

export async function startDiscordBot(): Promise<void> {
  if (!isDiscordBotConfigured()) {
    console.log('[discord] DISCORD_TOKEN/DISCORD_GUILD_ID не заданы — бот не запускается');
    return;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  client.once('ready', () => {
    ready = true;
    console.log(`[discord] Бот подключён как ${client?.user?.tag}`);
  });

  client.on('error', (err) => {
    console.error('[discord] Ошибка клиента:', err);
  });

  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (err) {
    console.error('[discord] Не удалось подключиться к Discord:', err);
    client = null;
  }
}

function getGuild(): Guild | null {
  if (!client || !ready || !env.DISCORD_GUILD_ID) return null;
  return client.guilds.cache.get(env.DISCORD_GUILD_ID) ?? null;
}

export type GuildCheckResult =
  | { ok: true; member: GuildMember }
  | { ok: false; reason: 'BOT_OFFLINE' | 'NOT_IN_GUILD' | 'BANNED' | 'FETCH_FAILED' };

export async function checkGuildMembership(discordId: string): Promise<GuildCheckResult> {
  const guild = getGuild();
  if (!guild) return { ok: false, reason: 'BOT_OFFLINE' };

  try {
    const ban = await guild.bans.fetch(discordId).catch(() => null);
    if (ban) return { ok: false, reason: 'BANNED' };
  } catch {
    // Не критично — продолжаем к проверке членства даже если бот не может читать баны
  }

  try {
    const member = await guild.members.fetch(discordId);
    return { ok: true, member };
  } catch {
    return { ok: false, reason: 'NOT_IN_GUILD' };
  }
}

function findRoleByName(guild: Guild, name: string) {
  return guild.roles.cache.find((r) => r.name === name) ?? null;
}

const MODE_TO_ROLE_SUFFIX: Record<string, '2x2' | '3x3' | '4x4' | '5x5'> = {
  MODE_2X2: '2x2',
  MODE_3X3: '3x3',
  MODE_4X4: '4x4',
  MODE_5X5: '5x5',
};

/** Преобразует MatchMode enum ('MODE_2X2' и т.д.) в суффикс имени роли ('2x2' и т.д.) */
export function modeToRoleSuffix(mode: string): '2x2' | '3x3' | '4x4' | '5x5' | null {
  return MODE_TO_ROLE_SUFFIX[mode] ?? null;
}

export function voiceRoleName(mode: '2x2' | '3x3' | '4x4' | '5x5', teamNumber: number): string {
  return `Voice ${teamNumber} ${mode}`;
}

export interface RoleSyncResult {
  ok: boolean;
  reason?: 'BOT_OFFLINE' | 'NOT_IN_GUILD' | 'ROLE_NOT_FOUND' | 'MISSING_PERMISSIONS' | 'UNKNOWN_ERROR';
}

export async function syncVoiceRole(discordId: string, roleName: string | null): Promise<RoleSyncResult> {
  const guild = getGuild();
  if (!guild) return { ok: false, reason: 'BOT_OFFLINE' };

  let member: GuildMember;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    return { ok: false, reason: 'NOT_IN_GUILD' };
  }

  try {
    const currentVoiceRoles = member.roles.cache.filter((r) => /^Voice \d+ (2x2|3x3|4x4|5x5)$/.test(r.name));
    if (currentVoiceRoles.size > 0) {
      await member.roles.remove([...currentVoiceRoles.values()]);
    }

    if (roleName) {
      const role = findRoleByName(guild, roleName);
      if (!role) return { ok: false, reason: 'ROLE_NOT_FOUND' };
      await member.roles.add(role);
    }

    return { ok: true };
  } catch (err: any) {
    if (err?.code === 50013) return { ok: false, reason: 'MISSING_PERMISSIONS' };
    console.error('[discord] syncVoiceRole error:', err);
    return { ok: false, reason: 'UNKNOWN_ERROR' };
  }
}

/**
 * Высокоуровневый помощник для лобби-роутов: по режиму матча и слоту команды вычисляет
 * имя роли, синхронизирует её на Discord и сохраняет текущее состояние в БД для диагностики.
 * Если discordId пустой (Discord не настроен глобально) или синхронизация не удалась —
 * молча возвращает результат без выброса исключения, чтобы вызывающий код решал сам,
 * насколько критична ошибка (по п.7 — сайт никогда не должен падать из-за Discord).
 */
export async function syncTeamVoiceRoleForUser(
  userId: string,
  discordId: string,
  mode: string,
  teamSlot: number | null
): Promise<RoleSyncResult> {
  if (!discordId) return { ok: true };

  const suffix = teamSlot !== null ? modeToRoleSuffix(mode) : null;
  const roleName = suffix && teamSlot !== null ? voiceRoleName(suffix, teamSlot) : null;

  const result = await syncVoiceRole(discordId, roleName);

  try {
    await prisma.user.update({ where: { id: userId }, data: { discordCurrentVoiceRole: result.ok ? roleName : null } });
  } catch (err) {
    console.error('[discord] Не удалось сохранить discordCurrentVoiceRole:', err);
  }

  return result;
}
