@echo off
echo # 服务器配置 > .env
echo PORT=8000 >> .env
echo NODE_ENV=development >> .env
echo. >> .env
echo # AWS Athena 配置 >> .env
echo AWS_REGION=us-west-2 >> .env
echo AWS_ACCESS_KEY_ID=AKIAQQJLCWBOOKC7J6ZI >> .env
echo AWS_SECRET_ACCESS_KEY=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 >> .env
echo ATHENA_DATABASE=gmp >> .env
echo ATHENA_OUTPUT_LOCATION=s3://gmp-asia-gamehistory-athena-results/query-results/ >> .env
echo ATHENA_WORKGROUP=primary >> .env
echo. >> .env
echo # API 密钥 >> .env
echo API_KEYS=f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d >> .env
echo. >> .env
echo # 查询限制 >> .env
echo MAX_QUERY_TIMEOUT=300000 >> .env
echo MAX_RESULT_SIZE=1000000 >> .env
echo .env 文件创建完成！












