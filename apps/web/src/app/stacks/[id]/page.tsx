'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';
import { ImageUploadField } from '@/components/ImageUploadField';

interface StackMember {
  id: string;
  userId: string;
  joinedAt: string;
  user: { id: string; username: string; avatarUrl?: string | null; staticId?: { value: string } | null };
}
interface JoinRequest {
  id: string;
  userId: string;
  message: string | null;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string | null; staticId?: { value: string } | null };
}
interface StackDetail {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  logoUrl: string | null;
  description: string | null;
  captainId: string;
  captain: { id: string; username: string; avatarUrl?: string | null };
  members: StackMember[];
  _count: { wins: number; members: number };
}

function StackLogo({ stack, size = 64 }: { stack: Pick<StackDetail, 'name' | 'tag' | 'tagColor' | 'logoUrl'>; size?: number }) {
  if (stack.logoUrl) return <img src={stack.logoUrl} alt={stack.name} className="rounded-2xl object-cover" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-2xl flex items-center justify-center font-display font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${stack.tagColor}22`, border: `2px solid ${stack.tagColor}55`, color: stack.tagColor, fontSize: size * 0.35 }}
    >
      {stack.tag.toUpperCase()}
    </div>
  );
}

export default function StackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const router = useRouter();

  const [joinMsg, setJoinMsg] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { data: stack, isLoading } = useQuery<StackDetail>({
    queryKey: ['stack', id],
    queryFn: () => api.get(`/stacks/${id}`, { auth: false }),
    enabled: !!id,
  });

  const { data: requests } = useQuery<JoinRequest[]>({
    queryKey: ['stack-requests', id],
    queryFn: () => api.get(`/stacks/${id}/requests`),
    enabled: !!user && !!stack && (stack.captainId === user.id || isAdminOrOwner(user.role)),
    refetchInterval: 15_000,
  });

  const { data: myStack } = useQuery<StackDetail | null>({
    queryKey: ['my-stack'],
    queryFn: () => api.get('/stacks/my'),
    enabled: !!user,
    retry: false,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Загрузка...</p></div>;
  if (!stack) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Стак не найден.</p></div>;

  const isCaptain = user?.id === stack.captainId;
  const isStaff = isAdminOrOwner(user?.role);
  const canManage = isCaptain || isStaff;
  const isMember = stack.members.some((m) => m.userId === user?.id);
  const isInOtherStack = myStack && myStack.id !== id;
  const hasRequest = false; // TODO: track pending request

  const openEdit = () => {
    setEditName(stack.name); setEditTag(stack.tag); setEditColor(stack.tagColor);
    setEditDesc(stack.description ?? ''); setEditLogo(stack.logoUrl ?? ''); setEditErr(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    setEditErr(null); setEditSaving(true);
    try {
      await api.patch(`/stacks/${id}`, { name: editName, tag: editTag, tagColor: editColor, description: editDesc || undefined, logoUrl: editLogo || undefined });
      qc.invalidateQueries({ queryKey: ['stack', id] });
      qc.invalidateQueries({ queryKey: ['stacks'] });
      setEditOpen(false);
    } catch (e) { setEditErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setEditSaving(false); }
  };

  const handleJoin = async () => {
    setJoinErr(null); setJoining(true);
    try {
      await api.post(`/stacks/${id}/join`, { message: joinMsg.trim() || undefined });
      setJoinMsg('');
      qc.invalidateQueries({ queryKey: ['my-stack'] });
    } catch (e) { setJoinErr(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!confirm('Выйти из стака?')) return;
    setLeaving(true);
    try {
      await api.post(`/stacks/${id}/leave`);
      qc.invalidateQueries({ queryKey: ['my-stack'] });
      qc.invalidateQueries({ queryKey: ['stack', id] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLeaving(false); }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(`Кикнуть ${username} из стака?`)) return;
    try {
      await api.delete(`/stacks/${id}/members/${userId}`);
      qc.invalidateQueries({ queryKey: ['stack', id] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  const handleApprove = async (reqId: string) => {
    try {
      await api.post(`/stacks/${id}/requests/${reqId}/approve`);
      qc.invalidateQueries({ queryKey: ['stack-requests', id] });
      qc.invalidateQueries({ queryKey: ['stack', id] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  const handleReject = async (reqId: string) => {
    try {
      await api.post(`/stacks/${id}/requests/${reqId}/reject`);
      qc.invalidateQueries({ queryKey: ['stack-requests', id] });
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить стак «${stack.name}»? Это действие нельзя отменить.`)) return;
    try {
      await api.delete(`/stacks/${id}`);
      qc.invalidateQueries({ queryKey: ['stacks'] });
      qc.invalidateQueries({ queryKey: ['my-stack'] });
      router.push('/stacks');
    } catch (e) { alert(e instanceof ApiClientError ? e.message : 'Ошибка'); }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="flex items-start gap-5 mb-8 flex-wrap">
        <StackLogo stack={stack} size={80} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <StackTag tag={stack.tag} color={stack.tagColor} />
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(22px,4vw,36px)', letterSpacing: '-0.01em' }}>
              {stack.name}
            </h1>
          </div>
          {stack.description && <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{stack.description}</p>}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <Avatar username={stack.captain.username} avatarUrl={stack.captain.avatarUrl} size={16} />
            Капитан: {stack.captain.username}
            <span>·</span>
            <span>🏆 {stack._count.wins} побед</span>
            <span>·</span>
            <span>👥 {stack._count.members} участников</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <>
              <button onClick={openEdit} className="btn-out" style={{ padding: '10px 16px', fontSize: '13px' }}>✏️ Редактировать</button>
              <button onClick={handleDelete} className="text-xs font-medium px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' }}>
                Удалить
              </button>
            </>
          )}
          {!isMember && user && !isInOtherStack && (
            <button onClick={handleJoin} disabled={joining} className="btn-main" style={{ padding: '10px 16px', fontSize: '13px' }}>
              {joining ? 'Отправляем...' : '📨 Подать заявку'}
            </button>
          )}
          {isMember && !isCaptain && (
            <button onClick={handleLeave} disabled={leaving} className="btn-out" style={{ padding: '10px 16px', fontSize: '13px', color: '#f87171', borderColor: 'rgba(239,68,68,.3)' }}>
              Выйти
            </button>
          )}
        </div>
      </div>

      {/* ЗАЯВКА НА ВСТУПЛЕНИЕ */}
      {!isMember && user && !isInOtherStack && (
        <div className="card mb-6">
          <label className="label-field">Сообщение капитану (необязательно)</label>
          <div className="flex gap-2">
            <input value={joinMsg} onChange={(e) => setJoinMsg(e.target.value)} placeholder="Почему хочу вступить..." className="input-field flex-1" maxLength={256} />
            <button onClick={handleJoin} disabled={joining} className="btn-main flex-shrink-0" style={{ padding: '10px 16px', fontSize: '13px' }}>
              Отправить
            </button>
          </div>
          {joinErr && <p className="error-text mt-2">{joinErr}</p>}
        </div>
      )}

      {isInOtherStack && !isMember && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(79,127,255,.06)', border: '1px solid rgba(79,127,255,.2)', color: 'var(--muted)' }}>
          Вы состоите в другом стаке. Выйдите из него, чтобы вступить сюда.
        </div>
      )}

      {/* ЗАЯВКИ (только капитан) */}
      {canManage && requests && requests.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
            Заявки на вступление ({requests.length})
          </h2>
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3" style={{ background: 'rgba(79,127,255,.04)', border: '1px solid rgba(79,127,255,.12)' }}>
                <Avatar username={r.user.username} avatarUrl={r.user.avatarUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{r.user.username}
                    {r.user.staticId && <span className="ml-2 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{r.user.staticId.value}</span>}
                  </div>
                  {r.message && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{r.message}</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(r.id)} className="text-xs font-medium px-3 py-1.5 rounded-md" style={{ color: 'var(--green)', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.18)' }}>
                    ✓ Принять
                  </button>
                  <button onClick={() => handleReject(r.id)} className="text-xs font-medium px-3 py-1.5 rounded-md" style={{ color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.18)' }}>
                    ✕ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* УЧАСТНИКИ */}
      <div className="card">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Участники · {stack.members.length}
        </h2>
        <div className="flex flex-col gap-2">
          {stack.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2 group" style={{ borderBottom: '1px solid var(--border)' }}>
              <Avatar username={m.user.username} avatarUrl={m.user.avatarUrl} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{m.user.username}</span>
                  {m.userId === stack.captainId && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>👑 Капитан</span>
                  )}
                  {m.user.staticId && (
                    <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{m.user.staticId.value}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
                с {new Date(m.joinedAt).toLocaleDateString('ru-RU')}
              </span>
              {canManage && m.userId !== stack.captainId && (
                <button
                  onClick={() => handleKick(m.userId, m.user.username)}
                  className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#f87171' }}
                >
                  кикнуть
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setEditOpen(false)}>
          <div className="card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Редактировать стак
            </h2>
            {editErr && <div className="text-sm rounded-lg px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{editErr}</div>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="label-field">Название</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label-field">Тег (макс. 4 символа)</label>
                  <input value={editTag} onChange={(e) => setEditTag(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4))} className="input-field font-mono uppercase" maxLength={4} />
                </div>
                <div>
                  <label className="label-field">Цвет тега</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" style={{ border: '1px solid var(--border2)', background: 'transparent' }} />
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{editColor}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="label-field">Описание (необязательно)</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="input-field" maxLength={500} />
              </div>
              <ImageUploadField label="Логотип (необязательно)" value={editLogo} onChange={setEditLogo} folder="media-thumbs" />
              {editTag && editColor && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  Предпросмотр: <StackTag tag={editTag} color={editColor} />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditOpen(false)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>Отмена</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {editSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
