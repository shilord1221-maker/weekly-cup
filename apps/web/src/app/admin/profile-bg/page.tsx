'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

interface PendingBg { id: string; username: string; pendingProfileBg: string; profileBg: string | null; }

export default function AdminProfileBgPage() {
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<PendingBg[]>({
    queryKey: ['admin-profile-bg'],
    queryFn: () => api.get('/shop/profile-bg/pending'),
  });

  const approve = async (userId: string) => {
    try {
      await api.post(`/shop/profile-bg/${userId}/approve`);
      qc.invalidateQueries({ queryKey: ['admin-profile-bg'] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  const reject = async (userId: string) => {
    try {
      await api.post(`/shop/profile-bg/${userId}/reject`, { reason: rejectReason[userId] });
      qc.invalidateQueries({ queryKey: ['admin-profile-bg'] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-8" style={{ fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.01em' }}>
        Фоны профилей
      </h1>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}
      {!isLoading && !data?.length && <p style={{ color: 'var(--muted)' }}>Нет заявок на модерацию.</p>}

      <div className="flex flex-col gap-4">
        {data?.map((item) => (
          <div key={item.id} className="card">
            <div className="font-medium mb-3">{item.username}</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {item.profileBg && (
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Текущий фон</div>
                  <img src={item.profileBg} alt="current" className="w-full rounded-xl object-cover" style={{ height: '120px' }} />
                </div>
              )}
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Новый фон</div>
                <img src={item.pendingProfileBg} alt="new" className="w-full rounded-xl object-cover" style={{ height: '120px' }} />
              </div>
            </div>
            <input
              value={rejectReason[item.id] ?? ''}
              onChange={(e) => setRejectReason((r) => ({ ...r, [item.id]: e.target.value }))}
              placeholder="Причина отклонения (необязательно)"
              className="input-field mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => approve(item.id)} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>✓ Одобрить</button>
              <button onClick={() => reject(item.id)} className="flex-1 text-sm font-medium py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,.08)', color: '#f87171', border: '1px solid rgba(239,68,68,.2)' }}>
                ✕ Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
