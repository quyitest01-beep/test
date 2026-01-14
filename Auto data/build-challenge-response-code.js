// 构建Lark Challenge验证响应 / 处理正常消息并格式化数据
// n8n Code节点：构建Challenge响应

// 检查是否是正常消息事件（不是challenge验证）
const isNormalMessage = 
  $json.isChallenge === false ||  // 明确标记为非challenge
  ($json.body && $json.body.event_type) ||  // 有event_type说明是正常消息
  ($json.body && $json.body.event);  // 有event说明是正常消息

if (isNormalMessage) {
  // 处理正常消息，格式化数据供下游使用
  console.log('📨 处理正常消息，格式化数据');
  
  // 格式化时间：YYMMDD hhmmss
  let formattedTime = '';
  if ($json.messageTime) {
    // 如果已有messageTime（ISO格式），转换为YYMMDD hhmmss
    const date = new Date($json.messageTime);
    const year = date.getFullYear().toString().slice(-2); // 后两位年份
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    formattedTime = `${year}${month}${day} ${hours}${minutes}${seconds}`;
  } else if ($json.timestamp) {
    // 如果有timestamp，转换为YYMMDD hhmmss
    const date = new Date(parseInt($json.timestamp) * 1000);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    formattedTime = `${year}${month}${day} ${hours}${minutes}${seconds}`;
  } else {
    // 使用当前时间
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    formattedTime = `${year}${month}${day} ${hours}${minutes}${seconds}`;
  }
  
  // 返回格式化后的数据
  return {
    json: {
      ...$json,  // 保留原有字段
      formattedTime: formattedTime,  // 添加格式化后的时间
      timeFormat: 'YYMMDD hhmmss'  // 时间格式说明
    }
  };
}

// 处理challenge验证请求
// 兼容两种数据格式：
// 1. 来自"提取消息内容"节点：{ isChallenge: true, challenge: "xxx" }
// 2. 直接来自Webhook：{ body: { challenge: "xxx", type: "url_verification" } }
const challenge = $json.challenge || $json.body?.challenge || '';

if (!challenge) {
  console.error('❌ 未找到challenge值，当前数据:', JSON.stringify($json, null, 2));
  throw new Error('未找到challenge值');
}

console.log('🔐 构建Challenge响应，challenge:', challenge);

// 返回包含challenge的JSON对象（n8n会自动序列化）
// 确保返回格式：{ challenge: "xxx" }
return {
  json: {
    challenge: challenge
  }
};

