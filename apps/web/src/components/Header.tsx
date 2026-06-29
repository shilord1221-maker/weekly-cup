'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';
import { Avatar } from '@/components/Avatar';
import { TokenIcon } from '@/components/TokenIcon';

export function Header() {
  const [stuck, setStuck] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    router.push('/');
  };

  const navLinks = [
    { href: '/', label: 'Главная' },
    { href: '/matches', label: 'Матчи' },
    { href: '/media', label: 'Медиа' },
    { href: '/complaints', label: 'Жалобы' },
    { href: '/wins', label: 'Победы', special: true },
    { href: '/stacks', label: 'Стаки' },
    { href: '/social', label: 'Соцсети' },
    { href: '/maps', label: 'Карты' },
  ] as { href: string; label: string; special?: boolean }[];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between transition-all duration-300"
        style={{ padding: stuck ? '14px 24px' : '20px 24px' }}
      >
        {/* HOME BUTTON */}
        <Link
          href="/"
          className="hidden md:flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20"
          style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--text)' }}
          aria-label="Главная"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>

        {/* MOBILE LOGO (visible only on small screens, replaces home button) */}
        <Link href="/" className="md:hidden font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <img src="/branding/logo.png" alt="Weekly Pracs" className="w-6 h-6 object-contain" />
          WEEKLY <span style={{ color: 'var(--a)' }}>PRACS</span>
        </Link>

        {/* CENTER PILL NAV */}
        <nav
          className="hidden md:flex items-center gap-1 rounded-full px-1.5 py-1.5 absolute left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(8,13,26,.7)', border: '1px solid var(--border2)', backdropFilter: 'blur(20px)' }}
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            if (link.special) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 rounded-full wins-nav-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: isActive ? '1px solid rgba(201,149,74,.35)' : '1px solid transparent',
                    background: isActive ? 'rgba(201,149,74,.08)' : 'transparent',
                    transition: 'border-color .2s, background .2s',
                  }}
                >
                  {/* Корона */}
                  <svg
                    width="13" height="9" viewBox="0 0 14 10" fill="none"
                    className="absolute left-1/2 wins-crown"
                    style={{ top: '-9px', transform: 'translateX(-50%)', pointerEvents: 'none' }}
                  >
                    <path d="M1 9L3.5 2L7 6L10.5 2L13 9H1Z" fill="url(#cg)" stroke="rgba(201,149,74,.5)" strokeWidth="0.5"/>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="14" y2="10" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#fde68a"/>
                        <stop offset="50%" stopColor="#f59e0b"/>
                        <stop offset="100%" stopColor="#d97706"/>
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Искры — только 2, очень тонкие */}
                  <span className="wins-spark wins-spark-1" />
                  <span className="wins-spark wins-spark-3" />

                  {/* Текст — всегда золотой градиент */}
                  <span className="text-sm font-semibold wins-text" style={{ position: 'relative', zIndex: 1 }}>
                    Победы
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium px-4 py-2 rounded-full transition-all"
                style={{
                  color: isActive ? '#0a0d16' : 'var(--muted)',
                  background: isActive ? '#fff' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="text-sm font-medium px-4 py-2 rounded-full transition-all flex items-center gap-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Режимы
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setMoreOpen(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 rounded-xl py-2 z-[100] min-w-[160px]" style={{ background: 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 16px 40px rgba(0,0,0,.4)' }}>
                  <Link href="/matches" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>
                    🎮 Weekly Pracs
                  </Link>
                  <Link href="/gfc" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>
                    ⚔️ GFC
                  </Link>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/shop"
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20 relative"
            style={{ border: '1px solid rgba(201,149,74,.35)', background: 'rgba(201,149,74,.08)', backdropFilter: 'blur(20px)' }}
            aria-label="Магазин токенов"
            title="Магазин токенов"
          >
            <TokenIcon size={32} />
          </Link>
          <Link
            href="/settings"
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20"
            style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--muted)' }}
            title="Мои настройки / карточка игрока"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </Link>
          <Link
            href="/rules"
            className="flex items-center justify-center h-11 px-4 rounded-full text-sm font-medium transition-all hover:border-white/20"
            style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--muted)' }}
          >
            Правила
          </Link>
          <Link
            href="/social"
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20"
            style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--muted)' }}
            aria-label="Соцсети"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/>
              <line x1="9" y1="9" x2="9" y2="9"/><line x1="12" y1="9" x2="12" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/>
            </svg>
          </Link>

          {isOrganizerOrAbove(user?.role) && (
            <Link
              href="/admin"
              className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20"
              style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--muted)' }}
              aria-label="Админка"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{ background: 'rgba(8,13,26,.7)', border: '1px solid var(--border2)', backdropFilter: 'blur(20px)', color: 'var(--text)' }}
              >
                <Avatar username={user.username} avatarUrl={user.avatarUrl} size={28} />
                {user.username}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium px-3 py-2 transition-colors hover:text-white"
                style={{ color: 'var(--muted)' }}
              >
                Выйти
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 pl-5 pr-1.5 py-1.5 rounded-full text-sm font-semibold transition-all hover:gap-3"
              style={{ background: '#0a0d16', border: '1px solid var(--border2)', color: '#fff' }}
            >
              ВОЙТИ
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: 'var(--a)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        <button className="md:hidden flex flex-col gap-1.5 p-1" onClick={() => setMobileOpen(true)} aria-label="Меню">
          <span className="block w-[22px] h-0.5 rounded" style={{ background: 'var(--text)' }} />
          <span className="block w-[22px] h-0.5 rounded" style={{ background: 'var(--text)' }} />
          <span className="block w-[22px] h-0.5 rounded" style={{ background: 'var(--text)' }} />
        </button>
      </header>

      {/* MOBILE NAV */}
      <div
        className="fixed inset-0 z-[150] transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none' }}
        onClick={() => setMobileOpen(false)}
      />
      <nav
        className="fixed top-0 right-0 bottom-0 z-[200] flex flex-col p-9 pt-20 transition-transform duration-400"
        style={{
          width: 'min(300px,100vw)',
          background: 'rgba(5,7,15,0.97)',
          borderLeft: '1px solid var(--border)',
          transform: mobileOpen ? 'none' : 'translateX(100%)',
        }}
      >
        <button className="absolute top-5 right-6 text-2xl" style={{ color: 'var(--muted)' }} onClick={() => setMobileOpen(false)}>
          ✕
        </button>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className="font-display text-2xl font-semibold uppercase py-3.5"
            style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/gfc"
          onClick={() => setMobileOpen(false)}
          className="font-display text-2xl font-semibold uppercase py-3.5"
          style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
        >
          ⚔️ GFC
        </Link>
        <Link
          href="/rules"
          onClick={() => setMobileOpen(false)}
          className="font-display text-2xl font-semibold uppercase py-3.5"
          style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
        >
          Правила
        </Link>
        <div
          className="flex items-center gap-2 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="font-display text-2xl font-semibold uppercase" style={{ color: 'rgba(96,104,128,.5)' }}>
            Режимы
          </span>
          <span
            className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full"
            style={{ color: 'var(--gold)', background: 'rgba(201,149,74,.12)' }}
          >
            скоро
          </span>
        </div>
        {user ? (
          <>
            <Link href="/profile" onClick={() => setMobileOpen(false)} className="mt-5" style={{ color: 'var(--a)' }}>
              Профиль ({user.username})
            </Link>
            {isOrganizerOrAbove(user.role) && (
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="mt-3" style={{ color: 'var(--a)' }}>
                Админка
              </Link>
            )}
            <button onClick={handleLogout} className="mt-3 text-left" style={{ color: 'var(--muted)' }}>
              Выйти
            </button>
          </>
        ) : (
          <Link href="/login" onClick={() => setMobileOpen(false)} className="mt-5" style={{ color: 'var(--a)' }}>
            Войти
          </Link>
        )}
      </nav>
    </>
  );
}
