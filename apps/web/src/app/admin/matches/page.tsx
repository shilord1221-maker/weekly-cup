'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface MatchItem {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { name: string };
}

const MODE_LABELS: Record<string, string> = { MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5' };

export default function AdminMatchesPage() {
  const { data: matches, isLoading } = useQuery<MatchItem[]>({
    queryKey: ['admin-matches'],
    queryFn: () => api.get('/matches'),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
          Матчи
        </h1>
        <Link href="/admin/matches/create" className="btn-main">
          + Создать матч
        </Link>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-2">
        {matches?.map((m) => (
          <Link
            key={m.id}
            href={`/admin/matches/${m.id}`}
            className="flex items-center justify-between gap-4 px-6 py-4 rounded-xl transition-all hover:translate-x-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          >
            <div>
              <div className="font-display font-semibold uppercase" style={{ fontSize: '15px' }}>
                {m.map.name}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {new Date(m.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] px-3 py-1 rounded-full" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)' }}>
                {MODE_LABELS[m.mode]}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {m.status}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && (!matches || matches.length === 0) && <p style={{ color: 'var(--muted)' }}>Матчей пока нет.</p>}
    </div>
  );
}
