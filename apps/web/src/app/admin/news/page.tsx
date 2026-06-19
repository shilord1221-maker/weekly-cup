'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/api';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
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
  const [serverError, setServerError] = useState<string | null>(null);

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
          <div key={n.id} className="flex items-center justify-between px-5 py-3 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span>{n.title}</span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
              {new Date(n.createdAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
