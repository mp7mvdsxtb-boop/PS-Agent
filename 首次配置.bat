@echo off
cls
echo.
echo  ============================================
echo    AI-PsAssistant First Time Setup
echo  ============================================
echo.

cd /d "%~dp0"

if not exist "package.json" goto :noextract

echo [1/3] Checking environment...
echo       Configuring China mirror...
call npm config set registry https://registry.npmmirror.com
set npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" goto :skipinstall

echo       Installing dependencies...
if exist "node_modules" rmdir /s /q "node_modules"
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto :installfailed

:skipinstall
echo       Environment OK

echo.
echo [2/3] Running setup wizard...
echo.
node setup.js
if errorlevel 1 goto :setupfailed

echo.
echo [3/3] Done
echo.
echo  ============================================
echo   Please double-click Start.bat to start
echo  ============================================
echo.
pause
exit /b 0

:noextract
echo.
echo  [ERROR] Please EXTRACT the zip first!
echo.
echo  Right-click the zip file, choose "Extract All".
echo  Then run this file from the extracted folder.
echo  Do NOT run it inside the zip preview window.
echo.
pause
exit /b 1

:installfailed
echo.
echo  [ERROR] Failed to install dependencies
echo  Please check your network connection and try again.
echo.
pause
exit /b 1

:setupfailed
echo.
echo  [ERROR] Setup failed
echo  Please run this file again.
echo.
pause
exit /b 1
