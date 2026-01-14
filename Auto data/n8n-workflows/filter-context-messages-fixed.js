// n8n Code 节点：过滤需要处理的上下文消息（修复版）
// 修复：先分组收集所有消息，再过滤需要处理的消息，确保 context 包含完整历史

const items = $input.all();

if (!items.length) throw new Error('未收到数据');

// 需要处理的明确状态列表
const CONTEXT_STATUSES = ['未处理', '需执行查数', '需执行查询'];

// 需要忽略的状态列表（这些状态的消息不会被处理，也不会出现在 contextMessages 中，但可以作为历史上下文用于 lastAiReply 和 previousMessage）
const IGNORE_STATUSES = ['已处理', '非查数需求', '非查数需求，不做处理'];

// 第一步：先按 chatid 和 senderid 分组，收集所有消息（不过滤）
const allGrouped = new Map();

items.forEach((item) => {
  const key = `${item.json.chatid || ''}::${item.json.senderid || ''}`;
  
  if (!allGrouped.has(key)) {
    allGrouped.set(key, {
      chatid: item.json.chatid,
      senderid: item.json.senderid,
      allMessages: [], // 所有消息（包括已处理的）
    });
  }
  
  allGrouped.get(key).allMessages.push({
    messagid: item.json.messagid,
    time: item.json.time || item.json.createdAt || '',
    text: item.json.text,
    status: String(item.json.status || '').trim(),
    aiReply: item.json['AI reply'] || item.json.ai_reply || '',
  });
});

// 第二步：在每个组内，找出需要处理的消息，并构建上下文
const outputs = [];

allGrouped.forEach((bucket) => {
  if (!bucket.allMessages.length) return;
  
  // 按时间排序所有消息
  bucket.allMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  // 找出需要处理的消息（status 在 CONTEXT_STATUSES 中，且不在 IGNORE_STATUSES 中）
  const messagesToProcess = bucket.allMessages.filter((msg) => {
    const status = msg.status;
    // 不在忽略列表中，且在需要处理的状态列表中
    return !IGNORE_STATUSES.includes(status) && CONTEXT_STATUSES.includes(status);
  });
  
  if (messagesToProcess.length === 0) return;
  
  // 只处理最新的一条需要处理的消息
  const latestMsg = messagesToProcess[messagesToProcess.length - 1];
  
  // 找出这条消息之前的所有消息（作为历史上下文）
  const latestTime = new Date(latestMsg.time);
  const previousMsgs = bucket.allMessages.filter((msg) => {
    return new Date(msg.time) < latestTime;
  });
  
  // 查找最近一条有 AI 回复的消息（排除空字符串）
  const lastAiReply = [...previousMsgs].reverse().find((m) => 
    m.aiReply && String(m.aiReply).trim()
  )?.aiReply || '';
  
  // 获取上一条消息文本
  const previousMessage = previousMsgs.length 
    ? previousMsgs[previousMsgs.length - 1].text 
    : '';
  
  // 收集所有需要处理的消息（用于 contextMessages）
  // 注意：contextMessages 只包含需要处理的消息，不包含"已处理"或"非查数需求"的消息
  const contextMessages = messagesToProcess;
  
  outputs.push({
    json: {
      chatid: bucket.chatid,
      senderid: bucket.senderid,
      type: 'telegram',
      messagid: latestMsg.messagid,
      text: latestMsg.text,
      status: latestMsg.status,
      contextCount: contextMessages.length,
      contextMessages: contextMessages,
      context: {
        lastAiReply,
        previousMessage,
      },
    },
  });
});

// 如果只需要每个组的最新一条消息，可以添加去重逻辑
// 这里返回所有需要处理的消息，如果需要去重，可以在下游节点处理
return outputs;

