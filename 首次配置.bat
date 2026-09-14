@echo off
cls
echo.
echo  ============================================
echo    AI-PsAssistant First Time Setup
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
echo       Configuring China mirror...
call npm config set registry https://registry.npmmirror.com
set npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

if not exist "node_modules" (
    echo       Installing dependencies...
    call npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Failed to install dependencies
        echo  Please check your network connection
        echo.
        pause
        exit /b 1
    )
    echo       Dependencies installed
) else (
    echo       Environment OK
)

echo.
echo [2/3] Running setup wizard...
echo.
node setup.js
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Setup failed
    echo  Please run this file again
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Done
echo.
echo  ============================================
echo   Please double-click Start.bat to start
echo  ============================================
echo.
pause
