/**
 * 验证下载URL功能是否正常工作
 */

const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function verifyDownloadUrlFeature() {
  console.log('🧪 验证下载URL功能\n');

  try {
    // 测试API调用
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/query/file-size/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const testData = JSON.stringify({
      queryIds: ['81556de6-88db-4122-84e8-44c926f82054']
    });

    console.log('📡 发送API请求...');
    const response = await makeRequest(options, testData);

    if (response.success) {
      console.log('✅ API调用成功');
      
      const result = response.data[0];
      if (result.success) {
        console.log(`📊 查询ID: ${result.queryId}`);
        console.log(`📁 Bucket: ${result.bucket}`);
        console.log(`🔑 FileKey: ${result.fileKey}`);
        
        if (result.fileSize) {
          console.log(`📏 文件大小: ${result.fileSize.formattedSize}`);
          console.log(`🔢 字节数: ${result.fileSize.totalSizeBytes}`);
          
          const isLargeFile = result.fileSize.totalSizeBytes > 500 * 1024;
          console.log(`📋 是否大文件 (>500KB): ${isLargeFile ? '是' : '否'}`);
          
          if (isLargeFile && result.downloadUrl) {
            console.log('✅ 下载URL已生成');
            console.log(`🔗 URL长度: ${result.downloadUrl.length} 字符`);
            console.log(`🌐 URL预览: ${result.downloadUrl.substring(0, 80)}...`);
            
            // 验证URL格式
            const hasAwsSignature = result.downloadUrl.includes('X-Amz-Signature');
            const hasAwsAlgorithm = result.downloadUrl.includes('X-Amz-Algorithm');
            const hasExpiration = result.downloadUrl.includes('X-Amz-Expires');
            
            console.log(`🔐 AWS签名: ${hasAwsSignature ? '✅' : '❌'}`);
            console.log(`🔐 AWS算法: ${hasAwsAlgorithm ? '✅' : '❌'}`);
            console.log(`⏰ 过期时间: ${hasExpiration ? '✅' : '❌'}`);
            
            if (hasAwsSignature && hasAwsAlgorithm && hasExpiration) {
              console.log('\n🎉 下载URL功能验证成功！');
              console.log('✅ 所有必要的AWS签名参数都存在');
              console.log('✅ URL格式正确');
              console.log('✅ 大文件自动生成下载链接');
            } else {
              console.log('\n⚠️ URL格式可能有问题');
            }
          } else if (isLargeFile && !result.downloadUrl) {
            console.log('❌ 大文件但未生成下载URL');
          } else {
            console.log('ℹ️ 小文件，无需下载URL');
          }
        } else {
          console.log('❌ 未获取到文件大小信息');
        }
      } else {
        console.log(`❌ 查询失败: ${result.error}`);
      }
    } else {
      console.log(`❌ API调用失败: ${response.error || response.message}`);
    }

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
}

// 运行验证
console.log('🚀 开始验证...\n');
verifyDownloadUrlFeature()
  .then(() => {
    console.log('\n✅ 验证完成');
  })
  .catch((error) => {
    console.error('\n❌ 验证异常:', error.message);
  });