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
if errorlevel 1 goto installnode
node -e "process.exit(process.versions.modules==='137'?0:1)"
if errorlevel 1 goto installnode
goto nodeok

:installnode
echo.
echo  [提示] 未检测到 Node.js（或版本不对）
echo  正在自动下载并安装 Node.js 24（约32MB），请稍候...
echo.
set "NODE_URL=https://cdn.npmmirror.com/binaries/node/v24.21.0/node-v24.21.0-x64.msi"
set "NODE_MSI=%TEMP%\node-v24.21.0-x64.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor 3072; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%'"
if not exist "%NODE_MSI%" goto downloadfailed
echo  下载完成，正在安装...
echo  （如弹出用户账户控制提示，请点"是"）
powershell -NoProfile -Command "Start-Process msiexec -ArgumentList '/i','%NODE_MSI%','/qn','/norestart' -Verb RunAs -Wait"
set "PATH=C:\Program Files\nodejs;%PATH%"
set /a cnt=0
:waitnode
where node >nul 2>nul
if not errorlevel 1 goto nodeinstalled
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
where node >nul 2>nul
if not errorlevel 1 goto nodeinstalled
timeout /t 3 /nobreak >nul
set /a cnt+=1
if %cnt% LSS 20 goto waitnode
goto installfailed

:nodeinstalled
node -e "process.exit(process.versions.modules==='137'?0:1)"
if errorlevel 1 goto versionfailed
echo  Node.js 安装成功！
echo.

:nodeok
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

:downloadfailed
echo.
echo  [错误] 自动下载失败（可能是网络问题）
echo  请手动下载安装 Node.js 24，即将打开下载页面...
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载(国内快): https://npmmirror.com/mirrors/node/
echo.
pause
exit /b 1

:installfailed
echo.
echo  [错误] Node.js 安装失败
echo  请手动下载安装 Node.js 24，即将打开下载页面...
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载(国内快): https://npmmirror.com/mirrors/node/
echo.
pause
exit /b 1

:versionfailed
echo.
echo  [错误] Node.js 版本仍然不对
echo  请手动安装 Node.js 24 版本，即将打开下载页面...
echo.
start https://nodejs.org/zh-cn/download
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
