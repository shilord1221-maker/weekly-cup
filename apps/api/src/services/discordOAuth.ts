import { env } from '@/env.js';

export function isDiscordOAuthConfigured(): boolean {
  return !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_REDIRECT_URI);
}

export function buildDiscordAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID!,
    redirect_uri: env.DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

interface DiscordIdentity {
  id: string;
  username: string;
  avatar: string | null;
}

export async function exchangeDiscordCode(code: string): Promise<DiscordIdentity> {
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) {
    throw new Error(`Discord user fetch failed: ${userRes.status}`);
  }
  const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };

  return { id: user.id, username: user.username, avatar: user.avatar };
}

export function discordAvatarUrl(discordId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
}
