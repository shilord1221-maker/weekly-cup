'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { ColoredUsername } from '@/components/ColoredUsername';
import { TokenIcon } from '@/components/TokenIcon';
import { StackTag } from '@/components/StackTag';
import { roleLabel } from '@/store/auth';

interface PublicProfile {
  id: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  activeUsernameEffect: string | null;
  activeFrameEffect: string | null;
  profileBg: string | null;
  discordUsername: string | null;
  discordId: string | null;
  profileBgPosition: string | null;
  tokenBalance: number;
  staticId: { value: string } | null;
  achievements: { id: string; title: string; earnedAt: string }[];
  wins: { id: string; createdAt: string; match: { id: string; map: { name: string; imageUrl: string } }; team: { name: string } }[];
  stackMembership: { stack: { id: string; name: string; tag: string; tagColor: string; logoUrl: string | null } } | null;
  _count: { wins: number };
}

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  OWNER:     { label: 'Owner',      color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
  ADMIN:     { label: 'Admin',      color: '#8b5cf6', bg: 'rgba(139,92,246,.1)' },
  ORGANIZER: { label: 'Organizer',  color: '#4f7fff', bg: 'rgba(79,127,255,.1)' },
  PLAYER:    { label: 'Player',     color: 'var(--muted)', bg: 'rgba(255,255,255,.04)' },
};

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ['public-profile', id],
    queryFn: () => api.get(`/users/${id}/profile`, { auth: false }),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Игрок не найден.</p>
      </div>
    );
  }

  const badge = ROLE_BADGE[profile.role] ?? ROLE_BADGE.PLAYER;
  const joinDate = new Date(profile.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen px-6 md:px-10 pb-20 max-w-3xl mx-auto relative" style={{ background: 'var(--bg)' }}>

      {/* ФОН ПРОФИЛЯ */}
      {profile.profileBg && (
        <div className="absolute top-0 left-0 right-0 h-72 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
          <img src={profile.profileBg} alt="" className="w-full h-full object-cover" style={{ objectPosition: profile.profileBgPosition ?? '50% 30%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(5,7,15,.1) 0%, rgba(5,7,15,.7) 60%, rgba(5,7,15,1) 100%)' }} />
        </div>
      )}

      {/* HEADER */}
      <div className={`flex items-start gap-6 mb-8 flex-wrap relative z-10 ${profile.profileBg ? 'pt-32' : 'pt-32'}`}>
        <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size={80} frameKey={profile.activeFrameEffect} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(22px,4vw,34px)', letterSpacing: '-0.01em' }}>
              <ColoredUsername username={profile.username} effectKey={profile.activeUsernameEffect} />
            </h1>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full" style={{ color: badge.color, background: badge.bg }}>
              {badge.label}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--muted)' }}>
            {profile.staticId && <span className="font-mono">SID: {profile.staticId.value}</span>}
            {profile.discordUsername && (
              <span className="flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.876 19.876 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029z"/></svg>
                {profile.discordUsername}
              </span>
            )}
            <span>На сайте с {joinDate}</span>
          </div>

          {/* Стак */}
          {profile.stackMembership && (
            <div className="mt-2">
              <Link href={`/stacks/${profile.stackMembership.stack.id}`} className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80">
                <StackTag tag={profile.stackMembership.stack.tag} color={profile.stackMembership.stack.tagColor} />
                <span style={{ color: 'var(--muted)' }}>{profile.stackMembership.stack.name}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* СТАТИСТИКА */}
      <div className="grid grid-cols-3 gap-3 mb-8 relative z-10">
        <div className="rounded-2xl px-4 py-4 text-center" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="font-display font-bold text-2xl" style={{ color: 'var(--gold)' }}>🏆 {profile._count.wins}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Побед</div>
        </div>
        <div className="rounded-2xl px-4 py-4 text-center" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="font-display font-bold text-2xl">{profile.achievements.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Достижений</div>
        </div>
        <div className="rounded-2xl px-4 py-4 text-center" style={{ border: '1px solid rgba(201,149,74,.2)', background: 'rgba(201,149,74,.04)' }}>
          <div className="font-display font-bold text-2xl flex items-center justify-center gap-2" style={{ color: 'var(--gold)' }}>
            <TokenIcon size={24} />
            {profile.tokenBalance}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Токенов</div>
        </div>
      </div>

      {/* ДОСТИЖЕНИЯ */}
      {profile.achievements.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Достижения
          </h2>
          <div className="flex flex-col gap-1">
            {profile.achievements.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🏆 {a.title}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{new Date(a.earnedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ИСТОРИЯ ПОБЕД */}
      <div className="card">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Последние победы
        </h2>
        {profile.wins.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Пока нет побед.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.wins.map((w) => (
              <Link
                key={w.id}
                href={`/lobby/${w.match.id}`}
                className="flex items-center gap-3 py-2 rounded-lg px-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {w.match.map.imageUrl && (
                  <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
                    <img src={w.match.map.imageUrl} alt={w.match.map.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">🏆 {w.team.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>📍 {w.match.map.name}</div>
                </div>
                <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                  {new Date(w.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
