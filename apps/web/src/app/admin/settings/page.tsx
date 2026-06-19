'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function AdminSettingsPage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'OWNER')) {
      router.push('/admin');
    }
  }, [isInitialized, user, router]);

  if (!user || user.role !== 'OWNER') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Проверка доступа...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-2xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Настройки системы
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Доступно только роли Owner.
      </p>

      <div className="card mb-4">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Управление администраторами
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>
          Назначение и снятие ролей Admin, Organizer и Owner происходит на странице «Пользователи».
          Только Owner может назначать или снимать роль Owner — Admin не имеет доступа к управлению другими Owner-аккаунтами.
        </p>
        <a href="/admin/users" className="btn-out" style={{ padding: '10px 20px', fontSize: '13px' }}>
          Перейти к пользователям →
        </a>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Иерархия ролей
        </h2>
        <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.1)' }}>
              OWNER
            </span>
            <span style={{ color: 'var(--muted)' }}>— полный доступ, управляет администраторами и настройками</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.1)' }}>
              ADMIN
            </span>
            <span style={{ color: 'var(--muted)' }}>— управление контентом, жалобами, картами, организаторами</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--a2)', background: 'rgba(139,92,246,.1)' }}>
              ORGANIZER
            </span>
            <span style={{ color: 'var(--muted)' }}>— создание и управление матчами, лобби</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,.04)' }}>
              PLAYER
            </span>
            <span style={{ color: 'var(--muted)' }}>— участие в матчах</span>
          </div>
        </div>
      </div>
    </div>
  );
}
