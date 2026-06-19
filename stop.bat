@echo off
chcp 65001 >nul
title Weekly Cup — остановка
cd /d "%~dp0"

echo Останавливаю Weekly Cup...
docker compose down

echo.
echo Платформа остановлена. Данные базы сохранены — при следующем запуске start.bat всё будет на месте.
echo.
pause
