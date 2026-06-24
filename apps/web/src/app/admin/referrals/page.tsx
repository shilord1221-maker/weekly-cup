'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LeaderboardRow {
  id: string;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'ORGANIZER' | 'PLAYER';
  referralCode: string;
  referredAt: string;
  count: number;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  PLAYER: 'Player',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ReferralLeaderboardPage() {
  const { data, isLoading } = useQuery<LeaderboardRow[]>({
    queryKey: ['referral-leaderboard'],
    queryFn: () => api.get('/users/referral-leaderboard'),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Топ рефералов
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Кто привёл больше всего игроков на сайт по своей реферальной ссылке.
      </p>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      {!isLoading && (!data || data.length === 0) && (
        <p style={{ color: 'var(--muted)' }}>Пока никто не пригласил ни одного игрока по реферальной ссылке.</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl flex-wrap"
            style={{
              border: `1px solid ${i < 3 ? 'rgba(201,149,74,.25)' : 'var(--border)'}`,
              background: i < 3 ? 'rgba(201,149,74,.05)' : 'var(--surface)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="font-display font-bold w-8 text-center" style={{ fontSize: '18px', color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>
                {MEDALS[i] ?? `#${i + 1}`}
              </span>
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {row.username}
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)' }}>
                    {ROLE_LABELS[row.role]}
                  </span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                  код: {row.referralCode}
                </span>
              </div>
            </div>
            <div className="font-display font-bold" style={{ fontSize: '20px', color: 'var(--a)' }}>
              {row.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
