const items = $input.all();

if (!items.length) throw new Error('未收到上游数据');

let reportTitle = '周报';
let reportPeriod = '';
let generatedAt = '';
let fileKey = '';
let fileName = '';

// 扫描所有上游 item，整合需要的信息
for (const item of items) {
  const j = item.json || {};
  
  if (j.title || j.html || j.period) {
    reportTitle = j.title || reportTitle;
    reportPeriod = j.period || reportPeriod;
    generatedAt = j.timestamp || generatedAt;
  }
  
  if (!fileKey && (j.data?.file_key || j.file_key)) {
    fileKey = j.data?.file_key || j.file_key;
  }
  
  if (!fileName && (j.fileName || j.file_name)) {
    fileName = j.fileName || j.file_name;
  }
}

if (!fileKey) throw new Error('未找到 file_key');

// ✅ 使用现有后端生成下载链接
const downloadUrl = `http://localhost:8000/download/${fileKey}`;
const infoUrl = `http://localhost:8000/file-info/${fileKey}`;

// ✅ 构建包含直接下载链接的卡片
const card = {
  config: { wide_screen_mode: true, enable_forward: true },
  header: {
    template: 'blue',
    title: { tag: 'plain_text', content: reportTitle || '📊 报告已生成' },
  },
  elements: [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**报告周期：** ${reportPeriod || '未知'}\n` +
                `**生成时间：** ${(generatedAt || new Date().toISOString()).replace('T', ' ').replace('Z', '')}`,
      },
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `📄 **文件名：** ${fileName || '报告.pdf'}\n\n` +
                `🔗 **下载链接：** [点击下载](${downloadUrl})\n\n` +
                `📋 **文件ID：** \`${fileKey}\`\n\n` +
                `💡 *点击下方按钮直接下载文件*`,
      },
    },
    {
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
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `🌐 **备用链接：** ${downloadUrl}\n\n` +
                `💬 如下载遇到问题，请联系管理员或复制链接在浏览器中打开。`,
      },
    }
  ],
};

// ✅ 构建webhook请求
const webhookRequest = {
  url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
  body: {
    msg_type: 'interactive',
    card: card
  },
};

return [{
  json: {
    card_payload: { card },
    report_title: reportTitle,
    report_period: reportPeriod,
    generated_at: generatedAt,
    file_key: fileKey,
    file_name: fileName,
    download_url: downloadUrl,
    info_url: infoUrl,
    
    // ✅ webhook请求
    webhookRequest,
    
    // ✅ 兼容：保留原字段名
    httpRequest: webhookRequest,
  },
}];