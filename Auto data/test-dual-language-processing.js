// 测试双语言报告处理逻辑
const axios = require('axios');

// 模拟上游数据结构（基于你提供的实际数据）
const mockUpstreamData = [
  {
    "code": 0,
    "data": {
      "file_key": "file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu"
    },
    "msg": "success"
  },
  {
    "html": "<!DOCTYPE html>\n<html lang=\"zh-CN\">...", // 简化的HTML内容
    "title": "GMP日报_2026.02.03-02",
    "period": "2026.02.03-02",
    "timestamp": "2026-02-04T09:03:47.709Z"
  },
  {
    "code": 0,
    "expire": 2742,
    "msg": "ok",
    "tenant_access_token": "t-g206247NLPL3J5L63PFFAZKVKQ54GXHEZETGQOV6"
  },
  {
    "code": 0,
    "data": {
      "file_key": "file_v3_00uj_5dd0567b-378e-4313-aac3-2405d1194fhu"
    },
    "msg": "success"
  }
];

// 模拟n8n Code节点的处理逻辑
function processUpstreamData(items) {
  let reports = [];
  let webhookUrl = 'https://httpbin.org/post'; // 测试用webhook
  let publicBaseUrl = 'http://localhost:8000'; // 本地测试
  
  // 从输入数据中提取信息
  const fileKeys = [];
  let htmlMeta = null;
  
  for (const item of items) {
    const data = item;
    
    // 收集文件上传结果
    if (data && data.code === 0 && data.data && data.data.file_key) {
      fileKeys.push(data.data.file_key);
    }
    
    // 收集HTML元数据
    if (data && data.html && data.title) {
      htmlMeta = {
        title: data.title,
        period: data.period,
        timestamp: data.timestamp
      };
    }
  }
  
  console.log('提取到的文件keys:', fileKeys);
  console.log('提取到的HTML元数据:', htmlMeta);
  
  // 构建报告数组
  if (htmlMeta && fileKeys.length > 0) {
    // 中文报告
    reports.push({
      title: htmlMeta.title,
      file_key: fileKeys[0],
      language: 'zh',
      period: htmlMeta.period
    });
    
    // 英文报告（如果有第二个文件）
    if (fileKeys.length > 1) {
      reports.push({
        title: `Daily_Report_${htmlMeta.period.replace(/\./g, '-')}`,
        file_key: fileKeys[1],
        language: 'en',
        period: htmlMeta.period
      });
    } else {
      // 使用同一个文件，不同标题
      reports.push({
        title: `Daily_Report_${htmlMeta.period.replace(/\./g, '-')}`,
        file_key: fileKeys[0],
        language: 'en',
        period: htmlMeta.period
      });
    }
  }
  
  // 构建API请求
  const apiRequest = {
    reports: reports,
    webhook_url: webhookUrl,
    public_base_url: publicBaseUrl
  };
  
  // 生成下载链接
  const downloadLinks = reports.map(report => {
    const encodedTitle = encodeURIComponent(report.title);
    return {
      title: report.title,
      language: report.language,
      downloadUrl: `${publicBaseUrl}/lark-download/${report.file_key}?filename=${encodedTitle}`
    };
  });
  
  return {
    apiRequest,
    downloadLinks,
    summary: {
      reportCount: reports.length,
      languages: [...new Set(reports.map(r => r.language))],
      period: reports[0]?.period
    }
  };
}

// 测试处理逻辑
async function testProcessing() {
  console.log('=== 测试双语言报告处理逻辑 ===\n');
  
  console.log('1. 原始上游数据:');
  console.log(JSON.stringify(mockUpstreamData, null, 2));
  
  console.log('\n2. 处理后的结果:');
  const result = processUpstreamData(mockUpstreamData);
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n3. 测试API调用:');
  try {
    const response = await axios.post('http://localhost:8000/api/send-reports', result.apiRequest);
    console.log('✅ API调用成功');
    console.log('状态码:', response.status);
    console.log('响应摘要:', {
      success: response.data.success,
      reportCount: response.data.data?.reportCount,
      message: response.data.message
    });
    
    if (response.data.success && response.data.data.reports) {
      console.log('\n📋 生成的下载链接:');
      response.data.data.reports.forEach((report, index) => {
        console.log(`${index + 1}. ${report.title} (${report.language})`);
        console.log(`   ${report.downloadUrl}`);
      });
    }
    
  } catch (error) {
    console.log('❌ API调用失败:', error.response?.data || error.message);
  }
}

// 测试下载链接
async function testDownloadLinks() {
  console.log('\n=== 测试下载链接 ===');
  
  const testFileKey = 'file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu';
  const testUrls = [
    `http://localhost:8000/lark-download/${testFileKey}?filename=GMP日报_2026.02.03-02`,
    `http://localhost:8000/lark-download/${testFileKey}?filename=Daily_Report_2026-02-03-02`
  ];
  
  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n${i + 1}. 测试: ${url}`);
    
    try {
      const response = await axios.head(url);
      console.log('✅ 链接有效');
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Content-Disposition:', response.headers['content-disposition']);
    } catch (error) {
      console.log('❌ 链接测试失败:', error.response?.status || error.message);
    }
  }
}

// 运行所有测试
async function runAllTests() {
  await testProcessing();
  await testDownloadLinks();
}

runAllTests().catch(console.error);