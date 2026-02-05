// n8n Code节点：为外部群生成报告卡片（包含下载链接）
const items = $input.all();

if (!items.length) throw new Error('未收到上游数据');

let reportTitle = '数据报告';
let reportPeriod = '';
let generatedAt = new Date().toISOString().replace('T', ' ').replace('Z', '');
let fileKey = '';
let fileName = '';
let fileSize = '';

// 扫描所有上游数据，整合需要的信息
for (const item of items) {
  const j = item.json || {};
  
  // 从报告生成节点获取信息
  if (j.title || j.html || j.period) {
    reportTitle = j.title || reportTitle;
    reportPeriod = j.period || reportPeriod;
    generatedAt = j.timestamp || j.generatedAt || generatedAt;
  }
  
  // 从文件上传节点获取file_key
  if (!fileKey && (j.data?.file_key || j.file_key)) {
    fileKey = j.data?.file_key || j.file_key;
  }
  
  // 获取文件名和大小信息
  if (!fileName && (j.fileName || j.file_name)) {
    fileName = j.fileName || j.file_name;
  }
  
  if (!fileSize && (j.fileSize || j.file_size)) {
    fileSize = j.fileSize || j.file_size;
  }
}

// 如果没有fileKey，尝试从binary数据获取文件名
if (!fileName && items.some(item => item.binary?.data)) {
  const binaryItem = items.find(item => item.binary?.data);
  fileName = binaryItem.binary.data.fileName || '报告.pdf';
}

// 生成Lark文件下载链接（如果有fileKey）
let downloadUrl = '';
let backupMethod = '';

if (fileKey) {
  downloadUrl = `http://localhost:8000/lark-download/${fileKey}`;
  backupMethod = `文件ID: \`${fileKey}\``;
} else {
  backupMethod = '请联系管理员获取文件';
}

// ✅ 构建适合外部群的卡片
const card = {
  config: { 
    wide_screen_mode: true, 
    enable_forward: true 
  },
  header: {
    template: 'blue',
    title: { 
      tag: 'plain_text', 
      content: `📊 ${reportTitle}` 
    },
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**报告周期：** ${reportPeriod || '最新数据'}\n` +
                `**生成时间：** ${generatedAt}\n` +
                `**文件名称：** ${fileName || '数据报告.pdf'}` +
                (fileSize ? `\n**文件大小：** ${fileSize}` : ''),
      },
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: downloadUrl ? 
          `🔗 **下载链接：** [点击下载报告](${downloadUrl})\n\n💡 *链接有效期较长，建议及时下载保存*` :
          `📋 **获取方式：** ${backupMethod}\n\n💡 *请联系管理员获取下载链接*`,
      },
    }
  ],
};

// 如果有下载链接，添加下载按钮
if (downloadUrl) {
  card.elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '📥 立即下载'
        },
        type: 'primary',
        url: downloadUrl  // 直接跳转下载
      },
      {
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: '📋 复制链接'
        },
        type: 'default',
        value: {
          action: 'copy_link',
          url: downloadUrl
        }
      }
    ]
  });
}

// 添加底部说明
card.elements.push(
  { tag: 'hr' },
  {
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `🌐 **备用访问：** ${downloadUrl || '联系管理员'}\n\n` +
              `💬 如遇下载问题，请复制链接在浏览器中打开，或联系技术支持。`,
    },
  }
);

// ✅ 构建webhook请求（外部群使用）
const webhookRequest = {
  url: 'https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL_HERE', // 🔴 需要替换为你的外部群webhook URL
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    msg_type: 'interactive',
    card: card
  },
};

return [{
  json: {
    // 报告信息
    report_title: reportTitle,
    report_period: reportPeriod,
    generated_at: generatedAt,
    file_key: fileKey,
    file_name: fileName,
    file_size: fileSize,
    download_url: downloadUrl,
    
    // webhook请求配置
    webhookRequest,
    
    // 兼容字段
    httpRequest: webhookRequest,
    
    // 调试信息
    debug: {
      items_count: items.length,
      has_file_key: !!fileKey,
      has_download_url: !!downloadUrl,
      input_keys: items.map(item => Object.keys(item.json || {}))
    }
  },
}];