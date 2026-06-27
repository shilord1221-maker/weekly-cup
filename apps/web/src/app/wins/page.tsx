'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';
import { ColoredUsername } from '@/components/ColoredUsername';

interface WinItem {
  id: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string | null; activeUsernameEffect?: string | null };
  match: { id: string; mode: string; map: { name: string; imageUrl: string } };
  team: { name: string };
  userStack?: { id: string; name: string; tag: string; tagColor: string } | null;
}

const MODE_LABELS: Record<string, string> = {
  MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5',
};

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

export default function WinsPage() {
  const [mode, setMode] = useState('');

  const { data: wins, isLoading, refetch, isFetching } = useQuery<WinItem[]>({
    queryKey: ['wins-full'],
    queryFn: () => api.get('/wins', { auth: false }),
  });

  const filtered = mode ? wins?.filter((w) => w.match.mode === mode) : wins;
  const today = wins?.filter((w) => {
    const d = new Date(w.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length ?? 0;

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontSize: '32px' }}>🏆</span>
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
              Лента побед
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Смотри, кто побеждает. Стань следующим.</p>
        </div>

        {/* Фильтр по режиму */}
        <div className="flex items-center gap-1.5 p-1 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          {[['', 'Все режимы'], ['MODE_2X2', '2×2'], ['MODE_3X3', '3×3'], ['MODE_4X4', '4×4'], ['MODE_5X5', '5×5']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className="text-xs font-medium px-4 py-2 rounded-full transition-all"
              style={{ color: mode === val ? '#0a0d16' : 'var(--muted)', background: mode === val ? '#fff' : 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* СПИСОК */}
        <div className="flex-1 min-w-0">
          {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

          {!isLoading && (!filtered || filtered.length === 0) && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Нет побед в этой категории.</p>
          )}

          <div className="flex flex-col gap-2">
            {filtered?.map((w, idx) => {
              const isFirst = idx === 0 && !mode;
              return (
                <Link
                  key={w.id}
                  href={`/lobby/${w.match.id}`}
                  className="flex items-center gap-4 rounded-2xl transition-all hover:translate-x-1 overflow-hidden"
                  style={{
                    border: isFirst ? '1px solid rgba(201,149,74,.45)' : '1px solid var(--border)',
                    background: isFirst ? 'linear-gradient(90deg,rgba(201,149,74,.07),var(--surface) 40%)' : 'var(--surface)',
                    boxShadow: isFirst ? '0 0 32px rgba(201,149,74,.1)' : 'none',
                    paddingRight: '20px',
                  }}
                >
                  {/* ЛУЧШАЯ ПОБЕДА ДНЯ — левый блок только для первого */}
                  {isFirst ? (
                    <div
                      className="flex-shrink-0 flex flex-col items-center justify-center gap-2 self-stretch px-4 py-5"
                      style={{
                        minWidth: '90px',
                        background: 'linear-gradient(135deg,rgba(201,149,74,.18),rgba(201,149,74,.06))',
                        borderRight: '1px solid rgba(201,149,74,.2)',
                      }}
                    >
                      <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(201,149,74,.6))' }}>🏆</span>
                      <div className="font-display font-bold text-center uppercase leading-tight" style={{ fontSize: '9px', letterSpacing: '0.06em', color: 'var(--gold)' }}>
                        Лучшая<br />победа<br />дня
                      </div>
                    </div>
                  ) : (
                    /* Позиция для остальных */
                    <div className="flex-shrink-0 w-12 text-center pl-4">
                      <span className="font-display font-bold text-sm" style={{ color: idx < 3 ? 'var(--gold)' : 'var(--muted)' }}>
                        {idx + 1}
                      </span>
                    </div>
                  )}

                  {/* Аватар */}
                  <div
                    className="flex-shrink-0"
                    style={isFirst ? {
                      padding: '3px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#fde68a,#f59e0b,#d97706)',
                      boxShadow: '0 0 12px rgba(201,149,74,.5)',
                    } : {}}
                  >
                    <div style={isFirst ? { borderRadius: '50%', overflow: 'hidden' } : {}}>
                      <Avatar username={w.user.username} avatarUrl={w.user.avatarUrl} size={isFirst ? 48 : 44} />
                    </div>
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {w.userStack && (
                        <Link href={`/stacks/${w.userStack.id}`}>
                          <StackTag tag={w.userStack.tag} color={w.userStack.tagColor} />
                        </Link>
                      )}
                      <Link href={`/users/${w.user.id}`} className="font-semibold text-sm hover:underline" style={{ color: isFirst ? 'var(--gold)' : 'var(--text)' }}>
                        <ColoredUsername username={w.user.username} effectKey={w.user.activeUsernameEffect} />
                      </Link>
                      <span
                        className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)' }}
                      >
                        {w.team.name}
                      </span>
                      <span
                        className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.15)' }}
                      >
                        {MODE_LABELS[w.match.mode] ?? w.match.mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.07)', border: '1px solid rgba(201,149,74,.18)' }}
                      >
                        🏆 Победитель
                      </span>
                    </div>
                  </div>

                  {/* Время */}
                  <div className="text-xs text-right flex-shrink-0" style={{ color: 'var(--muted)', minWidth: '80px' }}>
                    {timeAgo(w.createdAt)}
                  </div>

                  {/* Карта */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="w-20 h-12 rounded-lg overflow-hidden" style={{ border: isFirst ? '1px solid rgba(201,149,74,.3)' : '1px solid var(--border)' }}>
                      {w.match.map?.imageUrl ? (
                        <img src={w.match.map.imageUrl} alt={w.match.map.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>🗺️</div>
                      )}
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                      📍 {w.match.map?.name}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Кнопка обновить */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 btn-out"
              style={{ fontSize: '13px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {isFetching ? 'Обновляем...' : 'Обновить ленту'}
            </button>
          </div>
        </div>

        {/* SIDEBAR — статистика */}
        <div className="hidden lg:flex flex-col gap-3 flex-shrink-0" style={{ width: '200px' }}>
          <div className="rounded-2xl px-5 py-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Статистика ленты
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>🏆</span>
                  <span className="font-display font-bold text-xl">{wins?.length ?? 0}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>Всего побед</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>☀️</span>
                  <span className="font-display font-bold text-xl">{today}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>За сегодня</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>👥</span>
                  <span className="font-display font-bold text-xl">
                    {new Set(wins?.map((w) => w.user.id)).size ?? 0}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>Победителей</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
