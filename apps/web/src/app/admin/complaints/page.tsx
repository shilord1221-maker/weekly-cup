'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';

interface Complaint {
  id: string;
  nick: string;
  staticIdValue: string | null;
  text: string;
  status: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  adminComment: string | null;
  createdAt: string;
  author: { username: string };
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Новая' },
  { value: 'IN_REVIEW', label: 'На рассмотрении' },
  { value: 'RESOLVED', label: 'Решена' },
  { value: 'REJECTED', label: 'Отклонена' },
];

export default function AdminComplaintsPage() {
  const qc = useQueryClient();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ['admin-complaints'],
    queryFn: () => api.get('/complaints'),
  });

  const handleUpdate = async (id: string, status: string) => {
    setError(null);
    try {
      await api.patch(`/complaints/${id}`, { status, adminComment: comments[id] });
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось обновить жалобу');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Модерация жалоб
      </h1>

      {error && (
        <div className="mb-6 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {complaints?.map((c) => (
          <div key={c.id} className="card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm">
                <strong>{c.nick}</strong> {c.staticIdValue && <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>· {c.staticIdValue}</span>}
                <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>
                  ({c.author.username})
                </span>
              </div>
              <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                {new Date(c.createdAt).toLocaleString('ru-RU')}
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
              {c.text}
            </p>
            <textarea
              defaultValue={c.adminComment ?? ''}
              onChange={(e) => setComments((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="Комментарий администратора..."
              rows={2}
              className="input-field mb-3"
            />
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleUpdate(c.id, opt.value)}
                  className="btn-out"
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    ...(c.status === opt.value ? { borderColor: 'var(--a)', color: 'var(--a)' } : {}),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && (!complaints || complaints.length === 0) && <p style={{ color: 'var(--muted)' }}>Жалоб пока нет.</p>}
    </div>
  );
}
