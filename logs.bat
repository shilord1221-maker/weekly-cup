@echo off
chcp 65001 >nul
title Weekly Cup — логи
cd /d "%~dp0"

echo Показываю логи всех сервисов (Ctrl+C чтобы выйти)...
echo.
docker compose logs -f
