'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { StackTag } from '@/components/StackTag';

interface StackItem {
  id: string; name: string; tag: string; tagColor: string;
  logoUrl: string | null; description: string | null; captainId: string;
  captain: { id: string; username: string; avatarUrl?: string | null };
  _count: { wins: number; members: number };
}

function StackLogo({ stack, size = 48 }: { stack: Pick<StackItem,'name'|'tag'|'tagColor'|'logoUrl'>; size?: number }) {
  if (stack.logoUrl) return <img src={stack.logoUrl} alt={stack.name} className="rounded-2xl object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-2xl flex items-center justify-center font-display font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `${stack.tagColor}18`, border: `2px solid ${stack.tagColor}40`, color: stack.tagColor, fontSize: size * 0.35 }}>
      {stack.tag.toUpperCase()}
    </div>
  );
}

const RANK_CONFIG = [
  { border: 'rgba(201,149,74,.45)', bg: 'linear-gradient(135deg,rgba(201,149,74,.18),rgba(201,149,74,.04))', glow: 'rgba(201,149,74,.15)', icon: '👑', label: '#1' },
  { border: 'rgba(148,163,184,.3)',  bg: 'linear-gradient(135deg,rgba(148,163,184,.1),rgba(148,163,184,.03))', glow: 'rgba(148,163,184,.08)', icon: '🥈', label: '#2' },
  { border: 'rgba(205,127,50,.3)',   bg: 'linear-gradient(135deg,rgba(205,127,50,.1),rgba(205,127,50,.03))',  glow: 'rgba(205,127,50,.08)', icon: '🥉', label: '#3' },
];

export default function StacksPage() {
  const { user } = useAuthStore();
  const { data: stacks, isLoading } = useQuery<StackItem[]>({
    queryKey: ['stacks'],
    queryFn: () => api.get('/stacks', { auth: false }),
  });
  const { data: myStack } = useQuery<StackItem | null>({
    queryKey: ['my-stack'],
    queryFn: () => api.get('/stacks/my'),
    enabled: !!user, retry: false,
  });

  const top3 = stacks?.slice(0, 3) ?? [];
  const rest = stacks?.slice(3) ?? [];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* HERO */}
      <div className="relative overflow-hidden pt-32 pb-12 px-6 md:px-10">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,127,255,.06), transparent)' }} />
        <div className="max-w-5xl mx-auto relative z-10 flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>
              <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
              Кланы и стаки
            </div>
            <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-0.02em', lineHeight: 0.9 }}>
              Топ команд
            </h1>
          </div>
          <div className="flex gap-2">
            {user && !myStack && <Link href="/stacks/create" className="btn-main">+ Создать стак</Link>}
            {myStack && (
              <Link href={`/stacks/${myStack.id}`} className="btn-out flex items-center gap-2">
                <StackTag tag={myStack.tag} color={myStack.tagColor} /> Мой стак
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 pb-20">
        {isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Загрузка...</p>}

        {/* ТОП 3 */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {top3.map((s, idx) => {
              const cfg = RANK_CONFIG[idx];
              return (
                <Link key={s.id} href={`/stacks/${s.id}`} className="relative block rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl"
                  style={{ border: `1px solid ${cfg.border}`, background: cfg.bg, boxShadow: `0 0 30px ${cfg.glow}` }}>
                  {/* Фоновый блик */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${cfg.glow.replace(',.08)',',,.15)')}, transparent)`, filter: 'blur(20px)' }} />

                  <div className="relative z-10 p-5">
                    {/* Ранг */}
                    <div className="flex items-center justify-between mb-4">
                      <span style={{ fontSize: '28px', filter: `drop-shadow(0 0 8px ${cfg.border})` }}>{cfg.icon}</span>
                      <div className="font-display font-bold text-3xl" style={{ color: idx === 0 ? 'var(--gold)' : 'rgba(255,255,255,.7)' }}>
                        {s._count.wins}
                        <span className="text-xs font-mono ml-1" style={{ color: 'var(--muted)' }}>побед</span>
                      </div>
                    </div>

                    {/* Лого + инфо */}
                    <div className="flex items-center gap-3">
                      <StackLogo stack={s} size={52} />
                      <div className="flex-1 min-w-0">
                        <StackTag tag={s.tag} color={s.tagColor} />
                        <div className="font-display font-semibold mt-1 truncate" style={{ fontSize: '16px' }}>{s.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          👥 {s._count.members} · {s.captain.username}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ОСТАЛЬНЫЕ */}
        <div className="flex flex-col gap-2">
          {rest.map((s, i) => (
            <Link key={s.id} href={`/stacks/${s.id}`} className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all hover:translate-x-1"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <span className="font-display font-bold w-8 text-center" style={{ color: 'var(--muted)', fontSize: '14px' }}>{i + 4}</span>
              <StackLogo stack={s} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><StackTag tag={s.tag} color={s.tagColor} /><span className="font-semibold text-sm">{s.name}</span></div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>👥 {s._count.members} · {s.captain.username}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-xl">{s._count.wins}</div>
                <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>побед</div>
              </div>
            </Link>
          ))}
          {!isLoading && !stacks?.length && (
            <div className="rounded-2xl px-6 py-16 text-center" style={{ border: '1px dashed var(--border2)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Нет стаков. Создай первый!</p>
              {user && <Link href="/stacks/create" className="btn-main inline-flex">+ Создать стак</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
