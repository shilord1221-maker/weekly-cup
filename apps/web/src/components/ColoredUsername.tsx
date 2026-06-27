'use client';

export interface CosmeticItem {
  key: string;
  name: string;
  price: number;
  type: string;
  color?: string;
  gradient?: string;
  preview: string;
}

/** Возвращает инлайн-стиль для имени пользователя на основе ключа эффекта */
export function getUsernameStyle(effectKey: string | null | undefined): React.CSSProperties {
  if (!effectKey) return {};

  // Список эффектов (дублируем на фронте чтобы не делать запрос к API)
  const EFFECTS: Record<string, { color?: string; gradient?: string }> = {
    COLOR_BLUE:   { color: '#4f7fff' },
    COLOR_RED:    { color: '#ef4444' },
    COLOR_GREEN:  { color: '#22c55e' },
    COLOR_CYAN:   { color: '#06b6d4' },
    COLOR_PURPLE: { color: '#8b5cf6' },
    COLOR_PINK:   { color: '#ec4899' },
    COLOR_GOLD:   { color: '#f59e0b' },
    COLOR_WHITE:  { color: '#ffffff' },
    GRADIENT_FIRE:    { gradient: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)' },
    GRADIENT_ICE:     { gradient: 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)' },
    GRADIENT_GOLD:    { gradient: 'linear-gradient(90deg,#fde68a,#f59e0b,#d97706)' },
    GRADIENT_TOXIC:   { gradient: 'linear-gradient(90deg,#4ade80,#a3e635,#facc15)' },
    GRADIENT_GALAXY:  { gradient: 'linear-gradient(90deg,#8b5cf6,#4f7fff,#ec4899)' },
    GRADIENT_SUNSET:  { gradient: 'linear-gradient(90deg,#f97316,#ec4899,#8b5cf6)' },
    GRADIENT_RAINBOW: { gradient: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24,#22c55e,#4f7fff,#8b5cf6)' },
    GRADIENT_PRACS:   { gradient: 'linear-gradient(90deg,#4f7fff,#8b5cf6,#f59e0b)' },
  };

  const e = EFFECTS[effectKey];
  if (!e) return {};

  if (e.gradient) {
    return {
      background: e.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };
  }
  return { color: e.color };
}

interface Props {
  username: string;
  effectKey?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

/** Рендерит имя пользователя с активным эффектом цвета/градиента */
export function ColoredUsername({ username, effectKey, className, style }: Props) {
  const effectStyle = getUsernameStyle(effectKey);
  return (
    <span className={className} style={{ ...effectStyle, ...style }}>
      {username}
    </span>
  );
}
