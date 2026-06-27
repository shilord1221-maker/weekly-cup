'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import { Avatar } from '@/components/Avatar';
import { ColoredUsername } from '@/components/ColoredUsername';

interface PartyMember {
  id: string;
  userId: string;
  user: { id: string; username: string; avatarUrl?: string | null; activeFrameEffect?: string | null; activeUsernameEffect?: string | null };
}

interface Party {
  id: string;
  captainId: string;
  status: string;
  captain: { id: string; username: string; avatarUrl?: string | null };
  members: PartyMember[];
  invites: { id: string; userId: string; user: { username: string; avatarUrl?: string | null } }[];
}

interface PendingInvite {
  id: string;
  partyId: string;
  party: { id: string; captain: { username: string; avatarUrl?: string | null }; members: { userId: string }[] };
}

const PARTY_SIZE = 5;

export default function GfcQueuePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const socket = useSocket();
  const qc = useQueryClient();

  const [inviteInput, setInviteInput] = useState('');
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const { data: party, refetch: refetchParty } = useQuery<Party | null>({
    queryKey: ['gfc-party'],
    queryFn: () => api.get<Party>('/gfc/party/my').catch(() => null),
    enabled: !!user,
  });

  const { data: pendingInvites, refetch: refetchInvites } = useQuery<PendingInvite[]>({
    queryKey: ['gfc-party-invites'],
    queryFn: () => api.get('/gfc/party/invites'),
    enabled: !!user,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [searching]);

  useEffect(() => {
    const onMatchFound = (data: { lobbyId: string }) => router.push(`/gfc/${data.lobbyId}`);
    const onPartyState = () => refetchParty();
    const onPartyInvite = (data: { captainUsername: string }) => { showToast(`⚔️ ${data.captainUsername} приглашает в пати GFC!`); refetchInvites(); };
    const onDisbanded = (data: { reason: string }) => { showToast(data.reason); refetchParty(); };
    const onSearching = (data: { searching: boolean }) => { setSearching(data.searching); if (data.searching) setElapsed(0); };
    const onKicked = () => { showToast('Вас кикнули из пати'); refetchParty(); };
    const onMemberJoined = (data: { username: string }) => { showToast(`${data.username} присоединился к пати`); refetchParty(); };

    socket.on('gfc:match_found', onMatchFound);
    socket.on('party:state', onPartyState);
    socket.on('gfc:party_invite', onPartyInvite);
    socket.on('party:disbanded', onDisbanded);
    socket.on('party:searching', onSearching);
    socket.on('party:kicked', onKicked);
    socket.on('party:member_joined', onMemberJoined);

    return () => {
      socket.off('gfc:match_found', onMatchFound);
      socket.off('party:state', onPartyState);
      socket.off('gfc:party_invite', onPartyInvite);
      socket.off('party:disbanded', onDisbanded);
      socket.off('party:searching', onSearching);
      socket.off('party:kicked', onKicked);
      socket.off('party:member_joined', onMemberJoined);
    };
  }, [socket, router, refetchParty, refetchInvites]);

  // Подписываемся на комнату пати
  useEffect(() => {
    if (!party?.id) return;
    socket.emit('gfc-party:subscribe', { partyId: party.id });
    return () => socket.emit('gfc-party:unsubscribe', { partyId: party.id });
  }, [party?.id, socket]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Войдите чтобы играть в GFC.</p>
    </div>
  );

  const isCaptain = party?.captainId === user.id;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const createParty = async () => {
    setLoading(true);
    try { await api.post('/gfc/party'); refetchParty(); }
    catch (e) { showToast(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const leaveParty = async () => {
    setLoading(true);
    try { await api.post('/gfc/party/leave'); refetchParty(); setSearching(false); }
    catch (e) { showToast(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const invitePlayer = async () => {
    if (!inviteInput.trim()) return;
    setInviteErr(null); setLoading(true);
    try { await api.post('/gfc/party/invite', { username: inviteInput.trim() }); setInviteInput(''); showToast(`Приглашение отправлено`); }
    catch (e) { setInviteErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const respondInvite = async (partyId: string, accept: boolean) => {
    setLoading(true);
    try { await api.post(`/gfc/party/invites/${partyId}/respond`, { accept }); refetchInvites(); refetchParty(); }
    catch (e) { showToast(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const kickMember = async (userId: string) => {
    await api.delete(`/gfc/party/members/${userId}`);
    refetchParty();
  };

  const startSearch = async () => {
    setLoading(true);
    try { const res = await api.post<{ searching: boolean }>('/gfc/party/search'); setSearching(res.searching); setElapsed(0); }
    catch (e) { showToast(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const cancelSearch = async () => {
    await api.post('/gfc/party/search/cancel');
    setSearching(false);
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>

      {toast && (
        <div className="fixed top-24 right-6 z-50 px-5 py-3 rounded-lg text-sm shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)' }}>
          {toast}
        </div>
      )}

      <Link href="/gfc" className="text-xs font-mono" style={{ color: 'var(--muted)' }}>← GFC</Link>
      <h1 className="font-display font-bold uppercase mt-3 mb-2" style={{ fontSize: 'clamp(28px,5vw,44px)' }}>
        GFC Пати
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Собери команду 5 игроков и найдите соперника</p>

      {/* Входящие приглашения */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--gold)' }}>
            ⚔️ Приглашения в пати
          </h2>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)' }}>
                <Avatar username={inv.party.captain.username} avatarUrl={inv.party.captain.avatarUrl} size={36} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{inv.party.captain.username}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>приглашает в пати · {inv.party.members.length}/{PARTY_SIZE}</div>
                </div>
                <button onClick={() => respondInvite(inv.partyId, true)} disabled={loading} className="btn-main" style={{ padding: '8px 16px', fontSize: '12px' }}>Принять</button>
                <button onClick={() => respondInvite(inv.partyId, false)} disabled={loading} className="btn-out" style={{ padding: '8px 12px', fontSize: '12px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Нет пати */}
      {!party && (
        <div className="card text-center py-10">
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>У вас нет активной пати</p>
          <button onClick={createParty} disabled={loading} className="btn-main justify-center">
            ⚔️ Создать пати
          </button>
        </div>
      )}

      {/* Пати активна */}
      {party && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
              Пати · {party.members.length}/{PARTY_SIZE}
            </h2>
            <div className="flex gap-2">
              {isCaptain && party.status !== 'SEARCHING' && (
                <button onClick={startSearch} disabled={loading || party.members.length < 1} className="btn-main" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  🔍 Найти матч
                </button>
              )}
              {isCaptain && party.status === 'SEARCHING' && (
                <button onClick={cancelSearch} className="btn-out" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  Отменить поиск
                </button>
              )}
              <button onClick={leaveParty} disabled={loading} className="text-xs px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' }}>
                {isCaptain ? 'Распустить' : 'Выйти'}
              </button>
            </div>
          </div>

          {/* Поиск идёт */}
          {searching && party.status === 'SEARCHING' && (
            <div className="mb-4 rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)' }}>
              <div className="font-display font-bold text-xl" style={{ color: 'var(--a)' }}>{fmt(elapsed)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Поиск соперника...</div>
            </div>
          )}

          {/* Участники */}
          <div className="flex flex-col gap-1 mb-4">
            {party.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size={36} frameKey={m.user.activeFrameEffect} />
                <span className="flex-1 text-sm"><ColoredUsername username={m.user.username} effectKey={m.user.activeUsernameEffect} /></span>
                {m.userId === party.captainId && <span className="font-mono text-[10px]" style={{ color: 'var(--gold)' }}>👑 капитан</span>}
                {m.userId === user.id && <span className="font-mono text-[10px]" style={{ color: 'var(--a)' }}>вы</span>}
                {isCaptain && m.userId !== user.id && (
                  <button onClick={() => kickMember(m.userId)} className="text-[10px] font-mono" style={{ color: '#f87171' }}>кик</button>
                )}
              </div>
            ))}

            {/* Ожидающие приглашения */}
            {party.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
                <Avatar username={inv.user.username} avatarUrl={inv.user.avatarUrl} size={36} />
                <span className="flex-1 text-sm">{inv.user.username}</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>⏳ ожидает</span>
              </div>
            ))}

            {/* Пустые слоты */}
            {Array.from({ length: PARTY_SIZE - party.members.length - party.invites.length }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)', opacity: 0.3 }}>
                <div className="w-9 h-9 rounded-full" style={{ background: 'var(--border2)' }} />
                <span className="text-sm italic" style={{ color: 'var(--muted)' }}>Свободный слот</span>
              </div>
            ))}
          </div>

          {/* Пригласить (только капитан) */}
          {isCaptain && party.members.length + party.invites.length < PARTY_SIZE && party.status !== 'SEARCHING' && (
            <div>
              <label className="label-field">Пригласить игрока по нику</label>
              {inviteErr && <p className="error-text mb-2">{inviteErr}</p>}
              <div className="flex gap-2">
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && invitePlayer()}
                  placeholder="Введите ник..."
                  className="input-field flex-1"
                />
                <button onClick={invitePlayer} disabled={loading || !inviteInput.trim()} className="btn-main flex-shrink-0">
                  Пригласить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
