'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';

interface MatchDetail {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  finishedAt: string | null;
  map: { name: string };
  selectedZones: { name: string }[];
  finalZone: { name: string } | null;
  organizer: { username: string };
  winnerTeam: { name: string } | null;
  lobby: { teams: { id: string; name: string; members: { user: { username: string } }[] }[] } | null;
}

const MODE_LABELS: Record<string, string> = { MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5' };

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: match, isLoading } = useQuery<MatchDetail>({
    queryKey: ['match', id],
    queryFn: () => api.get(`/matches/${id}`, { auth: false }),
    enabled: !!id,
  });

  if (isLoading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <Link href="/matches" className="text-sm inline-block mb-6" style={{ color: 'var(--a)' }}>
        ← Все матчи
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
            {match.map.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {MODE_LABELS[match.mode]} · Организатор: {match.organizer.username}
          </p>
        </div>
        {match.status !== 'FINISHED' && (
          <Link href={`/lobby/${match.id}`} className="btn-main">
            Открыть лобби
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Детали матча
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Старт" value={new Date(match.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК'} />
            {match.finishedAt && <Row label="Завершён" value={new Date(match.finishedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК'} />}
            <Row label="Зоны" value={match.selectedZones.map((z) => z.name).join(', ') || '—'} />
            <Row label="Финальная зона" value={match.finalZone?.name ?? '—'} />
            {match.winnerTeam && <Row label="Победитель" value={match.winnerTeam.name} accent />}
          </dl>
        </div>

        {match.lobby && (
          <div className="card">
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
              Составы команд
            </h2>
            <div className="flex flex-col gap-3">
              {match.lobby.teams.map((team) => (
                <div key={team.id}>
                  <div className="text-xs font-semibold mb-1" style={{ color: match.winnerTeam?.name === team.name ? 'var(--gold)' : 'var(--a)' }}>
                    {team.name} {match.winnerTeam?.name === team.name && '🏆'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {team.members.map((m) => m.user.username).join(', ') || 'пусто'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd style={{ color: accent ? 'var(--gold)' : 'var(--text)', textAlign: 'right' }}>{value}</dd>
    </div>
  );
}
