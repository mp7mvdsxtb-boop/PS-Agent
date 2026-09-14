@echo off
cls
echo.
echo  ============================================
echo    AI-PsAssistant 首次配置
echo  ============================================
echo.

cd /d "%~dp0"

if not exist "package.json" goto noextract

echo [1/4] 检查 Node.js...
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

echo [2/4] 检查依赖...
if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" goto skipinstall
echo        正在安装依赖（需要联网）...
call npm config set registry https://registry.npmmirror.com
set npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto depsfailed
:skipinstall
echo        依赖就绪

echo [3/4] 运行配置向导...
echo.
node setup.js
if errorlevel 1 goto setupfailed

echo.
echo  ============================================
echo    配置完成！请双击 Start.bat 启动
echo  ============================================
echo.
pause
exit /b 0

:noextract
echo.
echo  [错误] 请先解压压缩包！
echo.
echo  右键点击 zip 文件，选择"全部解压缩"。
echo  不要直接在压缩包预览里运行。
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

:depsfailed
echo.
echo  [错误] 依赖安装失败
echo  请检查网络后重试。
echo.
pause
exit /b 1

:setupfailed
echo.
echo  [错误] 配置失败
echo  请重新运行本文件。
echo.
pause
exit /b 1
