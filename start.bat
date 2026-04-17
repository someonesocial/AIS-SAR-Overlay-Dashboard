@echo off
echo ========================================================
echo Eye of God - Easy Start
echo =================================================.......
echo.

echo Cleaning up any old instances...
taskkill /FI "WindowTitle eq AIS Server*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq AIS Frontend*" /T /F >nul 2>&1

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

echo.
echo Starting Backend Server and Frontend Dashboard...
echo.
start "AIS Server" cmd /k "cd server && node index.js"
start "AIS Frontend" cmd /k "npm run dev"

echo Done! The app will open in a few seconds...
pause
