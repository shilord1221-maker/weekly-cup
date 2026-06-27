'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { TokenIcon } from '@/components/TokenIcon';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function masked(value: string, type: 'email' | 'ip') {
  if (type === 'email') {
    const [user, domain] = value.split('@');
    return `${user?.[0] ?? ''}${'●'.repeat(Math.max(2, (user?.length ?? 3) - 1))}@${domain ?? '●●●'}`;
  }
  return value.replace(/\d+/g, (n) => '●'.repeat(n.length));
}

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'ORGANIZER' | 'PLAYER';
  staticId: string | null;
  staticIdProofUrl: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedUntil: string | null;
  registrationIp?: string | null;
  lastLoginIp?: string | null;
  createdAt: string;
  tokenBalance?: number;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  PLAYER: 'Player',
};
const ROLE_LABEL_ORDER = ['OWNER', 'ADMIN', 'ORGANIZER', 'PLAYER'];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [bannedFilter, setBannedFilter] = useState('');
  const [banTargetId, setBanTargetId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banByIp, setBanByIp] = useState(false);
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDays, setSuspendDays] = useState('');
  const [staticIdTarget, setStaticIdTarget] = useState<UserItem | null>(null);
  const [staticIdInput, setStaticIdInput] = useState('');
  const [staticIdError, setStaticIdError] = useState<string | null>(null);
  const [usernameTarget, setUsernameTarget] = useState<UserItem | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const isOwner = currentUser?.role === 'OWNER';
  const [showSensitive, setShowSensitive] = useState(false);
  const [tokenTarget, setTokenTarget] = useState<UserItem | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Owner-роль предлагается в списке только самому Owner — обычный Admin физически
  // не увидит этот пункт (backend всё равно заблокирует попытку, если обойти UI).
  const availableRoles = isOwner ? ['PLAYER', 'ORGANIZER', 'ADMIN', 'OWNER'] : ['PLAYER', 'ORGANIZER', 'ADMIN'];

  const { data: users, isLoading } = useQuery<UserItem[]>({
    queryKey: ['admin-users', search, roleFilter, bannedFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (roleFilter) params.set('role', roleFilter);
      if (bannedFilter) params.set('banned', bannedFilter);
      const qs = params.toString();
      return api.get(`/users${qs ? `?${qs}` : ''}`);
    },
  });

  interface CountStats {
    total: number;
    banned: number;
    byRole: Record<string, number>;
  }
  const { data: stats } = useQuery<CountStats>({
    queryKey: ['admin-users-count'],
    queryFn: () => api.get('/users/count'),
  });

  const handleRoleChange = async (id: string, role: string) => {
    setError(null);
    try {
      await api.patch(`/users/${id}/role`, { role });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось изменить роль');
    }
  };

  const handleBanConfirm = async () => {
    if (!banTargetId) return;
    setError(null);
    try {
      await api.post(`/users/${banTargetId}/ban`, { reason: banReason.trim() || undefined, banByIp });
      setBanTargetId(null);
      setBanReason('');
      setBanByIp(false);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось забанить пользователя');
    }
  };

  const handleUnban = async (id: string) => {
    setError(null);
    try {
      await api.post(`/users/${id}/unban`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось разбанить пользователя');
    }
  };

  const handleSuspendConfirm = async () => {
    if (!suspendTargetId) return;
    setError(null);
    try {
      const durationDays = suspendDays.trim() ? Number(suspendDays) : undefined;
      await api.post(`/users/${suspendTargetId}/suspend`, { reason: suspendReason.trim() || undefined, durationDays });
      setSuspendTargetId(null);
      setSuspendReason('');
      setSuspendDays('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось отстранить пользователя');
    }
  };

  const handleUnsuspend = async (id: string) => {
    setError(null);
    try {
      await api.post(`/users/${id}/unsuspend`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось снять отстранение');
    }
  };

  const handleSaveStaticId = async () => {
    if (!staticIdTarget) return;
    setStaticIdError(null);
    try {
      await api.patch(`/users/${staticIdTarget.id}/static-id`, { staticId: staticIdInput.trim() });
      setStaticIdTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setStaticIdError(e instanceof ApiClientError ? e.message : 'Не удалось изменить Static ID');
    }
  };

  const handleGrantTokens = async () => {
    if (!tokenTarget) return;
    const amount = Number(tokenAmount);
    if (!amount || amount < 1) { setTokenError('Укажите количество токенов'); return; }
    setTokenError(null); setTokenSuccess(false); setTokenLoading(true);
    try {
      await api.post('/shop/grant', { userId: tokenTarget.id, amount });
      setTokenSuccess(true);
      setTokenAmount('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setTimeout(() => { setTokenTarget(null); setTokenSuccess(false); }, 1500);
    } catch (e) {
      setTokenError(e instanceof ApiClientError ? e.message : 'Не удалось выдать токены');
    } finally { setTokenLoading(false); }
  };

  const handleSaveUsername = async () => {
    if (!usernameTarget) return;
    setUsernameError(null);
    try {
      await api.patch(`/users/${usernameTarget.id}/username`, { username: usernameInput.trim() });
      setUsernameTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      setUsernameError(e instanceof ApiClientError ? e.message : 'Не удалось изменить ник');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-6" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Пользователи
      </h1>

      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по нику или Static ID..."
          className="input-field flex-1"
        />
        <button
          onClick={() => setShowSensitive((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          style={{
            color: showSensitive ? 'var(--text)' : 'var(--muted)',
            background: showSensitive ? 'rgba(79,127,255,.1)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${showSensitive ? 'rgba(79,127,255,.3)' : 'var(--border2)'}`,
          }}
          title={showSensitive ? 'Скрыть email и IP' : 'Показать email и IP'}
        >
          <EyeIcon open={showSensitive} />
          {showSensitive ? 'Скрыть' : 'Показать'}
        </button>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="font-mono text-xs px-3 py-1.5 rounded-full" style={{ color: 'var(--text)', background: 'rgba(255,255,255,.04)' }}>
            Всего: <strong>{stats.total}</strong>
          </span>
          <span className="font-mono text-xs px-3 py-1.5 rounded-full" style={{ color: '#f87171', background: 'rgba(239,68,68,.06)' }}>
            Забанено: <strong>{stats.banned}</strong>
          </span>
          {ROLE_LABEL_ORDER.map((r) => (
            <span key={r} className="font-mono text-xs px-3 py-1.5 rounded-full" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.03)' }}>
              {ROLE_LABELS[r]}: <strong>{stats.byRole[r] ?? 0}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field" style={{ width: 'auto' }}>
          <option value="">Все роли</option>
          {ROLE_LABEL_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select value={bannedFilter} onChange={(e) => setBannedFilter(e.target.value)} className="input-field" style={{ width: 'auto' }}>
          <option value="">Все статусы</option>
          <option value="true">Забаненные</option>
          <option value="false">Не забаненные</option>
        </select>
      </div>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-2">
        {users?.map((u) => {
          // Только Owner может менять роль другого Owner — для остальных селектор заблокирован.
          const isLockedForCurrentUser = u.role === 'OWNER' && !isOwner;
          return (
            <div
              key={u.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-lg flex-wrap"
              style={{ border: `1px solid ${u.isBanned ? 'rgba(239,68,68,.35)' : 'var(--border)'}`, background: u.isBanned ? 'rgba(239,68,68,.04)' : 'var(--surface)' }}
            >
              <div>
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  {u.username}
                  {u.role === 'OWNER' && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>
                      OWNER
                    </span>
                  )}
                  {u.isBanned && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#f87171', background: 'rgba(239,68,68,.1)' }}>
                      BANNED{u.bannedReason ? `: ${u.bannedReason}` : ''}
                    </span>
                  )}
                  {u.isSuspended && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>
                      SUSPENDED{u.suspendedReason ? `: ${u.suspendedReason}` : ''}
                      {u.suspendedUntil && ` до ${new Date(u.suspendedUntil).toLocaleDateString('ru-RU')}`}
                    </span>
                  )}
                </div>
                <div className="text-xs flex items-center gap-1 flex-wrap" style={{ color: 'var(--muted)' }}>
                  <span
                    className="font-mono"
                    style={{ filter: showSensitive ? 'none' : 'blur(4px)', userSelect: showSensitive ? 'text' : 'none', transition: 'filter .15s' }}
                  >
                    {u.email}
                  </span>
                  {u.staticId && <span>· {u.staticId}</span>}
                  {isOwner && (
                    <>
                      {' · '}
                      <button
                        onClick={() => {
                          setStaticIdTarget(u);
                          setStaticIdInput(u.staticId ?? '');
                          setStaticIdError(null);
                        }}
                        style={{ color: 'var(--a)' }}
                      >
                        изменить Static ID
                      </button>
                      {' · '}
                      <button
                        onClick={() => {
                          setUsernameTarget(u);
                          setUsernameInput(u.username);
                          setUsernameError(null);
                        }}
                        style={{ color: 'var(--a)' }}
                      >
                        изменить ник
                      </button>
                    </>
                  )}
                </div>
                {(u.registrationIp || u.lastLoginIp) && (
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: 'rgba(96,104,128,.6)' }}>
                    IP:{' '}
                    <span style={{ filter: showSensitive ? 'none' : 'blur(4px)', userSelect: showSensitive ? 'text' : 'none', transition: 'filter .15s' }}>
                      {u.lastLoginIp ?? u.registrationIp}
                    </span>
                  </div>
                )}
                {typeof u.tokenBalance === 'number' && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <TokenIcon size={12} />
                    <span className="font-mono text-[10px]" style={{ color: 'var(--gold)' }}>{u.tokenBalance}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  disabled={isLockedForCurrentUser}
                  className="input-field"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', opacity: isLockedForCurrentUser ? 0.5 : 1, cursor: isLockedForCurrentUser ? 'not-allowed' : 'pointer' }}
                  title={isLockedForCurrentUser ? 'Только Owner может управлять ролью Owner' : undefined}
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                {u.isBanned ? (
                  <button
                    onClick={() => handleUnban(u.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--green)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
                  >
                    Разбанить
                  </button>
                ) : (
                  !isLockedForCurrentUser && (
                    <button
                      onClick={() => setBanTargetId(u.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                    >
                      Забанить
                    </button>
                  )
                )}
                {u.isSuspended ? (
                  <button
                    onClick={() => handleUnsuspend(u.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--green)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
                  >
                    Вернуть в игры
                  </button>
                ) : (
                  !isLockedForCurrentUser && (
                    <button
                      onClick={() => setSuspendTargetId(u.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{ color: 'var(--gold)', background: 'rgba(201,149,74,0.06)', border: '1px solid rgba(201,149,74,0.18)' }}
                    >
                      Отстранить от игр
                    </button>
                  )
                )}
                <button
                  onClick={() => { setTokenTarget(u); setTokenAmount(''); setTokenError(null); setTokenSuccess(false); }}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                  style={{ color: 'var(--gold)', background: 'rgba(201,149,74,0.06)', border: '1px solid rgba(201,149,74,0.18)' }}
                >
                  <TokenIcon size={14} />
                  Токены
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && (!users || users.length === 0) && <p style={{ color: 'var(--muted)' }}>Ничего не найдено.</p>}

      {/* BAN MODAL */}
      {banTargetId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setBanTargetId(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Бан пользователя
            </h2>
            <label className="label-field">Причина (необязательно)</label>
            <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={3} className="input-field mb-3" placeholder="Причина бана..." />
            <label className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={banByIp} onChange={(e) => setBanByIp(e.target.checked)} />
              Забанить все аккаунты с этим IP
            </label>
            <div className="flex gap-2">
              <button onClick={() => setBanTargetId(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleBanConfirm} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Забанить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendTargetId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setSuspendTargetId(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Отстранение от игр
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Аккаунт останется рабочим (вход, чат), но участие в лобби и матчах будет запрещено.
            </p>
            <label className="label-field">Причина (необязательно)</label>
            <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={3} className="input-field mb-3" placeholder="Причина отстранения..." />
            <label className="label-field">Срок в днях (необязательно — пусто = бессрочно)</label>
            <input
              value={suspendDays}
              onChange={(e) => setSuspendDays(e.target.value.replace(/\D/g, ''))}
              placeholder="например: 7"
              inputMode="numeric"
              className="input-field mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setSuspendTargetId(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleSuspendConfirm} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отстранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATIC ID MODAL — только Owner */}
      {staticIdTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setStaticIdTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Изменить Static ID — {staticIdTarget.username}
            </h2>
            <label className="label-field">Новый Static ID</label>
            <input
              value={staticIdInput}
              onChange={(e) => setStaticIdInput(e.target.value)}
              className="input-field mb-3"
              placeholder="например: 7741209"
            />
            {staticIdError && <p className="error-text mb-3">{staticIdError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStaticIdTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleSaveStaticId} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOKEN MODAL */}
      {tokenTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setTokenTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <TokenIcon size={24} />
              <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--gold)' }}>
                Выдать токены — {tokenTarget.username}
              </h2>
            </div>
            <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--muted)' }}>
              Текущий баланс:
              <span className="font-mono font-bold flex items-center gap-1" style={{ color: 'var(--gold)' }}>
                <TokenIcon size={12} />
                {tokenTarget.tokenBalance ?? 0}
              </span>
            </div>
            {tokenError && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{tokenError}</div>}
            {tokenSuccess && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'var(--green)' }}>Токены выданы ✓</div>}
            <label className="label-field">Количество токенов</label>
            <input
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="например: 100"
              inputMode="numeric"
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-2 flex-wrap mb-2">
              {[50, 100, 200, 500, 1000].map((n) => (
                <button key={n} onClick={() => setTokenAmount(String(n))} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.08)', border: '1px solid rgba(201,149,74,.2)' }}>
                  +{n}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setTokenTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Отмена</button>
              <button onClick={handleGrantTokens} disabled={tokenLoading || !tokenAmount} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {tokenLoading ? 'Выдаём...' : 'Выдать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USERNAME MODAL — только Owner; обычные игроки меняют ник только через поддержку */}
      {usernameTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setUsernameTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Изменить ник — {usernameTarget.username}
            </h2>
            <label className="label-field">Новый ник</label>
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="input-field mb-3"
              placeholder="например: PlayerName"
            />
            {usernameError && <p className="error-text mb-3">{usernameError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setUsernameTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleSaveUsername} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
