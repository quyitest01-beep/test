@echo off
echo 安装 AWS S3 预签名URL 依赖包...
cd backend
npm install @aws-sdk/s3-request-presigner@^3.478.0
echo.
echo 安装完成！
echo.
echo 重启后端服务以应用更改...
pause