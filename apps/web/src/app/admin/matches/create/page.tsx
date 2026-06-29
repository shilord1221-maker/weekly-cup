'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { MODE_TEAM_LIMITS } from '@/lib/discordVoiceChannels';

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
      const match = await api.post<{ id: string; lobby: { teams: { id: string }[] } }>('/matches', {
        mapId,
        mode,
        startTime,
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
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="mb-8">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
          <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
          Организатор
        </div>
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.02em' }}>
          Создать матч
        </h1>
      </div>

      {serverError && (
        <div className="mb-6 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {serverError}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Левая колонка */}
        <div className="flex flex-col gap-4">
          {/* Карта */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Шаг 1</div>
              <div className="font-display font-semibold uppercase">Выбор карты</div>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2">
                {maps?.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMapId(m.id)}
                    className="relative flex items-center gap-3 p-3 rounded-xl transition-all text-left overflow-hidden"
                    style={{ border: `1px solid ${mapId === m.id ? 'var(--a)' : 'var(--border2)'}`, background: mapId === m.id ? 'rgba(79,127,255,.08)' : 'rgba(255,255,255,.02)' }}>
                    {m.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-12 h-8 rounded-lg object-cover flex-shrink-0" />}
                    <span className="font-medium text-sm">{m.name}</span>
                    {mapId === m.id && <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--a)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Режим */}
          <div className="rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Шаг 2</div>
              <div className="font-display font-semibold uppercase">Режим игры</div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-4 gap-2">
                {MODE_OPTIONS.map((m) => (
                  <button key={m.value} type="button" onClick={() => setMode(m.value)}
                    className="py-3 rounded-xl font-display font-bold text-lg transition-all"
                    style={{ background: mode === m.value ? 'var(--a)' : 'rgba(255,255,255,.03)', color: mode === m.value ? '#fff' : 'var(--muted)', border: `1px solid ${mode === m.value ? 'var(--a)' : 'var(--border2)'}`, boxShadow: mode === m.value ? '0 0 20px rgba(79,127,255,.3)' : 'none' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Дата и время */}
          <div className="rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Шаг 3</div>
              <div className="font-display font-semibold uppercase">Дата и время МСК</div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Дата</label>
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="input-field" />
              </div>
              <div>
                <label className="label-field">Время</label>
                <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className="input-field" />
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка — зоны */}
        <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Шаг 4 (необязательно)</div>
            <div className="font-display font-semibold uppercase">Зоны {selectedZoneIds.length > 0 && <span style={{ color: 'var(--a)' }}>· {selectedZoneIds.length}</span>}</div>
          </div>

          {!mapDetail ? (
            <div className="flex-1 flex items-center justify-center p-10 text-sm" style={{ color: 'var(--muted)' }}>
              Сначала выберите карту
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-4 flex-1">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
                <img src={mapDetail.imageUrl} alt={mapDetail.name} className="w-full h-auto block" />
              </div>
              <div className="flex flex-wrap gap-2">
                {mapDetail.zones.map((zone) => {
                  const isSelected = selectedZoneIds.includes(zone.id);
                  return (
                    <button key={zone.id} type="button" onClick={() => toggleZone(zone.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{ background: isSelected ? 'rgba(79,127,255,.15)' : 'rgba(255,255,255,.03)', border: `1px solid ${isSelected ? 'var(--a)' : 'var(--border2)'}`, color: isSelected ? 'var(--a)' : 'var(--text)' }}>
                      {zone.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Создать */}
      <div className="mt-6">
        <button onClick={handleSubmit} disabled={submitting} className="btn-main justify-center w-full" style={{ padding: '16px', fontSize: '16px' }}>
          {submitting ? 'Создаём...' : '🎮 Создать матч'}
        </button>
      </div>

    </div>
  );
}
