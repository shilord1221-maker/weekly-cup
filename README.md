# Weekly Cup — Custom Matches Platform

Турнирная платформа кастомных матчей: лобби, выбор зон по графу соседства (adjacencyMap), Discord Voice Channels, realtime-чат и живая лента побед.

## Быстрый запуск на Windows (одна кнопка)

1. Установи **Docker Desktop**, если его нет: https://www.docker.com/products/docker-desktop/ (после установки — перезагрузи компьютер).
2. Распакуй архив куда угодно.
3. Дважды кликни **`start.bat`**.

Скрипт сам:
- проверит, что Docker установлен и запущен (запустит его, если выключен);
- соберёт и поднимет все контейнеры (база, Redis, API, сайт);
- применит миграции базы данных;
- загрузит тестовые данные (админ-аккаунт, карту с зонами, новость);
- откроет сайт в браузере на `http://localhost:3000`.

Готовый `.env` уже лежит в архиве со сгенерированными секретами — редактировать ничего не нужно для локального запуска.

Тестовые аккаунты после первого запуска:
- **Admin**: `admin@weeklycup.gg` / `Admin123!`
- **Organizer**: `organizer@weeklycup.gg` / `Organizer123!`

Дополнительные скрипты:
- **`stop.bat`** — остановить платформу (данные в базе сохраняются)
- **`logs.bat`** — посмотреть логи всех сервисов, если что-то не так

---

## Стек

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand, React Query, Socket.io-client
- **Backend**: Fastify, TypeScript, Prisma ORM, Socket.io, BullMQ
- **БД**: PostgreSQL 16
- **Кэш / realtime / таймеры**: Redis 7
- **Авторизация**: JWT (access + refresh), argon2 для паролей

## Структура проекта

```
weekly-cup/
├── start.bat     # запуск всего одной кнопкой (Windows)
├── stop.bat      # остановка
├── logs.bat      # логи для дебага
├── .env          # готовые секреты — менять не нужно для локального запуска
├── apps/
│   ├── web/      # Next.js фронтенд
│   └── api/      # Fastify backend + Prisma
├── docker-compose.yml
└── README.md
```

---

## Локальный запуск (для разработки)

### 1. Зависимости

Нужны Node.js 20+, Docker (для Postgres/Redis) или локально установленные Postgres 16 и Redis 7.

### 2. Поднять базу и Redis

```bash
docker compose up -d postgres redis
```

### 3. Backend

```bash
cd apps/api
cp .env.example .env
# Отредактируйте .env — сгенерируйте свои JWT_ACCESS_SECRET / JWT_REFRESH_SECRET:
#   openssl rand -base64 32

npm install
npm run prisma:generate
npm run prisma:migrate:dev   # создаст таблицы
npm run prisma:seed          # создаст admin/organizer аккаунты и тестовую карту
npm run dev                  # http://localhost:4000
```

Тестовые аккаунты после seed:
- **Admin**: `admin@weeklycup.gg` / `Admin123!`
- **Organizer**: `organizer@weeklycup.gg` / `Organizer123!`

### 4. Frontend

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

Откройте http://localhost:3000 — лендинг, регистрация (ник и Static ID обязательны), вход, лобби с realtime — всё рабочее.

---

## Деплой в продакшен

### Вариант A — Docker Compose на одном сервере (VPS)

Самый быстрый способ выложить сайт в сеть. Это тот же `docker-compose.yml`, что использует `start.bat`, просто запускается на Linux-сервере, а не на Windows-ноутбуке.

1. Установите Docker и Docker Compose на сервер (Ubuntu 22.04+):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. Скопируйте проект на сервер (`git clone` или `scp`).

3. Откройте `.env` в корне проекта и поменяйте два значения на реальный домен (вместо localhost):
   ```bash
   WEB_ORIGIN=https://your-domain.com
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   ```
   `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` можно оставить как есть, но для продакшена лучше сгенерировать новые:
   ```bash
   openssl rand -base64 32
   ```

4. Запустите:
   ```bash
   docker compose up -d --build
   ```

5. Прогоните seed (один раз, миграции применяются автоматически при старте контейнера api):
   ```bash
   docker compose exec api npx tsx prisma/seed.ts
   ```

6. Настройте reverse-proxy (Nginx/Caddy) с HTTPS перед `web` (порт 3000) и `api` (порт 4000):

   Пример для Caddy (`Caddyfile`):
   ```
   your-domain.com {
     reverse_proxy localhost:3000
   }
   api.your-domain.com {
     reverse_proxy localhost:4000
   }
   ```
   Caddy сам выпустит SSL-сертификаты через Let's Encrypt.

7. Сайт доступен по `https://your-domain.com`, API — по `https://api.your-domain.com`.

### Вариант B — раздельный деплой (managed-сервисы)

Подходит, если хочется не администрировать сервер вручную.

- **Frontend (apps/web)** → Vercel (нативная поддержка Next.js):
  ```bash
  cd apps/web
  vercel --prod
  ```
  Указать переменную окружения `NEXT_PUBLIC_API_URL` в настройках проекта Vercel.

- **Backend (apps/api)** → Railway / Render / Fly.io (любой сервис с поддержкой Docker и Node.js):
  - Создать сервис из `apps/api/Dockerfile`.
  - Подключить managed PostgreSQL (Railway/Render предоставляют из коробки) и managed Redis (Upstash подходит).
  - Указать переменные `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`.
  - После первого деплоя выполнить миграции: `npx prisma migrate deploy` (Railway/Render позволяют запускать команды в консоли сервиса).

- **PostgreSQL** → Railway Postgres / Supabase / Neon
- **Redis** → Upstash Redis / Railway Redis

### Важно перед продакшен-запуском

- [ ] Сгенерировать новые `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (не использовать значения из `.env.example`)
- [ ] Сменить пароли тестовых аккаунтов (`admin`/`organizer`) сразу после первого входа, или удалить их и создать новые через регистрацию + ручное назначение роли в БД
- [ ] Настроить `WEB_ORIGIN` в backend — это домен фронтенда, для CORS
- [ ] Настроить `NEXT_PUBLIC_API_URL` во фронтенде — публичный адрес backend API
- [ ] Включить HTTPS (через reverse-proxy) — без него `Secure` cookies не будут работать в продакшен-режиме
- [ ] Настроить регулярный бэкап PostgreSQL (`pg_dump` по cron или managed-снапшоты)

---

## Структура БД

Полная Prisma-схема находится в `apps/api/prisma/schema.prisma`. Основные сущности: `User`, `StaticId`, `Match`, `Lobby`, `Team`, `LobbyMember`, `GameMap`, `Zone`, `Complaint`, `ChatMessage`, `Achievement`, `Win`, `News`, `Media`, `Notification`, `AuditLog`.

## Ключевая бизнес-логика

- **adjacencyMap** (`apps/api/src/services/zones.ts`) — выбор зон и финальной зоны проверяется по графу соседства; нельзя выбрать несвязанную зону.
- **Лобби** (`apps/api/src/services/lobby.ts`) — защита от переполнения команд и от участия в нескольких командах/лобби одновременно.
- **Таймеры** (`apps/api/src/services/timers.ts`, `apps/api/src/jobs/matchQueue.ts`) — серверное состояние в Redis + BullMQ; обновление страницы не сбивает таймеры старта матча, напоминания через 2 минуты и окна выбора финальной зоны.
- **Realtime** — Socket.io с комнатами `lobby:{matchId}`, `chat:global`, `user:{userId}`; все события из sitemap-документа реализованы (вход/выход из лобби, смена команды, ready, авто-распределение, выбор зон, финальная зона, старт/завершение матча, чат, уведомления).
- **Аудит** (`apps/api/src/services/audit.ts`) — все критичные действия (создание матча, изменение времени/зон, перенос игроков, завершение матча, работа с жалобами) логируются в `AuditLog`.

## Регистрация — обязательные поля

Форма регистрации (`apps/web/src/app/register/page.tsx`) требует **ник** и **Static ID** — оба поля обязательны на уровне валидации Zod как на фронте, так и на backend (`apps/api/src/routes/auth.ts`), запрос не пройдёт без них.
