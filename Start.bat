@echo off
cls
echo.
echo  ============================================
echo    AI-PsAssistant - AI 控制 Photoshop
echo    版本 2.1.0
echo  ============================================
echo.

cd /d "%~dp0"

if not exist "package.json" goto noextract

echo [1/6] 检查 Node.js...
where node >nul 2>nul
if errorlevel 1 goto nonode

node -e "process.exit(process.versions.modules==='137'?0:1)"
if errorlevel 1 goto abimismatch
echo        Node.js 已就绪

echo [2/6] 检查更新...
node check-update.js
if errorlevel 1 (
    echo        [提示] 更新检查失败，跳过...
)

echo [3/6] 检查依赖...
if not exist "node_modules" goto nodeps
echo        依赖就绪

echo [4/6] 检查 Photoshop...
tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul | find /i "Photoshop.exe" >nul
if errorlevel 1 goto nops
echo        Photoshop 已运行

echo [5/6] 检查配置...
if not exist "%USERPROFILE%\.photoshop-mcp\data.db" goto noconfig
echo        配置已找到

echo [6/6] 启动服务...
echo.
echo  ============================================
echo    访问地址: http://localhost:5175
echo    按 Ctrl+C 停止
echo  ============================================
echo.

node proxy-server.js

echo.
echo 服务已停止
pause
exit /b 0

:noextract
echo.
echo  [错误] 请先解压压缩包！
echo  右键点击 zip 文件，选择"全部解压缩"。
echo.
pause
exit /b 1

:nonode
echo.
echo  [错误] 未检测到 Node.js
echo  即将打开下载页面，请安装 Node.js 24 (LTS)：
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载(国内快): https://npmmirror.com/mirrors/node/
echo.
pause
exit /b 1

:abimismatch
echo.
echo  [错误] Node.js 版本不匹配
echo  请安装 Node.js 24 (LTS)，即将打开下载页面...
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载(国内快): https://npmmirror.com/mirrors/node/
echo.
pause
exit /b 1

:nodeps
echo.
echo  [错误] 依赖缺失
echo  请先运行 Setup.bat。
echo.
pause
exit /b 1

:nops
echo.
echo  [错误] 未检测到 Photoshop
echo  请先打开 Adobe Photoshop。
echo.
pause
exit /b 1

:noconfig
echo.
echo  [错误] 配置未找到
echo  请先运行 Setup.bat。
echo.
pause
exit /b 1
