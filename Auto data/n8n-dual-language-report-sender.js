// n8n Code节点：处理双语言报告发送
// 适用于新的上游数据结构：包含中英文HTML报告和文件上传结果

const items = $input.all();

// 配置信息 - 🔴 请根据实际情况修改
let webhookUrl = 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909'; // 🔴 替换为实际webhook
let publicBaseUrl = 'https://integrity-trembl-bare-pole.trycloudflare.com'; // 🔴 替换为你的ngrok URL

// 解析上游数据
let fileKeys = [];
let htmlReports = [];
let tokenInfo = null;

// 第一步：分类收集数据
for (const item of items) {
  const data = item.json;
  
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
      title: 'GMP日报',
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
              `• 点击链接或按钮直接下载\n`
    },
  }
);

// 构建Lark webhook请求体
const webhookPayload = {
  msg_type: 'interactive',
  card: card
};

// 调试信息
const debugInfo = {
  inputItemsCount: items.length,
  fileKeysFound: fileKeys.length,
  htmlReportsFound: htmlReports.length,
  reportsGenerated: reports.length,
  hasWebhookUrl: !!webhookUrl && !webhookUrl.includes('YOUR_WEBHOOK_URL_HERE'),
  hasPublicBaseUrl: !!publicBaseUrl && !publicBaseUrl.includes('your-ngrok-url'),
  tokenInfo: tokenInfo ? { hasToken: true, expire: tokenInfo.expire } : null,
  rawInputSample: items.slice(0, 3).map(item => ({
    hasCode: !!item.json?.code,
    hasFileKey: !!item.json?.data?.file_key,
    hasTitle: !!item.json?.title,
    hasHtml: !!item.json?.html,
    hasTenantToken: !!item.json?.tenant_access_token,
    title: item.json?.title,
    language: item.json?.language
  }))
};

return [{
  json: {
    // Lark webhook URL (用于HTTP Request节点)
    webhookUrl: webhookUrl,
    
    // 用于下一个HTTP Request节点的Lark webhook请求体
    webhookPayload: webhookPayload,
    
    // 预览信息
    summary: {
      reportCount: reports.length,
      languages: [...new Set(reports.map(r => r.language))],
      period: reports[0]?.period,
      titles: reports.map(r => r.title)
    },
    
    // 下载链接预览
    downloadLinks: downloadLinks,
    
    // 调试信息
    debug: debugInfo
  }
}];

// 使用说明：
// 1. 将此代码放在n8n的Code节点中
// 2. 确保上游节点提供了文件上传结果和HTML内容
// 3. 替换webhookUrl为你的Lark群webhook地址
// 4. 替换publicBaseUrl为你的ngrok公网地址
// 5. 下一个节点使用HTTP Request直接调用Lark webhook
// 6. HTTP Request节点配置：
//    - Method: POST
//    - URL: {{ $json.webhookUrl }} (使用上面配置的webhookUrl变量)
//    - Body: {{ $json.webhookPayload }}
//    - Headers: Content-Type: application/json
//
// 数据结构说明：
// - 支持多种上游数据格式
// - 自动识别中英文报告
// - 智能匹配文件和报告
// - 直接生成Lark消息卡片
// - 提供详细的调试信息
// - 兜底机制确保始终有报告输出