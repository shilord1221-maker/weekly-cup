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
  // Зоны строятся как сетка нужного размера, соседство — по строкам/столбцам (вверх/вниз/влево/вправо).
  const mapsConfig: { name: string; imageUrl: string; gridCols: number; gridRows: number; zoneNames: string[] }[] = [
    {
      name: 'Industrial',
      imageUrl: '/maps/industrial.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Red Block', 'Cyan Block', 'Green Peninsula', 'Yellow District', 'Purple Quarter', 'Blue Bay'],
    },
    {
      name: 'Mirror',
      imageUrl: '/maps/mirror.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Cyan North', 'Pink Heights', 'Red Center', 'Green Strip', 'Blue Harbor', 'Yellow South'],
    },
    {
      name: 'Sandy Shores',
      imageUrl: '/maps/sandy-shores.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Yellow Town', 'Cyan Point', 'Blue West', 'Purple Hills', 'Red Ridge', 'Green Coast'],
    },
    {
      name: 'Vinewood',
      imageUrl: '/maps/vinewood.jpg',
      gridCols: 4,
      gridRows: 2,
      zoneNames: ['Red North', 'Yellow Ridge', 'Magenta West', 'Purple Hills', 'Cyan Center', 'Orange Valley', 'Green Park', 'Blue South'],
    },
    {
      name: 'City',
      imageUrl: '/maps/city.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Blue North', 'Magenta West', 'Cyan East', 'Pink District', 'Orange Center', 'Green Block'],
    },
    {
      name: 'Farm',
      imageUrl: '/maps/farm.jpg',
      gridCols: 3,
      gridRows: 2,
      zoneNames: ['Orange Field', 'Pink Barn', 'Cyan Silo', 'Blue West', 'Green Pasture', 'Red South'],
    },
    {
      name: 'Ghetto',
      imageUrl: '/maps/ghetto.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Red North', 'Cyan East', 'Yellow West', 'Pink Center', 'Green Mid', 'Purple South', 'Orange Corner', 'Blue Block', 'Magenta Row'],
    },
    {
      name: 'Vineyards',
      imageUrl: '/maps/vineyards.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Purple Hills', 'Pink Valley', 'Orange Grove', 'Orange Field', 'Yellow Rows', 'Cyan Edge', 'Brown Ridge', 'Blue Pond', 'Teal Corner'],
    },
    {
      name: 'Windmill',
      imageUrl: '/maps/windmill.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Orange West', 'Cyan North', 'Pink Top', 'Purple Side', 'Brown Center', 'Blue East', 'Green South', 'Yellow Field', 'Red Bottom'],
    },
    {
      name: 'Redwood',
      imageUrl: '/maps/redwood.jpg',
      gridCols: 3,
      gridRows: 3,
      zoneNames: ['Red West', 'Yellow Slope', 'Blue North', 'Cyan Center', 'Pink Corner', 'Green East', 'Brown South', 'Purple Mid', 'Orange Bottom'],
    },
  ];

  for (const cfg of mapsConfig) {
    const existing = await prisma.gameMap.findFirst({ where: { name: cfg.name } });
    if (existing) {
      console.log(`Map "${cfg.name}" already exists, skipping`);
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
          name: cfg.zoneNames[i] ?? `Zone ${i + 1}`,
          coordinates: { row: Math.floor(i / cfg.gridCols), col: i % cfg.gridCols },
        },
      });
      created.push({ id: zone.id, idx: i });
    }

    // adjacencyMap по сетке: соседи сверху/снизу/слева/справа
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

    console.log(`Map "${cfg.name}" created with ${created.length} zones and adjacencyMap`);
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
