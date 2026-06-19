'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiClientError } from '@/lib/api';

interface MapItem {
  id: string;
  name: string;
}

const CreateMatchSchema = z.object({
  mapId: z.string().min(1, 'Выберите карту'),
  mode: z.enum(['MODE_2X2', 'MODE_3X3', 'MODE_4X4', 'MODE_5X5']),
  date: z.string().min(1, 'Укажите дату'),
  time: z.string().min(1, 'Укажите время'),
});
type CreateMatchForm = z.infer<typeof CreateMatchSchema>;

const MODE_OPTIONS = [
  { value: 'MODE_2X2', label: '2×2' },
  { value: 'MODE_3X3', label: '3×3' },
  { value: 'MODE_4X4', label: '4×4' },
  { value: 'MODE_5X5', label: '5×5' },
];

// Конвертация локального времени, введённого как московское, в UTC ISO-строку для API.
// МСК = UTC+3 без перехода на летнее время.
function mskToUtcIso(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Создаём момент времени, который ЯВЛЯЕТСЯ year-month-day hour:minute в МСК (UTC+3),
  // переводя его в UTC вычитанием 3 часов.
  const utcMs = Date.UTC(year, month - 1, day, hour - 3, minute);
  return new Date(utcMs).toISOString();
}

export default function CreateMatchPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: maps } = useQuery<MapItem[]>({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateMatchForm>({ resolver: zodResolver(CreateMatchSchema) });

  const onSubmit = async (data: CreateMatchForm) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const startTime = mskToUtcIso(data.date, data.time);
      const match = await api.post<{ id: string }>('/matches', { mapId: data.mapId, mode: data.mode, startTime });
      router.push(`/admin/matches/${match.id}`);
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось создать матч');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Создать матч
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-5">
        {serverError && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {serverError}
          </div>
        )}

        <div>
          <label className="label-field">Карта</label>
          <select {...register('mapId')} className={`input-field ${errors.mapId ? 'error' : ''}`}>
            <option value="">— выберите карту —</option>
            {maps?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {errors.mapId && <p className="error-text">{errors.mapId.message}</p>}
        </div>

        <div>
          <label className="label-field">Режим</label>
          <select {...register('mode')} className="input-field">
            {MODE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Дата (МСК)</label>
            <input {...register('date')} type="date" className={`input-field ${errors.date ? 'error' : ''}`} />
            {errors.date && <p className="error-text">{errors.date.message}</p>}
          </div>
          <div>
            <label className="label-field">Время (МСК)</label>
            <input {...register('time')} type="time" className={`input-field ${errors.time ? 'error' : ''}`} />
            {errors.time && <p className="error-text">{errors.time.message}</p>}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Время указывается по Москве и автоматически конвертируется в UTC для хранения на сервере.
        </p>

        <button type="submit" disabled={submitting} className="btn-main justify-center mt-2">
          {submitting ? 'Создаём...' : 'Создать матч'}
        </button>
      </form>
    </div>
  );
}
