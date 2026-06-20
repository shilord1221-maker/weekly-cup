'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, isOrganizerOrAbove } from '@/store/auth';

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
    { href: '/wins', label: 'Победы' },
    { href: '/news', label: 'Новости' },
  ];

  const moreLinks = [
    { href: '/media', label: 'Медиа' },
    { href: '/maps', label: 'Карты' },
    { href: '/rules', label: 'Правила' },
    { href: '/complaints', label: 'Жалобы' },
  ];

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
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--a)', boxShadow: '0 0 10px var(--a)' }} />
          WEEKLY <span style={{ color: 'var(--a)' }}>CUP</span>
        </Link>

        {/* CENTER PILL NAV */}
        <nav
          className="hidden md:flex items-center gap-1 rounded-full px-1.5 py-1.5 absolute left-1/2 -translate-x-1/2"
          style={{ background: 'rgba(8,13,26,.7)', border: '1px solid var(--border2)', backdropFilter: 'blur(20px)' }}
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
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
              className="text-sm font-medium px-4 py-2 rounded-full transition-all flex items-center gap-1"
              style={{ color: 'var(--muted)' }}
            >
              Ещё
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setMoreOpen(false)} />
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 rounded-xl py-2 z-[100] min-w-[160px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 16px 40px rgba(0,0,0,.4)' }}
                >
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className="block px-4 py-2.5 text-sm transition-colors hover:text-white"
                      style={{ color: 'var(--muted)' }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-3">
          {user && (
            <button
              className="flex items-center justify-center w-11 h-11 rounded-full transition-all hover:border-white/20"
              style={{ border: '1px solid var(--border2)', background: 'rgba(8,13,26,.7)', backdropFilter: 'blur(20px)', color: 'var(--muted)' }}
              aria-label="Уведомления"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          )}

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
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,var(--a),var(--a2))', color: '#fff' }}
                >
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
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
        {moreLinks.map((link) => (
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
