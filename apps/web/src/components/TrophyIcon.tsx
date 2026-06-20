'use client';

/**
 * Золотой кубок-трофей с лавровыми ветками — оригинальная SVG-иллюстрация
 * для акцента на лендинге (вдохновлена премиальными игровыми наградами,
 * не копирует конкретное чужое изображение).
 */
export function TrophyIcon({ size = 140 }: { size?: number }) {
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* glow behind trophy */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(201,149,74,.35) 0%, transparent 70%)',
          filter: 'blur(20px)',
          transform: 'scale(1.4)',
        }}
      />
      <svg viewBox="0 0 200 200" width={size} height={size} className="relative z-10" style={{ filter: 'drop-shadow(0 12px 30px rgba(201,149,74,.35))' }}>
        <defs>
          <linearGradient id="goldBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="35%" stopColor="#f0c25e" />
            <stop offset="65%" stopColor="#c9954a" />
            <stop offset="100%" stopColor="#8a6324" />
          </linearGradient>
          <linearGradient id="goldLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe9b0" />
            <stop offset="50%" stopColor="#d4a847" />
            <stop offset="100%" stopColor="#9a7430" />
          </linearGradient>
          <linearGradient id="woodShelf" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a9784f" />
            <stop offset="100%" stopColor="#6b4a30" />
          </linearGradient>
        </defs>

        {/* left laurel branch */}
        <g opacity="0.95">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse
              key={`l-${i}`}
              cx={62 - i * 9}
              cy={120 - i * 13}
              rx="9"
              ry="5"
              fill="url(#goldLeaf)"
              transform={`rotate(${-35 - i * 6} ${62 - i * 9} ${120 - i * 13})`}
            />
          ))}
          <path d="M70 130 Q 40 110 22 70" stroke="#9a7430" strokeWidth="2.5" fill="none" opacity="0.6" />
        </g>

        {/* right laurel branch */}
        <g opacity="0.95">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse
              key={`r-${i}`}
              cx={138 + i * 9}
              cy={120 - i * 13}
              rx="9"
              ry="5"
              fill="url(#goldLeaf)"
              transform={`rotate(${35 + i * 6} ${138 + i * 9} ${120 - i * 13})`}
            />
          ))}
          <path d="M130 130 Q 160 110 178 70" stroke="#9a7430" strokeWidth="2.5" fill="none" opacity="0.6" />
        </g>

        {/* shelf */}
        <rect x="38" y="172" width="124" height="10" rx="2" fill="url(#woodShelf)" />
        <rect x="38" y="172" width="124" height="3" rx="1.5" fill="#c9966a" opacity="0.5" />

        {/* trophy stem + base */}
        <rect x="92" y="150" width="16" height="22" fill="url(#goldBody)" />
        <rect x="80" y="168" width="40" height="8" rx="2" fill="url(#goldBody)" />
        <rect x="84" y="158" width="32" height="6" rx="3" fill="#f0c25e" />

        {/* trophy cup */}
        <path d="M62 48 H138 L130 100 Q126 128 100 130 Q74 128 70 100 Z" fill="url(#goldBody)" />
        <path d="M62 48 H138 L135 60 H65 Z" fill="#fff3d6" opacity="0.55" />

        {/* handles */}
        <path d="M62 56 Q34 56 34 80 Q34 100 60 98" stroke="url(#goldLeaf)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M138 56 Q166 56 166 80 Q166 100 140 98" stroke="url(#goldLeaf)" strokeWidth="9" fill="none" strokeLinecap="round" />

        {/* rim highlight */}
        <ellipse cx="100" cy="48" rx="38" ry="7" fill="#fff7e0" opacity="0.7" />

        {/* star/sparkle accents */}
        <g fill="#fff3d6" opacity="0.9">
          <circle cx="100" cy="78" r="2" />
          <circle cx="86" cy="92" r="1.5" />
          <circle cx="114" cy="92" r="1.5" />
        </g>
      </svg>
    </div>
  );
}
