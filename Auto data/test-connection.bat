@echo off
echo 测试 API 连接...
timeout /t 3 /nobreak > nul
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:8000/api/webhook/health' -Headers @{'X-API-Key'='f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'}"
pause

