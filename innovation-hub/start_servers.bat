@echo off
title Concentrix Innovation Hub Launcher
echo ========================================================
echo   Starting Concentrix Innovation Hub Local Servers...
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"

:: Detect Python executable (prefer Anaconda if installed)
set "PY_CMD=python"
if exist "%USERPROFILE%\AppData\Local\anaconda3\python.exe" (
    set "PY_CMD=%USERPROFILE%\AppData\Local\anaconda3\python.exe"
) else if exist "%ProgramData%\anaconda3\python.exe" (
    set "PY_CMD=%ProgramData%\anaconda3\python.exe"
) else if exist "C:\anaconda3\python.exe" (
    set "PY_CMD=C:\anaconda3\python.exe"
)

echo [1/2] Launching FastAPI Backend (Port 8000)...
start "Innovation Hub - Backend (FastAPI)" cmd /k "cd /d "%ROOT_DIR%apps\api" && "%PY_CMD%" -m uvicorn main:app --port 8000 --reload"

echo [2/2] Launching Vite Frontend (Port 5173)...
start "Innovation Hub - Frontend (Vite)" cmd /k "cd /d "%ROOT_DIR%apps\web" && npm run dev"

echo.
echo ========================================================
echo   Both servers launched in separate command windows!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo ========================================================
echo.
pause
