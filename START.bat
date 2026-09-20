@echo off
setlocal enabledelayedexpansion
title Universal Reader (ReadingX) - One-Click Launcher
color 0B
cls

echo =========================================================================
echo       UNIVERSAL READER (READINGX) - ONE-CLICK AUTO LAUNCHER
echo =========================================================================
echo.

cd /d "%~dp0"

:: 1. Check Node.js
echo [1/6] Checking Node.js environment...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not found in PATH! Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check dependencies and build Chrome Extension
if not exist "node_modules" (
    echo [2/6] Installing project dependencies: npm install...
    call npm install
) else (
    echo [2/6] Dependencies verified.
)

echo Building Chrome Extension into dist folder...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Build failed! Check output above.
    pause
    exit /b 1
)

:: 3. Setup Python Desktop Companion
echo.
echo [3/6] Setting up Desktop Companion Python environment...
cd desktop-companion

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment: .venv ...
    python -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        color 0E
        echo [WARNING] Could not create .venv with python. Trying py launcher...
        py -m venv .venv
    )
)

if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo Checking companion Python packages...
    pip install -r requirements.txt >nul 2>&1
) else (
    echo [WARNING] Using system python for companion...
    pip install -r requirements.txt >nul 2>&1
)

:: Return to project root
cd /d "%~dp0"

:: 4. Sync native VS Code Extension
echo.
echo [4/6] Registering native VS Code extension...
if exist "%USERPROFILE%\.vscode\extensions" (
    xcopy /y /e /i /q "%~dp0vscode-extension" "%USERPROFILE%\.vscode\extensions\universal-reader-tts" >nul 2>&1
    echo       Installed into VS Code: ~/.vscode/extensions/universal-reader-tts
)

:: 5. Copy dist path to clipboard for instant pasting
set "DIST_PATH=%~dp0dist"
echo %DIST_PATH%| clip
echo.
echo [5/6] Copied extension folder path to clipboard:
echo       "%DIST_PATH%"

:: 6. Launch Desktop Companion in separate persistent window
echo.
echo [6/6] Launching Desktop Companion server (Double Ctrl+C, F8 active)...
start "Universal Reader Desktop Companion" "%~dp0desktop-companion\run.bat"

:: Wait 2 seconds for companion server to spin up
ping 127.0.0.1 -n 3 >nul

:: Detect Chrome installation
set "CHROME_BIN="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

:: Open Google Chrome or default browser
echo Opening Chrome to extensions page and interactive test demo...
if defined CHROME_BIN (
    start "" "%CHROME_BIN%" "chrome://extensions"
    ping 127.0.0.1 -n 2 >nul
    start "" "%CHROME_BIN%" "http://127.0.0.1:8765/demo"
) else (
    start "" "http://127.0.0.1:8765/demo"
)

color 0A
echo.
echo =========================================================================
echo                  ALL SYSTEMS READY AND RUNNING!
echo =========================================================================
echo.
echo  TO READ IN CHROME:
echo   * Highlight any text ==^> Click 'Read' button or auto-read!
echo.
echo  TO READ IN VS CODE (ANY FILE OR MARKDOWN):
echo   * Method 1 (FASTEST): Highlight text ==^> Press [Ctrl + C] twice quickly!
echo     (Works anywhere in VS Code, even in Markdown Preview!)
echo   * Method 2: Highlight text ==^> Press [F8] or [Ctrl + Alt + R]
echo   * Method 3: In text editor ==^> Right-click ==^> 'Universal Reader: Read Selected Portion'
echo   * Method 4: Click the speaker button in the top-right toolbar or bottom status bar.
echo   * To STOP speech anytime: Press [F9] or [Ctrl + Alt + X]
echo.
echo  NOTE: Keep the 'Universal Reader Desktop Companion' window open (or minimized).
echo =========================================================================
echo Press any key to close this launcher window (companion stays running in its own window).
pause >nul
