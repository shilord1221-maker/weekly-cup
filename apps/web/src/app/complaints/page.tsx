'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Complaint {
  id: string;
  nick: string;
  staticIdValue: string | null;
  text: string;
  status: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  adminComment: string | null;
  createdAt: string;
  author: { username: string };
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: 'Новая', color: 'var(--a)', bg: 'rgba(79,127,255,.08)' },
  IN_REVIEW: { label: 'На рассмотрении', color: 'var(--gold)', bg: 'rgba(201,149,74,.08)' },
  RESOLVED: { label: 'Решена', color: 'var(--green)', bg: 'rgba(34,197,94,.08)' },
  REJECTED: { label: 'Отклонена', color: '#ef4444', bg: 'rgba(239,68,68,.08)' },
};

const ComplaintSchema = z.object({
  nick: z.string().min(1, 'Укажите ник').max(64),
  staticIdValue: z.string().max(64).optional(),
  text: z.string().min(5, 'Опишите ситуацию подробнее (минимум 5 символов)').max(2000),
});
type ComplaintForm = z.infer<typeof ComplaintSchema>;

export default function ComplaintsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: complaints } = useQuery<Complaint[]>({
    queryKey: ['complaints'],
    queryFn: () => api.get('/complaints'),
    enabled: !!user,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintForm>({ resolver: zodResolver(ComplaintSchema) });

  const onSubmit = async (data: ComplaintForm) => {
    setServerError(null);
    setSuccess(false);
    try {
      await api.post('/complaints', data);
      reset();
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось отправить жалобу');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <p className="mb-5" style={{ color: 'var(--muted)' }}>
            Войдите, чтобы отправить или посмотреть жалобы
          </p>
          <a href="/login" className="btn-main">
            Войти
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Жалобы
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        {user.role === 'PLAYER' ? 'Вы видите только свои жалобы.' : 'Вы видите все жалобы (роль ' + user.role + ').'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-4 mb-10">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
          Новая жалоба
        </h2>

        {serverError && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {serverError}
          </div>
        )}
        {success && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
            Жалоба отправлена и появится в списке ниже.
          </div>
        )}

        <div>
          <label className="label-field">Ваш ник</label>
          <input {...register('nick')} defaultValue={user.username} className={`input-field ${errors.nick ? 'error' : ''}`} />
          {errors.nick && <p className="error-text">{errors.nick.message}</p>}
        </div>

        <div>
          <label className="label-field">Static ID (если нужно указать)</label>
          <input {...register('staticIdValue')} defaultValue={user.staticId ?? ''} className="input-field" />
        </div>

        <div>
          <label className="label-field">Описание ситуации</label>
          <textarea {...register('text')} rows={5} className={`input-field ${errors.text ? 'error' : ''}`} placeholder="Опишите, что произошло..." />
          {errors.text && <p className="error-text">{errors.text.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-main justify-center">
          {isSubmitting ? 'Отправляем...' : 'Отправить жалобу'}
        </button>
      </form>

      <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
        {user.role === 'PLAYER' ? 'Мои жалобы' : 'Все жалобы'}
      </h2>

      {(!complaints || complaints.length === 0) && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Жалоб пока нет.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {complaints?.map((c) => {
          const status = STATUS_LABELS[c.status];
          return (
            <div key={c.id} className="rounded-xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                <span className="text-sm font-medium">
                  {c.nick} {c.staticIdValue && <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>· {c.staticIdValue}</span>}
                </span>
                <span className="font-mono text-[11px] px-3 py-1 rounded-full" style={{ color: status.color, background: status.bg }}>
                  {status.label}
                </span>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
                {c.text}
              </p>
              {c.adminComment && (
                <div className="text-xs rounded-lg px-3 py-2 mt-2" style={{ background: 'rgba(255,255,255,.03)', color: 'var(--muted)' }}>
                  Комментарий администратора: {c.adminComment}
                </div>
              )}
              <div className="font-mono text-[10px] mt-2" style={{ color: 'rgba(96,104,128,.5)' }}>
                {new Date(c.createdAt).toLocaleString('ru-RU')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
