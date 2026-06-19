'use client';

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/auth';

interface ChatMsg {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
}

export default function ChatPage() {
  const socket = useSocket();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.emit('chat:join');

    const onHistory = (history: ChatMsg[]) => setMessages(history);
    const onMessage = (msg: ChatMsg) => setMessages((prev) => [...prev, msg]);

    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);

    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
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

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-10 max-w-3xl mx-auto flex flex-col" style={{ background: 'var(--bg)', height: '100vh' }}>
      <h1 className="font-display font-bold uppercase mb-6" style={{ fontSize: '28px', letterSpacing: '0.02em' }}>
        Общий чат
      </h1>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl p-5 mb-4 flex flex-col gap-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {messages.length === 0 && (
          <p className="text-sm text-center mt-10" style={{ color: 'var(--muted)' }}>
            Пока сообщений нет — напиши первым
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: 'rgba(79,127,255,.15)', color: 'var(--a)' }}
            >
              {m.author.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--a)' }}>
                  {m.author.username}
                </span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                  {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {m.text}
              </p>
            </div>
          </div>
        ))}
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
