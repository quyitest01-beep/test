@echo off
echo ========================================
echo 启动 PDF 渲染服务
echo ========================================
echo.

REM 检查Chrome是否安装
echo 正在检查Chrome浏览器...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo ✓ 找到Chrome浏览器
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo ✓ 找到Chrome浏览器
) else (
    echo ✗ 未找到Chrome浏览器
    echo 请安装Google Chrome浏览器后重试
    echo 下载地址: https://www.google.com/chrome/
    pause
    exit /b 1
)

REM 检查是否有node_modules
if not exist "backend\pdf-service\node_modules" (
    echo 正在安装依赖...
    cd backend\pdf-service
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo ✓ 依赖安装完成
    cd ..\..
)

echo.
echo 正在启动PDF服务...
echo 服务地址: http://localhost:8787
echo 健康检查: http://localhost:8787/health
echo 按 Ctrl+C 停止服务
echo.

cd backend\pdf-service
node server.js

echo.
echo 服务已停止
pause
