'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { ColoredUsername } from '@/components/ColoredUsername';
import { StackTag } from '@/components/StackTag';
import { roleLabel } from '@/store/auth';

interface PublicProfile {
  id: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  activeUsernameEffect: string | null;
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
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="flex items-start gap-6 mb-8 flex-wrap">
        <div className="relative">
          <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size={80} />
        </div>
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
            {profile.staticId && <span className="font-mono">ID: {profile.staticId.value}</span>}
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
      <div className="grid grid-cols-3 gap-3 mb-8">
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
            <img src="/token.png" alt="Token" className="w-6 h-6 rounded-full object-cover" />
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
