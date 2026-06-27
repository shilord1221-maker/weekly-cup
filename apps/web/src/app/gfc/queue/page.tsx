'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';

export default function GfcQueuePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const socket = useSocket();
  const [inQueue, setInQueue] = useState(false);
  const [queueType, setQueueType] = useState<'SOLO' | 'STACK'>('SOLO');
  const [soloCount, setSoloCount] = useState(0);
  const [stackCount, setStackCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inQueue) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [inQueue]);

  useEffect(() => {
    const onFound = (data: { lobbyId: string }) => {
      router.push(`/gfc/${data.lobbyId}`);
    };
    socket.on('gfc:match_found', onFound);
    return () => { socket.off('gfc:match_found', onFound); };
  }, [socket, router]);

  const handleJoin = async () => {
    setError(null); setLoading(true);
    try {
      const res = await api.post<{ soloCount: number; stackCount: number }>('/gfc/queue/join', { type: queueType });
      setInQueue(true); setElapsed(0);
      setSoloCount(res.soloCount); setStackCount(res.stackCount);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleLeave = async () => {
    await api.post('/gfc/queue/leave');
    setInQueue(false); setElapsed(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Войдите, чтобы искать матч.</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md text-center">
        <Link href="/gfc" className="text-sm" style={{ color: 'var(--muted)' }}>← GFC Лобби</Link>

        <h1 className="font-display font-bold uppercase mt-4 mb-2" style={{ fontSize: 'clamp(28px,5vw,44px)' }}>
          Поиск матча
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>GFC 5×5 · Атака vs Защита</p>

        {error && <div className="text-sm rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>{error}</div>}

        {!inQueue ? (
          <>
            {/* Тип очереди */}
            <div className="flex gap-2 mb-6 p-1 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
              {(['SOLO', 'STACK'] as const).map((t) => (
                <button key={t} onClick={() => setQueueType(t)} className="flex-1 py-3 rounded-full text-sm font-medium transition-all"
                  style={{ color: queueType === t ? '#0a0d16' : 'var(--muted)', background: queueType === t ? '#fff' : 'transparent' }}>
                  {t === 'SOLO' ? '👤 Соло' : '👥 Стак 5'}
                </button>
              ))}
            </div>

            <div className="card mb-6 text-left">
              <p className="text-sm font-medium mb-2">{queueType === 'SOLO' ? '👤 Соло очередь' : '👥 Стак очередь'}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {queueType === 'SOLO'
                  ? 'Вы будете случайно распределены в одну из двух команд вместе с другими игроками.'
                  : 'Ваш стак из 5 игроков будет сопоставлен с другим готовым стаком. Все участники стака должны быть в очереди.'}
              </p>
            </div>

            <button onClick={handleJoin} disabled={loading} className="btn-main justify-center w-full" style={{ padding: '16px' }}>
              {loading ? 'Подключение...' : '🔍 Найти матч'}
            </button>
          </>
        ) : (
          <>
            {/* Анимация поиска */}
            <div className="flex justify-center mb-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--a)', animation: 'ping 1.5s cubic-bezier(0,0,.2,1) infinite', opacity: 0.4 }} />
                <div className="absolute inset-2 rounded-full" style={{ border: '2px solid var(--a)', animation: 'ping 1.5s cubic-bezier(0,0,.2,1) infinite 0.5s', opacity: 0.4 }} />
                <div className="absolute inset-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(79,127,255,.1)', border: '1px solid var(--a)' }}>
                  <span style={{ fontSize: '24px' }}>🔍</span>
                </div>
              </div>
            </div>

            <div className="font-display font-bold text-3xl mb-2">{fmt(elapsed)}</div>
            <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Поиск {queueType === 'SOLO' ? 'соло' : 'стак'} матча...</p>
            <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
              Соло: {soloCount}/10 · Нужно ещё {Math.max(0, 10 - soloCount)}
            </p>

            <button onClick={handleLeave} className="btn-out justify-center w-full">
              Отменить поиск
            </button>
          </>
        )}
      </div>
    </div>
  );
}
