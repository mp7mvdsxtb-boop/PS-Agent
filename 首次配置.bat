@echo off
chcp 65001 >nul
color 0A
cls
echo.
echo  ============================================
echo    AI-PsAssistant 首次配置向导
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/3] 检查环境...
if not exist "node_modules" (
    echo       正在安装依赖包...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [错误] 依赖包安装失败
        echo  请检查网络连接后重试
        echo.
        pause
        exit /b 1
    )
    echo       依赖包安装完成
) else (
    echo       环境正常
)

echo.
echo [2/3] 运行配置向导...
echo.
node setup.js

echo.
echo [3/3] 完成
echo.
echo  ============================================
echo   配置完成后，请双击 启动AI-P图.bat 启动程序
echo  ============================================
echo.
pause
