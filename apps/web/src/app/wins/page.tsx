'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';

interface WinItem {
  id: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string | null };
  match: { id: string; map: { name: string } };
  team: { name: string };
}

export default function WinsPage() {
  const { data: wins, isLoading } = useQuery<WinItem[]>({
    queryKey: ['wins-full'],
    queryFn: () => api.get('/wins', { auth: false }),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Лента побед
      </h1>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {wins?.map((w) => (
          <Link
            key={w.id}
            href={`/matches/${w.match.id}`}
            className="block p-6 rounded-2xl relative overflow-hidden transition-all hover:-translate-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent 0%,var(--gold) 40%,rgba(201,149,74,.3) 100%)' }} />
            <div className="flex items-center gap-3 mb-4">
              <Avatar username={w.user.username} avatarUrl={w.user.avatarUrl} size={40} />
              <div>
                <div className="font-semibold text-sm">{w.user.username}</div>
                <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                  {w.team.name}
                </div>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10px] px-3 py-1.5 rounded-full"
              style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.07)', border: '1px solid rgba(201,149,74,.18)' }}
            >
              🏆 Победитель
            </span>
            <div className="flex justify-between text-xs mt-3.5" style={{ color: 'var(--muted)' }}>
              <span>{w.match.map?.name}</span>
              <span>{new Date(w.createdAt).toLocaleDateString('ru-RU')}</span>
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && (!wins || wins.length === 0) && <p style={{ color: 'var(--muted)' }}>Пока нет завершённых матчей.</p>}
    </div>
  );
}
