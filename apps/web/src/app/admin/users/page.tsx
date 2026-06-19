'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'ORGANIZER' | 'PLAYER';
  staticId: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  PLAYER: 'Player',
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const isOwner = currentUser?.role === 'OWNER';

  // Owner-роль предлагается в списке только самому Owner — обычный Admin физически
  // не увидит этот пункт (backend всё равно заблокирует попытку, если обойти UI).
  const availableRoles = isOwner ? ['PLAYER', 'ORGANIZER', 'ADMIN', 'OWNER'] : ['PLAYER', 'ORGANIZER', 'ADMIN'];

  const { data: users, isLoading } = useQuery<UserItem[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/users'),
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

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Пользователи
      </h1>

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
            <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-lg flex-wrap" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {u.username}
                  {u.role === 'OWNER' && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>
                      OWNER
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {u.email} {u.staticId && `· ${u.staticId}`}
                </div>
              </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
