@echo off
chcp 65001 >nul
color 0A
cls
echo.
echo  ============================================
echo    AI-PsAssistant 发布更新脚本
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/4] 检查当前版本...
node -e "const pkg = require('./package.json'); console.log('当前版本: v' + pkg.version);"
echo.

set /p newVersion="请输入新版本号 (例如 2.2.0): "
if "%newVersion%"=="" (
    echo  [错误] 版本号不能为空
    pause
    exit /b 1
)

echo.
echo [2/4] 更新版本号到 v%newVersion%...

node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '%newVersion%'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)); console.log('版本号已更新到 v%newVersion%');"

echo.
echo [3/4] 提交到 Git...
git add .
git commit -m "v%newVersion%: 更新版本"

echo.
echo [4/4] 推送到 GitHub...
git push origin main

echo.
echo  ============================================
echo   更新发布完成！
echo   版本: v%newVersion%
echo   仓库: https://github.com/mp7mvdsxtb-boop/PS-Agent
echo  ============================================
echo.
pause
