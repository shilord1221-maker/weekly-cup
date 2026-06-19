'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';

const GRID_SIZE = 5;

export default function CreateMapPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('https://placehold.co/800x800/0b1022/e8ecf8?text=New+Map');
  const [zoneNames, setZoneNames] = useState<string[]>(Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => `Зона ${i + 1}`));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'info' | 'zones'>('info');

  // По умолчанию используем grid-соседство (вверх/вниз/влево/вправо), как в seed-скрипте.
  // Администратор может в будущем кастомизировать через PATCH /api/maps/:id/zones/:zoneId.

  const handleCreateMap = async () => {
    if (!name.trim()) {
      setError('Укажите название карты');
      return;
    }
    setStep('zones');
  };

  const handleCreateZones = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const map = await api.post<{ id: string }>('/maps', { name, imageUrl });

      // Создаём зоны по сетке, затем выставляем adjacencyMap по координатам
      const created: { id: string; idx: number }[] = [];
      for (let i = 0; i < zoneNames.length; i++) {
        const row = Math.floor(i / GRID_SIZE);
        const col = i % GRID_SIZE;
        const zone = await api.post<{ id: string }>(`/maps/${map.id}/zones`, {
          name: zoneNames[i],
          adjacentIds: [],
          coordinates: { row, col },
        });
        created.push({ id: zone.id, idx: i });
      }

      for (const { id, idx } of created) {
        const row = Math.floor(idx / GRID_SIZE);
        const col = idx % GRID_SIZE;
        const neighborIdxs: number[] = [];
        if (row > 0) neighborIdxs.push(idx - GRID_SIZE);
        if (row < GRID_SIZE - 1) neighborIdxs.push(idx + GRID_SIZE);
        if (col > 0) neighborIdxs.push(idx - 1);
        if (col < GRID_SIZE - 1) neighborIdxs.push(idx + 1);
        const adjacentIds = created.filter((c) => neighborIdxs.includes(c.idx)).map((c) => c.id);
        await api.patch(`/maps/${map.id}/zones/${id}`, { adjacentIds });
      }

      router.push('/admin/maps');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось создать карту');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Новая карта
      </h1>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {step === 'info' && (
        <div className="card flex flex-col gap-5">
          <div>
            <label className="label-field">Название карты</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Например: Erangel" />
          </div>
          <div>
            <label className="label-field">URL изображения</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input-field" />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            На следующем шаге вы зададите названия зон 5×5 — соседство (adjacencyMap) рассчитается автоматически по сетке.
          </p>
          <button onClick={handleCreateMap} className="btn-main justify-center">
            Далее: зоны →
          </button>
        </div>
      )}

      {step === 'zones' && (
        <div className="card flex flex-col gap-5">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Введите названия зон. Соседство по сетке (вверх/вниз/влево/вправо) выставится автоматически.
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {zoneNames.map((zn, i) => (
              <input
                key={i}
                value={zn}
                onChange={(e) => {
                  const next = [...zoneNames];
                  next[i] = e.target.value;
                  setZoneNames(next);
                }}
                className="input-field text-center"
                style={{ padding: '8px', fontSize: '11px' }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('info')} className="btn-out">
              ← Назад
            </button>
            <button onClick={handleCreateZones} disabled={submitting} className="btn-main flex-1 justify-center">
              {submitting ? 'Создаём карту и зоны...' : 'Создать карту'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
