@echo off
echo ================================================
echo  GuardOps - Security Guard CRM Setup
echo ================================================
echo.

:: Add common Node.js install paths
set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js:
node --version
npm --version
echo.

echo [1/4] Installing root dependencies...
call npm install

echo [2/4] Installing frontend dependencies...
cd frontend && call npm install && cd ..

echo [3/4] Installing backend dependencies...
cd backend && call npm install && cd ..

echo [4/4] Seeding database...
cd backend && call npx ts-node src/db/seed.ts && cd ..

echo.
echo ================================================
echo  Setup complete! Run start.bat to launch.
echo ================================================
pause
