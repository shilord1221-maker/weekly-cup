'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface ProfileData {
  id: string;
  username: string;
  email: string;
  role: string;
  staticId: { value: string } | null;
  achievements: { id: string; title: string; earnedAt: string }[];
  wins: { id: string; createdAt: string; match: { map: { name: string } } }[];
}

export default function ProfilePage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [editingStaticId, setEditingStaticId] = useState(false);
  const [staticIdInput, setStaticIdInput] = useState('');
  const [staticIdError, setStaticIdError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isInitialized && !user) router.push('/login');
  }, [isInitialized, user, router]);

  const { data: profile, refetch } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
    enabled: !!user,
  });

  const handleSaveStaticId = async () => {
    setStaticIdError(null);
    setSaving(true);
    try {
      await api.patch('/auth/static-id', { staticId: staticIdInput });
      setEditingStaticId(false);
      refetch();
    } catch (e) {
      setStaticIdError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить Static ID');
    } finally {
      setSaving(false);
    }
  };

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
            {profile.email} · {profile.role === 'ADMIN' ? 'Администратор' : profile.role === 'ORGANIZER' ? 'Организатор' : 'Игрок'}
          </p>
        </div>
      </div>

      {/* STATIC ID */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold uppercase text-sm tracking-wider" style={{ color: 'var(--muted)' }}>
            Static ID
          </h2>
          {!editingStaticId && (
            <button
              onClick={() => {
                setEditingStaticId(true);
                setStaticIdInput(profile.staticId?.value ?? '');
              }}
              className="text-xs font-medium"
              style={{ color: 'var(--a)' }}
            >
              Изменить
            </button>
          )}
        </div>

        {!editingStaticId ? (
          <p className="font-mono text-lg">{profile.staticId?.value ?? '— не привязан —'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <input value={staticIdInput} onChange={(e) => setStaticIdInput(e.target.value)} className="input-field" placeholder="Введите Static ID" />
            {staticIdError && <p className="error-text">{staticIdError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSaveStaticId} disabled={saving} className="btn-main" style={{ padding: '10px 20px', fontSize: '13px' }}>
                Сохранить
              </button>
              <button onClick={() => setEditingStaticId(false)} className="btn-out" style={{ padding: '10px 20px', fontSize: '13px' }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

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
