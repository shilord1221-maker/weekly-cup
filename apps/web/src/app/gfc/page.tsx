'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';
import { Avatar } from '@/components/Avatar';

interface GfcLobbyItem {
  id: string;
  status: string;
  hasPassword: boolean;
  team1Name: string;
  team2Name: string;
  mapPool: string[];
  selectedMap: string | null;
  team1Score: number;
  team2Score: number;
  createdBy: { username: string };
  players: { teamNum: number; user: { username: string; avatarUrl?: string | null } }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WAITING:     { label: 'Ожидание', color: 'var(--a)' },
  BAN_PICK:    { label: 'Бан-Пик', color: '#f59e0b' },
  SIDE_PICK:   { label: 'Выбор сторон', color: '#f97316' },
  IN_PROGRESS: { label: 'Идёт матч', color: 'var(--green)' },
  FINISHED:    { label: 'Завершён', color: 'var(--muted)' },
};

export default function GfcPage() {
  const { user } = useAuthStore();
  const canCreate = isOrganizerOrAbove(user?.role);

  const { data: lobbies, isLoading } = useQuery<GfcLobbyItem[]>({
    queryKey: ['gfc-lobbies'],
    queryFn: () => api.get('/gfc', { auth: false }),
    refetchInterval: 10_000,
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>

      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
            <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
            Тактический режим
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.01em' }}>
            GFC <span style={{ color: 'var(--muted)', fontSize: '50%' }}>5×5</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Gang Fight Club · Атака vs Защита · Бан-пик карт</p>
        </div>
        <div className="flex gap-2">
          {user && (
            <Link href="/gfc/queue" className="btn-out">🎯 Поиск матча</Link>
          )}
          {canCreate && (
            <Link href="/gfc/create" className="btn-main">+ Создать лобби</Link>
          )}
        </div>
      </div>

      {/* Правила коротко */}
      <div className="mb-8 rounded-2xl px-5 py-4 flex flex-wrap gap-4 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {[
          ['⚔️', 'Атака vs Защита'],
          ['🗺️', 'Бан-пик карт'],
          ['🔄', '2+2 раунда'],
          ['🏆', 'До 3 побед'],
          ['🎥', 'Откат обязателен'],
          ['🚫', 'Без крыш и интерьеров'],
        ].map(([icon, text]) => (
          <span key={text} className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <span>{icon}</span> {text}
          </span>
        ))}
        <Link href="/rules" className="ml-auto" style={{ color: 'var(--a)' }}>Полные правила →</Link>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {lobbies?.map((l) => {
          const t1 = l.players.filter((p) => p.teamNum === 1);
          const t2 = l.players.filter((p) => p.teamNum === 2);
          const st = STATUS_LABELS[l.status] ?? STATUS_LABELS.WAITING;
          return (
            <Link
              key={l.id}
              href={`/gfc/${l.id}`}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all hover:translate-x-1"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              {/* Статус */}
              <div className="flex-shrink-0 text-center" style={{ minWidth: '80px' }}>
                <div className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}15` }}>
                  {st.label}
                </div>
                {l.hasPassword && <div className="font-mono text-[9px] mt-1" style={{ color: 'var(--muted)' }}>🔒 Закрытое</div>}
              </div>

              {/* Команды */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-semibold text-sm">{l.team1Name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>vs</span>
                  <span className="font-display font-semibold text-sm">{l.team2Name}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {t1.slice(0, 5).map((p) => <Avatar key={p.user.username} username={p.user.username} avatarUrl={p.user.avatarUrl} size={18} />)}
                  <span className="mx-1.5 text-xs" style={{ color: 'var(--border2)' }}>|</span>
                  {t2.slice(0, 5).map((p) => <Avatar key={p.user.username} username={p.user.username} avatarUrl={p.user.avatarUrl} size={18} />)}
                  <span className="ml-2 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{t1.length}/5 · {t2.length}/5</span>
                </div>
              </div>

              {/* Счёт если матч идёт */}
              {l.status === 'IN_PROGRESS' || l.status === 'FINISHED' ? (
                <div className="flex-shrink-0 font-display font-bold text-xl" style={{ color: 'var(--text)' }}>
                  {l.team1Score} : {l.team2Score}
                </div>
              ) : (
                <div className="flex-shrink-0 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {l.mapPool.length} карт
                </div>
              )}
            </Link>
          );
        })}

        {!isLoading && !lobbies?.length && (
          <div className="rounded-xl px-6 py-12 text-center" style={{ border: '1px dashed var(--border2)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Нет активных лобби GFC.</p>
            {canCreate && <Link href="/gfc/create" className="btn-main inline-flex">+ Создать лобби</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
