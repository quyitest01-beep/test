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

// ✅ 为外部群用户提供详细的下载指南
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
                `🔑 **文件ID：** \`${fileKey}\`\n\n` +
                `📥 **获取方式：**\n` +
                `1️⃣ 复制上方文件ID\n` +
                `2️⃣ 联系管理员提供下载链接\n` +
                `3️⃣ 或发送私信给机器人获取文件`,
      },
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '📋 复制文件ID'
          },
          type: 'primary',
          value: {
            action: 'copy_file_id',
            file_key: fileKey,
            file_name: fileName
          }
        },
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '💬 联系管理员'
          },
          type: 'default',
          value: {
            action: 'contact_admin',
            file_key: fileKey
          }
        }
      ]
    },
    { tag: 'hr' },
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `💡 **提示：** 由于这是外部群，文件需要通过管理员获取。\n` +
                `请将文件ID发送给 @管理员 或私信机器人。`,
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
    
    // ✅ webhook请求
    webhookRequest,
    
    // ✅ 兼容：保留原字段名
    httpRequest: webhookRequest,
  },
}];