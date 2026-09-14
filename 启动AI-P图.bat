@echo off
color 0A
cls
echo.
echo  ============================================
echo    AI-PsAssistant - AI Control Photoshop
echo    Version 2.1.0
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/5] Checking update...
node check-update.js
if %errorlevel% neq 0 (
    echo.
    echo  [Tip] Update check failed, continuing...
    echo.
)

echo [2/5] Checking environment...
if not exist "node_modules" (
    echo.
    echo  [ERROR] Dependencies not found
    echo  Please run 首次配置.bat first
    echo.
    pause
    exit /b 1
)
echo       Environment OK

echo [3/5] Checking Photoshop...
tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul | find /i "Photoshop.exe" >nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Photoshop not found
    echo  Please open Adobe Photoshop first
    echo.
    pause
    exit /b 1
)
echo       Photoshop is running

echo [4/5] Checking config...
if not exist "%USERPROFILE%\.ai-ps\config.json" (
    echo.
    echo  [ERROR] Config not found
    echo  Please run 首次配置.bat first
    echo.
    pause
    exit /b 1
)
echo       Config found

echo [5/5] Starting server...
echo.
echo  ============================================
echo   Please visit: http://localhost:5175
echo   Press Ctrl+C to stop
echo  ============================================
echo.

node proxy-server.js

echo.
echo Server stopped
pause
