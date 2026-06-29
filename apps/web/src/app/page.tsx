'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { ZoneAnimation } from '@/components/ZoneAnimation';
import { PollBanner } from '@/components/PollBanner';
import { Avatar } from '@/components/Avatar';

interface MediaItem {
  id: string;
  title: string;
  type: string;
  url: string;
  thumbUrl: string | null;
}

interface MatchSummary {
  id: string;
  mode: string;
  status: string;
  startTime: string;
  map: { name: string };
  lobby?: { teams: { members: unknown[] }[] };
}

interface WinSummary {
  id: string;
  user: { username: string; avatarUrl?: string | null };
  match: { id: string; map: { name: string } };
  team: { name: string };
  createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  MODE_2X2: '2×2',
  MODE_3X3: '3×3',
  MODE_4X4: '4×4',
  MODE_5X5: '5×5',
};

export default function HomePage() {
  const [loaderOut, setLoaderOut] = useState(false);
  const [pct, setPct] = useState(0);
  const { user } = useAuthStore();

  const { data: matches } = useQuery<MatchSummary[]>({
    queryKey: ['matches-preview'],
    queryFn: () => api.get('/matches', { auth: false }),
    retry: false,
  });

  const { data: wins } = useQuery<WinSummary[]>({
    queryKey: ['wins-preview'],
    queryFn: () => api.get('/wins', { auth: false }),
    retry: false,
  });

  const { data: mediaItems } = useQuery<MediaItem[]>({
    queryKey: ['media-preview'],
    queryFn: () => api.get('/media', { auth: false }),
    retry: false,
  });

  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 4.5 + 1.2;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => setLoaderOut(true), 700);
      }
      setPct(Math.round(p));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const previewMatches = matches?.slice(0, 4) ?? [];
  const previewWins = wins?.slice(0, 4) ?? [];

  return (
    <>
      {/* LOADER */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-7 overflow-hidden"
        style={{
          background: 'var(--bg)',
          opacity: loaderOut ? 0 : 1,
          visibility: loaderOut ? 'hidden' : 'visible',
          pointerEvents: loaderOut ? 'none' : 'auto',
          transform: loaderOut ? 'scale(1.04)' : 'scale(1)',
          transition: 'opacity 0.7s cubic-bezier(.4,0,.2,1), transform 0.7s cubic-bezier(.4,0,.2,1), visibility 0.7s',
        }}
      >
        {/* solid base + ambient radial tint, layered separately so corners always stay fully opaque */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 45%,rgba(79,127,255,.08) 0%,transparent 65%)' }}
        />

        {/* ambient glow orbs — slow, subtle, no flashing */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 480, height: 480, background: 'radial-gradient(circle,rgba(201,149,74,.1) 0%,transparent 70%)', filter: 'blur(50px)', animation: 'loaderOrbPulse 6s ease-in-out infinite' }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 360, height: 360, top: '22%', left: '62%', background: 'radial-gradient(circle,rgba(79,127,255,.08) 0%,transparent 70%)', filter: 'blur(55px)', animation: 'loaderOrbPulse 7s ease-in-out infinite 1.5s' }}
        />

        {/* LOGO — rises from below, growing smoothly to full size, gentle settle, no impact effects */}
        <div
          className="relative z-10"
          style={{
            opacity: 0,
            transform: 'translateY(120px) scale(0.15)',
            animation: 'trophyRiseIn 1.4s 0.2s cubic-bezier(.16,1,.3,1) forwards, trophyFloat 6s 1.8s ease-in-out infinite',
          }}
        >
          <img src="/branding/logo.png" alt="Weekly Pracs" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
        </div>

        {/* TITLE — scales up from small to large, centered, in sync with trophy */}
        <div className="text-center relative z-10">
          <div
            className="font-display font-bold uppercase tracking-widest"
            style={{
              fontSize: 'clamp(32px,6vw,52px)',
              background: 'linear-gradient(135deg,#fff 20%,var(--a) 60%,var(--gold) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 100%',
              opacity: 0,
              transform: 'scale(0.3)',
              animation: 'loaderTitleScaleIn 1s 0.55s cubic-bezier(.16,1,.3,1) forwards, loaderGradientShift 4s 1.7s ease-in-out infinite',
            }}
          >
            WEEKLY PRACS
          </div>
          <div
            className="font-mono text-xs uppercase tracking-widest mt-2"
            style={{ color: 'var(--muted)', opacity: 0, transform: 'translateY(10px)', animation: 'loaderFadeUp 0.6s 1.1s ease-out forwards' }}
          >
            Custom Matches Platform
          </div>
        </div>

        {/* PROGRESS */}
        <div className="flex flex-col items-center gap-3 relative z-10" style={{ opacity: 0, transform: 'translateY(10px)', animation: 'loaderFadeUp 0.6s 1.25s ease-out forwards' }}>
          <div className="relative w-64 h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg,var(--a),var(--a2),var(--gold))',
                transition: 'width 0.15s ease-out',
                boxShadow: '0 0 12px rgba(79,127,255,.6)',
              }}
            />
          </div>
          <div className="font-mono text-xs tracking-wider" style={{ color: 'var(--a)' }}>
            {pct}%
          </div>
        </div>
      </div>

      <ParticlesBackground />

      {/* HERO — новый стиль */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 md:px-10 py-32 text-center overflow-hidden z-10">
        {/* Фоновые элементы */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]" style={{ background: 'radial-gradient(circle, rgba(79,127,255,.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px]" style={{ background: 'radial-gradient(circle, rgba(139,92,246,.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px]" style={{ background: 'radial-gradient(circle, rgba(201,149,74,.05) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          {/* Сетка */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(79,127,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(79,127,255,.025) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
        </div>

        {/* Лого */}
        <div className="relative z-10 mb-8" style={{ animation: 'trophyFloat 5s ease-in-out infinite' }}>
          <div className="relative">
            <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(79,127,255,.3), transparent 70%)', filter: 'blur(20px)', transform: 'scale(1.3)' }} />
            <img src="/branding/logo.png" alt="Weekly Pracs" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', position: 'relative', zIndex: 1, border: '2px solid rgba(79,127,255,.3)' }} />
          </div>
        </div>

        {/* Бейдж */}
        <div className="relative z-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] px-5 py-2 rounded-full mb-8"
          style={{ color: 'var(--a)', border: '1px solid rgba(79,127,255,.2)', background: 'rgba(79,127,255,.05)', backdropFilter: 'blur(10px)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)', animation: 'pulse 2s infinite' }} />
          Majestic · Кастомные матчи
        </div>

        {/* Заголовок */}
        <h1 className="relative z-10 font-display font-bold uppercase" style={{ fontSize: 'clamp(52px,11vw,130px)', lineHeight: 0.88, letterSpacing: '-0.03em', marginBottom: '24px' }}>
          <span className="block" style={{ color: 'var(--text)' }}>Weekly</span>
          <span className="block" style={{ background: 'linear-gradient(135deg, var(--a) 0%, var(--a2) 50%, var(--gold) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Pracs
          </span>
        </h1>

        <p className="relative z-10 max-w-md mb-12 text-base" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
          Организованные кастомные матчи 5×5.<br />Бан-пик карт, голосовые каналы, лента побед.
        </p>

        {/* CTA */}
        <div className="relative z-10 flex gap-4 flex-wrap justify-center">
          <Link href={user ? '/matches' : '/register'} className="btn-main" style={{ padding: '14px 36px', fontSize: '15px', fontWeight: 600 }}>
            {user ? '🎮 Найти матч' : '🚀 Начать играть'}
          </Link>
          <Link href="/gfc" className="btn-out" style={{ padding: '14px 32px', fontSize: '15px' }}>
            ⚔️ GFC 5×5
          </Link>
          <Link href="/wins" className="btn-out" style={{ padding: '14px 32px', fontSize: '15px' }}>
            🏆 Топ игроков
          </Link>
        </div>

        {/* Статы */}
        <div className="relative z-10 flex gap-8 mt-16 flex-wrap justify-center">
          {[['🎯', 'Кастомные матчи', '5×5'], ['⚔️', 'GFC режим', 'Атака/Защита'], ['🏆', 'Лента побед', 'Реалтайм'], ['💳', 'Токены', 'За победы']].map(([icon, label, val]) => (
            <div key={label} className="text-center">
              <div style={{ fontSize: '20px' }}>{icon}</div>
              <div className="font-display font-bold text-sm mt-1">{val}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TICKER */}
      <div className="relative z-10 overflow-hidden py-3" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'rgba(8,13,26,.8)', backdropFilter: 'blur(10px)' }}>
        <div className="flex whitespace-nowrap" style={{ animation: 'ticker 30s linear infinite' }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex">
              {[['🔴 LIVE', 'Кастомные матчи каждую неделю'], ['⚔️ GFC', 'Ban-Pick · Атака vs Защита'], ['🏆 Токены', '+50 за каждую победу'], ['🎮 5×5', 'Majestic Cyber League'], ['🛡️ Стаки', 'Создай команду и сражайся']].map(([tag, text]) => (
                <TickerItem key={tag}><b style={{ color: 'var(--a)' }}>{tag}</b> {text}</TickerItem>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS — новый стиль */}
      <section className="px-6 md:px-10 py-20 relative z-10 max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--a)' }}>Как это работает</div>
          <h2 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-0.02em' }}>
            От регистрации<br />до победы
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { num: '01', icon: '🎯', title: 'Аккаунт', desc: 'Регистрируйся со Static ID — он подтверждает твою личность в игре' },
            { num: '02', icon: '🗺️', title: 'Матч', desc: 'Выбирай из открытых лобби или создавай своё с бан-пиком карт' },
            { num: '03', icon: '🎮', title: 'Лобби', desc: 'Вступай в команду, общайся в войсе Discord и жди старта' },
            { num: '04', icon: '🏆', title: 'Победа', desc: 'Побеждай и получай токены, места в топе и уникальные эффекты' },
          ].map((card) => (
            <div key={card.num} className="relative rounded-2xl p-6 group transition-all hover:-translate-y-1"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div className="absolute top-4 right-4 font-display font-bold text-5xl leading-none" style={{ color: 'rgba(79,127,255,.06)' }}>{card.num}</div>
              <div className="text-2xl mb-4">{card.icon}</div>
              <div className="font-display font-semibold uppercase mb-2" style={{ fontSize: '16px', letterSpacing: '0.04em' }}>{card.title}</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MEDIA SECTION */}
      <section id="media" className="px-10 pb-28 relative z-10 max-w-[1240px] mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div>
            <Eyebrow>Контент</Eyebrow>
            <h2 className="font-display font-bold uppercase mt-4" style={{ fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
              Стримеры<br /><span style={{ background: 'linear-gradient(90deg,var(--a),var(--a2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>и медиа</span>
            </h2>
          </div>
          <Link href="/media" className="btn-out">Все медиа →</Link>
        </div>

        {mediaItems && mediaItems.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mediaItems.slice(0, 8).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
                    {item.thumbUrl ? (
                      <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">▶️</span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,.45)' }}>
                      <span className="text-white text-2xl">▶</span>
                    </div>
                  </div>
                  <span className="absolute top-2 left-2 font-mono text-[9px] uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,13,26,.8)', color: 'var(--a)', border: '1px solid rgba(79,127,255,.3)' }}>
                    {item.type === 'youtube' ? 'YouTube' : item.type === 'twitch' ? 'Twitch' : item.type}
                  </span>
                </div>
                <div className="px-3 py-2.5" style={{ height: '48px' }}>
                  <div className="text-xs font-medium leading-snug overflow-hidden" style={{ color: 'var(--text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div className="aspect-video flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
                  <span className="text-3xl opacity-30">▶️</span>
                </div>
                <div className="px-3 py-2.5">
                  <div className="h-2.5 rounded w-3/4 mb-1.5" style={{ background: 'rgba(255,255,255,.05)' }} />
                  <div className="h-2 rounded w-1/2" style={{ background: 'rgba(255,255,255,.03)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ACTIVE POLLS */}
      <div className="relative z-10 pt-16" style={{ background: 'var(--surface)' }}>
        <PollBanner />
      </div>

      {/* MATCHES PREVIEW — real data, fallback to placeholder */}
      <section className="px-10 pb-28 relative z-10" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1240px] mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <Eyebrow noMargin>Расписание</Eyebrow>
              <h2 className="font-display font-bold uppercase mt-4" style={{ fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
                Матчи
              </h2>
            </div>
            <Link href="/matches" className="btn-out">
              Все матчи →
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            {previewMatches.length > 0 ? (
              previewMatches.map((m) => <MatchRow key={m.id} match={m} />)
            ) : (
              <EmptyMatches />
            )}
          </div>
        </div>
      </section>

      {/* WINS */}
      <section id="wins" className="px-10 py-28 relative z-10 max-w-[1240px] mx-auto">
        <Eyebrow>Лента побед</Eyebrow>
        <h2 className="font-display font-bold uppercase mb-14" style={{ fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
          Последние<br />чемпионы
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
          {previewWins.length > 0 ? (
            previewWins.map((w) => <WinCard key={w.id} win={w} />)
          ) : (
            <p style={{ color: 'var(--muted)' }} className="text-sm col-span-full">
              Пока нет завершённых матчей — первая победа появится здесь.
            </p>
          )}
        </div>
      </section>

      {/* CTA */}
      <div className="px-10 py-28 text-center relative z-10 overflow-hidden">
        <div className="relative inline-block p-px rounded-3xl" style={{ background: 'linear-gradient(135deg,rgba(79,127,255,.5),rgba(139,92,246,.3),transparent 60%)' }}>
          <div className="rounded-[23px] px-12 md:px-24 py-16" style={{ background: 'var(--surface)' }}>
            <h2 className="font-display font-bold uppercase mb-5" style={{ fontSize: 'clamp(40px,6vw,72px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
              Готов к игре?
              <br />
              <span style={{ background: 'linear-gradient(90deg,var(--a),var(--a2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Заходи.</span>
            </h2>
            <p className="mb-11 max-w-sm mx-auto" style={{ color: 'var(--muted)' }}>
              {user ? 'Выбирай ближайший матч и вставай в лобби.' : 'Регистрируйся, привязывай Static ID и вставай в лобби ближайшего матча.'}
            </p>
            <div className="flex gap-3.5 justify-center flex-wrap">
              <Link href={user ? '/matches' : '/register'} className="btn-main" style={{ fontSize: '15px', padding: '16px 40px' }}>
                {user ? 'Найти матч' : 'Создать аккаунт'}
              </Link>
              <Link href="/rules" className="btn-out" style={{ fontSize: '15px', padding: '16px 36px' }}>
                Правила
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="px-10 py-9 flex items-center justify-between flex-wrap gap-4 relative z-10" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <Link href="/" className="font-display font-bold text-lg uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          WEEKLY <span style={{ color: 'var(--a)' }}>CUP</span>
        </Link>
        <div className="flex gap-6 flex-wrap text-xs" style={{ color: 'var(--muted)' }}>
          <Link href="/rules" className="hover:text-white transition-colors">Правила</Link>
          <Link href="/media" className="hover:text-white transition-colors">Медиа</Link>
          <Link href="/maps" className="hover:text-white transition-colors">Карты</Link>
          <Link href="/complaints" className="hover:text-white transition-colors">Жалобы</Link>
        </div>
        <div className="font-mono text-[11px]" style={{ color: 'rgba(96,104,128,.4)' }}>
          © 2025 Weekly Pracs
        </div>
      </footer>
    </>
  );
}

// ───────── SUBCOMPONENTS ─────────

function LiveDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />;
}

function TickerItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-4 px-8 font-mono text-xs" style={{ color: 'var(--muted)', borderRight: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest ${noMargin ? '' : 'mb-[18px]'}`} style={{ color: 'var(--a)' }}>
      <span className="block w-6 h-px" style={{ background: 'var(--a)' }} />
      {children}
    </div>
  );
}

function HowCard({ num, icon, title, desc }: { num: string; icon: string; title: string; desc: string }) {
  return (
    <div className="p-8 relative overflow-hidden group transition-colors" style={{ background: 'var(--surface)' }}>
      <div className="absolute right-4 top-3 font-display text-7xl font-bold leading-none transition-colors" style={{ color: 'rgba(79,127,255,.08)' }}>
        {num}
      </div>
      <div
        className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center text-xl"
        style={{ border: '1px solid var(--border2)', background: 'rgba(255,255,255,.03)' }}
      >
        {icon}
      </div>
      <div className="font-display font-semibold uppercase mb-2.5" style={{ fontSize: '19px', letterSpacing: '0.04em' }}>
        {title}
      </div>
      <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}


function MatchRow({ match }: { match: MatchSummary }) {
  const { user } = useAuthStore();
  const isStaff = isOrganizerOrAbove(user?.role);
  const date = new Date(match.startTime);
  const mskTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(date);
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';

  return (
    <Link
      href={`/lobby/${match.id}`}
      className="grid items-center gap-5 px-6 py-[18px] rounded-xl no-underline transition-all relative overflow-hidden hover:translate-x-1.5"
      style={{ gridTemplateColumns: '12px 1fr auto auto auto', border: '1px solid var(--border)', background: 'rgba(255,255,255,.015)', color: 'var(--text)' }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: isLive ? 'var(--green)' : isFinished ? 'var(--muted)' : 'var(--a)',
          boxShadow: isLive ? '0 0 10px var(--green)' : 'none',
          animation: isLive ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <div className="flex flex-col gap-0.5">
        <div className="font-display font-semibold uppercase" style={{ fontSize: '17px', letterSpacing: '0.04em' }}>
          {isStaff || isFinished ? `${match.map?.name ?? 'Карта'} — Weekly Pracs` : 'Карта скрыта до входа в команду'}
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {isLive ? 'Идёт сейчас' : isFinished ? 'Матч завершён' : 'Скоро начнётся'}
        </div>
      </div>
      <div className="font-mono text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap" style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.18)' }}>
        {MODE_LABELS[match.mode] ?? match.mode}
      </div>
      <div className="font-mono text-xs whitespace-nowrap hidden sm:block" style={{ color: isLive ? 'var(--green)' : 'var(--muted)' }}>
        {isLive ? 'LIVE' : isFinished ? 'Завершён' : `${mskTime} МСК`}
      </div>
      <span className="text-sm hidden sm:block transition-transform" style={{ color: 'var(--muted)' }}>
        →
      </span>
    </Link>
  );
}

function EmptyMatches() {
  return (
    <div className="rounded-xl px-6 py-10 text-center" style={{ border: '1px dashed var(--border2)' }}>
      <p style={{ color: 'var(--muted)' }} className="mb-4">
        Пока нет запланированных матчей.
      </p>
      <Link href="/register" className="btn-out inline-flex">
        Зарегистрироваться и узнать первым
      </Link>
    </div>
  );
}

function WinCard({ win }: { win: WinSummary }) {
  return (
    <Link
      href={`/matches/${win.match.id}`}
      className="block p-[26px] rounded-2xl relative overflow-hidden transition-all hover:-translate-y-1"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent 0%,var(--gold) 40%,rgba(201,149,74,.3) 100%)' }} />
      <div className="flex items-center gap-3 mb-[18px]">
        <Avatar username={win.user.username} avatarUrl={win.user.avatarUrl} size={40} />
        <div>
          <div className="font-semibold text-sm">{win.user.username}</div>
          <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
            {win.team.name}
          </div>
        </div>
      </div>
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide px-3 py-1.5 rounded-full"
        style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.07)', border: '1px solid rgba(201,149,74,.18)' }}
      >
        🏆 Победитель
      </span>
      <div className="flex justify-between text-xs mt-3.5" style={{ color: 'var(--muted)' }}>
        <span>{win.match.map?.name}</span>
        <span>{new Date(win.createdAt).toLocaleDateString('ru-RU')}</span>
      </div>
    </Link>
  );
}
