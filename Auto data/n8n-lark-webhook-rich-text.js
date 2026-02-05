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

// ✅ 方案2：发送富文本消息
const webhookRequest = {
  url: 'https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909',
  body: {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: reportTitle || '📊 周报已生成',
          content: [
            [
              {
                tag: 'text',
                text: '📅 报告周期：'
              },
              {
                tag: 'text',
                text: reportPeriod || '未知',
                style: ['bold']
              }
            ],
            [
              {
                tag: 'text',
                text: '⏰ 生成时间：'
              },
              {
                tag: 'text',
                text: (generatedAt || new Date().toISOString()).replace('T', ' ').replace('Z', ''),
                style: ['bold']
              }
            ],
            [
              {
                tag: 'text',
                text: ''
              }
            ],
            [
              {
                tag: 'text',
                text: '📄 文件名称：'
              },
              {
                tag: 'text',
                text: fileName || '周报.pdf',
                style: ['bold', 'underline']
              }
            ],
            [
              {
                tag: 'text',
                text: '🔑 文件ID：'
              },
              {
                tag: 'text',
                text: fileKey,
                style: ['code']
              }
            ],
            [
              {
                tag: 'text',
                text: ''
              }
            ],
            [
              {
                tag: 'text',
                text: '💡 请联系管理员获取文件下载链接',
                style: ['italic']
              }
            ]
          ]
        }
      }
    }
  }
};

return [{
  json: {
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