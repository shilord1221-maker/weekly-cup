export interface CosmeticItem {
  key: string;
  name: string;
  description: string;
  price: number;
  type: 'username' | 'frame' | 'profile';
  color?: string;
  gradient?: string;
  preview: string;
  frameUrl?: string;   // путь к PNG рамки (type === 'frame')
}

export const COSMETICS_CATALOG: CosmeticItem[] = [
  // ── Цветные ники ──
  { key: 'COLOR_BLUE',   name: 'Синий ник',      description: 'Синий цвет имени',    price: 200, type: 'username', color: '#4f7fff', preview: '#4f7fff' },
  { key: 'COLOR_RED',    name: 'Красный ник',    description: 'Красный цвет имени',  price: 200, type: 'username', color: '#ef4444', preview: '#ef4444' },
  { key: 'COLOR_GREEN',  name: 'Зелёный ник',    description: 'Зелёный цвет имени',  price: 200, type: 'username', color: '#22c55e', preview: '#22c55e' },
  { key: 'COLOR_CYAN',   name: 'Голубой ник',    description: 'Голубой цвет имени',  price: 200, type: 'username', color: '#06b6d4', preview: '#06b6d4' },
  { key: 'COLOR_PURPLE', name: 'Фиолетовый ник', description: 'Фиолетовый цвет',     price: 250, type: 'username', color: '#8b5cf6', preview: '#8b5cf6' },
  { key: 'COLOR_PINK',   name: 'Розовый ник',    description: 'Розовый цвет имени',  price: 250, type: 'username', color: '#ec4899', preview: '#ec4899' },
  { key: 'COLOR_GOLD',   name: 'Золотой ник',    description: 'Золотой цвет имени',  price: 300, type: 'username', color: '#f59e0b', preview: '#f59e0b' },

  // ── Градиентные ники ──
  { key: 'GRADIENT_FIRE',    name: 'Огонь 🔥',        description: 'Красно-оранжевый градиент',       price: 400,  type: 'username', gradient: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)', preview: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)' },
  { key: 'GRADIENT_ICE',     name: 'Лёд ❄️',          description: 'Голубой градиент',                price: 400,  type: 'username', gradient: 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)', preview: 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)' },
  { key: 'GRADIENT_GOLD',    name: 'Золото ✨',        description: 'Золотой градиент',                price: 500,  type: 'username', gradient: 'linear-gradient(90deg,#fde68a,#f59e0b,#d97706)', preview: 'linear-gradient(90deg,#fde68a,#f59e0b,#d97706)' },
  { key: 'GRADIENT_TOXIC',   name: 'Токсик ☢️',       description: 'Зелёный токсичный',               price: 500,  type: 'username', gradient: 'linear-gradient(90deg,#4ade80,#a3e635,#facc15)', preview: 'linear-gradient(90deg,#4ade80,#a3e635,#facc15)' },
  { key: 'GRADIENT_GALAXY',  name: 'Галактика 🌌',    description: 'Космический градиент',            price: 700,  type: 'username', gradient: 'linear-gradient(90deg,#8b5cf6,#4f7fff,#ec4899)', preview: 'linear-gradient(90deg,#8b5cf6,#4f7fff,#ec4899)' },
  { key: 'GRADIENT_SUNSET',  name: 'Закат 🌅',        description: 'Тёплый градиент заката',          price: 700,  type: 'username', gradient: 'linear-gradient(90deg,#f97316,#ec4899,#8b5cf6)', preview: 'linear-gradient(90deg,#f97316,#ec4899,#8b5cf6)' },
  { key: 'GRADIENT_RAINBOW', name: 'Радуга 🌈',       description: 'Все цвета радуги',                price: 800,  type: 'username', gradient: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24,#22c55e,#4f7fff,#8b5cf6)', preview: 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24,#22c55e,#4f7fff,#8b5cf6)' },
  { key: 'GRADIENT_PRACS',   name: 'Weekly Pracs 🏆', description: 'Эксклюзивный градиент платформы', price: 1000, type: 'username', gradient: 'linear-gradient(90deg,#4f7fff,#8b5cf6,#f59e0b)', preview: 'linear-gradient(90deg,#4f7fff,#8b5cf6,#f59e0b)' },

  // ── Рамки аватара ──
  { key: 'FRAME_WINGS_PURPLE', name: 'Крылья 🪽', description: 'Фиолетовые крылья вокруг аватара', price: 800, type: 'frame', frameUrl: '/frames/wings-purple.png', preview: '/frames/wings-purple.png' },
];

export const CATALOG_BY_KEY = new Map(COSMETICS_CATALOG.map((c) => [c.key, c]));

export const TOKENS_PER_WIN = 50; // токенов за победу
