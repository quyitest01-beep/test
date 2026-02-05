// 测试统一报告发送API
const axios = require('axios');

async function testUnifiedAPI() {
  console.log('=== 测试统一报告发送API ===');
  
  const testData = {
    reports: [
      {
        title: '每日数据报告_2024-02-04',
        file_key: 'file_v3_00uj_b45c29a2-48a3-48a3-9ff0-cbe43cc88bhu', // 使用之前测试成功的file_key
        language: 'zh',
        period: '2024-02-04'
      },
      {
        title: 'Daily_Data_Report_2024-02-04',
        file_key: 'file_v3_00uj_b45c29a2-48a3-48a3-9ff0-cbe43cc88bhu', // 同一个文件，不同标题
        language: 'en',
        period: '2024-02-04'
      }
    ],
    webhook_url: 'https://httpbin.org/post', // 使用httpbin测试webhook
    public_base_url: 'http://localhost:8000' // 本地测试
  };

  try {
    console.log('\n1. 发送API请求...');
    console.log('请求数据:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post('http://localhost:8000/api/send-reports', testData);
    
    console.log('\n2. API响应:');
    console.log('状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ 统一API测试成功！');
      console.log(`📊 发送了 ${response.data.data.reportCount} 个报告`);
      
      console.log('\n📋 生成的下载链接:');
      response.data.data.reports.forEach((report, index) => {
        console.log(`${index + 1}. ${report.title}`);
        console.log(`   语言: ${report.language}`);
        console.log(`   链接: ${report.downloadUrl}`);
        console.log('');
      });
    } else {
      console.log('❌ API调用失败:', response.data.message);
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 测试自定义文件名下载
async function testCustomFilename() {
  console.log('\n=== 测试自定义文件名下载 ===');
  
  const testUrls = [
    'http://localhost:8000/lark-download/file_v3_00uj_b45c29a2-48a3-48a3-9ff0-cbe43cc88bhu?filename=每日数据报告_2024-02-04',
    'http://localhost:8000/lark-download/file_v3_00uj_b45c29a2-48a3-48a3-9ff0-cbe43cc88bhu?filename=Daily_Data_Report_2024-02-04'
  ];
  
  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n${i + 1}. 测试URL: ${url}`);
    
    try {
      const response = await axios.head(url); // 只获取头信息，不下载文件
      console.log('✅ 链接有效');
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Content-Disposition:', response.headers['content-disposition']);
    } catch (error) {
      console.log('❌ 链接无效:', error.response?.status || error.message);
    }
  }
}

// 运行测试
async function runTests() {
  await testUnifiedAPI();
  await testCustomFilename();
}

runTests();