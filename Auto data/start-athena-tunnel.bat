@echo off
echo ========================================
echo 启动 Athena 查询后端的 Cloudflare Tunnel
echo ========================================
echo.

REM 检查 cloudflared.exe 是否存在
if not exist "cloudflared.exe" (
    echo 错误：找不到 cloudflared.exe
    echo.
    echo 请下载 cloudflared：
    echo https://github.com/cloudflare/cloudflared/releases/latest
    echo.
    echo 下载 cloudflared-windows-amd64.exe 并重命名为 cloudflared.exe
    echo 然后放到当前目录: %CD%
    echo.
    pause
    exit /b 1
)

echo 正在启动隧道，暴露本地 8000 端口到公网...
echo.
echo ⚠️  重要提示：
echo 1. 请保持此窗口运行，不要关闭
echo 2. 记录下生成的公网 URL（https://xxx.trycloudflare.com）
echo 3. 将这个 URL 配置到 n8n 工作流中
echo 4. 每次重启隧道，URL 可能会变化
echo.
echo 按 Ctrl+C 可停止隧道
echo.
echo ========================================
echo 隧道启动中...
echo ========================================
echo.

cloudflared tunnel --url http://localhost:8000

echo.
echo 隧道已停止
pause
