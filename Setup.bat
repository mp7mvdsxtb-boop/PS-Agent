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
if errorlevel 1 goto nonode

node -e "process.exit(process.versions.modules==='137'?0:1)"
if errorlevel 1 goto abimismatch
echo        Node.js 已就绪

echo [2/4] 检查依赖...
if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" goto skipinstall
echo        正在安装依赖（需要联网）...
call npm config set registry https://registry.npmmirror.com
set npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3
call npm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto installfailed
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

:nonode
echo.
echo  [错误] 未检测到 Node.js
echo.
echo  本程序需要 Node.js 才能运行。
echo  即将自动打开下载页面，请安装：
echo.
echo      Node.js 24 版本 (LTS 长期支持版)
echo.
echo  安装完成后，重新双击本文件。
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载地址(国内快): https://npmmirror.com/mirrors/node/
echo.
pause
exit /b 1

:abimismatch
echo.
echo  [错误] Node.js 版本不匹配
echo.
echo  请安装 Node.js 24 版本 (LTS)：
echo  即将自动打开下载页面...
echo.
start https://nodejs.org/zh-cn/download
echo  备用下载地址(国内快): https://npmmirror.com/mirrors/node/
echo.
echo  安装后重新双击本文件。
echo.
pause
exit /b 1

:installfailed
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
