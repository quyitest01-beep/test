// 测试Lark文件下载功能
const http = require('http');

function testLarkDownload() {
  console.log('=== 测试Lark文件下载功能 ===');
  
  // 使用一个示例file_key进行测试
  const testFileKey = 'BzfvbqKmXaTXotsyrMmlycZUg9g'; // 替换为实际的file_key
  
  console.log(`测试文件信息接口: http://localhost:8000/lark-file-info/${testFileKey}`);
  
  const fileInfoOptions = {
    hostname: 'localhost',
    port: 8000,
    path: `/lark-file-info/${testFileKey}`,
    method: 'GET'
  };

  const fileInfoReq = http.request(fileInfoOptions, (res) => {
    console.log(`文件信息响应状态: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('文件信息:', jsonData);
        
        if (jsonData.success) {
          console.log('✅ 文件信息获取成功');
          console.log(`文件名: ${jsonData.data.file_name}`);
          console.log(`文件大小: ${jsonData.data.file_size} bytes`);
          console.log(`下载链接: ${jsonData.data.direct_url}`);
          
          // 测试下载链接
          testDownloadLink(testFileKey);
        } else {
          console.log('❌ 文件信息获取失败:', jsonData.message);
        }
      } catch (e) {
        console.log('响应数据:', data);
      }
    });
  });

  fileInfoReq.on('error', (err) => {
    console.log('❌ 文件信息请求失败:', err.message);
    console.log('请确保：');
    console.log('1. 后端服务正在运行 (端口8000)');
    console.log('2. 环境变量 LARK_APP_ID 和 LARK_APP_SECRET 已设置');
  });

  fileInfoReq.end();
}

function testDownloadLink(fileKey) {
  console.log(`\n测试下载链接: http://localhost:8000/lark-download/${fileKey}`);
  
  const downloadOptions = {
    hostname: 'localhost',
    port: 8000,
    path: `/lark-download/${fileKey}`,
    method: 'GET'
  };

  const downloadReq = http.request(downloadOptions, (res) => {
    console.log(`下载响应状态: ${res.statusCode}`);
    console.log('响应头:', res.headers);
    
    if (res.statusCode === 200) {
      console.log('✅ 下载链接正常工作！');
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Disposition: ${res.headers['content-disposition']}`);
      
      // 不实际下载文件，只检查响应
      res.on('data', () => {
        // 忽略数据
      });
      
      res.on('end', () => {
        console.log('🎉 Lark文件下载功能正常！');
      });
    } else {
      let errorData = '';
      res.on('data', (chunk) => {
        errorData += chunk;
      });
      
      res.on('end', () => {
        try {
          const errorJson = JSON.parse(errorData);
          console.log('❌ 下载失败:', errorJson.message);
        } catch (e) {
          console.log('❌ 下载失败:', errorData);
        }
      });
    }
  });

  downloadReq.on('error', (err) => {
    console.log('❌ 下载请求失败:', err.message);
  });

  downloadReq.end();
}

// 运行测试
testLarkDownload();