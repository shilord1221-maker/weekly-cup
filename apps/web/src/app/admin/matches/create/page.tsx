'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { ZoneMapSelector } from '@/components/ZoneMapSelector';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates?: { row: number; col: number } | null;
}
interface MapItem {
  id: string;
  name: string;
  imageUrl: string;
}
interface MapDetail extends MapItem {
  zones: Zone[];
}

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
  const utcMs = Date.UTC(year, month - 1, day, hour - 3, minute);
  return new Date(utcMs).toISOString();
}

export default function CreateMatchPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [mapId, setMapId] = useState('');
  const [mode, setMode] = useState('MODE_2X2');
  const [teamCount, setTeamCount] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  const { data: maps } = useQuery<MapItem[]>({
    queryKey: ['maps'],
    queryFn: () => api.get('/maps'),
  });

  const { data: mapDetail } = useQuery<MapDetail>({
    queryKey: ['map-detail', mapId],
    queryFn: () => api.get(`/maps/${mapId}`),
    enabled: !!mapId,
  });

  // При смене карты — сбрасываем выбранные зоны (зоны другой карты не совпадают)
  useEffect(() => {
    setSelectedZoneIds([]);
  }, [mapId]);

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]));
  };

  const isZoneAvailable = (zoneId: string): boolean => {
    if (!mapDetail) return false;
    if (selectedZoneIds.length === 0) return true;
    const zone = mapDetail.zones.find((z) => z.id === zoneId);
    if (!zone) return false;
    return selectedZoneIds.some((selId) => {
      const selZone = mapDetail.zones.find((z) => z.id === selId);
      return zone.adjacentIds.includes(selId) || selZone?.adjacentIds.includes(zoneId);
    });
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!mapId) {
      setServerError('Выберите карту');
      return;
    }
    if (!date || !time) {
      setServerError('Укажите дату и время');
      return;
    }
    setSubmitting(true);
    try {
      const startTime = mskToUtcIso(date, time);
      const match = await api.post<{ id: string }>('/matches', {
        mapId,
        mode,
        startTime,
        teamCount,
        zoneIds: selectedZoneIds.length > 0 ? selectedZoneIds : undefined,
      });
      router.push(`/admin/matches/${match.id}`);
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : 'Не удалось создать матч');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--a)' }}>
        Организатор
      </div>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Создать матч
      </h1>

      {serverError && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {serverError}
        </div>
      )}

      <div className="card flex flex-col gap-6">
        <div>
          <label className="label-field">Карта</label>
          <select value={mapId} onChange={(e) => setMapId(e.target.value)} className="input-field">
            <option value="">— выберите карту —</option>
            {maps?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Зоны — картинка карты для ориентира, кнопки-цвета снизу для самого выбора */}
        {mapDetail && (
          <div>
            <label className="label-field">Зоны (выбрано: {selectedZoneIds.length})</label>
            <div className="mb-3">
              <ZoneMapSelector
                imageUrl={mapDetail.imageUrl}
                zones={mapDetail.zones}
                selectedIds={selectedZoneIds}
                interactive={false}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {mapDetail.zones.map((zone) => {
                const isSelected = selectedZoneIds.includes(zone.id);
                const available = isZoneAvailable(zone.id);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => (available || isSelected) && toggleZone(zone.id)}
                    disabled={!available && !isSelected}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isSelected ? 'rgba(79,127,255,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${isSelected ? 'var(--a)' : 'var(--border2)'}`,
                      color: isSelected ? 'var(--a)' : available ? 'var(--text)' : 'var(--muted)',
                      opacity: !available && !isSelected ? 0.4 : 1,
                      cursor: available || isSelected ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {zone.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Можно выбрать только зоны, граничащие с уже выбранными (граф соседства). Необязательно — можно выбрать позже.
            </p>
          </div>
        )}

        <div>
          <label className="label-field">Режим</label>
          <div className="flex gap-2">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1"
                style={{
                  background: mode === m.value ? 'var(--a)' : 'rgba(255,255,255,.03)',
                  color: mode === m.value ? '#fff' : 'var(--muted)',
                  border: `1px solid ${mode === m.value ? 'var(--a)' : 'var(--border2)'}`,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-field">Сколько команд в матче</label>
          <input
            type="number"
            min={2}
            max={16}
            value={teamCount}
            onChange={(e) => setTeamCount(Math.max(2, Math.min(16, Number(e.target.value) || 2)))}
            className="input-field"
            style={{ width: '120px' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Дата (МСК)</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="input-field" />
          </div>
          <div>
            <label className="label-field">Время (МСК)</label>
            <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className="input-field" />
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Время указывается по Москве и автоматически конвертируется в UTC для хранения на сервере.
        </p>

        <button onClick={handleSubmit} disabled={submitting} className="btn-main justify-center mt-2">
          {submitting ? 'Создаём...' : 'Создать матч'}
        </button>
      </div>
    </div>
  );
}
