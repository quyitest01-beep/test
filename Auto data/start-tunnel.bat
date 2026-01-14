@echo off
echo 启动 Cloudflare Tunnel...
echo.

REM 检查 cloudflared.exe 是否存在
if not exist "cloudflared.exe" (
    echo 错误：找不到 cloudflared.exe
    echo 请先下载并放置到当前目录
    echo 运行 download-cloudflared.bat 来下载
    pause
    exit /b 1
)

echo 启动隧道，暴露本地 8000 端口...
echo 按 Ctrl+C 停止隧道
echo.
cloudflared tunnel --url http://localhost:8000

pause

