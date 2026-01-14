// n8n Code 节点：处理拆分查数请求
// 识别需要拆分的请求，提取原始查询信息，准备拆分处理
// 修复：确保正确保留 contextMessages 和原始 SQL

const items = $input.all();

if (!items.length) throw new Error('未收到数据');

// 需要拆分的状态关键词
const SPLIT_KEYWORDS = [
  '文件大小',
  '拆分处理',
  '超过',
  '限制',
  '必须拆分',
  '需拆分',
  'MB',
  'GB'
];

// 判断是否需要拆分
function needsSplit(status) {
  if (!status || typeof status !== 'string') return false;
  
  const statusTrimmed = status.trim();
  
  // 检查是否包含拆分关键词
  for (const keyword of SPLIT_KEYWORDS) {
    if (statusTrimmed.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

const outputs = [];

items.forEach((item) => {
  const json = item.json;
  const status = String(json.status || '').trim();
  
  // 只处理需要拆分的请求
  if (!needsSplit(status)) {
    return;
  }
  
  // 提取文件大小信息（如果有）
  let fileSizeMB = null;
  let fileSizeGB = null;
  const sizeMatch = status.match(/(\d+\.?\d*)\s*(MB|GB)/i);
  if (sizeMatch) {
    const size = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    if (unit === 'MB') {
      fileSizeMB = size;
      fileSizeGB = size / 1024;
    } else if (unit === 'GB') {
      fileSizeGB = size;
      fileSizeMB = size * 1024;
    }
  }
  
  // **关键修复**：确保完整保留 contextMessages（包含 sql 字段）
  const contextMessages = json.contextMessages || [];
  
  // 提取原始查询信息（确保包含完整的 contextMessages）
  const originalQuery = {
    text: json.text || '',
    merchant_id: extractMerchantId(json.text),
    timeRange: extractTimeRange(json.text),
    chatid: json.chatid,
    senderid: json.senderid,
    messagid: json.messagid,
    type: json.type || 'telegram',
    status: status,
    // **关键**：完整保留 contextMessages，确保包含 sql 字段
    contextMessages: contextMessages.map(msg => ({
      messagid: msg.messagid,
      time: msg.time,
      text: msg.text,
      status: msg.status,
      aiReply: msg.aiReply || msg.ai_reply || '',
      // **关键**：确保 sql 字段被正确传递
      sql: msg.sql || msg['SQL'] || ''
    })),
    context: json.context || {}
  };
  
  outputs.push({
    json: {
      // 原始消息信息（完整保留）
      ...json,
      
      // **关键**：确保 contextMessages 被正确传递（包含 sql）
      contextMessages: contextMessages.map(msg => ({
        messagid: msg.messagid,
        time: msg.time,
        text: msg.text,
        status: msg.status,
        aiReply: msg.aiReply || msg.ai_reply || '',
        sql: msg.sql || msg['SQL'] || ''
      })),
      
      // 拆分标识
      needsSplit: true,
      splitReason: status,
      
      // 文件大小信息
      fileSizeMB: fileSizeMB,
      fileSizeGB: fileSizeGB,
      estimatedFileSize: fileSizeMB ? `${fileSizeMB.toFixed(2)} MB` : null,
      
      // 原始查询信息（包含完整的 contextMessages）
      originalQuery: originalQuery,
      
      // 拆分建议
      splitStrategy: fileSizeMB && fileSizeMB > 1000 ? 'date_range' : 'date_range',
      recommendedSplitCount: fileSizeMB ? Math.ceil(fileSizeMB / 100) : 5, // 建议每个查询不超过100MB
      
      // 处理状态
      splitStatus: 'pending', // pending, processing, completed, failed
      
      // 时间戳
      createdAt: new Date().toISOString()
    }
  });
});

// 辅助函数：从文本中提取商户号
function extractMerchantId(text) {
  if (!text) return null;
  
  const merchantMatch = text.match(/商户[号:：]\s*(\d+)/i);
  if (merchantMatch) {
    return merchantMatch[1];
  }
  
  return null;
}

// 辅助函数：从文本中提取时间范围
function extractTimeRange(text) {
  if (!text) return null;
  
  // 匹配各种时间格式
  const patterns = [
    /(\d{4}[-年]\d{1,2}[-月]\d{1,2})/g, // 2025-10-01 或 2025年10月
    /(\d{1,2}月)/g, // 10月
    /(上[周月])/g, // 上周、上月
    /(最近\d+[天日])/g, // 最近7天
    /(\d{4}[-年]\d{1,2}[-月])/g // 2025-10
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

console.log(`✅ 处理了 ${outputs.length} 个需要拆分的请求`);
if (outputs.length > 0) {
  const firstOutput = outputs[0].json;
  const hasContextMessages = firstOutput.contextMessages && firstOutput.contextMessages.length > 0;
  const hasSQL = hasContextMessages && firstOutput.contextMessages[0]?.sql;
  console.log(`✅ contextMessages 存在: ${hasContextMessages ? '是' : '否'}`);
  console.log(`✅ 原始 SQL 存在: ${hasSQL ? '是' : '否'}`);
  if (hasSQL) {
    console.log(`✅ 原始 SQL 预览: ${firstOutput.contextMessages[0].sql.substring(0, 100)}...`);
  }
}

return outputs;

