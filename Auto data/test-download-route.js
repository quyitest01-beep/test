// 测试下载路由是否正常工作
const axios = require('axios');

async function testDownloadRoute() {
  console.log('=== 测试下载路由 ===');
  
  try {
    // 1. 测试健康检查
    console.log('1. 测试后端健康状态...');
    const healthResponse = await axios.get('http://localhost:8000/api/health');
    console.log('✅ 后端服务正常:', healthResponse.data);
    
    // 2. 测试文件信息接口
    console.log('\n2. 测试文件信息接口...');
    const testFileKey = '81556de6-88db-4122-84e8-44c926f82054'; // 使用你之前的fileKey
    
    try {
      const fileInfoResponse = await axios.get(`http://localhost:8000/file-info/${testFileKey}`);
      console.log('✅ 文件信息获取成功:', fileInfoResponse.data);
      
      // 3. 测试下载链接（不实际下载，只检查重定向）
      console.log('\n3. 测试下载链接...');
      try {
        const downloadResponse = await axios.get(`http://localhost:8000/download/${testFileKey}`, {
          maxRedirects: 0, // 不跟随重定向
          validateStatus: function (status) {
            return status >= 200 && status < 400; // 接受重定向状态码
          }
        });
        
        if (downloadResponse.status === 302 || downloadResponse.status === 301) {
          console.log('✅ 下载重定向成功');
          console.log('重定向URL:', downloadResponse.headers.location);
        } else {
          console.log('✅ 下载响应:', downloadResponse.status);
        }
        
      } catch (downloadError) {
        if (downloadError.response && downloadError.response.status === 302) {
          console.log('✅ 下载重定向成功 (通过异常捕获)');
          console.log('重定向URL:', downloadError.response.headers.location);
        } else {
          console.log('❌ 下载测试失败:', downloadError.message);
          if (downloadError.response) {
            console.log('响应状态:', downloadError.response.status);
            console.log('响应数据:', downloadError.response.data);
          }
        }
      }
      
    } catch (fileInfoError) {
      console.log('❌ 文件信息获取失败:', fileInfoError.message);
      if (fileInfoError.response) {
        console.log('响应状态:', fileInfoError.response.status);
        console.log('响应数据:', fileInfoError.response.data);
      }
    }
    
  } catch (healthError) {
    console.log('❌ 后端服务连接失败:', healthError.message);
    console.log('请确保后端服务正在运行 (端口8000)');
  }
}

// 运行测试
testDownloadRoute().then(() => {
  console.log('\n=== 测试完成 ===');
}).catch(error => {
  console.error('测试过程中发生错误:', error);
});