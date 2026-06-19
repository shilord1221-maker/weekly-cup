'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { MediaGrid, MediaUrlInput } from '@/components/MediaAttachments';

interface ComplaintReply {
  id: string;
  text: string;
  mediaUrls: string[];
  createdAt: string;
  author: { username: string; role: string };
}

interface Complaint {
  id: string;
  nick: string;
  staticIdValue: string | null;
  text: string;
  mediaUrls: string[];
  status: 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  adminComment: string | null;
  createdAt: string;
  author: { username: string };
  replies: ComplaintReply[];
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Новая' },
  { value: 'IN_REVIEW', label: 'На рассмотрении' },
  { value: 'RESOLVED', label: 'Решена' },
  { value: 'REJECTED', label: 'Отклонена' },
];

const ROLE_SHORT: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', ORGANIZER: 'Organizer', PLAYER: 'Player' };

export default function AdminComplaintsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyMedia, setReplyMedia] = useState<Record<string, string[]>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  const { data: complaints, isLoading } = useQuery<Complaint[]>({
    queryKey: ['admin-complaints'],
    queryFn: () => api.get('/complaints'),
  });

  const handleUpdate = async (id: string, status: string) => {
    setError(null);
    try {
      await api.patch(`/complaints/${id}`, { status });
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось обновить жалобу');
    }
  };

  const handleSendReply = async (id: string) => {
    const text = replyText[id]?.trim();
    if (!text) return;
    setError(null);
    setSendingReply(id);
    try {
      await api.post(`/complaints/${id}/reply`, { text, mediaUrls: replyMedia[id] ?? [] });
      setReplyText((prev) => ({ ...prev, [id]: '' }));
      setReplyMedia((prev) => ({ ...prev, [id]: [] }));
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось отправить ответ');
    } finally {
      setSendingReply(null);
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
            {/* Медиа автора жалобы — в верхней части карточки */}
            {c.mediaUrls.length > 0 && (
              <div className="mb-4">
                <MediaGrid urls={c.mediaUrls} />
              </div>
            )}

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

            {/* История ответов */}
            {c.replies.length > 0 && (
              <div className="flex flex-col gap-2 mb-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                {c.replies.map((r) => (
                  <div key={r.id} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(79,127,255,.05)', border: '1px solid rgba(79,127,255,.12)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--a)' }}>
                        {r.author.username} ({ROLE_SHORT[r.author.role] ?? r.author.role})
                      </span>
                      <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                        {new Date(r.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text)' }}>
                      {r.text}
                    </p>
                    {r.mediaUrls.length > 0 && <MediaGrid urls={r.mediaUrls} size={70} />}
                  </div>
                ))}
              </div>
            )}

            {/* Форма ответа */}
            <div className="mb-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="label-field">Ответ автору жалобы</label>
              <textarea
                value={replyText[c.id] ?? ''}
                onChange={(e) => setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Напишите ответ..."
                rows={2}
                className="input-field mb-2"
              />
              <MediaUrlInput
                urls={replyMedia[c.id] ?? []}
                onChange={(urls) => setReplyMedia((prev) => ({ ...prev, [c.id]: urls }))}
              />
              <button
                onClick={() => handleSendReply(c.id)}
                disabled={sendingReply === c.id || !replyText[c.id]?.trim()}
                className="btn-main mt-2"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                {sendingReply === c.id ? 'Отправляем...' : 'Отправить ответ'}
              </button>
            </div>

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
