'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
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

export default function MediaPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canPublish = isAdminOrOwner(user?.role);
  const isOwner = user?.role === 'OWNER';

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('youtube');
  const [url, setUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editTarget, setEditTarget] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('youtube');
  const [editUrl, setEditUrl] = useState('');
  const [editThumbUrl, setEditThumbUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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

  const openEdit = (item: MediaItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditTarget(item);
    setEditTitle(item.title);
    setEditType(item.type);
    setEditUrl(item.url);
    setEditThumbUrl(item.thumbUrl ?? '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditError(null);
    setEditSaving(true);
    try {
      await api.patch(`/media/${editTarget.id}`, { title: editTitle, type: editType, url: editUrl, thumbUrl: editThumbUrl || undefined });
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      setEditError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string, mediaTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить «${mediaTitle}»? Это действие нельзя отменить.`)) return;
    try {
      await api.delete(`/media/${id}`);
      qc.invalidateQueries({ queryKey: ['media'] });
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Не удалось удалить медиа');
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Например: Финал Weekly Pracs #47" />
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
          <ImageUploadField label="Превью (необязательно)" value={thumbUrl} onChange={setThumbUrl} folder="media-thumbs" />
          <button type="submit" disabled={submitting} className="btn-main justify-center">
            {submitting ? 'Публикуем...' : 'Опубликовать'}
          </button>
        </form>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {media?.map((item) => (
          <div key={item.id} className="relative group">
            {isOwner && (
              <div className="absolute top-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => openEdit(item, e)}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-md"
                  style={{ background: 'rgba(8,13,26,.85)', color: 'var(--a)', border: '1px solid var(--border2)' }}
                >
                  изменить
                </button>
                <button
                  onClick={(e) => handleDelete(item.id, item.title, e)}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-md"
                  style={{ background: 'rgba(8,13,26,.85)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }}
                >
                  удалить
                </button>
              </div>
            )}
            <a
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
          </div>
        ))}
      </div>

      {!isLoading && (!media || media.length === 0) && <p style={{ color: 'var(--muted)' }}>Медиа пока не загружено.</p>}

      {/* EDIT MODAL — только Owner */}
      {editTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setEditTarget(null)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Редактировать медиа
            </h2>
            {editError && (
              <div className="text-sm rounded-lg px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {editError}
              </div>
            )}
            <label className="label-field">Название</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input-field mb-3" />
            <label className="label-field">Тип</label>
            <select value={editType} onChange={(e) => setEditType(e.target.value)} className="input-field mb-3">
              {MEDIA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="label-field">Ссылка на видео</label>
            <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="input-field mb-3" />
            <div className="mb-4">
              <ImageUploadField label="Превью" value={editThumbUrl} onChange={setEditThumbUrl} folder="media-thumbs" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {editSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
