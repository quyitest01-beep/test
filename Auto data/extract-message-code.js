// Lark/Telegram 消息内容提取和Challenge验证
// n8n Code节点：提取消息内容

const input = $input.first().json;

// 获取请求体（可能是body字段或直接是对象）
const body = input.body || input;

console.log('📥 收到请求，body:', JSON.stringify(body, null, 2));

// 🔐 处理Lark Challenge验证请求
if (body.type === 'url_verification' && body.challenge) {
  console.log('🔐 收到Lark Challenge验证请求，challenge:', body.challenge);
  
  // 返回challenge值，完成验证
  return {
    json: {
      isChallenge: true,
      challenge: body.challenge,
      type: 'url_verification',
      source: 'lark'
    }
  };
}

// 📨 判断消息来源并处理

// 检查是否是Telegram消息
if (body.update_id !== undefined || body.message) {
  // Telegram消息格式
  console.log('📱 识别为Telegram消息');
  
  const tgMessage = body.message || {};
  const tgFrom = tgMessage.from || {};
  const tgChat = tgMessage.chat || {};
  
  // 提取Telegram消息内容
  const messageText = tgMessage.text || tgMessage.caption || '';
  const messageId = tgMessage.message_id || '';
  const chatId = tgChat.id ? String(tgChat.id) : '';
  const chatTitle = tgChat.title || '';
  const senderId = tgFrom.id ? String(tgFrom.id) : '';
  const senderName = tgFrom.first_name || tgFrom.username || '未知用户';
  const senderUsername = tgFrom.username || '';
  const timestamp = tgMessage.date || Math.floor(Date.now() / 1000);
  
  // 格式化时间
  const messageTime = new Date(parseInt(timestamp) * 1000).toISOString();
  
  console.log('📱 收到Telegram消息:', {
    messageId,
    chatId,
    chatTitle,
    senderId,
    senderName,
    senderUsername,
    messageText,
    messageTime
  });
  
  return {
    json: {
      isChallenge: false,
      source: 'telegram',
      messageId: String(messageId),
      chatId: chatId,
      chatTitle: chatTitle,
      chatType: tgChat.type || '',
      senderId: senderId,
      senderName: senderName,
      senderUsername: senderUsername,
      messageText: messageText.trim(),
      messageTime,
      timestamp: parseInt(timestamp),
      rawEvent: body
    }
  };
}

// 📨 处理Lark消息事件
// 解析Lark Webhook事件
const event = body.event || {};
const message = event.message || {};
const sender = event.sender || {};

// 提取消息内容
let messageText = '';
if (message.message_type === 'text') {
  messageText = message.content || '';
  // 解析JSON格式的content
  try {
    const contentObj = JSON.parse(messageText);
    messageText = contentObj.text || messageText;
  } catch (e) {
    // 如果不是JSON，直接使用
  }
}

// 提取关键信息
const chatId = message.chat_id || '';
const messageId = message.message_id || '';
const senderId = sender.sender_id?.user_id || sender.sender_id || '';
const senderName = sender.sender_name || '未知用户';
const timestamp = message.create_time || Date.now();

// 格式化时间
const messageTime = new Date(parseInt(timestamp) * 1000).toISOString();

console.log('📨 收到Lark消息:', {
  messageId,
  chatId,
  senderId,
  senderName,
  messageText,
  messageTime
});

return {
  json: {
    isChallenge: false,
    source: 'lark',
    messageId,
    chatId,
    senderId,
    senderName,
    messageText: messageText.trim(),
    messageTime,
    timestamp: parseInt(timestamp),
    rawEvent: body
  }
};

