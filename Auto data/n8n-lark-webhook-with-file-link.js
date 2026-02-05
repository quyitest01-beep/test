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
  
  // 周报 HTML 节点输出
  if (j.title || j.html || j.period) {
    reportTitle = j.title || reportTitle;
    reportPeriod = j.period || reportPeriod;
    generatedAt = j.timestamp || generatedAt;
  }
  
  // 上传文件节点输出：{ code:0, data:{ file_key: 'xxx' }, ... }
  if (!fileKey && (j.data?.file_key || j.file_key)) {
    fileKey = j.data?.file_key || j.file_key;
  }
  
  if (!fileName && (j.fileName || j.file_name)) {
    fileName = j.fileName || j.file_name;
  }
}

if (!fileKey) throw new Error('未找到 file_key（请确认上传 PDF 成功并已接入本节点）');

// ✅ 方案1：构建包含文件下载链接的卡片
const card = {
  config: { wide_screen_mode: true, enable_forward: true },
  header: {
    template: 'blue',
    title: { tag: 'plain_text', content: reportTitle || '周报' },
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
        content: `📄 **报告文件：** ${fileName || '周报.pdf'}\n\n` +
                `🔗 **文件ID：** \`${fileKey}\`\n\n` +
                `💡 *请联系管理员获取文件下载链接*`,
      },
    },
    {
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: '📥 申请下载'
          },
          type: 'primary',
          value: {
            file_key: fileKey,
            file_name: fileName
          }
        }
      ]
    }
  ],
};

// ✅ 构建webhook请求（发送卡片 + 文件信息）
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
    
    // ✅ 只需要一个webhook请求
    webhookRequest,
    
    // ✅ 兼容：保留原字段名
    httpRequest: webhookRequest,
  },
}];