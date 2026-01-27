@echo off
echo ========================================
echo 测试 PDF 渲染 API
echo ========================================
echo.

echo 1. 测试健康检查...
curl http://localhost:8787/health
echo.
echo.

echo 2. 生成测试 PDF...
echo 正在创建测试 HTML 文件...

REM 创建临时 JSON 文件
echo {"html":"^<html^>^<head^>^<meta charset='UTF-8'^>^<style^>body{font-family:Arial;padding:40px}h1{color:#333}^</style^>^</head^>^<body^>^<h1^>测试文档^</h1^>^<p^>这是一个测试 PDF 文档^</p^>^<p^>生成时间: %date% %time%^</p^>^</body^>^</html^>","filename":"test.pdf"} > test-request.json

echo 正在调用 PDF API...
curl -X POST http://localhost:8787/render -H "Content-Type: application/json" -d @test-request.json --output test-output.pdf

echo.
if exist test-output.pdf (
    echo ✓ PDF 生成成功！
    echo 文件位置: %CD%\test-output.pdf
    echo.
    echo 正在打开 PDF 文件...
    start test-output.pdf
) else (
    echo ✗ PDF 生成失败
)

REM 清理临时文件
del test-request.json

echo.
echo 测试完成！
pause
