'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';

interface MatchItem {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { name: string; imageUrl: string };
  organizer: { username: string };
  winnerTeam?: { name: string } | null;
}

const MODE_LABELS: Record<string, string> = {
  MODE_2X2: '2×2',
  MODE_3X3: '3×3',
  MODE_4X4: '4×4',
  MODE_5X5: '5×5',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Черновик', color: 'var(--muted)' },
  SCHEDULED: { label: 'Запланирован', color: 'var(--a)' },
  LIVE: { label: 'LIVE', color: 'var(--green)' },
  FINISHED: { label: 'Завершён', color: 'var(--muted)' },
  CANCELLED: { label: 'Отменён', color: '#ef4444' },
};

export default function MatchesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isStaff = isOrganizerOrAbove(user?.role);

  const { data: matches, isLoading } = useQuery<MatchItem[]>({
    queryKey: ['matches'],
    queryFn: () => api.get('/matches', { auth: false }),
  });

  const handleDelete = async (e: React.MouseEvent, matchId: string, mapName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить матч «${mapName}»? Это действие нельзя отменить.`)) return;
    setDeletingId(matchId);
    try {
      await api.delete(`/matches/${matchId}`);
      qc.invalidateQueries({ queryKey: ['matches'] });
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Не удалось удалить матч');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--a)' }}>
            <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
            Расписание
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(32px,5vw,48px)', letterSpacing: '-0.01em' }}>
            Все матчи
          </h1>
        </div>
        {isStaff && (
          <Link href="/admin/matches/create" className="btn-main">
            + Создать матч
          </Link>
        )}
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка матчей...</p>}

      {!isLoading && (!matches || matches.length === 0) && (
        <div className="rounded-xl px-6 py-12 text-center" style={{ border: '1px dashed var(--border2)' }}>
          <p style={{ color: 'var(--muted)' }} className="mb-4">
            Пока нет запланированных матчей.
          </p>
          <Link href="/register" className="btn-out inline-flex">
            Зарегистрироваться
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {matches?.map((m) => {
          const status = STATUS_LABELS[m.status] ?? STATUS_LABELS.SCHEDULED;
          const date = new Date(m.startTime);
          const mskDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(date);

          return (
            <div
              key={m.id}
              onClick={() => router.push(`/lobby/${m.id}`)}
              className="grid items-center gap-5 px-6 py-5 rounded-xl transition-all hover:translate-x-1.5 cursor-pointer"
              style={{ gridTemplateColumns: isStaff ? '12px 1fr auto auto auto auto' : '12px 1fr auto auto auto', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: status.color, boxShadow: m.status === 'LIVE' ? `0 0 10px ${status.color}` : 'none' }}
              />
              <div>
                <div className="font-display font-semibold uppercase" style={{ fontSize: '17px', letterSpacing: '0.04em' }}>
                  {m.map.name} — Weekly Cup
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Организатор: {m.organizer.username}
                  {m.winnerTeam && ` · Победитель: ${m.winnerTeam.name}`}
                </div>
              </div>
              <div
                className="font-mono text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.18)' }}
              >
                {MODE_LABELS[m.mode]}
              </div>
              <div className="font-mono text-xs whitespace-nowrap hidden sm:block" style={{ color: status.color }}>
                {m.status === 'LIVE' ? 'LIVE' : m.status === 'FINISHED' ? 'Завершён' : `${mskDate} МСК`}
              </div>
              <span className="text-sm hidden sm:block" style={{ color: 'var(--muted)' }}>
                →
              </span>
              {isStaff && (
                <button
                  onClick={(e) => handleDelete(e, m.id, m.map.name)}
                  disabled={deletingId === m.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                >
                  {deletingId === m.id ? '...' : 'Удалить'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
