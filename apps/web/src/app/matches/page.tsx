'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove, isAdminOrOwner } from '@/store/auth';
import { ImageUploadField } from '@/components/ImageUploadField';

interface MediaItem {
  id: string;
  title: string;
  type: string;
  url: string;
  thumbUrl: string | null;
}

const MEDIA_TYPES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'embed', label: 'Embed' },
  { value: 'link', label: 'Ссылка' },
];

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
  const canManageMedia = isAdminOrOwner(user?.role);

  // Media state
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState('youtube');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaThumb, setMediaThumb] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSubmitting, setMediaSubmitting] = useState(false);

  const { data: media } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.get('/media', { auth: false }),
  });

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setMediaError(null);
    if (!mediaTitle.trim() || !mediaUrl.trim()) { setMediaError('Укажите название и ссылку'); return; }
    setMediaSubmitting(true);
    try {
      await api.post('/media', { title: mediaTitle, type: mediaType, url: mediaUrl, thumbUrl: mediaThumb || undefined });
      setMediaTitle(''); setMediaUrl(''); setMediaThumb(''); setShowMediaForm(false);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (err) {
      setMediaError(err instanceof ApiClientError ? err.message : 'Не удалось добавить медиа');
    } finally {
      setMediaSubmitting(false);
    }
  };

  const handleDeleteMedia = async (id: string, title: string) => {
    if (!confirm(`Удалить «${title}»?`)) return;
    try {
      await api.delete(`/media/${id}`);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Не удалось удалить медиа');
    }
  };

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

      {/* MEDIA SECTION */}
      <div className="mt-16">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--a)' }}>
              <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
              Медиа
            </div>
            <h2 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(22px,3vw,32px)', letterSpacing: '-0.01em' }}>
              Стримеры и видео
            </h2>
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
              <div>
                <label className="label-field">Название</label>
                <input value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} className="input-field" placeholder="Стрим Weekly Pracs #48" />
              </div>
              <div>
                <label className="label-field">Тип</label>
                <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="input-field">
                  {MEDIA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label-field">Ссылка</label>
              <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="input-field" placeholder="https://twitch.tv/..." />
            </div>
            <ImageUploadField label="Превью (необязательно)" value={mediaThumb} onChange={setMediaThumb} folder="media-thumbs" />
            <button type="submit" disabled={mediaSubmitting} className="btn-main justify-center">{mediaSubmitting ? 'Публикуем...' : 'Опубликовать'}</button>
          </form>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(media ?? []).slice(0, 8).map((item) => (
            <div key={item.id} className="relative group">
              {canManageMedia && (
                <button
                  onClick={() => handleDeleteMedia(item.id, item.title)}
                  className="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(8,13,26,.85)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }}
                >
                  удалить
                </button>
              )}
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
                    {item.thumbUrl ? <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" /> : <span className="text-3xl">▶️</span>}
                  </div>
                  <span className="absolute top-2 left-2 font-mono text-[9px] uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,13,26,.8)', color: 'var(--a)', border: '1px solid rgba(79,127,255,.3)' }}>
                    {item.type === 'youtube' ? 'YouTube' : item.type === 'twitch' ? 'Twitch' : item.type}
                  </span>
                </div>
                <div className="px-3 py-2.5" style={{ height: '48px' }}>
                  <div className="text-xs font-medium leading-snug line-clamp-2 overflow-hidden" style={{ color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
                </div>
              </a>
            </div>
          ))}
          {!media?.length && (
            <p className="col-span-full text-sm" style={{ color: 'var(--muted)' }}>Медиа ещё не добавлено.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 mt-10">
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
                  {isStaff || m.status === 'FINISHED' ? `${m.map.name} — Weekly Pracs` : 'Карта скрыта до входа в команду'}
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
