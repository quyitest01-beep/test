// 测试直接webhook发送的双语言报告处理逻辑
const axios = require('axios');

// 模拟上游数据结构
const mockUpstreamData = [
  {
    "code": 0,
    "data": {
      "file_key": "file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu"
    },
    "msg": "success"
  },
  {
    "html": "<!DOCTYPE html>\n<html lang=\"zh-CN\">...",
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

// 模拟n8n Code节点的新处理逻辑
function processUpstreamDataForDirectWebhook(items) {
  let webhookUrl = 'https://httpbin.org/post'; // 测试用webhook
  let publicBaseUrl = 'http://localhost:8000';
  
  // 解析上游数据
  let fileKeys = [];
  let htmlReports = [];
  let tokenInfo = null;

  // 第一步：分类收集数据
  for (const item of items) {
    const data = item;
    
    // 收集文件上传结果
    if (data && data.code === 0 && data.data && data.data.file_key) {
      fileKeys.push(data.data.file_key);
    }
    
    // 收集HTML报告信息
    if (data && data.html && data.title) {
      // 智能语言检测
      let detectedLanguage = data.language;
      if (!detectedLanguage) {
        // 基于标题内容判断语言
        if (data.title.includes('Daily') || data.title.includes('Report') || /^[A-Za-z0-9\s_-]+$/.test(data.title)) {
          detectedLanguage = 'en';
        } else {
          detectedLanguage = 'zh';
        }
      }
      
      htmlReports.push({
        title: data.title,
        period: data.period,
        timestamp: data.timestamp,
        language: detectedLanguage,
        html_content: data.html
      });
    }
    
    // 收集认证token信息
    if (data && data.tenant_access_token) {
      tokenInfo = {
        token: data.tenant_access_token,
        expire: data.expire
      };
    }
  }

  // 第二步：构建报告数组
  let reports = [];

  // 按语言排序HTML报告（中文在前，英文在后）
  htmlReports.sort((a, b) => {
    if (a.language === 'zh' && b.language === 'en') return -1;
    if (a.language === 'en' && b.language === 'zh') return 1;
    return 0;
  });

  // 智能匹配HTML报告和文件keys
  if (htmlReports.length > 0 && fileKeys.length > 0) {
    // 情况1：有多个HTML报告，按语言匹配文件
    if (htmlReports.length > 1) {
      for (let i = 0; i < htmlReports.length; i++) {
        const htmlReport = htmlReports[i];
        const fileKey = fileKeys[i] || fileKeys[0]; // 如果文件不够，使用第一个文件
        
        reports.push({
          title: htmlReport.title,
          file_key: fileKey,
          language: htmlReport.language,
          period: htmlReport.period,
          timestamp: htmlReport.timestamp
        });
      }
    } else {
      // 情况2：只有一个HTML报告，但可能有多个文件
      const htmlReport = htmlReports[0];
      
      // 创建中文报告
      reports.push({
        title: htmlReport.title,
        file_key: fileKeys[0],
        language: htmlReport.language,
        period: htmlReport.period,
        timestamp: htmlReport.timestamp
      });
      
      // 如果有第二个文件，创建对应语言的报告
      if (fileKeys.length > 1) {
        const alternateLanguage = htmlReport.language === 'zh' ? 'en' : 'zh';
        const alternateTitle = htmlReport.language === 'zh' 
          ? `Daily_Report_${htmlReport.period.replace(/\./g, '-')}`
          : `GMP日报_${htmlReport.period}`;
        
        reports.push({
          title: alternateTitle,
          file_key: fileKeys[1],
          language: alternateLanguage,
          period: htmlReport.period,
          timestamp: htmlReport.timestamp
        });
      }
    }
  } else if (fileKeys.length > 0) {
    // 情况3：没有HTML报告，使用文件keys创建默认报告
    const defaultPeriod = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    
    // 中文报告
    reports.push({
      title: `GMP日报_${defaultPeriod}`,
      file_key: fileKeys[0],
      language: 'zh',
      period: defaultPeriod
    });
    
    // 英文报告
    if (fileKeys.length > 1) {
      reports.push({
        title: `GMPDailyReport_${defaultPeriod}`,
        file_key: fileKeys[1],
        language: 'en',
        period: defaultPeriod
      });
    } else {
      // 使用同一个文件创建英文版本
      reports.push({
        title: `GMPDailyReport_${defaultPeriod}`,
        file_key: fileKeys[0],
        language: 'en',
        period: defaultPeriod
      });
    }
  }

  // 第三步：确保至少有一个报告（兜底逻辑）
  if (reports.length === 0) {
    reports = [
      {
        title: 'GMP日报_2026.02.03-02',
        file_key: 'file_v3_00uj_280e2e8f-767e-46ce-b807-3a98e17347hu',
        language: 'zh',
        period: '2026.02.03-02'
      }
    ];
  }

  // 第四步：生成下载链接
  const downloadLinks = reports.map(report => {
    const encodedTitle = encodeURIComponent(report.title);
    return {
      title: report.title,
      language: report.language,
      downloadUrl: `${publicBaseUrl}/lark-download/${report.file_key}?filename=${encodedTitle}`
    };
  });

  // 第五步：构建Lark消息卡片
  const card = {
    config: { 
      wide_screen_mode: true, 
      enable_forward: true 
    },
    header: {
      template: 'blue',
      title: { 
        tag: 'plain_text', 
        content: `📊 报告已生成 (${reports.length}个文件)` 
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**生成时间：** ${new Date().toLocaleString()}\n` +
                  `**报告周期：** ${reports[0]?.period || '最新数据'}\n` +
                  `**文件数量：** ${reports.length}个`
        },
      },
      { tag: 'hr' }
    ],
  };

  // 添加每个报告的下载链接
  downloadLinks.forEach((report, index) => {
    const languageFlag = report.language === 'zh' ? '🇨🇳' : '🇺🇸';
    
    card.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `${languageFlag} **${report.title}**\n` +
                `🔗 [点击下载](${report.downloadUrl})`
      },
    });

    // 添加分隔线（除了最后一个）
    if (index < downloadLinks.length - 1) {
      card.elements.push({ tag: 'hr' });
    }
  });

  // 添加下载按钮组（如果报告数量不超过5个）
  const actions = downloadLinks.map(report => ({
    tag: 'button',
    text: {
      tag: 'plain_text',
      content: `📥 ${report.title}`
    },
    type: 'primary',
    url: report.downloadUrl
  }));

  if (actions.length <= 5) { // Lark限制最多5个按钮
    card.elements.push(
      { tag: 'hr' },
      {
        tag: 'action',
        actions: actions
      }
    );
  }

  // 添加说明
  card.elements.push(
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `💡 **使用说明：**\n` +
                `• 点击链接或按钮直接下载\n` +
                `• 文件名会自动使用报告标题\n` +
                `• 链接长期有效，可以分享给其他人\n\n` +
                `🔄 如有问题，请联系技术支持`
      },
    }
  );

  // 构建Lark webhook请求体
  const webhookPayload = {
    msg_type: 'interactive',
    card: card
  };
  
  return {
    webhookUrl,
    webhookPayload,
    downloadLinks,
    summary: {
      reportCount: reports.length,
      languages: [...new Set(reports.map(r => r.language))],
      period: reports[0]?.period
    }
  };
}

// 测试处理逻辑
async function testDirectWebhookProcessing() {
  console.log('=== 测试直接Webhook发送的双语言报告处理逻辑 ===\n');
  
  console.log('1. 原始上游数据:');
  console.log(JSON.stringify(mockUpstreamData, null, 2));
  
  console.log('\n2. 处理后的结果:');
  const result = processUpstreamDataForDirectWebhook(mockUpstreamData);
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n3. 测试Webhook调用:');
  try {
    const response = await axios.post(result.webhookUrl, result.webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Webhook调用成功');
    console.log('状态码:', response.status);
    console.log('响应摘要:', {
      url: response.config.url,
      method: response.config.method,
      dataSize: JSON.stringify(response.config.data).length
    });
    
  } catch (error) {
    console.log('❌ Webhook调用失败:', error.response?.data || error.message);
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
  await testDirectWebhookProcessing();
  await testDownloadLinks();
}

runAllTests().catch(console.error);