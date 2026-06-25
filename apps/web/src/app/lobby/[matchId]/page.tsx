'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove, isAdminOrOwner } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import { ChatPanel } from '@/components/ChatPanel';
import { Avatar } from '@/components/Avatar';

interface Member {
  id: string;
  userId: string;
  dynamicId?: string | null;
  isEliminated?: boolean;
  user: { id: string; username: string; avatarUrl?: string | null; staticId?: { value: string } | null };
}
interface TeamData {
  id: string;
  name: string;
  slot: number;
  isReady: boolean;
  createdById: string | null;
  members: Member[];
}
interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates?: { row: number; col: number } | null;
}
interface MatchData {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  mapId: string;
  map: { id: string; name: string; imageUrl: string; zones: Zone[] };
  selectedZones: Zone[];
  finalZone: Zone | null;
  startZoneOpenedAt: string | null;
  startZoneClosesAt: string | null;
  finalZoneOpenedAt: string | null;
  finalZoneClosesAt: string | null;
  winnerTeam: { id: string; name: string } | null;
}
interface LobbyData {
  id: string;
  state: string;
  match: MatchData;
  teams: TeamData[];
  unassignedMembers: Member[];
}

const MODE_LABELS: Record<string, string> = { MODE_2X2: '2×2', MODE_3X3: '3×3', MODE_4X4: '4×4', MODE_5X5: '5×5' };
const CAPACITY: Record<string, number> = { MODE_2X2: 2, MODE_3X3: 3, MODE_4X4: 4, MODE_5X5: 5 };

function useCountdown(closesAt: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!closesAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(closesAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return remaining;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LobbyPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuthStore();
  const socket = useSocket();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { data: lobby, isLoading, refetch } = useQuery<LobbyData>({
    queryKey: ['lobby', matchId],
    queryFn: () => api.get(`/lobby/${matchId}`, { auth: false }),
    enabled: !!matchId,
  });

  const playBeep = useCallback((freq = 880, duration = 0.15) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      // Громкость поднята с 0.15 до 0.45 — звук должен быть отчётливо слышен, чтобы люди
      // не пропускали момент открытия финальной зоны, даже если свёрнули вкладку/окно.
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext недоступен до первого взаимодействия пользователя со страницей — молча игнорируем
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!matchId) return;
    socket.emit('lobby:subscribe', { matchId });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['lobby', matchId] });

    const onState = () => invalidate();
    const onJoined = (p: { username: string }) => {
      invalidate();
      showToast(`👤 ${p.username} вошёл в лобби`);
    };
    const onLeft = () => invalidate();
    const onTeamChanged = () => invalidate();
    const onTeamCreated = () => invalidate();
    const onTeamDeleted = () => invalidate();
    const onEliminatedChanged = () => invalidate();
    const onReadyChanged = (p: { ready: boolean }) => {
      invalidate();
      showToast(p.ready ? '✅ Команда готова' : '⏳ Команда не готова');
    };
    const onAutoAssigned = () => {
      invalidate();
      showToast('🎲 Игроки распределены автоматически');
    };
    const onZonesSelected = () => {
      invalidate();
      showToast('🗺️ Организатор выбрал зоны');
    };
    const onStartZoneClosed = () => {
      invalidate();
      playBeep(330, 0.4);
      showToast('⛔ Время захода в зону истекло');
    };
    const onFinalZoneSelected = () => {
      invalidate();
      playBeep(660, 0.3);
      showToast('📍 Выбрана финальная зона — у вас 2 минуты на заход');
    };
    const onFinalZoneClosed = () => {
      playBeep(330, 0.4);
      showToast('⛔ Время захода в финальную зону истекло');
    };
    const onMatchStarted = () => {
      invalidate();
      playBeep(880, 0.25);
      showToast('🏁 Матч начался! У вас 2 минуты на заход в зону');
    };
    const onMatchFinished = () => {
      invalidate();
      playBeep(523, 0.2);
      setTimeout(() => playBeep(659, 0.2), 150);
      setTimeout(() => playBeep(784, 0.3), 300);
      showToast('🏆 Матч завершён');
    };
    const onKicked = () => {
      invalidate();
      showToast('⚠️ Вас кикнули из команды');
    };

    socket.on('lobby:state', onState);
    socket.on('lobby:player_joined', onJoined);
    socket.on('lobby:player_left', onLeft);
    socket.on('lobby:team_changed', onTeamChanged);
    socket.on('lobby:team_created', onTeamCreated);
    socket.on('lobby:team_deleted', onTeamDeleted);
    socket.on('lobby:eliminated_changed', onEliminatedChanged);
    socket.on('lobby:ready_changed', onReadyChanged);
    socket.on('lobby:auto_assigned', onAutoAssigned);
    socket.on('lobby:zones_selected', onZonesSelected);
    socket.on('lobby:start_zone_closed', onStartZoneClosed);
    socket.on('lobby:final_zone_selected', onFinalZoneSelected);
    socket.on('lobby:final_zone_closed', onFinalZoneClosed);
    socket.on('match:started', onMatchStarted);
    socket.on('match:finished', onMatchFinished);
    socket.on('notify:kicked', onKicked);

    return () => {
      socket.emit('lobby:unsubscribe', { matchId });
      socket.off('lobby:state', onState);
      socket.off('lobby:player_joined', onJoined);
      socket.off('lobby:player_left', onLeft);
      socket.off('lobby:team_changed', onTeamChanged);
      socket.off('lobby:team_created', onTeamCreated);
      socket.off('lobby:team_deleted', onTeamDeleted);
      socket.off('lobby:eliminated_changed', onEliminatedChanged);
      socket.off('lobby:ready_changed', onReadyChanged);
      socket.off('lobby:auto_assigned', onAutoAssigned);
      socket.off('lobby:zones_selected', onZonesSelected);
      socket.off('lobby:start_zone_closed', onStartZoneClosed);
      socket.off('lobby:final_zone_selected', onFinalZoneSelected);
      socket.off('lobby:final_zone_closed', onFinalZoneClosed);
      socket.off('match:started', onMatchStarted);
      socket.off('match:finished', onMatchFinished);
      socket.off('notify:kicked', onKicked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, socket]);

  // Голосовое озвучивание финальной зоны — чтобы игроки не пропускали момент,
  // даже если свернули вкладку или альтабнулись в игру и не смотрят на экран.
  const announcedZoneIdRef = useRef<string | null>(null);
  useEffect(() => {
    const finalZone = lobby?.match.finalZone;
    if (!finalZone || announcedZoneIdRef.current === finalZone.id) return;
    announcedZoneIdRef.current = finalZone.id;

    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(`Финальная зона: ${finalZone.name}`);
      utterance.lang = 'ru-RU';
      utterance.rate = 1;
      utterance.volume = 1;
      window.speechSynthesis.cancel(); // обрываем предыдущую фразу, если она ещё звучит
      window.speechSynthesis.speak(utterance);
    } catch {
      // Web Speech API недоступен в этом браузере — молча игнорируем, звуковые сигналы (playBeep) всё равно сработают
    }
  }, [lobby?.match.finalZone]);

  const myMembership =
    lobby?.teams.flatMap((t) => t.members.map((m) => ({ ...m, teamId: t.id }))).find((m) => m.userId === user?.id) ??
    lobby?.unassignedMembers.map((m) => ({ ...m, teamId: null as string | null })).find((m) => m.userId === user?.id);
  const isOrganizerOrAdmin = isOrganizerOrAbove(user?.role);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorCode, setActionErrorCode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedWinnerTeamId, setSelectedWinnerTeamId] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [dynamicIdInput, setDynamicIdInput] = useState('');
  const [dynamicIdError, setDynamicIdError] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  const handleOpenJoinModal = () => {
    setDynamicIdInput('');
    setDynamicIdError(null);
    setShowJoinModal(true);
  };

  const handleConfirmJoin = async () => {
    if (!user) return;
    if (!/^\d{1,8}$/.test(dynamicIdInput)) {
      setDynamicIdError('Введите ID — только цифры, от 1 до 8 знаков');
      return;
    }
    setActionError(null);
    setActionErrorCode(null);
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/join`, { dynamicId: dynamicIdInput });
      setShowJoinModal(false);
      await refetch();
    } catch (e) {
      setDynamicIdError(e instanceof ApiClientError ? e.message : 'Не удалось войти в лобби');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/leave`);
      await refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleChooseTeam = async (teamId: string) => {
    setActionError(null);
    setActionErrorCode(null);
    setActionLoading(true);
    try {
      await api.patch(`/lobby/${matchId}/team`, { teamId });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось выбрать команду');
      setActionErrorCode(e instanceof ApiClientError ? e.code : null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReady = async (teamId: string, ready: boolean) => {
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/ready`, { teamId, ready });
      await refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/auto-assign`);
      await refetch();
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickPlayer = async (userId: string) => {
    if (!confirm('Кикнуть этого игрока из команды?')) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/kick`, { userId });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось кикнуть игрока');
    } finally {
      setActionLoading(false);
    }
  };

  const [showCreateTeamForm, setShowCreateTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);

  const handleCreateTeam = async () => {
    setCreateTeamError(null);
    if (!newTeamName.trim()) {
      setCreateTeamError('Укажите название команды');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/teams`, { name: newTeamName.trim() });
      setNewTeamName('');
      setShowCreateTeamForm(false);
      await refetch();
    } catch (e) {
      setCreateTeamError(e instanceof ApiClientError ? e.message : 'Не удалось создать команду');
    } finally {
      setActionLoading(false);
    }
  };

  // Кик от лица капитана команды (не путать с handleKickPlayer — это админский кик)
  const handleCaptainKick = async (teamId: string, userId: string) => {
    if (!confirm('Кикнуть этого игрока из вашей команды?')) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/lobby/${matchId}/teams/${teamId}/kick`, { userId });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось кикнуть игрока');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Удалить команду «${teamName}»? Участники останутся в лобби без команды.`)) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.delete(`/lobby/${matchId}/teams/${teamId}`);
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось удалить команду');
    } finally {
      setActionLoading(false);
    }
  };

  const [customZoneSeconds, setCustomZoneSeconds] = useState('');

  const handleStartMatch = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const seconds = customZoneSeconds.trim() ? Number(customZoneSeconds) : undefined;
      await api.post(`/matches/${matchId}/start`, seconds ? { zoneEntrySeconds: seconds } : undefined);
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось запустить матч');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseMatch = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/pause`);
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось поставить матч на паузу');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeMatch = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/resume`);
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось снять матч с паузы');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyAllIds = (label: string, ids: string[]) => {
    const text = ids.filter(Boolean).join('\n');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 2000);
    });
  };

  const handleToggleEliminated = async (eliminated: boolean) => {
    setActionError(null);
    try {
      await api.post(`/lobby/${matchId}/eliminated`, { eliminated });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось обновить статус');
    }
  };

  const handleRollFinalZone = async () => {
    if (!lobby?.match.selectedZones.length) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const randomZone = lobby.match.selectedZones[Math.floor(Math.random() * lobby.match.selectedZones.length)];
      await api.post(`/matches/${matchId}/final-zone`, { zoneId: randomZone.id });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось выбрать финальную зону');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishMatch = async () => {
    if (!selectedWinnerTeamId) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await api.post(`/matches/${matchId}/finish`, { winnerTeamId: selectedWinnerTeamId });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : 'Не удалось завершить матч');
    } finally {
      setActionLoading(false);
    }
  };

  const startZoneRemaining = useCountdown(lobby?.match.startZoneOpenedAt ? lobby.match.startZoneClosesAt : null);
  const finalZoneRemaining = useCountdown(lobby?.match.finalZoneOpenedAt ? lobby.match.finalZoneClosesAt : null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка лобби...</p>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Лобби не найдено.</p>
      </div>
    );
  }

  const capacity = CAPACITY[lobby.match.mode] ?? 4;
  const startDate = new Date(lobby.match.startTime);
  const mskTime = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(startDate);
  const canStart = lobby.match.status === 'SCHEDULED' && isOrganizerOrAdmin;
  const isLive = lobby.match.status === 'LIVE';
  const isPaused = lobby.match.status === 'PAUSED';
  const isFinished = lobby.match.status === 'FINISHED';
  const hasZones = lobby.match.selectedZones.length > 0;

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      {toast && (
        <div
          className="fixed top-24 right-6 z-50 px-5 py-3 rounded-lg text-sm shadow-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)' }}
        >
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
            <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
            Лобби · {isOrganizerOrAdmin ? lobby.match.map.name : 'карта скрыта'} · {MODE_LABELS[lobby.match.mode]}
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
            {isFinished ? 'Матч завершён' : isLive ? 'Матч идёт' : `Старт в ${mskTime} МСК`}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOrganizerOrAdmin && lobby.match.status !== 'FINISHED' && (
            <button onClick={handleAutoAssign} disabled={actionLoading} className="btn-out">
              🎲 Авто-раскидать
            </button>
          )}
        </div>
      </div>

      {isFinished && lobby.match.winnerTeam && (
        <div className="mb-6 rounded-xl px-6 py-6 text-center flex flex-col items-center gap-4" style={{ background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.25)' }}>
          <span className="font-display font-bold uppercase" style={{ fontSize: '20px', color: 'var(--gold)' }}>
            🏆 Победитель: {lobby.match.winnerTeam.name}
          </span>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Матч завершён.
          </p>
        </div>
      )}

      {/* Карта видна только тем, кто уже вступил в команду (или организатору/админу) —
          до этого момента игрок не должен знать, на какой карте будет матч. */}
      {!isOrganizerOrAdmin && !myMembership?.teamId && !isFinished && (
        <div className="mb-6 rounded-xl px-6 py-8 text-center" style={{ border: '1px dashed var(--border2)', background: 'rgba(255,255,255,.015)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            🗺️ Карта откроется, как только вы вступите в команду
          </p>
        </div>
      )}

      {hasZones && (isOrganizerOrAdmin || myMembership?.teamId || isFinished) && (
        <div className="card mb-6">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            Карта и зоны
          </h2>
          <div className="max-w-md mx-auto rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border2)' }}>
            <img src={lobby.match.map.imageUrl} alt={lobby.match.map.name} className="w-full h-auto block" />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {lobby.match.selectedZones.map((z) => (
              <span
                key={z.id}
                className="font-mono text-[11px] px-3 py-1 rounded-full"
                style={{
                  color: z.id === lobby.match.finalZone?.id ? '#c084fc' : 'var(--a)',
                  background: z.id === lobby.match.finalZone?.id ? 'rgba(139,92,246,.1)' : 'rgba(79,127,255,.08)',
                  border: `1px solid ${z.id === lobby.match.finalZone?.id ? 'rgba(139,92,246,.25)' : 'rgba(79,127,255,.18)'}`,
                }}
              >
                {z.name} {z.id === lobby.match.finalZone?.id && '(финальная)'}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLive && startZoneRemaining !== null && startZoneRemaining > 0 && !lobby.match.finalZoneOpenedAt && (
        <div className="mb-6 rounded-xl px-6 py-5 text-center" style={{ background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)' }}>
          <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--a)' }}>
            Время на заход в зону
          </div>
          <div className="font-display font-bold" style={{ fontSize: '40px', color: 'var(--text)' }}>
            {formatMs(startZoneRemaining)}
          </div>
        </div>
      )}

      {isLive && lobby.match.finalZoneOpenedAt && finalZoneRemaining !== null && finalZoneRemaining > 0 && (
        <div className="mb-6 rounded-xl px-6 py-5 text-center" style={{ background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.25)' }}>
          <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: '#c084fc' }}>
            Время на заход в финальную зону: {lobby.match.finalZone?.name}
          </div>
          <div className="font-display font-bold" style={{ fontSize: '40px', color: 'var(--text)' }}>
            {formatMs(finalZoneRemaining)}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <span>{actionError}</span>
          {actionErrorCode === 'DISCORD_NOT_LINKED' && (
            <Link href="/profile" className="btn-main flex-shrink-0" style={{ padding: '6px 14px', fontSize: '12px' }}>
              Привязать Discord
            </Link>
          )}
        </div>
      )}

      {isOrganizerOrAdmin && (
        <div className="card mb-8 flex flex-col gap-4">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            Управление матчем
          </h2>

          {(isLive || isPaused) && (
            <div className="rounded-lg px-4 py-3 flex flex-wrap items-center gap-3" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border2)' }}>
              <span className="font-display font-bold" style={{ fontSize: '18px', color: 'var(--green)' }}>
                {lobby.teams.flatMap((t) => t.members).filter((m) => !m.isEliminated).length}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                живых игроков из {lobby.teams.flatMap((t) => t.members).length}
              </span>
              <div className="flex flex-wrap gap-1.5 ml-auto">
                {lobby.teams.map((t) => {
                  const alive = t.members.filter((m) => !m.isEliminated).length;
                  if (t.members.length === 0) return null;
                  return (
                    <span
                      key={t.id}
                      className="font-mono text-[10px] px-2 py-1 rounded-full"
                      style={{ color: alive === 0 ? '#f87171' : 'var(--muted)', background: alive === 0 ? 'rgba(239,68,68,.08)' : 'rgba(255,255,255,.03)' }}
                    >
                      {t.name}: {alive}/{t.members.length}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {canStart && (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={customZoneSeconds}
                onChange={(e) => setCustomZoneSeconds(e.target.value.replace(/\D/g, ''))}
                placeholder="120"
                inputMode="numeric"
                className="input-field"
                style={{ width: '100px' }}
              />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                секунд на заход в зону (по умолчанию 120)
              </span>
              <button onClick={handleStartMatch} disabled={actionLoading} className="btn-main justify-center flex-1" style={{ minWidth: '140px' }}>
                ▶ Старт
              </button>
            </div>
          )}

          {isLive && (
            <button onClick={handlePauseMatch} disabled={actionLoading} className="btn-out justify-center">
              ⏸ Поставить на паузу
            </button>
          )}

          {isPaused && (
            <button onClick={handleResumeMatch} disabled={actionLoading} className="btn-main justify-center">
              ▶ Продолжить
            </button>
          )}

          {(isLive || isPaused) && (
            <button
              onClick={() => handleCopyAllIds('all', lobby.teams.flatMap((t) => t.members.map((m) => m.dynamicId ?? '')))}
              className="btn-out justify-center"
            >
              {copiedFeedback === 'all' ? '✓ Скопировано' : '📋 Скопировать все ID'}
            </button>
          )}

          {isLive && !lobby.match.finalZoneOpenedAt && hasZones && (
            <button onClick={handleRollFinalZone} disabled={actionLoading} className="btn-main justify-center">
              🎲 Выбрать финальную зону
            </button>
          )}

          {isLive && !!lobby.match.finalZoneOpenedAt && (
            <div className="flex flex-col gap-2">
              <label className="label-field">Победитель</label>
              <div className="flex gap-2 flex-wrap">
                <select value={selectedWinnerTeamId} onChange={(e) => setSelectedWinnerTeamId(e.target.value)} className="input-field flex-1">
                  <option value="">— выберите команду —</option>
                  {lobby.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.members.map((m) => `${m.user.username}${m.user.staticId ? ' / ' + m.user.staticId.value : ''}`).join(', ') || 'пусто'})
                    </option>
                  ))}
                </select>
                <button onClick={handleFinishMatch} disabled={actionLoading || !selectedWinnerTeamId} className="btn-main" style={{ padding: '13px 24px' }}>
                  Завершить матч
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!user && (
        <div className="mb-8 rounded-xl px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--muted)' }}>Войдите, чтобы присоединиться к лобби</p>
          <a href="/login" className="btn-main">
            Войти
          </a>
        </div>
      )}

      {user && !myMembership && !isFinished && (
        <div className="mb-8 rounded-xl px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--muted)' }}>Вы пока не в лобби</p>
          <button onClick={handleOpenJoinModal} disabled={actionLoading} className="btn-main">
            Войти в лобби
          </button>
        </div>
      )}

      {user && myMembership && (
        <div className="mb-8 rounded-xl px-6 py-5 flex items-center justify-between flex-wrap gap-4" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <p style={{ color: 'var(--text)' }}>Вы в лобби {myMembership.teamId ? '· команда выбрана' : '· выберите команду ниже'}</p>
          <div className="flex items-center gap-2">
            {(isLive || isPaused) && myMembership.teamId && (
              <button
                onClick={() => handleToggleEliminated(!myMembership.isEliminated)}
                className={myMembership.isEliminated ? 'btn-out' : 'btn-main'}
                style={{ padding: '10px 18px', fontSize: '13px' }}
              >
                {myMembership.isEliminated ? '✅ Я жив' : '💀 Мы умерли'}
              </button>
            )}
            <button onClick={handleLeave} disabled={actionLoading} className="btn-out">
              Выйти из лобби
            </button>
          </div>
        </div>
      )}

      {lobby.unassignedMembers.length > 0 && (
        <div className="mb-8 rounded-xl px-6 py-5" style={{ border: '1px dashed var(--border2)', background: 'rgba(255,255,255,.015)' }}>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Ждут выбора команды
          </p>
          <div className="flex flex-wrap gap-2">
            {lobby.unassignedMembers.map((m) => (
              <span key={m.id} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                {m.user.username}
                {m.userId === user?.id && (
                  <span className="text-[10px] font-mono" style={{ color: 'var(--a)' }}>
                    вы
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CREATE TEAM — доступно тому, кто в лобби, но ещё без команды */}
      {myMembership && !myMembership.teamId && !isFinished && (
        <div className="mb-8 card">
          {!showCreateTeamForm ? (
            <button onClick={() => setShowCreateTeamForm(true)} className="btn-main justify-center w-full">
              + Создать свою команду
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
                Новая команда
              </h3>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                placeholder="Название команды"
                maxLength={64}
                className="input-field"
                autoFocus
              />
              {createTeamError && <p className="error-text">{createTeamError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowCreateTeamForm(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                  Отмена
                </button>
                <button onClick={handleCreateTeam} disabled={actionLoading} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                  Создать
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lobby.teams.map((team) => {
          const isMyTeam = myMembership?.teamId === team.id;
          const isFull = team.members.length >= capacity;
          const isWinner = lobby.match.winnerTeam?.id === team.id;

          return (
            <div
              key={team.id}
              className="rounded-2xl p-6"
              style={{ border: `1px solid ${isWinner ? 'rgba(201,149,74,.4)' : 'var(--border)'}`, background: isWinner ? 'rgba(201,149,74,.04)' : 'var(--surface)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="font-display font-semibold uppercase tracking-wider flex items-center gap-2" style={{ fontSize: '16px', color: 'var(--text)' }}>
                  {team.name}
                  {isWinner && <span>🏆</span>}
                </div>
                <div className="flex items-center gap-2">
                  {isOrganizerOrAdmin && team.members.length > 0 && (
                    <button
                      onClick={() => handleCopyAllIds(team.id, team.members.map((m) => m.dynamicId ?? ''))}
                      className="font-mono text-[10px] px-2 py-1 rounded-full transition-colors"
                      style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.18)' }}
                      title="Скопировать ID этой команды"
                    >
                      {copiedFeedback === team.id ? '✓' : '📋 ID'}
                    </button>
                  )}
                  {isOrganizerOrAdmin && !isFinished && (
                    <button
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="font-mono text-[10px] px-2 py-1 rounded-full transition-colors"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.18)' }}
                      title="Удалить команду"
                    >
                      🗑 Удалить
                    </button>
                  )}
                  <span
                    className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                    style={{
                      color: team.isReady ? 'var(--green)' : 'var(--muted)',
                      background: team.isReady ? 'rgba(34,197,94,.08)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${team.isReady ? 'rgba(34,197,94,.2)' : 'var(--border2)'}`,
                    }}
                  >
                    {team.isReady ? 'READY ✓' : `${team.members.length}/${capacity}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-5 min-h-[80px]">
                {team.members.length === 0 && <p className="text-xs italic" style={{ color: 'rgba(96,104,128,.5)' }}>Пока никого</p>}
                {team.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 text-sm py-1 group"
                    style={{ borderBottom: '1px solid var(--border)', opacity: m.isEliminated ? 0.45 : 1 }}
                  >
                    <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size={24} />
                    <span style={{ textDecoration: m.isEliminated ? 'line-through' : 'none' }}>
                      {m.isEliminated && '💀 '}
                      {m.user.username}
                    </span>
                    {m.user.staticId && (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                        {m.user.staticId.value}
                      </span>
                    )}
                    {isOrganizerOrAdmin && m.dynamicId && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)' }}>
                        ID: {m.dynamicId}
                      </span>
                    )}
                    {m.userId === team.createdById && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.08)' }}>
                        👑 капитан
                      </span>
                    )}
                    {m.userId === user?.id && (
                      <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--a)' }}>
                        вы
                      </span>
                    )}
                    {isAdminOrOwner(user?.role) && m.userId !== user?.id && (
                      <button
                        onClick={() => handleKickPlayer(m.userId)}
                        className="ml-auto text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#f87171' }}
                        title="Кикнуть из команды (только Admin)"
                      >
                        кикнуть
                      </button>
                    )}
                    {!isAdminOrOwner(user?.role) && team.createdById === user?.id && m.userId !== user?.id && (
                      <button
                        onClick={() => handleCaptainKick(team.id, m.userId)}
                        className="ml-auto text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#f87171' }}
                        title="Кикнуть из своей команды"
                      >
                        кикнуть
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {user && myMembership && !isMyTeam && !isFull && !isFinished && (
                  <button onClick={() => handleChooseTeam(team.id)} disabled={actionLoading} className="btn-out flex-1" style={{ padding: '10px 16px', fontSize: '13px' }}>
                    Выбрать команду
                  </button>
                )}
                {isMyTeam && !isFinished && (
                  <button
                    onClick={() => handleReady(team.id, !team.isReady)}
                    disabled={actionLoading}
                    className="btn-main flex-1"
                    style={{ padding: '10px 16px', fontSize: '13px' }}
                  >
                    {team.isReady ? 'Снять готовность' : 'Мы готовы'}
                  </button>
                )}
              </div>

              {/* ЧАТ КОМАНДЫ — видят и пишут только её участники */}
              {isMyTeam && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <ChatPanel matchId={lobby.match.id} teamId={team.id} height="280px" title="Чат команды" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ЧАТ ЛОББИ — отдельная комната от общего чата, доступна всем в этом матче */}
      <div className="card mt-8">
        <ChatPanel matchId={lobby.match.id} height="500px" title="Чат лобби" />
      </div>

      {/* JOIN MODAL — динамический ID запрашивается перед входом в лобби */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setShowJoinModal(false)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              Вход в лобби
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
              Укажите ваш текущий игровой ID на сервере (не Static ID — он меняется каждую сессию).
            </p>
            <input
              value={dynamicIdInput}
              onChange={(e) => {
                setDynamicIdInput(e.target.value.replace(/\D/g, '').slice(0, 8));
                setDynamicIdError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmJoin()}
              placeholder="например: 68"
              inputMode="numeric"
              className="input-field mb-3"
              autoFocus
            />
            {dynamicIdError && <p className="error-text mb-3">{dynamicIdError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowJoinModal(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleConfirmJoin} disabled={actionLoading} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {actionLoading ? 'Входим...' : 'Войти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
