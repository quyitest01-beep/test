@echo off
echo 设置 Cloudflare Tunnel 来暴露本地服务到公网...
echo.
echo 请按照以下步骤操作：
echo.
echo 1. 下载 cloudflared：
echo    https://github.com/cloudflare/cloudflared/releases
echo.
echo 2. 解压到当前目录
echo.
echo 3. 运行以下命令：
echo    cloudflared tunnel --url http://localhost:8000
echo.
echo 4. 复制生成的公网 URL（类似 https://xxx.trycloudflare.com）
echo.
echo 5. 在 n8n 中将 URL 改为公网地址
echo.
echo 按任意键继续...
pause
