@echo off
echo 修复 S3 输出位置配置...
echo.

echo 当前配置：
type .env | findstr "ATHENA_OUTPUT_LOCATION"

echo.
echo 建议的修复方案：
echo 1. 使用简化的 S3 路径
echo 2. 确保存储桶存在且有权限
echo 3. 确保存储桶在正确的区域 (us-west-2)
echo.

echo 请手动编辑 .env 文件，将：
echo ATHENA_OUTPUT_LOCATION=s3://gmp-asia-gamehistory-athena-results/query-results/
echo 改为：
echo ATHENA_OUTPUT_LOCATION=s3://gmp-asia-gamehistory-athena-results/
echo.

echo 或者创建一个新的存储桶：
echo 1. 登录 AWS S3 控制台
echo 2. 创建存储桶：athena-query-results-us-west-2
echo 3. 确保在 us-west-2 区域
echo 4. 更新配置为：ATHENA_OUTPUT_LOCATION=s3://athena-query-results-us-west-2/
echo.

pause
