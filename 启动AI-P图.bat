@echo off
chcp 65001 >nul
color 0A
cls
echo.
echo  ============================================
echo    AI-PsAssistant 智能体控制Photoshop
echo    版本 2.1.0 - 自动更新 + 密码保护
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/5] 检查更新...
node check-update.js
if %errorlevel% neq 0 (
    echo.
    echo  [提示] 更新检查失败，继续启动...
    echo.
)

echo [2/5] 检查环境...
if not exist "node_modules" (
    echo.
    echo  [错误] 未检测到依赖包，请先运行 首次配置.bat
    echo.
    pause
    exit /b 1
)
echo       环境正常

echo [3/5] 检查Photoshop...
tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul | find /i "Photoshop.exe" >nul
if %errorlevel% neq 0 (
    echo.
    echo  [错误] 未检测到Photoshop
    echo  请先打开Adobe Photoshop，然后重新运行本程序
    echo.
    pause
    exit /b 1
)
echo       Photoshop 正在运行

echo [4/5] 检查配置...
if not exist "%USERPROFILE%\.ai-ps\config.json" (
    echo.
    echo  [错误] 未检测到配置
    echo  请先运行 首次配置.bat
    echo.
    pause
    exit /b 1
)
echo       配置已找到

echo [5/5] 启动服务...
echo.
echo  ============================================
echo   服务启动后请访问：
echo   http://localhost:5175
echo   按 Ctrl+C 停止服务
echo  ============================================
echo.

node proxy-server.js

echo.
echo 服务已停止
pause
