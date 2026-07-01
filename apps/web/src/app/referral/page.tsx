'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { TokenIcon } from '@/components/TokenIcon';

export default function ReferralPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (user) fetch('/api/referral/my-code').then(r => r.json()).then(setData);
  }, [user]);

  const copy = () => {
    navigator.clipboard.writeText(data?.link);
    alert('Скопировано!');
  };

  if (!user) return <div className="text-center p-20"><a href="/login" className="btn-main">Войти</a></div>;
  if (!data) return <div className="text-center p-20" style={{ color: 'var(--muted)' }}>Загрузка...</div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto p-6">
      <h1 className="font-display font-bold text-3xl mb-6">🤝 Реферальная программа</h1>

      <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-3 gap-4 text-center mb-6">
          <div>
            <div className="text-xs font-mono uppercase" style={{ color: 'var(--muted)' }}>Баланс</div>
            <div className="text-2xl font-bold text-green-400">{data.balance}₽</div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase" style={{ color: 'var(--muted)' }}>Заработано</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{data.totalEarned}₽</div>
          </div>
          <div>
            <div className="text-xs font-mono uppercase" style={{ color: 'var(--muted)' }}>Рефералов</div>
            <div className="text-2xl font-bold text-purple-400">{data.referralsCount}</div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border2)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Твоя ссылка (10% с каждого):</div>
          <div className="flex gap-2">
            <input readOnly value={data.link} className="input-field flex-1 text-sm" />
            <button onClick={copy} className="btn-out" style={{ padding: '10px 14px' }}>📋</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'rgba(201,149,74,.06)', border: '1px solid rgba(201,149,74,.2)' }}>
        <h3 className="font-bold mb-2" style={{ color: 'var(--gold)' }}>💰 Как вывести:</h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Напиши в Telegram-бот: <code className="px-2 py-1 rounded" style={{ background: 'var(--surface)' }}>/payout сумма номер_карты</code><br/>
          Пример: <code className="px-2 py-1 rounded" style={{ background: 'var(--surface)' }}>/payout 500 2200123456789012</code>
        </p>
      </div>
    </div>
  );
}