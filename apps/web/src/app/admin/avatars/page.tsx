'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface PendingAvatar {
  id: string;
  username: string;
  avatarUrl: string | null;
  pendingAvatarUrl: string;
}

export default function AdminAvatarsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingAvatar | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery<PendingAvatar[]>({
    queryKey: ['admin-avatars-pending'],
    queryFn: () => api.get('/avatars/pending'),
  });

  const handleApprove = async (id: string) => {
    setError(null);
    try {
      await api.post(`/avatars/${id}/approve`);
      qc.invalidateQueries({ queryKey: ['admin-avatars-pending'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось одобрить аватарку');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setError(null);
    try {
      await api.post(`/avatars/${rejectTarget.id}/reject`, { reason: rejectReason.trim() || undefined });
      setRejectTarget(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['admin-avatars-pending'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось отклонить аватарку');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Модерация аватарок
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Новые аватарки игроков не показываются на сайте, пока их не одобрит админ или овнер.
      </p>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}
      {!isLoading && (!data || data.length === 0) && <p style={{ color: 'var(--muted)' }}>Нет аватарок на рассмотрении.</p>}

      <div className="flex flex-col gap-3">
        {data?.map((item) => (
          <div key={item.id} className="card flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted)' }}>
                  {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" /> : 'нет'}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  было
                </span>
              </div>
              <span style={{ color: 'var(--muted)' }}>→</span>
              <div className="text-center">
                <div className="w-14 h-14 rounded-full overflow-hidden" style={{ border: '2px solid var(--gold)' }}>
                  <img src={item.pendingAvatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--gold)' }}>
                  новая
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{item.username}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(item.id)}
                className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                style={{ color: 'var(--green)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
              >
                Одобрить
              </button>
              <button
                onClick={() => setRejectTarget(item)}
                className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setRejectTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Отклонить аватарку — {rejectTarget.username}
            </h2>
            <label className="label-field">Причина (необязательно)</label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="input-field mb-4" placeholder="Причина отклонения..." />
            <div className="flex gap-2">
              <button onClick={() => setRejectTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleReject} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
