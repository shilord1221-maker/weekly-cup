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
  const [tab, setTab] = useState<'top' | 'today' | 'gfc'>('top');

  const { data: leaderboard, isLoading: loadingTop } = useQuery<LeaderboardItem[]>({
    queryKey: ['wins-leaderboard'],
    queryFn: () => api.get('/wins/leaderboard', { auth: false }),
  });

  const { data: todayTop, isLoading: loadingToday } = useQuery<DayTopItem[]>({
    queryKey: ['wins-today-top'],
    queryFn: () => api.get('/wins/today-top', { auth: false }),
    refetchInterval: 60_000,
  });

  const { data: gfcTop, isLoading: loadingGfc } = useQuery<LeaderboardItem[]>({
    queryKey: ['gfc-leaderboard'],
    queryFn: () => api.get('/gfc/leaderboard', { auth: false }),
    enabled: tab === 'gfc',
  });

  const isLoading = tab === 'top' ? loadingTop : tab === 'today' ? loadingToday : loadingGfc;
  const items = tab === 'top' ? leaderboard : tab === 'today' ? todayTop : gfcTop;

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
      <div className="flex gap-1 p-1 rounded-full mb-8 w-fit flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
        {([['top', '🏆 Топ всех времён'], ['today', '🔥 Топ сегодня'], ['gfc', '⚔️ GFC Топ']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className="text-sm font-medium px-5 py-2 rounded-full transition-all"
            style={{ color: tab === t ? '#0a0d16' : 'var(--muted)', background: tab === t ? '#fff' : 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* GFC Топ — шапка */}
      {tab === 'gfc' && (
        <div className="rounded-xl px-5 py-3 mb-6 flex items-center justify-between" style={{ background: 'rgba(79,127,255,.04)', border: '1px solid rgba(79,127,255,.15)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            ⚔️ Топ игроков по победам в GFC (Gang Fight Club)
          </p>
          <Link href="/gfc" style={{ color: 'var(--a)', fontSize: '13px' }}>Все лобби →</Link>
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      {!isLoading && (!items || items.length === 0) && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Пока нет данных.</p>
      )}

      {/* Первое место — hero карточка */}
      {items && items.length > 0 && (() => {
        const p = items[0];
        const stack = (p as LeaderboardItem).stack ?? null;
        return (
          <Link href={`/users/${p.userId}`} className="block relative rounded-2xl overflow-hidden mb-3 transition-all hover:scale-[1.01]"
            style={{ border: '1px solid rgba(201,149,74,.4)', boxShadow: '0 0 40px rgba(201,149,74,.12)' }}>
            {/* Фон */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(201,149,74,.15) 0%, rgba(139,92,246,.08) 50%, rgba(5,7,15,1) 100%)' }} />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(201,149,74,.06), transparent 60%)' }} />
            <div className="relative z-10 flex items-center gap-6 px-6 py-6 flex-wrap">
              {/* Лейбл */}
              <div className="flex-shrink-0 text-center">
                <span style={{ fontSize: '36px', filter: 'drop-shadow(0 0 12px rgba(201,149,74,.8))' }}>👑</span>
                <div className="font-mono text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--gold)' }}>
                  {tab === 'top' ? '#1 Лучший' : tab === 'today' ? '#1 Сегодня' : '#1 GFC'}
                </div>
              </div>
              {/* Аватар */}
              <Avatar username={p.username} avatarUrl={p.avatarUrl} size={64} frameKey={p.activeFrameEffect} />
              {/* Инфо */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {stack && <Link href={`/stacks/${stack.id}`} onClick={(e) => e.stopPropagation()}><StackTag tag={stack.tag} color={stack.tagColor} /></Link>}
                </div>
                <div className="font-display font-bold" style={{ fontSize: 'clamp(20px,3vw,28px)', color: 'var(--gold)' }}>
                  <ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} />
                </div>
              </div>
              {/* Счётчик */}
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold" style={{ fontSize: '48px', color: 'var(--gold)', lineHeight: 1, textShadow: '0 0 30px rgba(201,149,74,.5)' }}>{p.count}</div>
                <div className="text-xs font-mono" style={{ color: 'rgba(201,149,74,.6)' }}>{tab === 'gfc' ? 'GFC побед' : p.count === 1 ? 'победа' : p.count < 5 ? 'победы' : 'побед'}</div>
              </div>
            </div>
          </Link>
        );
      })()}

      <div className="flex flex-col gap-2">
        {items?.slice(1).map((p, idx) => {
          const isTop3 = idx < 2; // idx 0,1 = позиции 2,3
          const stack = (p as LeaderboardItem).stack ?? null;
          return (
            <Link
              key={p.userId}
              href={`/users/${p.userId}`}
              className="flex items-center gap-4 rounded-2xl transition-all hover:translate-x-1"
              style={{
                border: isTop3 ? '1px solid rgba(255,255,255,.08)' : '1px solid var(--border)',
                background: 'var(--surface)',
                paddingRight: '20px',
              }}
            >
              <div className="flex-shrink-0 w-12 text-center pl-4">
                <Medal idx={idx + 1} />
              </div>

              {/* Аватар */}
              <div className="flex-shrink-0 py-3">
                <Avatar username={p.username} avatarUrl={p.avatarUrl} size={44} frameKey={p.activeFrameEffect} />
              </div>

              {/* Инфо */}
              <div className="flex-1 min-w-0 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {stack && (
                    <Link href={`/stacks/${stack.id}`} onClick={(e) => e.stopPropagation()}>
                      <StackTag tag={stack.tag} color={stack.tagColor} />
                    </Link>
                  )}
                  <span className="font-semibold text-sm">
                    <ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} />
                  </span>
                </div>
              </div>

              {/* Счётчик побед */}
              <div className="flex-shrink-0 text-right">
                <div className="font-display font-bold" style={{ fontSize: '24px', color: idx < 2 ? 'var(--text)' : 'var(--muted)', lineHeight: 1 }}>
                  {p.count}
                </div>
                <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  {tab === 'gfc' ? 'GFC' : p.count === 1 ? 'победа' : p.count < 5 ? 'победы' : 'побед'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
