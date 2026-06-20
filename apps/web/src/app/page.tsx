'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ParticlesBackground } from '@/components/ParticlesBackground';
import { ZoneAnimation } from '@/components/ZoneAnimation';
import { TrophyIcon } from '@/components/TrophyIcon';

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
  user: { username: string };
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

  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 5 + 1.5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => setLoaderOut(true), 500);
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
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(79,127,255,.07) 0%,var(--bg) 60%)',
          opacity: loaderOut ? 0 : 1,
          visibility: loaderOut ? 'hidden' : 'visible',
          pointerEvents: loaderOut ? 'none' : 'auto',
          transform: loaderOut ? 'scale(1.08)' : 'scale(1)',
          transition: 'opacity 0.8s cubic-bezier(.4,0,.2,1), transform 0.8s cubic-bezier(.4,0,.2,1), visibility 0.8s',
        }}
      >
        {/* ambient glow orbs */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 500, height: 500, background: 'radial-gradient(circle,rgba(201,149,74,.12) 0%,transparent 70%)', filter: 'blur(40px)', animation: 'loaderOrbPulse 4s ease-in-out infinite' }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 380, height: 380, top: '20%', left: '60%', background: 'radial-gradient(circle,rgba(79,127,255,.1) 0%,transparent 70%)', filter: 'blur(50px)', animation: 'loaderOrbPulse 5s ease-in-out infinite 1s' }}
        />

        {/* sparkle particles around trophy */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              background: i % 2 === 0 ? 'var(--gold)' : 'var(--a)',
              top: `${50 + Math.sin((i / 8) * Math.PI * 2) * 22}%`,
              left: `${50 + Math.cos((i / 8) * Math.PI * 2) * 22}%`,
              boxShadow: `0 0 8px ${i % 2 === 0 ? 'var(--gold)' : 'var(--a)'}`,
              animation: `loaderSparkle 2.4s ease-in-out infinite`,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}

        {/* TROPHY — dramatic entrance */}
        <div
          className="relative z-10"
          style={{
            opacity: 0,
            transform: 'scale(0.4) translateY(30px) rotate(-12deg)',
            animation: 'loaderTrophyIn 1s 0.15s cubic-bezier(.18,1.2,.3,1) forwards, trophyFloat 5s 1.2s ease-in-out infinite',
          }}
        >
          {/* rotating glow ring behind trophy */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 200,
              height: 200,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              border: '1px solid rgba(201,149,74,.25)',
              animation: 'loaderRingSpin 8s linear infinite',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: 160,
              height: 160,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              border: '1px dashed rgba(79,127,255,.2)',
              animation: 'loaderRingSpin 12s linear infinite reverse',
            }}
          />
          <TrophyIcon size={120} />
        </div>

        {/* TEXT — staged reveal */}
        <div className="text-center relative z-10">
          <div
            className="font-display font-bold text-5xl uppercase tracking-widest"
            style={{
              background: 'linear-gradient(135deg,#fff 20%,var(--a) 60%,var(--gold) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 100%',
              opacity: 0,
              transform: 'translateY(12px)',
              animation: 'loaderFadeUp 0.7s 0.5s ease-out forwards, loaderGradientShift 3s 1.2s ease-in-out infinite',
            }}
          >
            WEEKLY CUP
          </div>
          <div
            className="font-mono text-xs uppercase tracking-widest mt-2"
            style={{ color: 'var(--muted)', opacity: 0, transform: 'translateY(12px)', animation: 'loaderFadeUp 0.6s 0.7s ease-out forwards' }}
          >
            Custom Matches Platform
          </div>
        </div>

        {/* PROGRESS */}
        <div className="flex flex-col items-center gap-3 relative z-10" style={{ opacity: 0, transform: 'translateY(12px)', animation: 'loaderFadeUp 0.6s 0.85s ease-out forwards' }}>
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

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-10 py-36 text-center relative z-10">
        <div
          className="absolute -top-1/5 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(79,127,255,.08) 0%,rgba(139,92,246,.04) 40%,transparent 70%)' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(79,127,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(79,127,255,.03) 1px,transparent 1px)',
            backgroundSize: '80px 80px',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%,black 20%,transparent 100%)',
          }}
        />

        <div className="relative z-10 mb-7" style={{ animation: 'trophyFloat 5s ease-in-out infinite' }}>
          <TrophyIcon size={130} />
        </div>

        <div
          className="inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest px-[18px] py-1.5 rounded-full mb-9 relative z-10"
          style={{ color: 'var(--a)', border: '1px solid rgba(79,127,255,.25)', background: 'rgba(79,127,255,.06)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a)', boxShadow: '0 0 8px var(--a)' }} />
          Турнирная платформа · Кастомные матчи
        </div>

        <h1 className="font-display font-bold uppercase relative z-10" style={{ fontSize: 'clamp(56px,10vw,120px)', lineHeight: 0.92, letterSpacing: '-0.02em' }}>
          <span className="block" style={{ color: 'var(--text)' }}>
            Играй
          </span>
          <span
            className="block"
            style={{ background: 'linear-gradient(90deg,var(--a) 0%,var(--a2) 50%,var(--a3) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            На уровне
          </span>
        </h1>

        <p className="relative z-10 mt-3 mb-12 max-w-lg" style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'var(--muted)', lineHeight: 1.75 }}>
          Организованные кастомные матчи с выбором зон по adjacencyMap, голосовыми каналами Discord и живым лобби без перезагрузок.
        </p>

        <div className="flex gap-3.5 justify-center flex-wrap relative z-10">
          <Link href={user ? '/matches' : '/register'} className="btn-main">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Начать играть
          </Link>
          <Link href="/matches" className="btn-out">
            Ближайшие матчи
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* TICKER */}
      <div className="relative z-10 overflow-hidden py-3.5" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex whitespace-nowrap" style={{ animation: 'ticker 28s linear infinite' }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex">
              <TickerItem>
                <LiveDot /> <b style={{ color: 'var(--a)' }}>LIVE</b> Weekly Cup · кастомные матчи каждую неделю
              </TickerItem>
              <TickerItem>🗺️ Зоны выбираются по adjacencyMap — без хардкода</TickerItem>
              <TickerItem>🔊 Discord Voice — отдельный канал на команду</TickerItem>
              <TickerItem>🏆 Победы и достижения — в публичной ленте</TickerItem>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="px-10 py-28 relative z-10 max-w-[1240px] mx-auto">
        <Eyebrow>Как это работает</Eyebrow>
        <h2 className="font-display font-bold uppercase mb-16" style={{ fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
          От лобби<br />до победы
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-2xl overflow-hidden" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
          <HowCard num="01" icon="🎯" title="Регистрация" desc="Создай аккаунт, привяжи Static ID из игры. Профиль, достижения и история — всё в одном месте." />
          <HowCard num="02" icon="🗺️" title="Выбор матча" desc="Организатор создаёт матч — карта, зоны по adjacencyMap, режим, время старта по Москве." />
          <HowCard num="03" icon="🎮" title="Лобби" desc="Занимай место в команде, жди команды в Discord Voice, нажимай «Готовы» — и в бой." />
          <HowCard num="04" icon="🏆" title="Победа" desc="Матч завершён — победа и достижения записываются всей команде, появляются в ленте." />
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section id="features" className="px-10 pb-28 relative z-10 max-w-[1240px] mx-auto">
        <Eyebrow>Возможности</Eyebrow>
        <h2 className="font-display font-bold uppercase mb-16" style={{ fontSize: 'clamp(36px,5vw,60px)', lineHeight: 0.95, letterSpacing: '-0.01em' }}>
          Платформа<br />изнутри
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <BentoCard span={7} minH={300} tag="Realtime WebSocket" title="PUBG-лобби" desc="Живое лобби без перезагрузок. Игроки заходят, выбирают команды, организатор управляет составами." href="/matches">
            <div className="grid grid-cols-2 gap-2.5 mt-7">
              <MiniTeam name="Team 1" color="var(--a)" status="WAIT..." statusColor="var(--muted)" players={['Ghost_UA', 'ShadowK']} empty />
              <MiniTeam name="Team 2" color="var(--a2)" status="READY ✓" statusColor="var(--green)" players={['StrikeForce', 'NightOwl', 'Apex_Pro']} />
            </div>
          </BentoCard>

          <BentoCard span={5} minH={300} tag="adjacencyMap" title="Выбор зон" desc="Только смежные зоны. Граф соседства не даёт выбрать несвязанные территории." href="/maps">
            <ZoneAnimation />
          </BentoCard>

          <BentoCard span={4} minH={240} tag="WebSocket" title="Общий чат" href="/chat">
            <ChatPreview />
          </BentoCard>

          <BentoCard span={4} minH={240} tag="Discord" title="Voice каналы" desc="Каждая команда — свой канал." href="/matches">
            <div className="flex flex-col gap-2 mt-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg text-xs transition-all cursor-pointer hover:translate-x-1"
                  style={{ background: 'rgba(88,101,242,.07)', border: '1px solid rgba(88,101,242,.15)' }}
                >
                  <span className="flex items-center gap-2">
                    <span>🔊</span>
                    <span>Voice {n} — Team {n}</span>
                  </span>
                  <span className="font-mono" style={{ color: 'rgba(88,101,242,.7)', fontSize: '10px', letterSpacing: '0.06em' }}>
                    JOIN →
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard span={4} minH={240} tag="Звуковые + визуальные" title="Уведомления" href="/profile">
            <div className="flex flex-col gap-2 mt-5">
              <Notif color="#4ade80" bg="rgba(34,197,94,.06)" border="rgba(34,197,94,.15)" text="🏁 Матч начался" time="сейчас" />
              <Notif color="#c084fc" bg="rgba(139,92,246,.06)" border="rgba(139,92,246,.15)" text="📍 Финальная зона выбрана" time="21:02" />
              <Notif color="var(--gold)" bg="rgba(201,149,74,.06)" border="rgba(201,149,74,.15)" text="🏆 Победа записана" time="21:34" />
            </div>
          </BentoCard>
        </div>
      </section>

      {/* MATCHES PREVIEW — real data, fallback to placeholder */}
      <section className="px-10 py-28 relative z-10" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
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
          <Link href="/news" className="hover:text-white transition-colors">Новости</Link>
          <Link href="/media" className="hover:text-white transition-colors">Медиа</Link>
          <Link href="/maps" className="hover:text-white transition-colors">Карты</Link>
          <Link href="/complaints" className="hover:text-white transition-colors">Жалобы</Link>
        </div>
        <div className="font-mono text-[11px]" style={{ color: 'rgba(96,104,128,.4)' }}>
          © 2025 Weekly Cup
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

const SPAN_CLASSES: Record<number, string> = {
  7: 'md:col-span-7',
  5: 'md:col-span-5',
  4: 'md:col-span-4',
};

function BentoCard({
  span,
  minH,
  tag,
  title,
  desc,
  href,
  children,
}: {
  span: number;
  minH: number;
  tag: string;
  title: string;
  desc?: string;
  href: string;
  children?: React.ReactNode;
}) {
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  return (
    <Link
      href={href}
      onMouseMove={handleMouseMove}
      className={`block rounded-2xl p-8 relative overflow-hidden transition-all hover:shadow-2xl col-span-1 ${SPAN_CLASSES[span] ?? 'md:col-span-4'} group`}
      style={{
        minHeight: minH,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(79,127,255,.06),transparent 60%)' }}
      />
      <span
        className="inline-block font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full mb-5"
        style={{ color: 'var(--a)', background: 'rgba(79,127,255,.08)', border: '1px solid rgba(79,127,255,.18)' }}
      >
        {tag}
      </span>
      <div className="font-display font-semibold uppercase mb-2.5" style={{ fontSize: '22px', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {desc && (
        <p className="text-sm max-w-[340px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          {desc}
        </p>
      )}
      {children}
    </Link>
  );
}

function MiniTeam({
  name,
  color,
  status,
  statusColor,
  players,
  empty,
}: {
  name: string;
  color: string;
  status: string;
  statusColor: string;
  players: string[];
  empty?: boolean;
}) {
  return (
    <div className="rounded-lg p-3.5" style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
      <div className="font-display text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center justify-between">
        <span style={{ color }}>{name}</span>
        <span className="font-mono text-[10px]" style={{ color: statusColor }}>
          {status}
        </span>
      </div>
      {players.map((p, i) => (
        <div key={p} className="flex items-center gap-2 py-1 text-xs" style={{ borderBottom: i < players.length - 1 || empty ? '1px solid var(--border)' : 'none' }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, opacity: 1 - i * 0.2 }} />
          <span style={{ color: i === 0 ? undefined : 'var(--muted)' }}>{p}</span>
        </div>
      ))}
      {empty && (
        <div className="flex items-center gap-2 py-1 text-xs">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,.1)' }} />
          <span style={{ color: 'rgba(96,104,128,.4)', fontStyle: 'italic' }}>Свободно</span>
        </div>
      )}
    </div>
  );
}

function ChatPreview() {
  const msgs = [
    { name: 'Ghost_UA', color: 'var(--a)', text: 'Кто идёт на C зону?', initials: 'GH', bg: 'rgba(79,127,255,.2)' },
    { name: 'NightOwl', color: 'var(--a2)', text: 'Мы берём Б и Д', initials: 'NK', bg: 'rgba(139,92,246,.2)' },
    { name: 'Apex_Pro', color: 'var(--gold)', text: 'ок, встречаемся у финалки', initials: 'AP', bg: 'rgba(201,149,74,.2)' },
  ];
  return (
    <div className="flex flex-col gap-2.5 mt-5">
      {msgs.map((m) => (
        <div key={m.name} className="flex gap-2.5">
          <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: m.bg, color: m.color }}>
            {m.initials}
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wide mb-0.5" style={{ color: m.color }}>
              {m.name}
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {m.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Notif({ color, bg, border, text, time }: { color: string; bg: string; border: string; text: string; time: string }) {
  return (
    <div className="px-4 py-2.5 rounded-lg text-xs flex items-center gap-2.5 transition-transform hover:translate-x-1" style={{ background: bg, border: `1px solid ${border}`, color }}>
      {text}
      <span className="ml-auto font-mono text-[9px] opacity-50">{time}</span>
    </div>
  );
}

function MatchRow({ match }: { match: MatchSummary }) {
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
          {match.map?.name ?? 'Карта'} — Weekly Cup
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
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
        >
          {win.user.username.slice(0, 2).toUpperCase()}
        </div>
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
