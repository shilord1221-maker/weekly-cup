'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
}
interface TeamData {
  id: string;
  name: string;
  voiceUrl: string | null;
  members: { user: { username: string } }[];
}
interface MatchDetail {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { id: string; name: string; zones: Zone[] };
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
  const [voiceInputs, setVoiceInputs] = useState<Record<string, string>>({});

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

  const gridSize = Math.round(Math.sqrt(match.map.zones.length)) || 5;
  const availableSelected = selectedZoneIds.length > 0 ? selectedZoneIds : match.selectedZones.map((z) => z.id);

  const isAdjacentToSelected = (zoneId: string, zone: Zone): boolean => {
    if (availableSelected.length === 0) return true;
    return availableSelected.some((selId) => {
      const selZone = match.map.zones.find((z) => z.id === selId);
      return zone.adjacentIds.includes(selId) || selZone?.adjacentIds.includes(zoneId);
    });
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) => {
      if (prev.includes(zoneId)) return prev.filter((z) => z !== zoneId);
      return [...prev, zoneId];
    });
  };

  const handleSaveZones = async () => {
    setError(null);
    try {
      await api.post(`/matches/${id}/zones`, { zoneIds: availableSelected });
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить зоны');
    }
  };

  const handleSetFinalZone = async (zoneId: string) => {
    setError(null);
    try {
      await api.post(`/matches/${id}/final-zone`, { zoneId });
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось выбрать финальную зону');
    }
  };

  const handleSaveVoice = async (teamId: string) => {
    const url = voiceInputs[teamId];
    if (!url) return;
    setError(null);
    try {
      await api.patch(`/lobby/${match.id}/voice-url/${teamId}`, { voiceUrl: url });
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Укажите корректную ссылку на Discord');
    }
  };

  const handleFinish = async (winnerTeamId: string) => {
    setError(null);
    try {
      await api.post(`/matches/${id}/finish`, { winnerTeamId });
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось завершить матч');
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
        <a href={`/lobby/${match.id}`} className="btn-out" target="_blank" rel="noopener noreferrer">
          Открыть лобби →
        </a>
      </div>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* ZONE SELECTION */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            Выбор зон
          </h2>
          <button onClick={handleSaveZones} className="btn-main" style={{ padding: '8px 18px', fontSize: '13px' }}>
            Сохранить зоны
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Можно выбрать только зоны, граничащие с уже выбранными (граф соседства).
        </p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
          {match.map.zones.map((zone) => {
            const isSelected = availableSelected.includes(zone.id);
            const isAvailable = availableSelected.length === 0 || isAdjacentToSelected(zone.id, zone) || isSelected;
            return (
              <button
                key={zone.id}
                onClick={() => isAvailable && toggleZone(zone.id)}
                disabled={!isAvailable}
                className="aspect-square rounded-md text-[8px] p-1 transition-all"
                style={{
                  background: isSelected ? 'rgba(79,127,255,.3)' : isAvailable ? 'rgba(79,127,255,.06)' : 'rgba(255,255,255,.02)',
                  border: `1px solid ${isSelected ? 'rgba(79,127,255,.6)' : 'rgba(255,255,255,.06)'}`,
                  color: isSelected ? 'var(--text)' : 'var(--muted)',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  opacity: isAvailable ? 1 : 0.4,
                }}
              >
                {zone.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* FINAL ZONE */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Финальная зона
        </h2>
        {match.finalZone ? (
          <p className="text-sm">
            Выбрана: <strong>{match.finalZone.name}</strong>
          </p>
        ) : (
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
            Финальная зона пока не выбрана.
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {match.selectedZones.map((z) => (
            <button key={z.id} onClick={() => handleSetFinalZone(z.id)} className="btn-out" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Сделать финальной: {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* VOICE URLS */}
      {match.lobby && (
        <div className="card mb-6">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            Discord Voice ссылки
          </h2>
          <div className="flex flex-col gap-3">
            {match.lobby.teams.map((team) => (
              <div key={team.id} className="flex gap-2 items-center">
                <span className="text-sm w-20 flex-shrink-0">{team.name}</span>
                <input
                  defaultValue={team.voiceUrl ?? ''}
                  onChange={(e) => setVoiceInputs((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  placeholder="https://discord.gg/..."
                  className="input-field flex-1"
                />
                <button onClick={() => handleSaveVoice(team.id)} className="btn-out" style={{ padding: '10px 16px', fontSize: '13px' }}>
                  Сохранить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FINISH MATCH */}
      {match.lobby && match.status !== 'FINISHED' && (
        <div className="card">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            Завершить матч
          </h2>
          <div className="flex flex-wrap gap-2">
            {match.lobby.teams.map((team) => (
              <button key={team.id} onClick={() => handleFinish(team.id)} className="btn-main" style={{ padding: '10px 20px', fontSize: '13px' }}>
                🏆 Победитель: {team.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
