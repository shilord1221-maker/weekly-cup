'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';

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

export default function MediaPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canPublish = isAdminOrOwner(user?.role);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('youtube');
  const [url, setUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: media, isLoading } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.get('/media', { auth: false }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!title.trim() || !url.trim()) {
      setServerError('Укажите название и ссылку');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/media', { title, type, url, thumbUrl: thumbUrl || undefined });
      setTitle('');
      setUrl('');
      setThumbUrl('');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось добавить медиа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
          Медиа
        </h1>
        {canPublish && (
          <button onClick={() => setShowForm((v) => !v)} className="btn-main">
            {showForm ? 'Отмена' : '+ Добавить медиа'}
          </button>
        )}
      </div>

      {canPublish && showForm && (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-4 mb-10">
          {serverError && (
            <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {serverError}
            </div>
          )}
          <div>
            <label className="label-field">Название</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Например: Финал Weekly Cup #47" />
          </div>
          <div>
            <label className="label-field">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
              {MEDIA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Ссылка на видео</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input-field" placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="label-field">Ссылка на превью (необязательно)</label>
            <input value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} className="input-field" placeholder="https://..." />
          </div>
          <button type="submit" disabled={submitting} className="btn-main justify-center">
            {submitting ? 'Публикуем...' : 'Опубликовать'}
          </button>
        </form>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {media?.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="aspect-video w-full flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
              {item.thumbUrl ? (
                <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">▶️</span>
              )}
            </div>
            <div className="p-4">
              <div className="font-medium text-sm mb-1">{item.title}</div>
              <span className="font-mono text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                {item.type}
              </span>
            </div>
          </a>
        ))}
      </div>

      {!isLoading && (!media || media.length === 0) && <p style={{ color: 'var(--muted)' }}>Медиа пока не загружено.</p>}
    </div>
  );
}
