'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';
import { ColoredUsername } from '@/components/ColoredUsername';

interface LeaderboardItem {
  userId: string; username: string; avatarUrl: string | null;
  activeUsernameEffect: string | null; activeFrameEffect: string | null;
  stack: { id: string; name: string; tag: string; tagColor: string } | null;
  count: number;
}
type DayTopItem = LeaderboardItem;

function Medal({ idx }: { idx: number }) {
  if (idx === 0) return <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)', boxShadow: '0 0 12px rgba(245,158,11,.5)' }}>👑</div>;
  if (idx === 1) return <div className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold" style={{ background: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', color: '#0a0d16', fontSize: '14px' }}>2</div>;
  if (idx === 2) return <div className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold" style={{ background: 'linear-gradient(135deg,#cd7f32,#92400e)', color: '#fde68a', fontSize: '14px' }}>3</div>;
  return <span className="font-display font-bold text-sm w-8 text-center block" style={{ color: 'var(--muted)' }}>{idx + 1}</span>;
}

const BG_COLORS = [
  'rgba(201,149,74,.12)', 'rgba(148,163,184,.08)', 'rgba(205,127,50,.08)',
  'rgba(79,127,255,.05)', 'rgba(139,92,246,.05)',
];

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
  const items: LeaderboardItem[] = (tab === 'top' ? leaderboard : tab === 'today' ? todayTop : gfcTop) ?? [];
  const winLabel = tab === 'gfc' ? 'GFC побед' : '';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* HERO */}
      <div className="relative overflow-hidden pt-32 pb-12 px-6 md:px-10">
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,149,74,.07), transparent)' }} />
        </div>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span style={{ fontSize: '36px', filter: 'drop-shadow(0 0 12px rgba(201,149,74,.6))' }}>🏆</span>
                <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
                  Лента побед
                </h1>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Смотри, кто побеждает. Стань следующим.</p>
            </div>
          </div>

          {/* Табы */}
          <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)' }}>
            {([['top','🏆 Топ всех времён'],['today','🔥 Сегодня'],['gfc','⚔️ GFC']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} className="text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
                style={{ color: tab === t ? '#0a0d16' : 'var(--muted)', background: tab === t ? '#fff' : 'transparent' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-10 pb-20">
        {tab === 'gfc' && (
          <div className="rounded-xl px-5 py-3 mb-6 flex items-center justify-between" style={{ background: 'rgba(79,127,255,.04)', border: '1px solid rgba(79,127,255,.15)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>⚔️ Рейтинг по победам в GFC матчах</p>
            <Link href="/gfc" style={{ color: 'var(--a)', fontSize: '13px' }}>Все лобби →</Link>
          </div>
        )}

        {isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Загрузка...</p>}
        {!isLoading && items.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>Пока нет данных.</p>}

        {/* #1 — Hero карточка */}
        {items.length > 0 && (() => {
          const p = items[0];
          const stack = p.stack ?? null;
          return (
            <Link href={`/users/${p.userId}`} className="group block relative rounded-2xl overflow-hidden mb-4 transition-all hover:scale-[1.01] hover:shadow-2xl"
              style={{ border: '1px solid rgba(201,149,74,.4)', minHeight: '140px' }}>
              {/* Фон */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(201,149,74,.2) 0%, rgba(139,92,246,.08) 40%, rgba(5,7,15,.95) 100%)' }} />
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(201,149,74,.1), transparent 50%)' }} />
              {/* Световые частицы */}
              <div className="absolute right-10 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(201,149,74,.15), transparent)', filter: 'blur(20px)' }} />

              <div className="relative z-10 flex items-center gap-6 px-8 py-7 flex-wrap">
                <div className="text-center flex-shrink-0">
                  <div style={{ fontSize: '40px', filter: 'drop-shadow(0 0 16px rgba(201,149,74,.9))' }}>👑</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest mt-1" style={{ color: 'rgba(201,149,74,.7)' }}>
                    {tab === 'top' ? '#1 Лучший' : tab === 'today' ? '#1 Сегодня' : '#1 GFC'}
                  </div>
                </div>
                <Avatar username={p.username} avatarUrl={p.avatarUrl} size={72} frameKey={p.activeFrameEffect} />
                <div className="flex-1 min-w-0">
                  {stack && <span onClick={(e) => { e.preventDefault(); window.location.href=`/stacks/${stack.id}`; }}><StackTag tag={stack.tag} color={stack.tagColor} /></span>}
                  <div className="font-display font-bold mt-1" style={{ fontSize: 'clamp(22px,4vw,34px)', color: 'var(--gold)' }}>
                    <ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-display font-bold" style={{ fontSize: '56px', color: 'var(--gold)', lineHeight: 1, textShadow: '0 0 40px rgba(201,149,74,.6)' }}>{p.count}</div>
                  <div className="text-xs font-mono" style={{ color: 'rgba(201,149,74,.6)' }}>{winLabel || (p.count === 1 ? 'победа' : p.count < 5 ? 'победы' : 'побед')}</div>
                </div>
              </div>
            </Link>
          );
        })()}

        {/* Места 2-3 */}
        {items.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {items.slice(1, 3).map((p, i) => {
              const idx = i + 1;
              const stack = p.stack ?? null;
              const bg = idx === 1 ? 'rgba(148,163,184,.06)' : 'rgba(205,127,50,.06)';
              const border = idx === 1 ? 'rgba(148,163,184,.2)' : 'rgba(205,127,50,.2)';
              return (
                <Link key={p.userId} href={`/users/${p.userId}`} className="relative block rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl"
                  style={{ border: `1px solid ${border}`, background: bg, minHeight: '100px' }}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <Medal idx={idx} />
                    <Avatar username={p.username} avatarUrl={p.avatarUrl} size={44} frameKey={p.activeFrameEffect} />
                    <div className="flex-1 min-w-0">
                      {stack && <StackTag tag={stack.tag} color={stack.tagColor} />}
                      <div className="font-semibold text-sm mt-0.5"><ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} /></div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-2xl">{p.count}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{winLabel || 'побед'}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Места 4+ */}
        <div className="flex flex-col gap-2">
          {items.slice(3).map((p, i) => {
            const idx = i + 3;
            const stack = p.stack ?? null;
            return (
              <Link key={p.userId} href={`/users/${p.userId}`} className="flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all hover:translate-x-1"
                style={{ border: '1px solid var(--border)', background: BG_COLORS[i % BG_COLORS.length] ?? 'var(--surface)' }}>
                <span className="font-display font-bold w-8 text-center" style={{ color: 'var(--muted)', fontSize: '14px' }}>{idx + 1}</span>
                <Avatar username={p.username} avatarUrl={p.avatarUrl} size={36} frameKey={p.activeFrameEffect} />
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  {stack && <StackTag tag={stack.tag} color={stack.tagColor} />}
                  <span className="text-sm font-medium"><ColoredUsername username={p.username} effectKey={p.activeUsernameEffect} /></span>
                </div>
                <div className="font-display font-bold text-xl" style={{ color: 'var(--muted)' }}>{p.count}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
