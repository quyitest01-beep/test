// 简单测试下载路由（不需要额外依赖）
const http = require('http');

function testDownload() {
  console.log('=== 测试下载功能 ===');
  
  // 测试健康检查
  const healthOptions = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/health',
    method: 'GET'
  };

  const healthReq = http.request(healthOptions, (res) => {
    console.log(`✅ 后端服务状态: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      // 测试下载路由
      testDownloadRoute();
    } else {
      console.log('❌ 后端服务异常');
    }
  });

  healthReq.on('error', (err) => {
    console.log('❌ 无法连接后端服务:', err.message);
    console.log('请确保后端服务正在运行 (端口8000)');
  });

  healthReq.end();
}

function testDownloadRoute() {
  const testFileKey = '81556de6-88db-4122-84e8-44c926f82054';
  
  const downloadOptions = {
    hostname: 'localhost',
    port: 8000,
    path: `/download/${testFileKey}`,
    method: 'GET'
  };

  console.log(`\n测试下载链接: http://localhost:8000/download/${testFileKey}`);

  const downloadReq = http.request(downloadOptions, (res) => {
    console.log(`下载响应状态: ${res.statusCode}`);
    
    if (res.statusCode === 302 || res.statusCode === 301) {
      console.log('✅ 下载重定向成功!');
      console.log('重定向到:', res.headers.location);
      console.log('\n🎉 下载功能正常工作！');
    } else if (res.statusCode === 404) {
      console.log('❌ 下载路由未找到 - 需要重启后端服务');
    } else {
      console.log('响应头:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('响应数据:', jsonData);
        } catch (e) {
          console.log('响应数据:', data.substring(0, 200));
        }
      });
    }
  });

  downloadReq.on('error', (err) => {
    console.log('❌ 下载测试失败:', err.message);
  });

  downloadReq.end();
}

// 运行测试
testDownload();