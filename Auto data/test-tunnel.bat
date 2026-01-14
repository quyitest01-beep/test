@echo off
echo 测试 Cloudflare Tunnel 连接...
echo.

REM 这里需要替换为你的实际隧道 URL
set TUNNEL_URL=https://your-tunnel-url.trycloudflare.com

echo 请将 TUNNEL_URL 替换为你的实际隧道地址
echo 然后运行以下命令测试：
echo.
echo powershell -Command "Invoke-RestMethod -Uri \"%TUNNEL_URL%/api/webhook/health\" -Headers @{\"X-API-Key\"=\"f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d\"}"
echo.
echo 按任意键继续...
pause

