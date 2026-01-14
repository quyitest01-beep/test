@echo off
echo 使用 ngrok 暴露本地服务到公网...
echo.
echo 1. 下载 ngrok：
echo    https://ngrok.com/download
echo.
echo 2. 注册账号并获取 authtoken
echo.
echo 3. 解压 ngrok.exe 到当前目录
echo.
echo 4. 运行以下命令：
echo    ngrok authtoken YOUR_AUTHTOKEN
echo    ngrok http 8000
echo.
echo 5. 复制生成的公网 URL（类似 https://xxx.ngrok.io）
echo.
echo 6. 在 n8n 中将 URL 改为公网地址
echo.
echo 按任意键继续...
pause
