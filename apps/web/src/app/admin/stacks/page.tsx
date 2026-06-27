'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { StackTag } from '@/components/StackTag';
import { Avatar } from '@/components/Avatar';

interface StackItem {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  logoUrl: string | null;
  description: string | null;
  captainId: string;
  captain: { id: string; username: string; avatarUrl?: string | null };
  members: { id: string; userId: string; user: { username: string; avatarUrl?: string | null } }[];
  _count: { wins: number; members: number };
}

export default function AdminStacksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<StackItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: stacks, isLoading } = useQuery<StackItem[]>({
    queryKey: ['admin-stacks'],
    queryFn: () => api.get('/stacks'),
  });

  const filtered = search
    ? stacks?.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.tag.toLowerCase().includes(search.toLowerCase()))
    : stacks;

  const openEdit = (s: StackItem) => {
    setEditTarget(s);
    setEditName(s.name);
    setEditTag(s.tag);
    setEditColor(s.tagColor);
    setEditErr(null);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setEditErr(null); setEditSaving(true);
    try {
      await api.patch(`/stacks/${editTarget.id}`, { name: editName.trim(), tag: editTag.trim().toUpperCase() });
      qc.invalidateQueries({ queryKey: ['admin-stacks'] });
      setEditTarget(null);
    } catch (e) {
      setEditErr(e instanceof ApiClientError ? e.message : 'Ошибка');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (s: StackItem) => {
    if (!confirm(`Удалить стак «${s.name}» [${s.tag}]? Все участники и победы будут удалены.`)) return;
    setError(null);
    try {
      await api.delete(`/stacks/${s.id}`);
      qc.invalidateQueries({ queryKey: ['admin-stacks'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось удалить стак');
    }
  };

  const handleKickMember = async (stackId: string, userId: string, username: string) => {
    if (!confirm(`Кикнуть ${username} из стака?`)) return;
    try {
      await api.delete(`/stacks/${stackId}/members/${userId}`);
      qc.invalidateQueries({ queryKey: ['admin-stacks'] });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Ошибка');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.01em' }}>
          Управление стаками
        </h1>
        <Link href="/stacks" className="btn-out" style={{ padding: '10px 16px', fontSize: '13px' }}>
          Публичный топ →
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию или тегу..."
        className="input-field mb-6"
      />

      {error && (
        <div className="mb-4 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {filtered?.map((s) => (
          <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {/* Заголовок стака */}
            <div className="flex items-center gap-4 px-5 py-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <StackTag tag={s.tag} color={s.tagColor} />
                <span className="font-display font-semibold" style={{ fontSize: '16px' }}>{s.name}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                  🏆 {s._count.wins} побед · 👥 {s._count.members}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar username={s.captain.username} avatarUrl={s.captain.avatarUrl} size={20} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.captain.username}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(s)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ color: 'var(--a)', background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)' }}
                >
                  ✏️ Изменить
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.18)' }}
                >
                  🗑 Удалить
                </button>
              </div>
            </div>

            {/* Участники */}
            {s.members.length > 0 && (
              <div className="px-5 pb-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="w-full text-[10px] font-mono uppercase tracking-wider pt-3" style={{ color: 'var(--muted)' }}>Участники</span>
                {s.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full group"
                    style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border2)' }}
                  >
                    <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size={14} />
                    <span>{m.user.username}</span>
                    {m.userId !== s.captainId && (
                      <button
                        onClick={() => handleKickMember(s.id, m.userId, m.user.username)}
                        className="ml-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#f87171' }}
                        title="Кикнуть"
                      >
                        ✕
                      </button>
                    )}
                    {m.userId === s.captainId && (
                      <span className="text-[9px]" style={{ color: 'var(--gold)' }}>👑</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!isLoading && !filtered?.length && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Стаков не найдено.</p>
        )}
      </div>

      {/* EDIT MODAL */}
      {editTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setEditTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Изменить стак
            </h2>
            {editErr && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{editErr}</div>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="label-field">Название</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" maxLength={64} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label-field">Тег (макс. 4 символа)</label>
                  <input
                    value={editTag}
                    onChange={(e) => setEditTag(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
                    className="input-field font-mono uppercase"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="label-field">Цвет</label>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-11 h-11 rounded-lg cursor-pointer"
                    style={{ border: '1px solid var(--border2)' }}
                  />
                </div>
              </div>
              {editTag && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  Предпросмотр: <StackTag tag={editTag} color={editColor} />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Отмена</button>
              <button onClick={handleSave} disabled={editSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {editSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
