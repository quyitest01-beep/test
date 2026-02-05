/**
 * 测试 /api/query/file-size/batch API 的下载链接功能
 * 当文件大小超过500KB时，应该返回预签名下载URL
 */

const axios = require('axios');

// 配置
const API_BASE_URL = 'http://localhost:8000';
const API_ENDPOINT = '/api/query/file-size/batch';

// 测试查询ID（请替换为实际的查询ID）
const TEST_QUERY_IDS = [
  '81556de6-88db-4122-84e8-44c926f82054', // 这个应该是一个大文件
  // 可以添加更多查询ID进行测试
];

async function testFileSizeBatchWithDownloadUrl() {
  try {
    console.log('🧪 测试 /api/query/file-size/batch API 下载链接功能');
    console.log('📍 API地址:', `${API_BASE_URL}${API_ENDPOINT}`);
    console.log('🔍 测试查询ID:', TEST_QUERY_IDS);
    console.log('');

    const response = await axios.post(`${API_BASE_URL}${API_ENDPOINT}`, {
      queryIds: TEST_QUERY_IDS
    });

    console.log('✅ API调用成功');
    console.log('📊 响应状态:', response.status);
    console.log('');

    const data = response.data;
    
    if (data.success) {
      console.log('📈 批量查询结果:');
      console.log(`   总查询数: ${data.totalQueries}`);
      console.log(`   成功查询数: ${data.successfulQueries}`);
      console.log(`   失败查询数: ${data.failedQueries}`);
      console.log('');

      // 分析每个查询结果
      data.data.forEach((result, index) => {
        console.log(`📄 查询 ${index + 1}: ${result.queryId}`);
        
        if (result.success) {
          const fileSize = result.fileSize;
          const sizeInKB = Math.round(fileSize.totalSizeBytes / 1024);
          const isLargeFile = fileSize.totalSizeBytes > 500 * 1024;
          
          console.log(`   ✅ 成功`);
          console.log(`   📏 文件大小: ${fileSize.formattedSize} (${sizeInKB} KB)`);
          console.log(`   📁 文件数量: ${fileSize.fileCount}`);
          console.log(`   🗂️  Bucket: ${result.bucket}`);
          console.log(`   🔑 FileKey: ${result.fileKey}`);
          console.log(`   📊 处理建议: ${result.recommendation.action}`);
          
          // 检查下载链接
          if (isLargeFile) {
            if (result.downloadUrl) {
              console.log(`   🔗 下载链接: ✅ 已生成 (${result.downloadUrl.length} 字符)`);
              console.log(`   🌐 URL预览: ${result.downloadUrl.substring(0, 100)}...`);
              
              // 验证URL格式
              if (result.downloadUrl.includes('X-Amz-Algorithm') && 
                  result.downloadUrl.includes('X-Amz-Signature')) {
                console.log(`   ✅ URL格式正确 (包含AWS签名参数)`);
              } else {
                console.log(`   ❌ URL格式可能有问题`);
              }
            } else {
              console.log(`   ❌ 下载链接: 未生成 (文件>500KB但没有URL)`);
            }
          } else {
            console.log(`   ℹ️  下载链接: 不需要 (文件<500KB)`);
            if (result.downloadUrl) {
              console.log(`   ⚠️  警告: 小文件不应该有下载链接`);
            }
          }
        } else {
          console.log(`   ❌ 失败: ${result.error}`);
          console.log(`   💬 消息: ${result.message}`);
        }
        console.log('');
      });

      // 统计下载链接生成情况
      const resultsWithUrls = data.data.filter(r => r.success && r.downloadUrl);
      const largeFiles = data.data.filter(r => r.success && r.fileSize.totalSizeBytes > 500 * 1024);
      
      console.log('📊 下载链接统计:');
      console.log(`   大文件数量 (>500KB): ${largeFiles.length}`);
      console.log(`   生成下载链接数量: ${resultsWithUrls.length}`);
      
      if (largeFiles.length === resultsWithUrls.length) {
        console.log('   ✅ 所有大文件都生成了下载链接');
      } else {
        console.log('   ⚠️  部分大文件未生成下载链接');
      }

    } else {
      console.log('❌ API返回失败:', data.error || data.message);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    
    if (error.response) {
      console.error('📄 响应状态:', error.response.status);
      console.error('📄 响应数据:', error.response.data);
    } else if (error.request) {
      console.error('📡 网络错误: 无法连接到服务器');
    }
  }
}

// 运行测试
console.log('🚀 启动测试...\n');
testFileSizeBatchWithDownloadUrl()
  .then(() => {
    console.log('\n✅ 测试完成');
  })
  .catch((error) => {
    console.error('\n❌ 测试异常:', error.message);
  });