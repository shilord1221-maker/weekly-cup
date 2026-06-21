'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AmnestyStatus {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  staticId: string;
  createdAt: string;
  resolvedAt: string | null;
  adminComment: string | null;
}

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'На рассмотрении', color: 'var(--gold)', bg: 'rgba(201,149,74,.08)' },
  APPROVED: { label: 'Одобрена', color: 'var(--green)', bg: 'rgba(34,197,94,.08)' },
  REJECTED: { label: 'Отклонена', color: '#ef4444', bg: 'rgba(239,68,68,.08)' },
};

export default function AmnestyStatusPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery<AmnestyStatus>({
    queryKey: ['amnesty', id],
    queryFn: () => api.get(`/amnesty/${id}`, { auth: false }),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Заявка не найдена.</p>
      </div>
    );
  }

  const info = STATUS_INFO[data.status];

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="card max-w-md w-full text-center">
        <div className="text-4xl mb-4">🛡️</div>
        <h1 className="font-display font-bold uppercase mb-3" style={{ fontSize: '24px', letterSpacing: '-0.01em' }}>
          Заявка на амнистию
        </h1>

        <span
          className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full mb-5"
          style={{ color: info.color, background: info.bg }}
        >
          {info.label}
        </span>

        <p className="text-sm mb-5" style={{ color: 'var(--text)' }}>
          Static ID <strong>#{data.staticId}</strong> уже привязан к другому зарегистрированному аккаунту.
          {data.status === 'PENDING' && ' Администратор проверит ситуацию вручную и решит, кому реально принадлежит этот игровой профиль.'}
          {data.status === 'APPROVED' && ' Заявка одобрена — теперь вы можете войти со своим email и паролем.'}
          {data.status === 'REJECTED' && ' Заявка отклонена администратором.'}
        </p>

        {data.adminComment && (
          <div className="text-xs rounded-lg px-4 py-3 mb-5" style={{ background: 'rgba(255,255,255,.03)', color: 'var(--muted)' }}>
            Комментарий администратора: {data.adminComment}
          </div>
        )}

        {data.status === 'PENDING' && (
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
            Страница автоматически обновляется. Можно закрыть её и зайти позже — заявка не пропадёт.
          </p>
        )}

        {data.status === 'APPROVED' && (
          <a href="/login" className="btn-main justify-center w-full">
            Войти в аккаунт
          </a>
        )}

        {data.status === 'REJECTED' && (
          <a href="/social" className="btn-out justify-center w-full">
            Связаться с поддержкой
          </a>
        )}
      </div>
    </div>
  );
}
