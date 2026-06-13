@echo off
title School ERP Server
cd /d "%~dp0"

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing required packages...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)

echo.
echo School ERP is starting...
echo Keep this window open while using the app.
echo.
call npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort

echo.
echo Server stopped. Press any key to close.
pause >nul
