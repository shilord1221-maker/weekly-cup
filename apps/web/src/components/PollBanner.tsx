'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
import { api, ApiClientError } from '@/lib/api';

interface PollOption {
  id: string;
  label: string;
  votes: { userId: string }[];
}
interface Poll {
  id: string;
  title: string;
  isClosed: boolean;
  options: PollOption[];
}

interface MapItem {
  id: string;
  name: string;
}

const MODE_OPTIONS = ['2×2', '3×3', '4×4', '5×5'];

export function PollBanner() {
  const socket = useSocket();
  const { user } = useAuthStore();
  const canManage = isAdminOrOwner(user?.role);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapItem[]>([]);

  useEffect(() => {
    api.get<Poll[]>('/polls/active', { auth: false }).then(setPolls).catch(() => {});
    api.get<MapItem[]>('/maps', { auth: false }).then(setMaps).catch(() => {});
  }, []);

  useEffect(() => {
    const onCreated = (poll: Poll) => setPolls((prev) => [poll, ...prev]);
    const onUpdated = ({ pollId, options }: { pollId: string; options: PollOption[] }) =>
      setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, options } : p)));
    const onClosed = ({ pollId }: { pollId: string }) => setPolls((prev) => prev.filter((p) => p.id !== pollId));

    socket.on('poll:created', onCreated);
    socket.on('poll:updated', onUpdated);
    socket.on('poll:closed', onClosed);
    return () => {
      socket.off('poll:created', onCreated);
      socket.off('poll:updated', onUpdated);
      socket.off('poll:closed', onClosed);
    };
  }, [socket]);

  const handleVote = (pollId: string, optionId: string) => {
    if (!user) return;
    socket.emit('poll:vote', { pollId, optionId });
  };

  const handleClose = async (pollId: string) => {
    if (!confirm('Закрыть голосование?')) return;
    try {
      await api.post(`/polls/${pollId}/close`);
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Не удалось закрыть голосование');
    }
  };

  const handleAddOption = () => {
    if (pollOptions.length >= 8) return;
    setPollOptions((prev) => [...prev, '']);
  };

  const handleCreate = (title: string, options: string[]) => {
    setError(null);
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) {
      setError('Укажите название и минимум 2 варианта');
      return;
    }
    socket.emit('poll:create', { title: title.trim(), options: cleanOptions });
    setPollTitle('');
    setPollOptions(['', '']);
    setShowCreateForm(false);
  };

  const handleCreateMapVote = () => {
    if (maps.length < 2) {
      setError('Недостаточно карт в системе для голосования');
      return;
    }
    handleCreate('Какую карту играем дальше?', maps.slice(0, 8).map((m) => m.name));
  };

  const handleCreateModeVote = () => {
    handleCreate('Сколько человек в команде в следующем матче?', MODE_OPTIONS);
  };

  if (polls.length === 0 && !canManage) return null;

  return (
    <div className="px-6 md:px-10 max-w-3xl mx-auto w-full mb-6">
      {canManage && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={handleCreateMapVote} className="btn-out" style={{ padding: '7px 14px', fontSize: '12px' }}>
            🗺️ Голосование за карту
          </button>
          <button onClick={handleCreateModeVote} className="btn-out" style={{ padding: '7px 14px', fontSize: '12px' }}>
            👥 Голосование за состав команды
          </button>
          <button onClick={() => setShowCreateForm((v) => !v)} className="btn-out" style={{ padding: '7px 14px', fontSize: '12px' }}>
            {showCreateForm ? 'Отмена' : '+ Своё голосование'}
          </button>
        </div>
      )}

      {canManage && showCreateForm && (
        <div className="card mb-4 flex flex-col gap-3">
          {error && (
            <div className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <input value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} placeholder="Название голосования" className="input-field" />
          {pollOptions.map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) =>
                setPollOptions((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
              placeholder={`Вариант ${i + 1}`}
              className="input-field"
            />
          ))}
          <div className="flex gap-2">
            <button onClick={handleAddOption} className="btn-out flex-1" style={{ padding: '8px', fontSize: '13px' }}>
              + Вариант
            </button>
            <button onClick={() => handleCreate(pollTitle, pollOptions)} className="btn-main flex-1" style={{ padding: '8px', fontSize: '13px' }}>
              Опубликовать
            </button>
          </div>
        </div>
      )}

      {polls.map((poll) => {
        const myVote = poll.options.find((o) => o.votes.some((v) => v.userId === user?.id));
        const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

        return (
          <div key={poll.id} className="card mb-3" style={{ border: '1px solid rgba(79,127,255,.2)', background: 'rgba(79,127,255,.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                📊 {poll.title}
              </p>
              {canManage && (
                <button onClick={() => handleClose(poll.id)} className="text-xs" style={{ color: '#f87171' }}>
                  закрыть
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {poll.options.map((opt) => {
                const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                const isMine = myVote?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleVote(poll.id, opt.id)}
                    className="relative w-full text-left rounded-md overflow-hidden transition-all"
                    style={{ border: `1px solid ${isMine ? 'var(--a)' : 'var(--border2)'}` }}
                  >
                    <div className="absolute inset-0" style={{ width: `${pct}%`, background: isMine ? 'rgba(79,127,255,.18)' : 'rgba(255,255,255,.04)', transition: 'width .3s' }} />
                    <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                      <span style={{ color: isMine ? 'var(--a)' : 'var(--text)' }}>
                        {isMine && '✓ '}
                        {opt.label}
                      </span>
                      <span className="font-mono" style={{ color: 'var(--muted)' }}>
                        {opt.votes.length} ({pct}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
