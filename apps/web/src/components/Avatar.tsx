'use client';

// Маппинг ключ рамки → путь к PNG
const FRAME_URLS: Record<string, string> = {
  FRAME_WINGS_PURPLE: '/frames/wings-purple.png',
  FRAME_FIRE:         '/frames/fire.png',
  FRAME_GOLD:         '/frames/gold.png',
};

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  frameKey?: string | null;
}

export function Avatar({ username, avatarUrl, size = 32, className = '', frameKey }: AvatarProps) {
  const fontSize = Math.max(9, Math.round(size * 0.32));
  const frameUrl = frameKey ? FRAME_URLS[frameKey] : null;

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username}
      className="rounded-full object-cover w-full h-full"
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white w-full h-full"
      style={{ fontSize, background: 'linear-gradient(135deg,var(--a),var(--a2))' }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );

  if (frameUrl) {
    // Рамка накладывается поверх аватара — PNG с прозрачным центром
    // Рамка на 40% больше аватара чтобы выходить за края
    const frameSize = Math.round(size * 1.8);
    const offset = Math.round((frameSize - size) / 2);
    return (
      <div
        className={`relative inline-flex flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {inner}
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
            zIndex: 2,
          }}
        />
      </div>
    );
  }

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
