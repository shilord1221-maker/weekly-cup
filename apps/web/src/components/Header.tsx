'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function Header() {
  const [stuck, setStuck] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const router = useRouter();

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
    { href: '/matches', label: 'Матчи' },
    { href: '/#features', label: 'Возможности' },
    { href: '/wins', label: 'Победы' },
    { href: '/news', label: 'Новости' },
  ];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between transition-all duration-300"
        style={{
          padding: stuck ? '14px 48px' : '22px 48px',
          background: stuck ? 'rgba(5,7,15,0.88)' : 'transparent',
          backdropFilter: stuck ? 'blur(24px) saturate(160%)' : 'none',
          borderBottom: stuck ? '1px solid var(--border)' : '1px solid transparent',
        }}
      >
        <Link href="/" className="font-display font-bold text-xl uppercase tracking-wider flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: 'var(--a)', boxShadow: '0 0 12px var(--a)', animation: 'pulse 2s ease-in-out infinite' }}
          />
          WEEKLY <span style={{ color: 'var(--a)' }}>&nbsp;CUP</span>
        </Link>

        <nav className="hidden md:flex items-center gap-9">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="h-btn">
                {user.username}
              </Link>
              {(user.role === 'ADMIN' || user.role === 'ORGANIZER') && (
                <Link href="/admin" className="h-btn">
                  Админка
                </Link>
              )}
              <button onClick={handleLogout} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="h-btn">
                Войти
              </Link>
              <Link href="/register" className="hbtn-fill">
                Начать играть
              </Link>
            </div>
          )}
        </nav>

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
        {user ? (
          <>
            <Link href="/profile" onClick={() => setMobileOpen(false)} className="mt-5" style={{ color: 'var(--a)' }}>
              Профиль ({user.username})
            </Link>
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
