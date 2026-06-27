'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';
import { ColoredUsername } from '@/components/ColoredUsername';

interface GfcPlayer {
  id: string;
  userId: string;
  teamNum: number;
  dynamicId: string | null;
  isReady: boolean;
  user: { id: string; username: string; avatarUrl?: string | null; activeFrameEffect?: string | null; activeUsernameEffect?: string | null; staticId?: { value: string } | null; stackMembership?: { stack: { tag: string; tagColor: string } } | null };
}

interface GfcRound {
  id: string;
  roundNum: number;
  team1Role: string;
  winnerTeam: number | null;
}

interface GfcLobby {
  id: string;
  status: string;
  hasPassword: boolean;
  team1Name: string;
  team2Name: string;
  mapPool: string[];
  bans: string[];
  banTurn: number;
  selectedMap: string | null;
  team1Side: string | null;
  team1Score: number;
  team2Score: number;
  winnerTeam: number | null;
  createdBy: { id: string; username: string };
  players: GfcPlayer[];
  rounds: GfcRound[];
}

interface GfcMap { key: string; name: string; imageUrl: string; }

const TEAM_SIZE = 5;

const MAP_NAMES: Record<string, string> = {
  tattoo: 'Тату', sandy: 'Сэндик', mexico: 'Мексы',
  shop247: '24/7', trailers: 'Трейлера', farm: 'Ферма',
};

export default function GfcLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const socket = useSocket();
  const router = useRouter();
  const [joinTeam, setJoinTeam] = useState<1 | 2>(1);
  const [joinPwd, setJoinPwd] = useState('');
  const [joinDynId, setJoinDynId] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const { data: lobby } = useQuery<GfcLobby>({
    queryKey: ['gfc', id],
    queryFn: () => api.get(`/gfc/${id}`, { auth: false }),
    enabled: !!id,
  });

  const { data: maps } = useQuery<GfcMap[]>({
    queryKey: ['gfc-maps'],
    queryFn: () => api.get('/gfc/maps', { auth: false }),
  });

  useEffect(() => {
    if (!id) return;
    socket.emit('gfc:subscribe', { lobbyId: id });
    const onState = () => qc.invalidateQueries({ queryKey: ['gfc', id] });
    const onDeleted = () => router.push('/gfc');
    const onBanPickStart = () => showToast('🗺️ Началась фаза бан-пика карт!');
    const onSidePickStart = () => showToast('⚔️ Выберите сторону — Атака или Защита');
    const onMatchStarted = () => showToast('🏁 Матч начался!');
    const onDecidingRound = () => showToast('⚡ Счёт 2:2 — решающий 5-й раунд!');
    const onMatchFinished = (data: { winnerTeam: number }) => showToast(`🏆 Победа команды ${data.winnerTeam}!`);

    socket.on('gfc:state', onState);
    socket.on('gfc:deleted', onDeleted);
    socket.on('gfc:ban_pick_start', onBanPickStart);
    socket.on('gfc:side_pick_start', onSidePickStart);
    socket.on('gfc:match_started', onMatchStarted);
    socket.on('gfc:deciding_round', onDecidingRound);
    socket.on('gfc:match_finished', onMatchFinished);

    return () => {
      socket.emit('gfc:unsubscribe', { lobbyId: id });
      socket.off('gfc:state', onState);
      socket.off('gfc:deleted', onDeleted);
      socket.off('gfc:ban_pick_start', onBanPickStart);
      socket.off('gfc:side_pick_start', onSidePickStart);
      socket.off('gfc:match_started', onMatchStarted);
      socket.off('gfc:deciding_round', onDecidingRound);
      socket.off('gfc:match_finished', onMatchFinished);
    };
  }, [id, socket]);

  if (!lobby) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Загрузка...</p></div>;

  const myPlayer = lobby.players.find((p) => p.userId === user?.id);
  const t1 = lobby.players.filter((p) => p.teamNum === 1);
  const t2 = lobby.players.filter((p) => p.teamNum === 2);
  const isOrganizer = isOrganizerOrAbove(user?.role);
  const myTeamNum = myPlayer?.teamNum;
  const currentMap = maps?.find((m) => m.key === lobby.selectedMap);

  const handleJoin = async () => {
    setJoinErr(null); setLoading(true);
    try {
      await api.post(`/gfc/${id}/join`, { teamNum: joinTeam, password: joinPwd || undefined, dynamicId: joinDynId || undefined });
      qc.invalidateQueries({ queryKey: ['gfc', id] });
    } catch (e) { setJoinErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleLeave = async () => {
    await api.post(`/gfc/${id}/leave`);
    qc.invalidateQueries({ queryKey: ['gfc', id] });
  };

  const handleReady = async (ready: boolean) => {
    setLoading(true);
    try { await api.post(`/gfc/${id}/ready`, { ready }); qc.invalidateQueries({ queryKey: ['gfc', id] }); }
    catch (e) { setActionErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleBan = async (mapKey: string) => {
    setLoading(true);
    try { await api.post(`/gfc/${id}/ban`, { mapKey }); qc.invalidateQueries({ queryKey: ['gfc', id] }); }
    catch (e) { setActionErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handlePickSide = async (side: 'ATTACK' | 'DEFENSE') => {
    setLoading(true);
    try { await api.post(`/gfc/${id}/pick-side`, { side }); qc.invalidateQueries({ queryKey: ['gfc', id] }); }
    catch (e) { setActionErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleReportRound = async (roundNum: number, winnerTeam: 1 | 2) => {
    setLoading(true);
    try { await api.post(`/gfc/${id}/round/${roundNum}/result`, { winnerTeam }); qc.invalidateQueries({ queryKey: ['gfc', id] }); }
    catch (e) { setActionErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const renderPlayer = (p: GfcPlayer) => (
    <div key={p.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <Avatar username={p.user.username} avatarUrl={p.user.avatarUrl} size={32} frameKey={p.user.activeFrameEffect} />
      {p.user.stackMembership?.stack && <StackTag tag={p.user.stackMembership.stack.tag} color={p.user.stackMembership.stack.tagColor} />}
      <span className="text-sm flex-1"><ColoredUsername username={p.user.username} effectKey={p.user.activeUsernameEffect} /></span>
      {p.user.staticId && <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{p.user.staticId.value}</span>}
      {p.dynamicId && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)' }}>ID: {p.dynamicId}</span>}
      {p.isReady && <span className="font-mono text-[10px]" style={{ color: 'var(--green)' }}>✓ Готов</span>}
      {p.userId === user?.id && <span className="font-mono text-[10px]" style={{ color: 'var(--a)' }}>вы</span>}
    </div>
  );

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>

      {toast && (
        <div className="fixed top-24 right-6 z-50 px-5 py-3 rounded-lg text-sm shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)' }}>
          {toast}
        </div>
      )}

      {/* Заголовок */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <Link href="/gfc" className="text-xs font-mono" style={{ color: 'var(--muted)' }}>← GFC</Link>
          <h1 className="font-display font-bold uppercase mt-2" style={{ fontSize: 'clamp(22px,4vw,36px)' }}>
            {lobby.team1Name} <span style={{ color: 'var(--muted)', fontSize: '60%' }}>vs</span> {lobby.team2Name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            <span>GFC 5×5</span>
            {lobby.hasPassword && <span>🔒 Закрытое</span>}
            <span>Организатор: {lobby.createdBy.username}</span>
          </div>
        </div>
        {isOrganizer && (
          <button onClick={async () => { if (confirm('Удалить лобби?')) { await api.delete(`/gfc/${id}`); router.push('/gfc'); } }} className="text-xs px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' }}>
            Удалить
          </button>
        )}
      </div>

      {actionErr && <div className="mb-4 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{actionErr}</div>}

      {/* ФАЗА: ОЖИДАНИЕ */}
      {lobby.status === 'WAITING' && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {[1, 2].map((teamNum) => {
            const players = teamNum === 1 ? t1 : t2;
            const name = teamNum === 1 ? lobby.team1Name : lobby.team2Name;
            return (
              <div key={teamNum} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold uppercase text-sm tracking-wider">{name}</h2>
                  <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{players.length}/{TEAM_SIZE}</span>
                </div>
                <div className="flex flex-col gap-1 min-h-[120px]">
                  {players.map(renderPlayer)}
                </div>
                {!myPlayer && user && players.length < TEAM_SIZE && (
                  <button
                    onClick={() => setJoinTeam(teamNum as 1 | 2)}
                    className="mt-3 w-full py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ border: `1px solid ${joinTeam === teamNum ? 'var(--a)' : 'var(--border2)'}`, background: joinTeam === teamNum ? 'rgba(79,127,255,.08)' : 'transparent', color: joinTeam === teamNum ? 'var(--a)' : 'var(--muted)' }}
                  >
                    {joinTeam === teamNum ? '✓ Выбрана' : 'Выбрать команду'}
                  </button>
                )}
                {myPlayer?.teamNum === teamNum && (
                  <button onClick={() => handleReady(!myPlayer.isReady)} disabled={loading} className={`mt-3 btn-${myPlayer.isReady ? 'out' : 'main'} justify-center w-full`}>
                    {myPlayer.isReady ? 'Снять готовность' : '✓ Я готов'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Форма входа */}
      {!myPlayer && user && lobby.status === 'WAITING' && (
        <div className="card mb-6">
          <h3 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Войти в лобби</h3>
          {joinErr && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{joinErr}</div>}
          <div className="flex gap-2 flex-wrap">
            <input value={joinDynId} onChange={(e) => setJoinDynId(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Динамический ID" inputMode="numeric" className="input-field flex-1" style={{ minWidth: '120px' }} />
            {lobby.hasPassword && <input value={joinPwd} onChange={(e) => setJoinPwd(e.target.value)} placeholder="Пароль" type="password" className="input-field flex-1" style={{ minWidth: '120px' }} />}
            <button onClick={handleJoin} disabled={loading} className="btn-main flex-shrink-0">{loading ? '...' : `Войти в ${joinTeam === 1 ? lobby.team1Name : lobby.team2Name}`}</button>
          </div>
        </div>
      )}

      {myPlayer && lobby.status === 'WAITING' && (
        <div className="flex justify-end mb-4">
          <button onClick={handleLeave} className="btn-out" style={{ fontSize: '13px' }}>Выйти из лобби</button>
        </div>
      )}

      {/* ФАЗА: БАН-ПИК */}
      {lobby.status === 'BAN_PICK' && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
              Бан-пик карт
            </h2>
            <div className="text-sm" style={{ color: lobby.banTurn === myTeamNum ? 'var(--green)' : 'var(--muted)' }}>
              {lobby.banTurn === myTeamNum ? '⚡ Ваша очередь банить' : `Банит: ${lobby.banTurn === 1 ? lobby.team1Name : lobby.team2Name}`}
            </div>
          </div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Бан-порядок: {lobby.team1Name} → {lobby.team2Name} → {lobby.team1Name} → {lobby.team2Name}
            &nbsp;· Забанено: {lobby.bans.length}/4
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lobby.mapPool.map((mapKey) => {
              const m = maps?.find((x) => x.key === mapKey);
              const banned = lobby.bans.includes(mapKey);
              const canBan = lobby.banTurn === myTeamNum && !banned && lobby.status === 'BAN_PICK';
              return (
                <div key={mapKey} className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${banned ? 'rgba(239,68,68,.3)' : 'var(--border)'}`, opacity: banned ? 0.4 : 1 }}>
                  <div className="aspect-video bg-gray-900">
                    {m?.imageUrl && <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--surface)' }}>
                    <span className="text-sm font-medium">{m?.name ?? mapKey}</span>
                    {banned ? (
                      <span className="text-[10px] font-mono" style={{ color: '#f87171' }}>BANNED</span>
                    ) : canBan ? (
                      <button onClick={() => handleBan(mapKey)} disabled={loading} className="text-[10px] font-medium px-2 py-1 rounded" style={{ color: '#f87171', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
                        Забанить
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ФАЗА: ВЫБОР СТОРОН */}
      {lobby.status === 'SIDE_PICK' && (
        <div className="card mb-6 text-center">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Выбор сторон</h2>
          {currentMap && <p className="text-sm mb-4">Карта: <strong>{currentMap.name}</strong></p>}
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{lobby.team1Name} выбирает сторону на первые 2 раунда</p>
          {myTeamNum === 1 ? (
            <div className="flex gap-3 justify-center">
              <button onClick={() => handlePickSide('ATTACK')} disabled={loading} className="btn-main px-8">
                ⚔️ Атака
              </button>
              <button onClick={() => handlePickSide('DEFENSE')} disabled={loading} className="btn-out px-8">
                🛡️ Защита
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Ждём выбора {lobby.team1Name}...</p>
          )}
        </div>
      )}

      {/* ФАЗА: МАТЧ */}
      {(lobby.status === 'IN_PROGRESS' || lobby.status === 'FINISHED') && (
        <div className="mb-6">
          {/* Счёт */}
          <div className="card mb-4 text-center">
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="font-display font-bold text-4xl" style={{ color: lobby.winnerTeam === 1 ? 'var(--gold)' : 'var(--text)' }}>{lobby.team1Score}</div>
                <div className="text-sm mt-1">{lobby.team1Name}</div>
              </div>
              <div className="text-2xl" style={{ color: 'var(--muted)' }}>:</div>
              <div>
                <div className="font-display font-bold text-4xl" style={{ color: lobby.winnerTeam === 2 ? 'var(--gold)' : 'var(--text)' }}>{lobby.team2Score}</div>
                <div className="text-sm mt-1">{lobby.team2Name}</div>
              </div>
            </div>
            {lobby.winnerTeam && (
              <div className="mt-4 font-display font-bold text-lg" style={{ color: 'var(--gold)' }}>
                🏆 Победа: {lobby.winnerTeam === 1 ? lobby.team1Name : lobby.team2Name}
              </div>
            )}
            {currentMap && <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Карта: {currentMap.name}</p>}
          </div>

          {/* Раунды */}
          <div className="card">
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>Раунды</h2>
            <div className="flex flex-col gap-3">
              {lobby.rounds.map((round) => {
                const team1Role = round.team1Role;
                const team2Role = team1Role === 'ATTACK' ? 'DEFENSE' : 'ATTACK';
                const isDeciding = round.roundNum === 5;
                const canReport = myPlayer && !round.winnerTeam && lobby.status === 'IN_PROGRESS';
                return (
                  <div key={round.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-mono text-xs px-2 py-0.5 rounded" style={{ color: isDeciding ? 'var(--gold)' : 'var(--muted)', background: isDeciding ? 'rgba(201,149,74,.1)' : 'rgba(255,255,255,.04)' }}>
                        {isDeciding ? '⚡ Решающий' : `Раунд ${round.roundNum}`}
                      </div>
                      <div className="text-xs flex items-center gap-3 flex-1">
                        <span>⚔️ {team1Role === 'ATTACK' ? lobby.team1Name : lobby.team2Name}</span>
                        <span style={{ color: 'var(--muted)' }}>vs</span>
                        <span>🛡️ {team2Role === 'DEFENSE' ? lobby.team2Name : lobby.team1Name}</span>
                      </div>
                      {round.winnerTeam ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ color: 'var(--green)', background: 'rgba(34,197,94,.08)' }}>
                          ✓ {round.winnerTeam === 1 ? lobby.team1Name : lobby.team2Name}
                        </span>
                      ) : canReport ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleReportRound(round.roundNum, 1)} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)' }}>
                            {lobby.team1Name} выиграл
                          </button>
                          <button onClick={() => handleReportRound(round.roundNum, 2)} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)' }}>
                            {lobby.team2Name} выиграл
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>ожидание...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Список игроков */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {[1, 2].map((teamNum) => {
              const players = teamNum === 1 ? t1 : t2;
              const name = teamNum === 1 ? lobby.team1Name : lobby.team2Name;
              return (
                <div key={teamNum} className="card">
                  <h3 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{name}</h3>
                  {players.map(renderPlayer)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
