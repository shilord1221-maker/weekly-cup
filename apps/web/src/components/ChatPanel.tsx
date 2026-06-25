'use client';

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';
import { Avatar } from '@/components/Avatar';

interface PollOption {
  id: string;
  label: string;
  votes: { userId: string }[];
}
interface Poll {
  id: string;
  title: string;
  options: PollOption[];
}
interface ChatMsg {
  id: string;
  text: string;
  createdAt: string;
  pollId?: string | null;
  poll?: Poll | null;
  author: { id: string; username: string; avatarUrl?: string | null };
}

interface ChatPanelProps {
  matchId?: string;
  teamId?: string;
  height?: string;
  allowPolls?: boolean;
  title?: string;
}

export function ChatPanel({ matchId, teamId, height = '100vh', allowPolls = !matchId && !teamId, title = 'Общий чат' }: ChatPanelProps) {
  const socket = useSocket();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollError, setPollError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canManage = isAdminOrOwner(user?.role);

  const historyEvent = teamId ? 'teamChat:history' : matchId ? 'lobbyChat:history' : 'chat:history';
  const messageEvent = teamId ? 'teamChat:message' : matchId ? 'lobbyChat:message' : 'chat:message';
  const deletedEvent = teamId ? 'teamChat:message_deleted' : matchId ? 'lobbyChat:message_deleted' : 'chat:message_deleted';

  useEffect(() => {
    socket.emit('chat:join', matchId || teamId ? { matchId, teamId } : undefined);

    const onHistory = (history: ChatMsg[]) => setMessages(history);
    const onMessage = (msg: ChatMsg) => setMessages((prev) => [...prev, msg]);
    const onDeleted = ({ messageId }: { messageId: string }) => setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const onPollUpdated = ({ pollId, options }: { pollId: string; options: PollOption[] }) =>
      setMessages((prev) => prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: { ...m.poll!, options } } : m)));
    const onChatError = ({ message }: { message: string }) => setPollError(message);

    socket.on(historyEvent, onHistory);
    socket.on(messageEvent, onMessage);
    socket.on(deletedEvent, onDeleted);
    socket.on('poll:updated', onPollUpdated);
    socket.on('chat:error', onChatError);

    return () => {
      socket.emit('chat:leave', matchId || teamId ? { matchId, teamId } : undefined);
      socket.off(historyEvent, onHistory);
      socket.off(messageEvent, onMessage);
      socket.off(deletedEvent, onDeleted);
      socket.off('poll:updated', onPollUpdated);
      socket.off('chat:error', onChatError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, matchId, teamId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !user) return;
    socket.emit('chat:send', { text: input.trim(), matchId, teamId });
    setInput('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!confirm('Удалить это сообщение?')) return;
    socket.emit('chat:delete', { messageId, matchId, teamId });
  };

  const handleAddPollOption = () => {
    if (pollOptions.length >= 8) return;
    setPollOptions((prev) => [...prev, '']);
  };

  const handleCreatePoll = () => {
    setPollError(null);
    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollTitle.trim() || cleanOptions.length < 2) {
      setPollError('Укажите название и минимум 2 варианта');
      return;
    }
    socket.emit('poll:create', { title: pollTitle.trim(), options: cleanOptions });
    setPollTitle('');
    setPollOptions(['', '']);
    setShowPollForm(false);
  };

  const handleVote = (pollId: string, optionId: string) => {
    if (!user) return;
    socket.emit('poll:vote', { pollId, optionId });
  };

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display font-semibold uppercase" style={{ fontSize: '16px', letterSpacing: '0.04em', color: 'var(--muted)' }}>
          {title}
        </h2>
        {allowPolls && canManage && (
          <button onClick={() => setShowPollForm((v) => !v)} className="btn-out" style={{ padding: '6px 14px', fontSize: '12px' }}>
            {showPollForm ? 'Отмена' : '📊 Голосование'}
          </button>
        )}
      </div>

      {allowPolls && canManage && showPollForm && (
        <div className="card mb-4 flex flex-col gap-3">
          {pollError && (
            <div className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {pollError}
            </div>
          )}
          <input value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} placeholder="Например: Какую карту играем дальше?" className="input-field" />
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
              placeholder={`Вариант ${i + 1} (например: Redwood · 4x4)`}
              className="input-field"
            />
          ))}
          <div className="flex gap-2">
            <button onClick={handleAddPollOption} className="btn-out flex-1" style={{ padding: '8px', fontSize: '13px' }}>
              + Вариант
            </button>
            <button onClick={handleCreatePoll} className="btn-main flex-1" style={{ padding: '8px', fontSize: '13px' }}>
              Опубликовать
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl p-5 mb-4 flex flex-col gap-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {messages.length === 0 && (
          <p className="text-sm text-center mt-10" style={{ color: 'var(--muted)' }}>
            Пока сообщений нет — напиши первым
          </p>
        )}
        {messages.map((m) => {
          const myVote = m.poll?.options.find((o) => o.votes.some((v) => v.userId === user?.id));
          const totalVotes = m.poll?.options.reduce((sum, o) => sum + o.votes.length, 0) ?? 0;

          return (
            <div key={m.id} className="flex gap-3 group">
              <Avatar username={m.author.username} avatarUrl={m.author.avatarUrl} size={32} />
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--a)' }}>
                    {m.author.username}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                    {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteMessage(m.id)}
                      className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                      style={{ color: '#f87171' }}
                    >
                      удалить
                    </button>
                  )}
                </div>

                {m.poll ? (
                  <div className="mt-2 rounded-lg p-3" style={{ background: 'rgba(79,127,255,.05)', border: '1px solid rgba(79,127,255,.15)' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                      📊 {m.poll.title}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {m.poll.options.map((opt) => {
                        const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                        const isMine = myVote?.id === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleVote(m.poll!.id, opt.id)}
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
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    {m.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {user ? (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Написать сообщение..."
            maxLength={500}
            className="input-field flex-1"
          />
          <button onClick={sendMessage} className="btn-main" style={{ padding: '13px 24px' }}>
            Отправить
          </button>
        </div>
      ) : (
        <div className="text-center py-3 text-sm" style={{ color: 'var(--muted)' }}>
          <a href="/login" style={{ color: 'var(--a)' }}>
            Войдите
          </a>
          , чтобы писать в чат
        </div>
      )}
    </div>
  );
}
