import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ───────── OWNER USER ─────────
  // Защита от случайного удаления: upsert никогда не удаляет существующую запись,
  // повторный запуск seed безопасен и не пересоздаёт/не сбрасывает аккаунт.
  const ownerPassword = await argon2.hash('Owner123!');
  const owner = await prisma.user.upsert({
    where: { email: 'owner@weeklycup.gg' },
    update: {},
    create: {
      username: 'owner',
      email: 'owner@weeklycup.gg',
      passwordHash: ownerPassword,
      role: 'OWNER',
      staticId: { create: { value: '00001' } },
    },
  });
  console.log('Owner created:', owner.username);

  // ───────── ADMIN USER ─────────
  const adminPassword = await argon2.hash('Admin123!');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@weeklycup.gg' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@weeklycup.gg',
      passwordHash: adminPassword,
      role: 'ADMIN',
      staticId: { create: { value: '00002' } },
    },
  });
  console.log('Admin created:', admin.username);

  // ───────── ORGANIZER USER ─────────
  const orgPassword = await argon2.hash('Organizer123!');
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@weeklycup.gg' },
    update: {},
    create: {
      username: 'organizer',
      email: 'organizer@weeklycup.gg',
      passwordHash: orgPassword,
      role: 'ORGANIZER',
      staticId: { create: { value: '00003' } },
    },
  });
  console.log('Organizer created:', organizer.username);

  // ───────── REAL MAPS — 10 карт с зонами и adjacencyMap ─────────
  // Зоны строятся как сетка нужного размера. Названия — чистые цвета на русском (без привязки к стороне карты).
  const mapsConfig: { name: string; imageUrl: string; gridCols: number; gridRows: number; zoneNames: string[] }[] = [
    {
      name: 'Industrial',
      imageUrl: '/maps/industrial.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Красная', 'Голубая', 'Зелёная', 'Жёлтая', 'Фиолетовая', 'Синяя'],
    },
    {
      name: 'Mirror',
      imageUrl: '/maps/mirror.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Голубая', 'Розовая', 'Красная', 'Зелёная', 'Синяя', 'Жёлтая'],
    },
    {
      name: 'Sandy Shores',
      imageUrl: '/maps/sandy-shores.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Жёлтая', 'Голубая', 'Синяя', 'Фиолетовая', 'Красная', 'Зелёная'],
    },
    {
      name: 'Vinewood',
      imageUrl: '/maps/vinewood.jpg',
      gridCols: 4,
      gridRows: 2,
      zoneNames: ['Красная', 'Жёлтая', 'Розовая', 'Фиолетовая', 'Голубая', 'Оранжевая', 'Зелёная', 'Синяя'],
    },
    {
      name: 'City',
      imageUrl: '/maps/city.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Синяя', 'Розовая', 'Голубая', 'Малиновая', 'Оранжевая', 'Зелёная'],
    },
    {
      name: 'Farm',
      imageUrl: '/maps/farm.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Оранжевая', 'Розовая', 'Голубая', 'Синяя', 'Зелёная', 'Красная'],
    },
    {
      name: 'Ghetto',
      imageUrl: '/maps/ghetto.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Красная', 'Голубая', 'Жёлтая', 'Розовая', 'Зелёная', 'Фиолетовая', 'Оранжевая', 'Синяя', 'Малиновая'],
    },
    {
      name: 'Vineyards',
      imageUrl: '/maps/vineyards.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Фиолетовая', 'Розовая', 'Оранжевая', 'Тёмно-оранжевая', 'Жёлтая', 'Голубая', 'Коричневая', 'Синяя', 'Бирюзовая'],
    },
    {
      name: 'Windmill',
      imageUrl: '/maps/windmill.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Оранжевая', 'Голубая', 'Розовая', 'Фиолетовая', 'Коричневая', 'Синяя', 'Зелёная', 'Жёлтая', 'Красная'],
    },
    {
      name: 'Redwood',
      imageUrl: '/maps/redwood.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Красная', 'Жёлтая', 'Синяя', 'Голубая', 'Розовая', 'Зелёная', 'Коричневая', 'Фиолетовая', 'Оранжевая'],
    },
  ];

  for (const cfg of mapsConfig) {
    const existing = await prisma.gameMap.findFirst({ where: { name: cfg.name }, include: { zones: true } });

    if (existing) {
      // Сортируем зоны по координатам (row, col) — это надёжно восстанавливает исходный порядок создания,
      // так как зоны создавались последовательно по индексу row*gridCols+col. Zone не имеет поля createdAt.
      const sortedZones = [...existing.zones].sort((a, b) => {
        const ca = (a.coordinates as { row: number; col: number } | null) ?? { row: 0, col: 0 };
        const cb = (b.coordinates as { row: number; col: number } | null) ?? { row: 0, col: 0 };
        return ca.row * 1000 + ca.col - (cb.row * 1000 + cb.col);
      });
      // Карта уже есть — обновляем названия зон на актуальные по порядку координат,
      // не трогая adjacencyMap/координаты, чтобы не сломать уже созданные матчи.
      for (let i = 0; i < sortedZones.length && i < cfg.zoneNames.length; i++) {
        if (sortedZones[i].name !== cfg.zoneNames[i]) {
          await prisma.zone.update({ where: { id: sortedZones[i].id }, data: { name: cfg.zoneNames[i] } });
        }
      }
      console.log(`Map "${cfg.name}" already exists — zone names refreshed`);
      continue;
    }

    const map = await prisma.gameMap.create({
      data: { name: cfg.name, imageUrl: cfg.imageUrl, isActive: true },
    });

    const total = cfg.gridCols * cfg.gridRows;
    const created: { id: string; idx: number }[] = [];
    for (let i = 0; i < total; i++) {
      const zone = await prisma.zone.create({
        data: {
          mapId: map.id,
          name: cfg.zoneNames[i] ?? `Зона ${i + 1}`,
          coordinates: { row: Math.floor(i / cfg.gridCols), col: i % cfg.gridCols },
        },
      });
      created.push({ id: zone.id, idx: i });
    }

    // adjacencyMap по сетке: соседи сверху/снизу/слева/справа (используется только для совместимости старых данных;
    // выбор зон при создании матча больше не ограничивается соседством по требованию)
    for (const { id, idx } of created) {
      const row = Math.floor(idx / cfg.gridCols);
      const col = idx % cfg.gridCols;
      const neighborIdxs: number[] = [];
      if (row > 0) neighborIdxs.push(idx - cfg.gridCols);
      if (row < cfg.gridRows - 1) neighborIdxs.push(idx + cfg.gridCols);
      if (col > 0) neighborIdxs.push(idx - 1);
      if (col < cfg.gridCols - 1) neighborIdxs.push(idx + 1);

      const adjacentIds = created.filter((c) => neighborIdxs.includes(c.idx)).map((c) => c.id);
      await prisma.zone.update({ where: { id }, data: { adjacentIds } });
    }

    console.log(`Map "${cfg.name}" created with ${created.length} zones`);
  }

  // ───────── SAMPLE NEWS ─────────
  await prisma.news.upsert({
    where: { slug: 'welcome-to-weekly-cup' },
    update: {},
    create: {
      slug: 'welcome-to-weekly-cup',
      title: 'Добро пожаловать на Weekly Cup',
      excerpt: 'Платформа кастомных матчей запущена',
      body: 'Регистрируйся, привязывай Static ID и присоединяйся к ближайшему матчу.',
      published: true,
    },
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
