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

// Маппинг ключа эффекта → CSS-класс для градиентов
const GRADIENT_CLASSES: Record<string, string> = {
  GRADIENT_FIRE:    'ug-fire',
  GRADIENT_ICE:     'ug-ice',
  GRADIENT_GOLD:    'ug-gold',
  GRADIENT_TOXIC:   'ug-toxic',
  GRADIENT_GALAXY:  'ug-galaxy',
  GRADIENT_SUNSET:  'ug-sunset',
  GRADIENT_RAINBOW: 'ug-rainbow',
  GRADIENT_PRACS:   'ug-pracs',
};

const COLOR_STYLES: Record<string, string> = {
  COLOR_BLUE:   '#4f7fff',
  COLOR_RED:    '#ef4444',
  COLOR_GREEN:  '#22c55e',
  COLOR_CYAN:   '#06b6d4',
  COLOR_PURPLE: '#8b5cf6',
  COLOR_PINK:   '#ec4899',
  COLOR_GOLD:   '#f59e0b',
};

export function isGradientEffect(effectKey: string | null | undefined): boolean {
  return !!effectKey && effectKey in GRADIENT_CLASSES;
}

export function getGradientClass(effectKey: string | null | undefined): string {
  return effectKey ? (GRADIENT_CLASSES[effectKey] ?? '') : '';
}

/** Возвращает инлайн-стиль ТОЛЬКО для цветных (не градиентных) эффектов */
export function getUsernameStyle(effectKey: string | null | undefined): React.CSSProperties {
  if (!effectKey) return {};
  if (effectKey in GRADIENT_CLASSES) return {}; // градиенты — через CSS класс
  const color = COLOR_STYLES[effectKey];
  return color ? { color } : {};
}

interface Props {
  username: string;
  effectKey?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

/** Рендерит имя пользователя с активным эффектом цвета/градиента */
export function ColoredUsername({ username, effectKey, className, style }: Props) {
  const gradientClass = getGradientClass(effectKey);
  const colorStyle = getUsernameStyle(effectKey);
  return (
    <span
      className={[gradientClass, className].filter(Boolean).join(' ')}
      style={{ ...colorStyle, ...style }}
    >
      {username}
    </span>
  );
}
