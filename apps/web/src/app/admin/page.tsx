'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, isOrganizerOrAbove, isAdminOrOwner, roleLabel } from '@/store/auth';

export default function AdminPage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && (!user || !isOrganizerOrAbove(user.role))) {
      router.push('/');
    }
  }, [isInitialized, user, router]);

  if (!user || !isOrganizerOrAbove(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Проверка доступа...</p>
      </div>
    );
  }

  const isOwner = user.role === 'OWNER';
  const isAdmin = isAdminOrOwner(user.role);

  const links = [
    { href: '/admin/matches', label: 'Матчи', desc: 'Создание и управление матчами', icon: '🎮', show: true },
    { href: '/admin/maps', label: 'Карты', desc: 'Загрузка карт и зон с adjacencyMap', icon: '🗺️', show: isAdmin },
    { href: '/admin/complaints', label: 'Жалобы', desc: 'Модерация жалоб игроков', icon: '📋', show: true },
    { href: '/admin/news', label: 'Новости', desc: 'Публикация и удаление новостей', icon: '📰', show: isAdmin },
    { href: '/admin/users', label: 'Пользователи', desc: 'Управление ролями', icon: '👥', show: isAdmin },
    { href: '/admin/amnesty', label: 'Амнистия', desc: 'Конфликты Static ID при регистрации', icon: '🛡️', show: isAdmin },
    { href: '/admin/referrals', label: 'Топ рефералов', desc: 'Кто привёл больше всего игроков', icon: '🔗', show: isAdmin },
    { href: '/admin/avatars', label: 'Аватарки', desc: 'Модерация новых аватарок игроков', icon: '🖼️', show: isAdmin },
    { href: '/admin/audit-log', label: 'Audit Log', desc: 'История всех действий', icon: '🧾', show: isAdmin },
    { href: '/admin/settings', label: 'Настройки системы', desc: 'Доступно только Owner', icon: '⚙️', show: isOwner },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Админ-панель
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--muted)' }}>
        Роль: {roleLabel(user.role)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-2xl p-6 transition-transform hover:-translate-y-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div className="text-2xl mb-3">{l.icon}</div>
            <div className="font-display font-semibold uppercase mb-1.5" style={{ fontSize: '17px', letterSpacing: '0.03em' }}>
              {l.label}
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {l.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
