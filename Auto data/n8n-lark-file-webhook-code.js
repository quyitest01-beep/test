const items = $input.all();

if (!items.length) throw new Error('未收到上游数据');

let tenantAccessToken = '';
let reportTitle = '周报';
let reportPeriod = '';
let generatedAt = '';
let fileKey = '';
let fileName = '';

// 扫描所有上游 item，整合需要的信息
for (const item of items) {
  const j = item.json || {};
  
  if (j.tenant_access_token && !tenantAccessToken) {
    tenantAccessToken = j.tenant_access_token;
  }
  
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

// 构建卡片（用于webhook通知）
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
        content: '日报报告已生成，可下载附件查看。\n',
      },
    },
  ],
};

// ✅ 修改：构建webhook请求（发送卡片通知）
const webhookRequest = {
  url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
  body: {
    msg_type: 'interactive',
    card: card
  },
};

// ✅ 保留：API请求（发送文件）- 文件发送仍需要API方式
const fileRequest = {
  url: 'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id',
  body: {
    receive_id: 'oc_f138be619fd7e6ef75c45ce167a3bf24',
    msg_type: 'file',
    content: JSON.stringify({ file_key: fileKey }),
  },
};

return [{
  json: {
    tenant_access_token: tenantAccessToken,  // 文件发送仍需要token
    card_payload: { card },
    report_title: reportTitle,
    report_period: reportPeriod,
    generated_at: generatedAt,
    file_key: fileKey,
    file_name: fileName,
    
    // ✅ 提供两种请求方式
    webhookRequest,  // 用于发送卡片通知（webhook）
    fileRequest,     // 用于发送文件（API）
    
    // ✅ 兼容：保留原字段名
    httpRequest: fileRequest,
  },
}];