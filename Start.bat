@echo off
cls
echo.
echo  ============================================
echo    AI-PsAssistant - AI Control Photoshop
echo    Version 2.1.0
echo  ============================================
echo.

cd /d "%~dp0"

if not exist "package.json" goto noextract

echo [1/5] Checking update...
node check-update.js
if errorlevel 1 (
    echo  [Tip] Update check failed, continuing...
)

echo [2/5] Checking environment...
if not exist "node_modules" goto nodeps
echo       Environment OK

echo [3/5] Checking Photoshop...
tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul | find /i "Photoshop.exe" >nul
if errorlevel 1 goto nops
echo       Photoshop is running

echo [4/5] Checking config...
if not exist "%USERPROFILE%\.photoshop-mcp\data.db" goto noconfig
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
exit /b 0

:noextract
echo.
echo  [ERROR] Please EXTRACT the zip first!
echo  Right-click the zip, choose "Extract All".
echo.
pause
exit /b 1

:nodeps
echo.
echo  [ERROR] Dependencies not found
echo  Please run Setup.bat first.
echo.
pause
exit /b 1

:nops
echo.
echo  [ERROR] Photoshop not found
echo  Please open Adobe Photoshop first.
echo.
pause
exit /b 1

:noconfig
echo.
echo  [ERROR] Config not found
echo  Please run Setup.bat first.
echo.
pause
exit /b 1
