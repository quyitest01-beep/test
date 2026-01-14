@echo off
echo ========================================
echo 启动 PDF 渲染服务
echo ========================================
echo.

REM 获取脚本所在目录（项目根目录）
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM 检查是否在pdf-service目录下
if not exist "backend\pdf-service" (
    echo 错误：找不到 backend\pdf-service 目录
    echo 当前目录：%CD%
    echo 脚本目录：%SCRIPT_DIR%
    pause
    exit /b 1
)

echo 当前目录：%CD%
cd backend\pdf-service
echo 进入目录：%CD%

REM 检查Chrome是否安装
echo 正在检查Chrome浏览器...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo ✓ 找到Chrome浏览器: C:\Program Files\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo ✓ 找到Chrome浏览器: C:\Program Files ^(x86^)\Google\Chrome\Application\chrome.exe
) else (
    echo ✗ 未找到Chrome浏览器
    echo 请安装Google Chrome浏览器后重试
    echo 下载地址: https://www.google.com/chrome/
    pause
    exit /b 1
)

REM 检查是否有node_modules
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo ✓ 依赖安装完成
)

echo.
echo 正在启动PDF服务...
echo 服务地址: http://localhost:8787
echo 健康检查: http://localhost:8787/health
echo 按 Ctrl+C 停止服务
echo.

node server.js

echo.
echo 服务已停止
pause








