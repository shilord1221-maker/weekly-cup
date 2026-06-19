'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'ORGANIZER' | 'PLAYER';
  staticId: string | null;
  createdAt: string;
}

const ROLES = [
  { value: 'PLAYER', label: 'Player' },
  { value: 'ORGANIZER', label: 'Organizer' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

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
        {users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-lg flex-wrap" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div>
              <div className="text-sm font-medium">{u.username}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {u.email} {u.staticId && `· ${u.staticId}`}
              </div>
            </div>
            <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="input-field" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
