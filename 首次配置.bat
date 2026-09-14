@echo off
color 0A
cls
echo.
echo  ============================================
echo    AI-PsAssistant First Time Setup
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
if not exist "node_modules" (
    echo       Installing dependencies...
    call npm install
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
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Done
echo.
echo  ============================================
echo   Please double-click 启动AI-P图.bat to start
echo  ============================================
echo.
pause
