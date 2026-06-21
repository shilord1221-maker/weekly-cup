'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface AmnestyItem {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  username: string;
  email: string;
  staticId: string;
  proofUrl: string | null;
  detectedStaticId: string | null;
  registrationIp: string | null;
  createdAt: string;
  conflictUser: { id: string; username: string; email: string; createdAt: string } | null;
  reviewer: { id: string; username: string } | null;
  adminComment: string | null;
}

export default function AdminAmnestyPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery<AmnestyItem[]>({
    queryKey: ['admin-amnesty'],
    queryFn: () => api.get('/amnesty'),
  });

  const handleApprove = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await api.post(`/amnesty/${id}/approve`, { comment: comments[id]?.trim() || undefined });
      qc.invalidateQueries({ queryKey: ['admin-amnesty'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось одобрить заявку');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await api.post(`/amnesty/${id}/reject`, { comment: comments[id]?.trim() || undefined });
      qc.invalidateQueries({ queryKey: ['admin-amnesty'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось отклонить заявку');
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests?.filter((r) => r.status === 'PENDING') ?? [];
  const resolved = requests?.filter((r) => r.status !== 'PENDING') ?? [];

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Заявки на амнистию
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Возникают, когда новый игрок указывает Static ID, уже привязанный к существующему аккаунту.
      </p>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      {pending.length === 0 && !isLoading && <p className="mb-10" style={{ color: 'var(--muted)' }}>Нет заявок на рассмотрении.</p>}

      <div className="flex flex-col gap-3 mb-12">
        {pending.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm">
                <strong>{r.username}</strong> <span style={{ color: 'var(--muted)' }}>({r.email})</span>
              </div>
              <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                {new Date(r.createdAt).toLocaleString('ru-RU')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,.03)' }}>
                <div className="mb-1" style={{ color: 'var(--muted)' }}>Заявленный Static ID</div>
                <div className="font-mono font-semibold" style={{ color: 'var(--text)' }}>#{r.staticId}</div>
                {r.detectedStaticId && (
                  <div className="font-mono mt-1" style={{ color: r.detectedStaticId === r.staticId ? 'var(--green)' : '#f87171' }}>
                    ИИ распознал на скрине: #{r.detectedStaticId}
                  </div>
                )}
              </div>
              <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,.05)' }}>
                <div className="mb-1" style={{ color: 'var(--muted)' }}>Конфликт с аккаунтом</div>
                {r.conflictUser ? (
                  <>
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>{r.conflictUser.username}</div>
                    <div style={{ color: 'var(--muted)' }}>{r.conflictUser.email}</div>
                    <div className="font-mono mt-1" style={{ color: 'var(--muted)' }}>
                      зарегистрирован {new Date(r.conflictUser.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>аккаунт удалён</span>
                )}
              </div>
            </div>

            {r.proofUrl && (
              <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
                <img src={r.proofUrl} alt="Скрин-пруф" className="rounded-lg max-h-48 w-auto" />
              </a>
            )}

            {r.registrationIp && (
              <div className="font-mono text-[10px] mb-3" style={{ color: 'rgba(96,104,128,.6)' }}>
                IP: {r.registrationIp}
              </div>
            )}

            <textarea
              value={comments[r.id] ?? ''}
              onChange={(e) => setComments((prev) => ({ ...prev, [r.id]: e.target.value }))}
              placeholder="Комментарий (необязательно)..."
              rows={2}
              className="input-field mb-3"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(r.id)}
                disabled={busyId === r.id}
                className="btn-main flex-1"
                style={{ padding: '10px', fontSize: '13px', background: 'var(--green)' }}
              >
                Одобрить (создать аккаунт)
              </button>
              <button
                onClick={() => handleReject(r.id)}
                disabled={busyId === r.id}
                className="btn-out flex-1"
                style={{ padding: '10px', fontSize: '13px', color: '#f87171', borderColor: 'rgba(239,68,68,.3)' }}
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            История решений
          </h2>
          <div className="flex flex-col gap-2">
            {resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 rounded-lg text-sm flex-wrap gap-2" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <span>
                  {r.username} · #{r.staticId}
                </span>
                <span
                  className="font-mono text-[11px] px-2.5 py-1 rounded-full"
                  style={{
                    color: r.status === 'APPROVED' ? 'var(--green)' : '#f87171',
                    background: r.status === 'APPROVED' ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                  }}
                >
                  {r.status === 'APPROVED' ? 'Одобрена' : 'Отклонена'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
