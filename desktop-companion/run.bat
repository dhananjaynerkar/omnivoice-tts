@echo off
title Universal Reader Desktop Companion
echo ========================================================
echo   Launching Universal Reader Desktop Companion
echo ========================================================
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [1/2] Creating isolated Python virtual environment (.venv)...
    python -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment. Ensure Python 3.10+ is installed.
        pause
        exit /b 1
    )
    echo [2/2] Installing companion requirements...
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
)

echo Starting Desktop Companion server...
"%~dp0.venv\Scripts\python.exe" main.py
pause
