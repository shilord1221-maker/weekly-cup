'use client';

const FRAME_URLS: Record<string, string> = {
  FRAME_WINGS_PURPLE: '/frames/wings-purple.png',
  FRAME_FIRE:         '/frames/fire.png',
  FRAME_GOLD:         '/frames/gold.png',
};

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
    // PNG 1024×1024, прозрачный круг ≈ 50% ширины → frameSize = size / 0.50
    // Контейнер = размер всей рамки, аватарка центрируется внутри
    // Нет проблем с overflow clipping — ничего не выходит за границы
    const frameSize = Math.round(size / 0.62);
    const avatarOffset = Math.round((frameSize - size) / 2);

    return (
      <div
        className={`relative flex-shrink-0 ${className}`}
        style={{ width: frameSize, height: frameSize, display: 'inline-block' }}
      >
        {/* Аватарка по центру, под рамкой */}
        <div
          style={{
            position: 'absolute',
            top: avatarOffset,
            left: avatarOffset,
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          {avatarContent}
        </div>

        {/* Рамка поверх, заполняет весь контейнер */}
        <img
          src={frameUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: frameSize,
            height: frameSize,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </div>
    );
  }

  // Без рамки
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
