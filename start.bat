@echo off
setlocal EnableDelayedExpansion
title EyeOfGod Launcher
cd /d "%~dp0"

echo ========================================================
echo Eye of God - Easy Start
echo ========================================================
echo.

echo Cleaning up old instances...
call :KillWindow "Eye of God Backend*"
call :KillWindow "Eye of God Frontend*"
call :KillPorts 3001 5173

echo.
echo Make sure you have Node.js installed and set up your
echo app/.env with AISSTREAM_API_KEY!
echo.

echo Checking dependencies...
cd /d "%~dp0app" || goto :fail
call npm install || goto :fail
cd /d "%~dp0app\server" || goto :fail
call npm install || goto :fail
cd /d "%~dp0app" || goto :fail

echo.
echo Starting servers...
start "Eye of God Backend" cmd /k "title Eye of God Backend && cd /d "%~dp0app\server" && node index.js"
start "Eye of God Frontend" cmd /k "title Eye of God Frontend && cd /d "%~dp0app" && npm run dev"

echo.
echo Done! Open http://localhost:5173 in your browser.
pause
exit /b 0

:KillWindow
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '%~1' } | Stop-Process -Force -ErrorAction SilentlyContinue"
exit /b 0

:KillPorts
for %%L in (%*) do (
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %%L -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    if not "%%P"=="" taskkill /PID %%P /T /F >nul 2>&1
  )
)
exit /b 0

:fail
echo.
echo Startup failed. Check the error above.
pause
exit /b 1