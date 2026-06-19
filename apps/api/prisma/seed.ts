import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

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
      staticId: { create: { value: 'ADMIN-0001' } },
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
      staticId: { create: { value: 'ORG-0001' } },
    },
  });
  console.log('Organizer created:', organizer.username);

  // ───────── SAMPLE MAP: 5x5 grid с adjacencyMap (как на лендинге) ─────────
  const existingMap = await prisma.gameMap.findFirst({ where: { name: 'Erangel' } });
  if (!existingMap) {
    const map = await prisma.gameMap.create({
      data: {
        name: 'Erangel',
        imageUrl: 'https://placehold.co/800x800/0b1022/e8ecf8?text=Erangel',
        isActive: true,
      },
    });

    // Создаём grid 5x5, считаем соседство по строкам/столбцам
    const GRID = 5;
    const zoneNames = [
      'Pochinki', 'Yasnaya Polyana', 'Mylta', 'Mylta Power', 'Severny',
      'Rozhok', 'Gatka', 'Lipovka', 'Stalber', 'Shooting Range',
      'School', 'Sosnovka Military Base', 'Primorsk', 'Kameshki', 'Zharki',
      'Novorepnoye', 'Krechevo', 'Ferry Pier', 'Hospital', 'Quarry',
      'Georgopol', 'Container Yard', 'Water Town', 'Apartments', 'Train Yard',
    ];

    const created: { id: string; idx: number }[] = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const zone = await prisma.zone.create({
        data: {
          mapId: map.id,
          name: zoneNames[i] ?? `Zone ${i + 1}`,
          coordinates: { row: Math.floor(i / GRID), col: i % GRID },
        },
      });
      created.push({ id: zone.id, idx: i });
    }

    // Заполняем adjacencyMap: соседи по сетке (вверх/вниз/влево/вправо)
    for (const { id, idx } of created) {
      const row = Math.floor(idx / GRID);
      const col = idx % GRID;
      const neighborIdxs: number[] = [];
      if (row > 0) neighborIdxs.push(idx - GRID);
      if (row < GRID - 1) neighborIdxs.push(idx + GRID);
      if (col > 0) neighborIdxs.push(idx - 1);
      if (col < GRID - 1) neighborIdxs.push(idx + 1);

      const adjacentIds = created.filter((c) => neighborIdxs.includes(c.idx)).map((c) => c.id);
      await prisma.zone.update({ where: { id }, data: { adjacentIds } });
    }

    console.log(`Map "Erangel" created with ${created.length} zones and adjacencyMap`);
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
