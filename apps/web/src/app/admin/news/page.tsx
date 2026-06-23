'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  published: boolean;
  createdAt: string;
}

const NewsSchema = z.object({
  title: z.string().min(2, 'Укажите заголовок'),
  slug: z
    .string()
    .min(2, 'Укажите slug')
    .regex(/^[a-z0-9-]+$/, 'Только латиница, цифры и дефис'),
  excerpt: z.string().max(500).optional(),
  body: z.string().min(1, 'Текст не может быть пустым'),
});
type NewsForm = z.infer<typeof NewsSchema>;

export default function AdminNewsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const [serverError, setServerError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<NewsItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['admin-news'],
    queryFn: () => api.get('/news'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsForm>({ resolver: zodResolver(NewsSchema) });

  const onSubmit = async (data: NewsForm) => {
    setServerError(null);
    try {
      await api.post('/news', { ...data, published: true });
      reset();
      qc.invalidateQueries({ queryKey: ['admin-news'] });
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось опубликовать новость');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить новость «${title}»? Это действие нельзя отменить.`)) return;
    setServerError(null);
    try {
      await api.delete(`/news/${id}`);
      qc.invalidateQueries({ queryKey: ['admin-news'] });
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось удалить новость');
    }
  };

  const openEdit = (item: NewsItem) => {
    setEditTarget(item);
    setEditTitle(item.title);
    setEditExcerpt(item.excerpt ?? '');
    setEditBody(item.body);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditError(null);
    setEditSaving(true);
    try {
      await api.patch(`/news/${editTarget.id}`, { title: editTitle, excerpt: editExcerpt || undefined, body: editBody });
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-news'] });
    } catch (e) {
      setEditError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Новости
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-4 mb-10">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
          Новая публикация
        </h2>

        {serverError && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {serverError}
          </div>
        )}

        <div>
          <label className="label-field">Заголовок</label>
          <input {...register('title')} className={`input-field ${errors.title ? 'error' : ''}`} />
          {errors.title && <p className="error-text">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label-field">Slug (для URL)</label>
          <input {...register('slug')} placeholder="например: weekly-cup-48-results" className={`input-field ${errors.slug ? 'error' : ''}`} />
          {errors.slug && <p className="error-text">{errors.slug.message}</p>}
        </div>
        <div>
          <label className="label-field">Краткое описание</label>
          <input {...register('excerpt')} className="input-field" />
        </div>
        <div>
          <label className="label-field">Текст</label>
          <textarea {...register('body')} rows={6} className={`input-field ${errors.body ? 'error' : ''}`} />
          {errors.body && <p className="error-text">{errors.body.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-main justify-center">
          {isSubmitting ? 'Публикуем...' : 'Опубликовать'}
        </button>
      </form>

      <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
        Опубликованные новости
      </h2>
      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}
      <div className="flex flex-col gap-2">
        {news?.map((n) => (
          <div key={n.id} className="flex items-center justify-between px-5 py-3 rounded-lg text-sm flex-wrap gap-2" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span>{n.title}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                {new Date(n.createdAt).toLocaleDateString('ru-RU')}
              </span>
              {isOwner && (
                <>
                  <button
                    onClick={() => openEdit(n)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--a)', background: 'rgba(79,127,255,0.06)', border: '1px solid rgba(79,127,255,0.18)' }}
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(n.id, n.title)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                  >
                    Удалить
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* EDIT MODAL — только Owner */}
      {editTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setEditTarget(null)}>
          <div className="card max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Редактировать новость
            </h2>
            {editError && (
              <div className="text-sm rounded-lg px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {editError}
              </div>
            )}
            <label className="label-field">Заголовок</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input-field mb-3" />
            <label className="label-field">Краткое описание</label>
            <input value={editExcerpt} onChange={(e) => setEditExcerpt(e.target.value)} className="input-field mb-3" />
            <label className="label-field">Текст</label>
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} className="input-field mb-4" />
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
