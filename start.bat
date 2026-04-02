@echo off
set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs
echo Starting GuardOps (all services)...
echo.
echo Backend API:  http://localhost:3001
echo Admin CRM:    http://localhost:5173
echo Guard App:    http://localhost:5174
echo.
echo Open the relevant URL in your browser.
echo Press Ctrl+C to stop all services.
echo.
call npm run dev
