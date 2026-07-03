@echo off
title TURBODOS dev launcher
rem Launch the TURBODOS dev build in one go.
rem Uses "npm run dev" (NOT "npm run tauri dev") so the msvc target flag from
rem package.json is applied — otherwise Rust rebuilds everything into a
rem different target folder from scratch.
cd /d "%~dp0"
rem Free port 1420 if a stale vite/preview instance is still holding it
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
call npm run dev
if errorlevel 1 (
  echo.
  echo *** Launch failed — see errors above. ***
  pause
)
