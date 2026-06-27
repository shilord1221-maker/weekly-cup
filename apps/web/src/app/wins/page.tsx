'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';
import { ColoredUsername } from '@/components/ColoredUsername';
import { TokenIcon } from '@/components/TokenIcon';

interface LeaderboardItem {
  userId: string;
  username: string;
  avatarUrl: string | null;
  activeUsernameEffect: string | null;
  activeFrameEffect: string | null;
  stack: { id: string; name: string; tag: string; tagColor: string } | null;
  count: number;
}

interface DayTopItem {
  userId: string;
  username: string;
  avatarUrl: string | null;
  activeUsernameEffect: string | null;
  activeFrameEffect: string | null;
  stack?: { id: string; name: string; tag: string; tagColor: string } | null;
  count: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин. назад`;
  if (h < 24) return `${h} ч. назад`;
  return `${d} дн. назад`;
}

function Medal({ idx }: { idx: number }) {
  if (idx === 0) return <span style={{ fontSize: '22px' }}>👑</span>;
  if (idx === 1) return <span className="font-display font-bold text-lg" style={{ color: '#94a3b8' }}>2</span>;
  if (idx === 2) return <span className="font-display font-bold text-lg" style={{ color: '#cd7f32' }}>3</span>;
  return <span className="font-display font-bold text-sm" style={{ color: 'var(--muted)' }}>{idx + 1}</span>;
}

export default function WinsPage() {
  const [tab, setTab] = useState<'top' | 'today'>('top');

  const { data: leaderboard, isLoading: loadingTop } = useQuery<LeaderboardItem[]>({
    queryKey: ['wins-leaderboard'],
    queryFn: () => api.get('/wins/leaderboard', { auth: false }),
  });

  const { data: todayTop, isLoading: loadingToday } = useQuery<DayTopItem[]>({
    queryKey: ['wins-today-top'],
    queryFn: () => api.get('/wins/today-top', { auth: false }),
    refetchInterval: 60_000,
  });

  const isLoading = tab === 'top' ? loadingTop : loadingToday;
  const items = tab === 'top' ? leaderboard : todayTop;

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: '32px' }}>🏆</span>
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.01em' }}>
              Лента побед
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Смотри, кто побеждает. Стань следующим.</p>
        </div>
      </div>

      {/* ТАБЫ */}
      <div className="flex gap-1 p-1 rounded-full mb-8 w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
        <button
          onClick={() => setTab('top')}
          className="text-sm font-medium px-6 py-2 rounded-full transition-all"
          style={{ color: tab === 'top' ? '#0a0d16' : 'var(--muted)', background: tab === 'top' ? '#fff' : 'transparent' }}
        >
          🏆 Топ всех времён
        </button>
        <button
          onClick={() => setTab('today')}
          className="text-sm font-medium px-6 py-2 rounded-full transition-all"
          style={{ color: tab === 'today' ? '#0a0d16' : 'var(--muted)', background: tab === 'today' ? '#fff' : 'transparent' }}
        >
          🔥 Топ сегодня
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      {!isLoading && (!items || items.length === 0) && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Пока нет данных.</p>
      )}

      <div className="flex flex-col gap-2">
        {items?.map((p, idx) => {
          const isFirst = idx === 0;
          const stack = (p as LeaderboardItem).stack ?? null;
          return (
            <Link
              key={p.userId}
              href={`/users/${p.userId}`}
              className="flex items-center gap-4 rounded-2xl transition-all hover:translate-x-1"
              style={{
                border: isFirst ? '1px solid rgba(201,149,74,.4)' : '1px solid var(--border)',
                background: isFirst ? 'linear-gradient(90deg,rgba(201,149,74,.07),var(--surface))' : 'var(--surface)',
                boxShadow: isFirst ? '0 0 24px rgba(201,149,74,.08)' : 'none',
                paddingRight: '20px',
              }}
            >
              {/* Блок ЛУЧШАЯ ПОБЕДА / позиция */}
              {isFirst ? (
                <div
                  className="flex-shrink-0 flex flex-col items-center justify-center gap-1 self-stretch px-4 py-4"
                  style={{ minWidth: '90px', background: 'linear-gradient(135deg,rgba(201,149,74,.18),rgba(201,149,74,.06))', borderRight: '1px solid rgba(201,149,74,.2)' }}
                >
                  <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 8px rgba(201,149,74,.6))' }}>🏆</span>
                  <div className="font-display font-bold text-center uppercase leading-tight" style={{ fontSize: '9px', letterSpacing: '0.06em', color: 'var(--gold)' }}>
                    {tab === 'top' ? 'Лучший\nигрок' : 'Лучший\nсегодня'}
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 w-12 text-center pl-4">
                  <Medal idx={idx} />
                </div>
              )}

              {/* Аватар */}
              <div className="flex-shrink-0 py-3">
                <Avatar
                  username={p.username}
                  avatarUrl={p.avatarUrl}
                  size={isFirst ? 52 : 44}
                  frameKey={p.activeFrameEffect}
                />
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {stack && (
                    <Link href={`/stacks/${stack.id}`} onClick={(e) => e.stopPropagation()}>
                      <StackTag tag={stack.tag} color={stack.tagColor} />
                    </Link>
                  )}
                  <span className="font-semibold text-sm" style={{ color: isFirst ? 'var(--gold)' : 'var(--text)' }}>
                    <ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} />
                  </span>
                </div>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.07)', border: '1px solid rgba(201,149,74,.18)' }}>
                    🏆 Победитель
                  </span>
                </div>
              </div>

              {/* Счётчик побед */}
              <div className="flex-shrink-0 text-right">
                <div className="font-display font-bold" style={{ fontSize: '28px', color: isFirst ? 'var(--gold)' : idx < 3 ? 'var(--text)' : 'var(--muted)', lineHeight: 1 }}>
                  {p.count}
                </div>
                <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {p.count === 1 ? 'победа' : p.count < 5 ? 'победы' : 'побед'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
