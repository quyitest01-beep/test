// 测试PDF渲染API
const http = require('http');

function testRenderAPI() {
  console.log('=== 测试PDF渲染API ===');
  
  const testHTML = `
    <html>
      <head>
        <title>测试报告</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .content { margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>📊 测试报告</h1>
        <div class="content">
          <p><strong>生成时间:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>状态:</strong> PDF渲染服务正常工作</p>
          <p><strong>测试内容:</strong> 这是一个测试PDF文档</p>
        </div>
      </body>
    </html>
  `;

  const postData = JSON.stringify({
    html: testHTML,
    options: {
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    }
  });

  const options = {
    hostname: 'localhost',
    port: 8787,
    path: '/render',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('发送渲染请求到: http://localhost:8787/render');

  const req = http.request(options, (res) => {
    console.log(`响应状态: ${res.statusCode}`);
    console.log('响应头:', res.headers);

    if (res.statusCode === 200) {
      console.log('✅ PDF渲染成功！');
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Length: ${res.headers['content-length']} bytes`);
      
      // 保存PDF文件
      const fs = require('fs');
      const writeStream = fs.createWriteStream('test-render-output.pdf');
      
      res.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log('📄 PDF文件已保存为: test-render-output.pdf');
        console.log('🎉 /render API 正常工作！');
      });
      
    } else {
      let errorData = '';
      res.on('data', (chunk) => {
        errorData += chunk;
      });
      
      res.on('end', () => {
        console.log('❌ 渲染失败:', errorData);
      });
    }
  });

  req.on('error', (err) => {
    console.log('❌ 请求失败:', err.message);
    console.log('请确保PDF服务正在运行在端口8787');
  });

  req.write(postData);
  req.end();
}

// 运行测试
testRenderAPI();