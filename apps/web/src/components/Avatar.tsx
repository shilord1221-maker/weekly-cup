'use client';

const FRAME_URLS: Record<string, string> = {
  FRAME_WINGS_PURPLE: '/frames/wings-purple.png',
  FRAME_FIRE:         '/frames/fire.png',
  FRAME_GOLD:         '/frames/gold.png',
};

// Минимальный размер аватара для показа рамки
const FRAME_MIN_SIZE = 40;

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  frameKey?: string | null;
}

export function Avatar({ username, avatarUrl, size = 32, className = '', frameKey }: AvatarProps) {
  const fontSize = Math.max(9, Math.round(size * 0.32));
  const frameUrl = (frameKey && size >= FRAME_MIN_SIZE) ? FRAME_URLS[frameKey] : null;

  const avatarContent = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <div
      className="flex items-center justify-center font-bold text-white w-full h-full"
      style={{ fontSize, background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );

  if (frameUrl) {
    // Крылья PNG: внутреннее кольцо занимает ~52% ширины.
    // Чтобы кольцо = аватарке: frameSize = size / 0.52
    const frameSize = Math.round(size / 0.52);
    const offset = Math.round((frameSize - size) / 2);

    return (
      <div
        className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Аватар в круглом контейнере */}
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {avatarContent}
        </div>

        {/* Рамка поверх — mix-blend-mode:screen делает чёрные пиксели прозрачными */}
        <img
          src={frameUrl}
          alt=""
          style={{
            position: 'absolute',
            width: frameSize,
            height: frameSize,
            top: -offset,
            left: -offset,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      </div>
    );
  }

  // Без рамки — обычная аватарка
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
