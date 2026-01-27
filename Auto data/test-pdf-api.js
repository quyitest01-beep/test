const axios = require('axios');
const fs = require('fs');

// 测试 PDF API
async function testPDFAPI() {
  console.log('测试 PDF 渲染 API...\n');

  try {
    // 测试1: 健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await axios.get('http://localhost:8787/health');
    console.log('✓ 健康检查成功:', healthResponse.data);
    console.log('');

    // 测试2: 渲染简单的 HTML
    console.log('2. 测试 HTML 转 PDF...');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; }
          p { line-height: 1.6; }
          .highlight { background-color: #ffeb3b; padding: 10px; }
        </style>
      </head>
      <body>
        <h1>测试 PDF 文档</h1>
        <p>这是一个测试文档，用于验证 PDF 渲染服务是否正常工作。</p>
        <div class="highlight">
          <strong>重要提示：</strong>这个服务支持中文！
        </div>
        <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      </body>
      </html>
    `;

    const pdfResponse = await axios.post('http://localhost:8787/render', {
      html: html,
      filename: '测试文档.pdf',
      options: {
        format: 'A4',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      }
    }, {
      responseType: 'arraybuffer'
    });

    // 保存 PDF 文件
    const outputPath = 'test-output.pdf';
    fs.writeFileSync(outputPath, pdfResponse.data);
    console.log(`✓ PDF 生成成功！文件已保存到: ${outputPath}`);
    console.log(`  文件大小: ${(pdfResponse.data.length / 1024).toFixed(2)} KB`);
    console.log('');

    // 测试3: 从 URL 渲染（可选）
    console.log('3. 测试从 URL 渲染 PDF...');
    const urlResponse = await axios.post('http://localhost:8787/render-url', {
      url: 'https://example.com',
      filename: 'example.pdf'
    }, {
      responseType: 'arraybuffer'
    });

    const urlOutputPath = 'test-url-output.pdf';
    fs.writeFileSync(urlOutputPath, urlResponse.data);
    console.log(`✓ URL 转 PDF 成功！文件已保存到: ${urlOutputPath}`);
    console.log(`  文件大小: ${(urlResponse.data.length / 1024).toFixed(2)} KB`);
    console.log('');

    console.log('========================================');
    console.log('所有测试通过！PDF API 运行正常 ✓');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testPDFAPI();
