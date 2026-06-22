'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, roleLabel, type Role } from '@/store/auth';

interface ProfileData {
  id: string;
  username: string;
  email: string;
  role: Role;
  staticId: { value: string } | null;
  achievements: { id: string; title: string; earnedAt: string }[];
  wins: { id: string; createdAt: string; match: { map: { name: string } } }[];
}

export default function ProfilePage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !user) router.push('/login');
  }, [isInitialized, user, router]);

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
    enabled: !!user,
  });

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-4 mb-12">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
        >
          {profile.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: '28px', letterSpacing: '0.02em' }}>
            {profile.username}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {profile.email} · {roleLabel(profile.role)}
          </p>
        </div>
      </div>

      {/* STATIC ID */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
          Static ID
        </h2>
        <p className="font-mono text-lg mb-2">{profile.staticId?.value ?? '— не привязан —'}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Static ID закреплён за аккаунтом и не может быть изменён самостоятельно. Если он указан неверно, обратитесь в{' '}
          <Link href="/social" style={{ color: 'var(--a)' }}>
            поддержку
          </Link>
          .
        </p>
      </div>

      {/* SUPPORT */}
      <a
        href="https://t.me/Weeklycupsupport"
        target="_blank"
        rel="noopener noreferrer"
        className="card mb-6 flex items-center justify-between gap-4 transition-all hover:translate-x-1"
        style={{ textDecoration: 'none' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(41,169,235,.1)', color: '#29a9eb' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16c-.169 1.858-.896 6.728-1.267 8.93-.156.93-.474 1.243-.748 1.27-.638.06-1.122-.422-1.74-.832-.964-.633-1.51-1.026-2.448-1.644-1.084-.717-.38-1.11.235-1.756.165-.17 3.026-2.78 3.082-3.012.007-.03.013-.14-.05-.197-.064-.06-.158-.038-.226-.022-.097.022-1.629 1.034-4.596 3.038-.434.299-.83.444-1.183.436-.39-.008-1.14-.222-1.698-.405-.685-.226-1.228-.346-1.182-.73.024-.2.297-.404.823-.612 3.232-1.408 5.387-2.336 6.464-2.785 3.078-1.274 3.717-1.494 4.135-1.502.092-.002.298.022.43.135.11.094.14.222.156.314.014.083.034.27.018.418z" />
            </svg>
          </div>
          <div>
            <div className="font-display font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '14px', color: 'var(--text)' }}>
              Поддержка
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Вопросы по аккаунту, Static ID, спорные ситуации
            </p>
          </div>
        </div>
        <span style={{ color: 'var(--muted)' }}>→</span>
      </a>

      {/* ACHIEVEMENTS */}
      <div className="card mb-6">
        <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
          Достижения
        </h2>
        {profile.achievements.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Пока нет достижений — сыграйте первый матч.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.achievements.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🏆 {a.title}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(a.earnedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MATCH HISTORY */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            История побед
          </h2>
          <Link href="/matches" className="text-xs font-medium" style={{ color: 'var(--a)' }}>
            Все матчи →
          </Link>
        </div>
        {profile.wins.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Пока нет побед в истории.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.wins.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span>🏆 Победа · {w.match.map.name}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(w.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
