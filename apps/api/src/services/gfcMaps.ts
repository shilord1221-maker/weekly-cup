export interface GfcMap {
  key: string;
  name: string;
  imageUrl: string;
}

export const GFC_MAPS: GfcMap[] = [
  { key: 'tattoo',   name: 'Тату',     imageUrl: '/gfc-maps/tattoo.jpg'   },
  { key: 'sandy',    name: 'Сэндик',   imageUrl: '/gfc-maps/sandy.jpg'    },
  { key: 'mexico',   name: 'Мексы',    imageUrl: '/gfc-maps/mexico.jpg'   },
  { key: 'shop247',  name: '24/7',     imageUrl: '/gfc-maps/shop247.jpg'  },
  { key: 'trailers', name: 'Трейлера', imageUrl: '/gfc-maps/trailers.jpg' },
  { key: 'farm',     name: 'Ферма',    imageUrl: '/gfc-maps/farm.jpg'     },
];

export const GFC_MAP_KEYS = new Set(GFC_MAPS.map((m) => m.key));
export const GFC_MAP_BY_KEY = new Map(GFC_MAPS.map((m) => [m.key, m]));

// Порядок банов: 1-2-1-2 (по 2 каждой команде)
export const BAN_ORDER = [1, 2, 1, 2];
export const TOTAL_BANS = 4;

// Раунды: 1-2 команда 1 атакует, 3-4 команда 2 атакует, 5 — решающий
export function getRoundConfig(roundNum: number, team1Side: 'ATTACK' | 'DEFENSE') {
  // Первые 2 раунда: team1 на своей стороне
  // Следующие 2: стороны меняются
  // 5й: рандом (передаётся как есть)
  if (roundNum <= 2) return { team1Role: team1Side };
  if (roundNum <= 4) return { team1Role: team1Side === 'ATTACK' ? 'DEFENSE' : 'ATTACK' };
  return { team1Role: team1Side }; // 5й решающий — организатор задаёт
}
