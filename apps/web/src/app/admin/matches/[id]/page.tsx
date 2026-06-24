'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates?: { row: number; col: number } | null;
}
interface TeamData {
  id: string;
  name: string;
  members: { user: { username: string } }[];
}
interface MatchDetail {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { id: string; name: string; imageUrl: string; zones: Zone[] };
  selectedZones: Zone[];
  finalZone: Zone | null;
  lobby: { teams: TeamData[] } | null;
}

const MODE_LABELS: Record<string, string> = { MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5' };

export default function AdminMatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  const { data: match, isLoading } = useQuery<MatchDetail>({
    queryKey: ['admin-match', id],
    queryFn: () => api.get(`/matches/${id}`),
    enabled: !!id,
  });

  if (isLoading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка матча...</p>
      </div>
    );
  }

  const selectedNow = selectedZoneIds.length > 0 ? selectedZoneIds : match.selectedZones.map((z) => z.id);

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) => {
      const base = prev.length > 0 ? prev : match.selectedZones.map((z) => z.id);
      return base.includes(zoneId) ? base.filter((z) => z !== zoneId) : [...base, zoneId];
    });
  };

  const handleSaveZones = async () => {
    setError(null);
    try {
      await api.post(`/matches/${id}/zones`, { zoneIds: selectedNow });
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить зоны');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(26px,4vw,36px)', letterSpacing: '-0.01em' }}>
            {match.map.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {MODE_LABELS[match.mode]} · {match.status} · {new Date(match.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК
          </p>
        </div>
        <a href={`/lobby/${match.id}`} className="btn-main">
          Открыть лобби →
        </a>
      </div>

      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Старт матча, выбор финальной зоны и выбор победителя теперь происходят прямо в лобби — там же, где видят игроки.
      </p>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* ZONE SELECTION — фото карты для ориентира, кнопки-цвета для выбора, без ограничения по соседству */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            Выбор зон (выбрано: {selectedNow.length})
          </h2>
          <button onClick={handleSaveZones} className="btn-main" style={{ padding: '8px 18px', fontSize: '13px' }}>
            Сохранить зоны
          </button>
        </div>
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
          <img src={match.map.imageUrl} alt={match.map.name} className="w-full h-auto block" />
        </div>
        <div className="flex flex-wrap gap-2">
          {match.map.zones.map((zone) => {
            const isSelected = selectedNow.includes(zone.id);
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => toggleZone(zone.id)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isSelected ? 'rgba(79,127,255,.15)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${isSelected ? 'var(--a)' : 'var(--border2)'}`,
                  color: isSelected ? 'var(--a)' : 'var(--text)',
                }}
              >
                {zone.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          Можно выбрать любое количество зон в любом порядке.
        </p>
      </div>
    </div>
  );
}
