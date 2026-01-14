@echo off
echo 测试分区查询...
echo.

echo 1. 测试简单查询
powershell -Command "$body = '{\"sql\": \"SELECT 1 as test\"}'; Invoke-RestMethod -Uri 'https://tune-josh-lee-flower.trycloudflare.com/api/webhook/query/sql' -Method POST -Headers @{'X-API-Key'='f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'; 'Content-Type'='application/json'} -Body $body"
echo.

echo 2. 测试分区信息
powershell -Command "$body = '{\"sql\": \"SHOW PARTITIONS game_records LIMIT 3\"}'; Invoke-RestMethod -Uri 'https://tune-josh-lee-flower.trycloudflare.com/api/webhook/query/sql' -Method POST -Headers @{'X-API-Key'='f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'; 'Content-Type'='application/json'} -Body $body"
echo.

echo 3. 测试特定分区查询
powershell -Command "$body = '{\"sql\": \"SELECT COUNT(*) FROM game_records WHERE hour = ''2024-10-10'' LIMIT 1\"}'; Invoke-RestMethod -Uri 'https://tune-josh-lee-flower.trycloudflare.com/api/webhook/query/sql' -Method POST -Headers @{'X-API-Key'='f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'; 'Content-Type'='application/json'} -Body $body"
echo.

pause












