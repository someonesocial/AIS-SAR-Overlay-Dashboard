@echo off
setlocal

title EyeOfGod Launcher
cd /d "%~dp0"

echo ========================================================
echo Eye of God - Easy Start
echo ========================================================
echo.

echo Cleaning up old Eye of God instances...
call :KillWindow "Eye of God Backend*"
call :KillWindow "Eye of God Frontend*"
call :KillWindow "npm*"
call :KillPorts 3001 5173
call :WaitForPortsFree 3001 5173

echo.
echo Make sure you have Node.js installed and set up your
echo app/.env with AISSTREAM_API_KEY!
echo.

echo Checking and installing dependencies...
cd /d "%~dp0app" || goto :fail
call npm install || goto :fail
cd /d "%~dp0app\server" || goto :fail
call npm install || goto :fail
cd /d "%~dp0app" || goto :fail

title EyeOfGod Launcher

echo.
echo Starting Backend Server and Frontend Dashboard...
echo.
start "Eye of God Backend" cmd /k "title Eye of God Backend && cd /d "%~dp0app\server" && node index.js"
start "Eye of God Frontend" cmd /k "title Eye of God Frontend && cd /d "%~dp0app" && npm run dev"

echo Done! Open http://localhost:5173 in your browser.
pause
exit /b 0

:KillWindow
taskkill /FI "WINDOWTITLE eq %~1" /T /F >nul 2>&1
exit /b 0

:KillPorts
for %%L in (%*) do (
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %%L -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
    if not "%%P"=="" taskkill /PID %%P /T /F >nul 2>&1
  )
)
exit /b 0

:WaitForPortsFree
for /l %%A in (1,1,20) do (
  set "PORT_BUSY="
  for %%L in (%*) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %%L -State Listen -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>&1
    if errorlevel 1 set "PORT_BUSY=1"
  )
  if not defined PORT_BUSY exit /b 0
  timeout /t 1 /nobreak >nul
)

echo Warning: One or more ports are still busy after waiting.
exit /b 0

:fail
echo.
echo Startup failed. Please check the error above.
pause
exit /b 1
