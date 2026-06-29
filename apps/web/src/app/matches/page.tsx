'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove, isAdminOrOwner } from '@/store/auth';
import { ImageUploadField } from '@/components/ImageUploadField';

interface MatchItem {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { name: string; imageUrl: string };
  organizer: { username: string };
  winnerTeam?: { name: string } | null;
  lobby?: { teams: { members: unknown[] }[] } | null;
}

interface MediaItem {
  id: string; title: string; type: string; url: string; thumbUrl: string | null;
}

const MODE_LABELS: Record<string, string> = {
  MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5',
};
const MEDIA_TYPES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'embed', label: 'Embed' },
  { value: 'link', label: 'Ссылка' },
];

function formatMSK(dateStr: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(dateStr));
}

function MatchCard({ m, onDelete, isStaff }: { m: MatchItem; onDelete: () => void; isStaff: boolean }) {
  const isLive = m.status === 'LIVE';
  const isPaused = m.status === 'PAUSED';
  const isFinished = m.status === 'FINISHED';
  const players = m.lobby?.teams.reduce((acc, t) => acc + t.members.length, 0) ?? 0;

  return (
    <Link href={`/lobby/${m.id}`} className="group relative block rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl" style={{ border: isLive ? '1px solid rgba(34,197,94,.4)' : '1px solid var(--border)' }}>
      {/* Карта как фон */}
      <div className="absolute inset-0">
        {m.map.imageUrl ? (
          <img src={m.map.imageUrl} alt={m.map.name} className="w-full h-full object-cover" style={{ filter: 'brightness(0.3) saturate(0.8)' }} />
        ) : (
          <div className="w-full h-full" style={{ background: 'var(--surface2)' }} />
        )}
        {/* Градиент поверх */}
        <div className="absolute inset-0" style={{ background: isLive ? 'linear-gradient(135deg, rgba(34,197,94,.15), rgba(5,7,15,.85))' : isFinished ? 'linear-gradient(135deg, rgba(5,7,15,.7), rgba(5,7,15,.9))' : 'linear-gradient(135deg, rgba(79,127,255,.1), rgba(5,7,15,.85))' }} />
      </div>

      <div className="relative z-10 p-5">
        {/* Верхняя строка */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {isLive && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,.2)', color: 'var(--green)', border: '1px solid rgba(34,197,94,.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)', animation: 'pulse 1.5s infinite' }} />
                LIVE
              </span>
            )}
            {isPaused && <span className="font-mono text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>⏸ Пауза</span>}
            {isFinished && <span className="font-mono text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--muted)' }}>Завершён</span>}
            {!isLive && !isPaused && !isFinished && <span className="font-mono text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,127,255,.12)', color: 'var(--a)', border: '1px solid rgba(79,127,255,.2)' }}>📅 {formatMSK(m.startTime)} МСК</span>}
          </div>
          <span className="font-display font-bold text-xl flex-shrink-0" style={{ color: isLive ? 'var(--green)' : 'var(--text)' }}>
            {MODE_LABELS[m.mode]}
          </span>
        </div>

        {/* Название карты */}
        <div className="font-display font-bold uppercase mb-1" style={{ fontSize: 'clamp(18px,3vw,24px)', letterSpacing: '0.04em' }}>
          {m.map.name}
        </div>

        {/* Нижняя строка */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>
            Организатор: <span style={{ color: 'rgba(255,255,255,.8)' }}>{m.organizer.username}</span>
            {m.winnerTeam && <span> · 🏆 {m.winnerTeam.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {players > 0 && (
              <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,.4)' }}>👥 {players}</span>
            )}
            {isStaff && (
              <button
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                className="text-[10px] font-medium px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#f87171', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)' }}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MatchesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isStaff = isOrganizerOrAbove(user?.role);
  const canManageMedia = isAdminOrOwner(user?.role);

  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState('youtube');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaThumb, setMediaThumb] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSubmitting, setMediaSubmitting] = useState(false);

  const { data: matches, isLoading } = useQuery<MatchItem[]>({
    queryKey: ['matches'],
    queryFn: () => api.get('/matches', { auth: false }),
  });

  const { data: media } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.get('/media', { auth: false }),
  });

  const handleDelete = async (matchId: string, mapName: string) => {
    if (!confirm(`Удалить матч «${mapName}»? Это действие нельзя отменить.`)) return;
    setDeletingId(matchId);
    try { await api.delete(`/matches/${matchId}`); qc.invalidateQueries({ queryKey: ['matches'] }); }
    catch (err) { alert(err instanceof ApiClientError ? err.message : 'Не удалось удалить матч'); }
    finally { setDeletingId(null); }
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMediaError(null);
    if (!mediaTitle.trim() || !mediaUrl.trim()) { setMediaError('Укажите название и ссылку'); return; }
    setMediaSubmitting(true);
    try {
      await api.post('/media', { title: mediaTitle, type: mediaType, url: mediaUrl, thumbUrl: mediaThumb || undefined });
      setMediaTitle(''); setMediaUrl(''); setMediaThumb(''); setShowMediaForm(false);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (e) { setMediaError(e instanceof ApiClientError ? e.message : 'Не удалось добавить медиа'); }
    finally { setMediaSubmitting(false); }
  };

  const handleDeleteMedia = async (id: string, title: string) => {
    if (!confirm(`Удалить «${title}»?`)) return;
    try { await api.delete(`/media/${id}`); qc.invalidateQueries({ queryKey: ['media'] }); }
    catch (e) { alert(e instanceof ApiClientError ? e.message : 'Не удалось удалить медиа'); }
  };

  // Группируем матчи
  const live = matches?.filter((m) => m.status === 'LIVE' || m.status === 'PAUSED') ?? [];
  const scheduled = matches?.filter((m) => m.status === 'SCHEDULED' || m.status === 'DRAFT') ?? [];
  const finished = matches?.filter((m) => m.status === 'FINISHED' || m.status === 'CANCELLED') ?? [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* HERO */}
      <div className="relative overflow-hidden pt-32 pb-12 px-6 md:px-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,127,255,.06), transparent)' }} />
        </div>
        <div className="max-w-5xl mx-auto relative z-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
              <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
              Расписание
            </div>
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
              Матчи
            </h1>
          </div>
          {isStaff && (
            <Link href="/admin/matches/create" className="btn-main">+ Создать матч</Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pb-20">
        {isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Загрузка...</p>}

        {/* LIVE */}
        {live.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)', animation: 'pulse 1.5s infinite' }} />
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--green)' }}>Сейчас идут</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {live.map((m) => <MatchCard key={m.id} m={m} isStaff={isStaff} onDelete={() => handleDelete(m.id, m.map.name)} />)}
            </div>
          </div>
        )}

        {/* ЗАПЛАНИРОВАННЫЕ */}
        {scheduled.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--a)' }}>📅 Предстоящие</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)' }}>{scheduled.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduled.map((m) => <MatchCard key={m.id} m={m} isStaff={isStaff} onDelete={() => handleDelete(m.id, m.map.name)} />)}
            </div>
          </div>
        )}

        {/* ЗАВЕРШЁННЫЕ */}
        {finished.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>✓ Завершённые</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)' }}>{finished.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finished.map((m) => <MatchCard key={m.id} m={m} isStaff={isStaff} onDelete={() => handleDelete(m.id, m.map.name)} />)}
            </div>
          </div>
        )}

        {!isLoading && matches?.length === 0 && (
          <div className="rounded-2xl px-6 py-16 text-center" style={{ border: '1px dashed var(--border2)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Нет запланированных матчей.</p>
            {isStaff && <Link href="/admin/matches/create" className="btn-main inline-flex">+ Создать матч</Link>}
          </div>
        )}

        {/* МЕДИА — СТРИМЕРЫ */}
        <div className="mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Медиа</div>
              <h2 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(20px,3vw,30px)', letterSpacing: '-0.01em' }}>Стримеры и видео</h2>
            </div>
            <div className="flex items-center gap-2">
              {canManageMedia && (
                <button onClick={() => setShowMediaForm((v) => !v)} className="btn-out" style={{ padding: '10px 16px', fontSize: '13px' }}>
                  {showMediaForm ? 'Отмена' : '+ Добавить'}
                </button>
              )}
              <Link href="/media" className="btn-out" style={{ padding: '10px 16px', fontSize: '13px' }}>Все медиа →</Link>
            </div>
          </div>

          {canManageMedia && showMediaForm && (
            <form onSubmit={handleAddMedia} className="card flex flex-col gap-4 mb-6">
              {mediaError && <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{mediaError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label-field">Название</label><input value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} className="input-field" placeholder="Стрим Weekly Pracs #48" /></div>
                <div><label className="label-field">Тип</label><select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="input-field">{MEDIA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              </div>
              <div><label className="label-field">Ссылка</label><input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="input-field" placeholder="https://twitch.tv/..." /></div>
              <ImageUploadField label="Превью (необязательно)" value={mediaThumb} onChange={setMediaThumb} folder="media-thumbs" />
              <button type="submit" disabled={mediaSubmitting} className="btn-main justify-center">{mediaSubmitting ? 'Публикуем...' : 'Опубликовать'}</button>
            </form>
          )}

          {/* Медиа карточки */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(media ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="relative group">
                {canManageMedia && (
                  <button onClick={() => handleDeleteMedia(item.id, item.title)} className="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(8,13,26,.85)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }}>удалить</button>
                )}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform" style={{ background: 'var(--surface2)' }}>
                      {item.thumbUrl ? <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" /> : <span className="text-3xl opacity-50">▶️</span>}
                    </div>
                    <span className="absolute top-2 left-2 font-mono text-[9px] uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,13,26,.85)', color: item.type === 'twitch' ? '#9147ff' : item.type === 'youtube' ? '#ff0000' : 'var(--a)', border: '1px solid rgba(255,255,255,.1)' }}>
                      {item.type === 'youtube' ? 'YouTube' : item.type === 'twitch' ? 'Twitch' : item.type}
                    </span>
                  </div>
                  <div className="px-3 py-2.5" style={{ height: '48px' }}>
                    <div className="text-xs font-medium leading-snug overflow-hidden" style={{ color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
                  </div>
                </a>
              </div>
            ))}
            {!media?.length && <p className="col-span-full text-sm" style={{ color: 'var(--muted)' }}>Медиа ещё не добавлено.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
