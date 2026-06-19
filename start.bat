@echo off
chcp 65001 >nul
title Weekly Cup — запуск платформы
cd /d "%~dp0"

echo ================================================
echo   Weekly Cup — запуск платформы
echo ================================================
echo.

REM ── Проверка, что Docker установлен ──
where docker >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Docker не найден.
    echo.
    echo Установи Docker Desktop отсюда: https://www.docker.com/products/docker-desktop/
    echo После установки перезапусти компьютер и запусти этот файл снова.
    echo.
    pause
    exit /b 1
)

REM ── Проверка, что Docker daemon запущен ──
docker info >nul 2>nul
if errorlevel 1 (
    echo [ОЖИДАНИЕ] Docker Desktop не запущен. Пытаюсь запустить...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Жду, пока Docker запустится (это может занять минуту)...

    set WC_DOCKER_TRIES=0
    :WAIT_DOCKER
    set /a WC_DOCKER_TRIES+=1
    timeout /t 5 >nul
    docker info >nul 2>nul
    if errorlevel 1 (
        if %WC_DOCKER_TRIES% GEQ 24 (
            echo.
            echo [ОШИБКА] Docker Desktop не запустился за 2 минуты.
            echo Открой Docker Desktop вручную и попробуй снова запустить start.bat.
            echo.
            pause
            exit /b 1
        )
        goto WAIT_DOCKER
    )

    echo Docker запущен.
    echo.
)

REM ── Проверка наличия .env ──
if not exist ".env" (
    echo [ОШИБКА] Файл .env не найден в папке проекта.
    echo Убедись, что .env лежит рядом с этим файлом start.bat.
    pause
    exit /b 1
)

echo [1/3] Собираю и поднимаю контейнеры (база, Redis, API, сайт)...
echo       Первый запуск может занять несколько минут — это нормально.
echo       Миграции базы данных применяются автоматически при старте API.
echo.
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось поднять контейнеры. Смотри сообщение выше.
    pause
    exit /b 1
)

echo.
echo [2/3] Жду, пока API будет готов отвечать...
set WC_TRIES=0
:WAIT_API
set /a WC_TRIES+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    if %WC_TRIES% GEQ 40 (
        echo.
        echo [ОШИБКА] API не отвечает уже больше 2 минут.
        echo Посмотри логи: запусти logs.bat, чтобы понять, что пошло не так.
        echo.
        pause
        exit /b 1
    )
    timeout /t 3 >nul
    goto WAIT_API
)
echo       API готов.

echo.
echo [3/3] Загружаю начальные данные (админ, карта, тестовая новость)...
echo       Если данные уже были загружены ранее — ничего не изменится (безопасно).
docker compose exec -T api npx tsx prisma/seed.ts

echo.
echo ================================================
echo   Готово! Платформа запущена.
echo ================================================
echo.
echo   Сайт:   http://localhost:3000
echo   API:    http://localhost:4000
echo.
echo   Тестовые аккаунты:
echo     Admin:     admin@weeklycup.gg     / Admin123!
echo     Organizer: organizer@weeklycup.gg / Organizer123!
echo.
echo   Чтобы ОСТАНОВИТЬ платформу — запусти stop.bat
echo   Чтобы посмотреть логи — запусти logs.bat
echo ================================================
echo.

timeout /t 3 >nul
start "" "http://localhost:3000"

pause
