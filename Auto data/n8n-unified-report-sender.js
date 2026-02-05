// n8n Code节点：统一发送多个报告
const items = $input.all();

// 从上游节点收集报告信息
let reports = [];
let webhookUrl = '';
let publicBaseUrl = 'https://your-ngrok-url.ngrok.io'; // 🔴 替换为你的ngrok URL

// 扫描所有输入，收集报告信息
for (const item of items) {
  const j = item.json || {};
  
  // 收集报告文件信息
  if (j.file_key && j.title) {
    reports.push({
      title: j.title,
      file_key: j.file_key,
      language: j.language || 'zh', // 默认中文
      period: j.period || new Date().toISOString().split('T')[0]
    });
  }
  
  // 获取webhook URL（如果有的话）
  if (j.webhook_url) {
    webhookUrl = j.webhook_url;
  }
}

// 如果没有从输入获取webhook URL，使用默认的
if (!webhookUrl) {
  webhookUrl = 'https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL_HERE'; // 🔴 替换为实际webhook
}

// 如果没有收集到报告，尝试手动构建（用于测试）
if (reports.length === 0) {
  // 示例数据结构
  reports = [
    {
      title: '每日数据报告_2024-02-04',
      file_key: 'file_v3_00uj_b45c29a2-48a3-48a3-9ff0-cbe43cc88bhu', // 🔴 替换为实际file_key
      language: 'zh',
      period: '2024-02-04'
    },
    {
      title: 'Daily_Data_Report_2024-02-04',
      file_key: 'file_v3_00uj_another_file_key_here', // 🔴 替换为实际file_key
      language: 'en', 
      period: '2024-02-04'
    }
  ];
}

// 构建API请求
const apiRequest = {
  reports: reports,
  webhook_url: webhookUrl,
  public_base_url: publicBaseUrl
};

// 生成下载链接预览（用于调试）
const downloadLinks = reports.map(report => {
  const encodedTitle = encodeURIComponent(report.title);
  return {
    title: report.title,
    language: report.language,
    downloadUrl: `${publicBaseUrl}/lark-download/${report.file_key}?filename=${encodedTitle}`
  };
});

return [{
  json: {
    // API请求数据
    apiRequest: apiRequest,
    
    // 预览信息
    summary: {
      reportCount: reports.length,
      languages: [...new Set(reports.map(r => r.language))],
      period: reports[0]?.period
    },
    
    // 下载链接预览
    downloadLinks: downloadLinks,
    
    // 调试信息
    debug: {
      inputItemsCount: items.length,
      reportsFound: reports.length,
      hasWebhookUrl: !!webhookUrl,
      publicBaseUrl: publicBaseUrl
    }
  }
}];

// 使用说明：
// 1. 将此代码放在n8n的Code节点中
// 2. 确保上游节点提供了file_key和title信息
// 3. 替换publicBaseUrl为你的ngrok URL
// 4. 替换webhookUrl为你的Lark群webhook
// 5. 下一个节点使用HTTP Request调用 POST /api/send-reports