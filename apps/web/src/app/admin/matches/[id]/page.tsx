'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { ZoneMapSelector } from '@/components/ZoneMapSelector';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates?: { row: number; col: number } | null;
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
  map: { id: string; name: string; imageUrl: string; zones: Zone[] };
  selectedZones: Zone[];
  finalZone: Zone | null;
  lobby: { teams: TeamData[] } | null;
}

const MODE_LABELS: Record<string, string> = { MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5' };

// Готовые voice-каналы Discord — организатор выбирает из списка, без ручного ввода ссылок.
const VOICE_CHANNELS = [
  { label: 'Voice 1', url: 'https://discord.com/channels/1503166605855690793/1503166606497284222' },
  { label: 'Voice 2', url: 'https://discord.com/channels/1503166605855690793/1512570070889398363' },
  { label: 'Voice 3', url: 'https://discord.com/channels/1503166605855690793/1512570127223226478' },
  { label: 'Voice 4', url: 'https://discord.com/channels/1503166605855690793/1512570190368346183' },
  { label: 'Voice 5', url: 'https://discord.com/channels/1503166605855690793/1512570237772632135' },
  { label: 'Voice 6', url: 'https://discord.com/channels/1503166605855690793/1512570277538697266' },
  { label: 'Voice 7', url: 'https://discord.com/channels/1503166605855690793/1512570317590106173' },
  { label: 'Voice 8', url: 'https://discord.com/channels/1503166605855690793/1512570360363749376' },
  { label: 'Voice 9', url: 'https://discord.com/channels/1503166605855690793/1512570414159757312' },
  { label: 'Voice 10', url: 'https://discord.com/channels/1503166605855690793/1512572351127224421' },
  { label: 'Voice 11', url: 'https://discord.com/channels/1503166605855690793/1512572391455326378' },
  { label: 'Voice 12', url: 'https://discord.com/channels/1503166605855690793/1512572470874345492' },
  { label: 'Voice 13', url: 'https://discord.com/channels/1503166605855690793/1512572703092248656' },
  { label: 'Voice 14', url: 'https://discord.com/channels/1503166605855690793/1512572751897038939' },
  { label: 'Voice 15', url: 'https://discord.com/channels/1503166605855690793/1512572895543431251' },
  { label: 'Voice 16', url: 'https://discord.com/channels/1503166605855690793/1512897712729755658' },
];

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

  const handleAutoAssignVoice = async () => {
    if (!match.lobby) return;
    setError(null);
    try {
      await Promise.all(
        match.lobby.teams.map((team, i) => {
          const channel = VOICE_CHANNELS[i];
          if (!channel) return Promise.resolve();
          return api.patch(`/lobby/${match.id}/voice-url/${team.id}`, { voiceUrl: channel.url });
        })
      );
      qc.invalidateQueries({ queryKey: ['admin-match', id] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось назначить каналы автоматически');
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
        <a href={`/lobby/${match.id}`} className="btn-out">
          Открыть лобби →
        </a>
      </div>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* ZONE SELECTION — интерактивная карта с реальным изображением */}
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
          Наведите на зону, чтобы увидеть соседние. Можно выбрать только зоны, граничащие с уже выбранными (граф соседства).
        </p>
        <ZoneMapSelector
          imageUrl={match.map.imageUrl}
          zones={match.map.zones}
          selectedIds={availableSelected}
          finalZoneId={match.finalZone?.id}
          interactive
          onToggleZone={toggleZone}
          isZoneAvailable={(zoneId) => {
            const zone = match.map.zones.find((z) => z.id === zoneId);
            if (!zone) return false;
            return availableSelected.length === 0 || isAdjacentToSelected(zoneId, zone) || availableSelected.includes(zoneId);
          }}
        />
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
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Discord Voice каналы
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Выберите готовый voice-канал для каждой команды, или нажмите «Авто» для назначения по порядку (Team 1 → Voice 1 и т.д.).
          </p>
          <button onClick={handleAutoAssignVoice} className="btn-out mb-4" style={{ padding: '8px 18px', fontSize: '13px' }}>
            🎲 Авто-назначить каналы по порядку
          </button>
          <div className="flex flex-col gap-3">
            {match.lobby.teams.map((team) => (
              <div key={team.id} className="flex gap-2 items-center">
                <span className="text-sm w-20 flex-shrink-0">{team.name}</span>
                <select
                  defaultValue={team.voiceUrl ?? ''}
                  onChange={(e) => setVoiceInputs((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  className="input-field flex-1"
                >
                  <option value="">— не назначен —</option>
                  {VOICE_CHANNELS.map((vc) => (
                    <option key={vc.url} value={vc.url}>
                      {vc.label}
                    </option>
                  ))}
                </select>
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
