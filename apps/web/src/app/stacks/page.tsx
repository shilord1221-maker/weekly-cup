'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';

interface StackItem {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  logoUrl: string | null;
  description: string | null;
  captainId: string;
  captain: { id: string; username: string; avatarUrl?: string | null };
  _count: { wins: number; members: number };
}

function StackLogo({ stack, size = 48 }: { stack: Pick<StackItem, 'name' | 'tag' | 'tagColor' | 'logoUrl'>; size?: number }) {
  if (stack.logoUrl) {
    return <img src={stack.logoUrl} alt={stack.name} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center font-display font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${stack.tagColor}22`, border: `2px solid ${stack.tagColor}55`, color: stack.tagColor, fontSize: size * 0.35 }}
    >
      {stack.tag.toUpperCase()}
    </div>
  );
}

export default function StacksPage() {
  const { user } = useAuthStore();

  const { data: stacks, isLoading } = useQuery<StackItem[]>({
    queryKey: ['stacks'],
    queryFn: () => api.get('/stacks', { auth: false }),
  });

  const { data: myStack } = useQuery<StackItem | null>({
    queryKey: ['my-stack'],
    queryFn: () => api.get('/stacks/my'),
    enabled: !!user,
    retry: false,
  });

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-5xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
            <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
            Кланы и стаки
          </div>
          <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.01em' }}>
            Топ команд
          </h1>
        </div>
        <div className="flex gap-2">
          {user && !myStack && (
            <Link href="/stacks/create" className="btn-main">+ Создать стак</Link>
          )}
          {myStack && (
            <Link href={`/stacks/${myStack.id}`} className="btn-out">
              <StackTag tag={myStack.tag} color={myStack.tagColor} />
              Мой стак
            </Link>
          )}
        </div>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {stacks?.map((s, idx) => (
          <Link
            key={s.id}
            href={`/stacks/${s.id}`}
            className="flex items-center gap-5 px-6 py-4 rounded-2xl transition-all hover:translate-x-1"
            style={{
              border: idx === 0 ? '1px solid rgba(201,149,74,.4)' : '1px solid var(--border)',
              background: idx === 0 ? 'linear-gradient(90deg,rgba(201,149,74,.06),var(--surface))' : 'var(--surface)',
            }}
          >
            {/* Позиция */}
            <div className="flex-shrink-0 w-8 text-center">
              {idx === 0 ? <span style={{ fontSize: '20px' }}>👑</span> :
               idx === 1 ? <span className="font-display font-bold text-lg" style={{ color: '#94a3b8' }}>2</span> :
               idx === 2 ? <span className="font-display font-bold text-lg" style={{ color: '#cd7f32' }}>3</span> :
               <span className="font-display font-bold text-sm" style={{ color: 'var(--muted)' }}>{idx + 1}</span>}
            </div>

            {/* Логотип */}
            <StackLogo stack={s} size={52} />

            {/* Инфо */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StackTag tag={s.tag} color={s.tagColor} />
                <span className="font-display font-semibold" style={{ fontSize: '17px', color: idx === 0 ? 'var(--gold)' : 'var(--text)' }}>
                  {s.name}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Avatar username={s.captain.username} avatarUrl={s.captain.avatarUrl} size={16} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Капитан: {s.captain.username} · {s._count.members} участников
                </span>
              </div>
            </div>

            {/* Побед */}
            <div className="flex-shrink-0 text-right">
              <div className="font-display font-bold" style={{ fontSize: '22px', color: idx < 3 ? 'var(--gold)' : 'var(--text)' }}>
                {s._count.wins}
              </div>
              <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>побед</div>
            </div>
          </Link>
        ))}
        {!isLoading && !stacks?.length && (
          <div className="rounded-xl px-6 py-12 text-center" style={{ border: '1px dashed var(--border2)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Пока нет ни одного стака. Будь первым!</p>
            {user && <Link href="/stacks/create" className="btn-main inline-flex">+ Создать стак</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
