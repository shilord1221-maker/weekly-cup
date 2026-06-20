'use client';

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore, isAdminOrOwner } from '@/store/auth';

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
  author: { id: string; username: string };
}

export default function ChatPage() {
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

  useEffect(() => {
    socket.emit('chat:join');

    const onHistory = (history: ChatMsg[]) => setMessages(history);
    const onMessage = (msg: ChatMsg) => setMessages((prev) => [...prev, msg]);
    const onDeleted = ({ messageId }: { messageId: string }) => setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const onPollUpdated = ({ pollId, options }: { pollId: string; options: PollOption[] }) =>
      setMessages((prev) => prev.map((m) => (m.poll?.id === pollId ? { ...m, poll: { ...m.poll!, options } } : m)));
    const onChatError = ({ message }: { message: string }) => setPollError(message);

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:message_deleted', onDeleted);
    socket.on('poll:updated', onPollUpdated);
    socket.on('chat:error', onChatError);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:message_deleted', onDeleted);
      socket.off('poll:updated', onPollUpdated);
      socket.off('chat:error', onChatError);
    };
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !user) return;
    socket.emit('chat:send', { text: input.trim() });
    setInput('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!confirm('Удалить это сообщение?')) return;
    socket.emit('chat:delete', { messageId });
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
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-10 max-w-3xl mx-auto flex flex-col" style={{ background: 'var(--bg)', height: '100vh' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: '28px', letterSpacing: '0.02em' }}>
          Общий чат
        </h1>
        {canManage && (
          <button onClick={() => setShowPollForm((v) => !v)} className="btn-out" style={{ padding: '8px 16px', fontSize: '13px' }}>
            {showPollForm ? 'Отмена' : '📊 Создать голосование'}
          </button>
        )}
      </div>

      {canManage && showPollForm && (
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
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(79,127,255,.15)', color: 'var(--a)' }}
              >
                {m.author.username.slice(0, 2).toUpperCase()}
              </div>
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
