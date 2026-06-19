'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { username: string } | null;
  payload: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Регистрация пользователя',
  STATIC_ID_UPDATED: 'Изменён Static ID',
  MATCH_CREATED: 'Матч создан',
  MATCH_TIME_CHANGED: 'Изменено время матча',
  ZONES_SELECTED: 'Выбраны зоны',
  FINAL_ZONE_SELECTED: 'Выбрана финальная зона',
  MATCH_STARTED_MANUAL: 'Матч запущен вручную',
  MATCH_FINISHED: 'Матч завершён',
  AUTO_ASSIGN: 'Авто-распределение игроков',
  PLAYER_MOVED: 'Игрок перемещён',
  COMPLAINT_CREATED: 'Жалоба создана',
  COMPLAINT_UPDATED: 'Жалоба обновлена',
  MAP_CREATED: 'Карта создана',
  ZONE_CREATED: 'Зона создана',
  NEWS_CREATED: 'Новость опубликована',
  MEDIA_CREATED: 'Медиа добавлено',
};

export default function AdminAuditLogPage() {
  const { data: logs, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.get('/audit-log'),
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Audit Log
      </h1>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-1.5">
        {logs?.map((log) => (
          <div key={log.id} className="flex items-center justify-between gap-4 px-5 py-3 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex flex-col">
              <span>{ACTION_LABELS[log.action] ?? log.action}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {log.actor?.username ?? 'система'} · {log.entityType}
              </span>
            </div>
            <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
              {new Date(log.createdAt).toLocaleString('ru-RU')}
            </span>
          </div>
        ))}
      </div>

      {!isLoading && (!logs || logs.length === 0) && <p style={{ color: 'var(--muted)' }}>Записей пока нет.</p>}
    </div>
  );
}
