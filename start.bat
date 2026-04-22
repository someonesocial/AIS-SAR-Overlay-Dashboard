@echo off
title Eye of God Launcher - Starting
echo ========================================================
echo Eye of God - Easy Start
echo =================================================.......
echo.

echo Cleaning up any old instances...
taskkill /FI "WINDOWTITLE eq Eye of God Launcher" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Eye of God Backend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Eye of God Frontend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq npm install" /T /F >nul 2>&1

echo.
echo Make sure you have Node.js installed and set up your
echo app/.env with AISSTREAM_API_KEY!
echo.
echo Checking and installing dependencies...
cd app
call npm install
cd server
call npm install
cd ..
title Eye of God Launcher

echo.
echo Starting Backend Server and Frontend Dashboard...
echo.
start "Eye of God Backend" cmd /k "title Eye of God Backend && cd server && node index.js"
start "Eye of God Frontend" cmd /k "title Eye of God Frontend && npm run dev"

echo Done! The app will open in a few seconds...
pause
