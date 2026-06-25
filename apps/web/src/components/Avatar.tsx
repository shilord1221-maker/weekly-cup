'use client';

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Единая аватарка для всего сайта — картинка, если она одобрена и есть, иначе инициалы
 * на градиентном фоне. Раньше каждое место (хедер, лобби, чат, профиль) рисовало это
 * своим собственным куском кода, из-за чего аватарка реально показывалась только
 * в одном-двух местах, а не везде. Теперь это один компонент.
 */
export function Avatar({ username, avatarUrl, size = 32, className = '' }: AvatarProps) {
  const fontSize = Math.max(9, Math.round(size * 0.32));

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize, background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}
