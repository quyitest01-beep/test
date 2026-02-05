// n8n Code节点：Lark消息查询处理器 - 针对sy.json数据结构优化版本
// 专门处理包含Lark事件和商户数据的混合数据结构

const items = $input.all();
const results = [];

// 分析输入数据结构
let merchantData = [];
let larkEventData = null;

console.log(`=== 处理 ${items.length} 个输入项 ===`);

// 1. 从所有输入项中提取数据
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(`\n项目 ${i + 1} 的字段:`, Object.keys(item.json));
  
  // 检查是否包含Lark事件数据
  if (item.json.messageId || item.json.rawEvent || item.json.chatId) {
    larkEventData = item.json;
    console.log(`✅ 找到Lark事件数据 (项目 ${i + 1})`);
  }
  
  // 检查是否包含商户数据
  if (item.json.filtered_merchants && Array.isArray(item.json.filtered_merchants)) {
    merchantData = item.json.filtered_merchants;
    console.log(`✅ 找到商户数据 (项目 ${i + 1}): ${merchantData.length} 条`);
  }
}

console.log(`\n数据汇总:`);
console.log(`- 商户数据: ${merchantData.length} 条`);
console.log(`- Lark事件: ${larkEventData ? '已找到' : '未找到'}`);

// 2. 提取消息文本
let messageText = '';
if (larkEventData) {
  // 优先从Lark事件数据中提取
  messageText = larkEventData.messageText || '';
  
  // 如果没有，尝试从rawEvent中提取
  if (!messageText && larkEventData.rawEvent && larkEventData.rawEvent.event && larkEventData.rawEvent.event.message) {
    const content = larkEventData.rawEvent.event.message.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        messageText = parsed.text || '';
      } catch (e) {
        messageText = content;
      }
    }
  }
}

const cleanText = String(messageText).trim();
console.log(`\n提取的消息文本: "${cleanText}"`);

// 3. 提取Lark回复参数
let larkParams = {};

if (larkEventData) {
  // 从直接字段提取
  if (larkEventData.messageId) larkParams.message_id = larkEventData.messageId;
  if (larkEventData.chatId) larkParams.chat_id = larkEventData.chatId;
  
  // 从rawEvent中提取更多参数
  if (larkEventData.rawEvent) {
    const rawEvent = larkEventData.rawEvent;
    
    // 从header提取
    if (rawEvent.header) {
      if (rawEvent.header.tenant_key) larkParams.tenant_key = rawEvent.header.tenant_key;
    }
    
    // 从event提取
    if (rawEvent.event) {
      if (rawEvent.event.message) {
        const msg = rawEvent.event.message;
        if (msg.message_id) larkParams.message_id = msg.message_id;
        if (msg.chat_id) larkParams.chat_id = msg.chat_id;
      }
      
      if (rawEvent.event.sender) {
        larkParams.sender = rawEvent.event.sender;
      }
    }
  }
}

console.log(`\n提取的Lark参数:`, Object.keys(larkParams));
console.log(`参数详情:`, JSON.stringify(larkParams, null, 2));

// 4. 处理查询并生成回复消息
let replyMessage = '';

if (!cleanText) {
  replyMessage = '请输入要查询的商户名称或ID';
} else if (merchantData.length === 0) {
  replyMessage = '抱歉，当前没有可用的商户数据';
} else {
  // 提取查询关键词
  let queryKeyword = cleanText;
  
  // 处理中文格式："商户betfiery的id"
  if (cleanText.includes('商户') && cleanText.includes('的')) {
    const match = cleanText.match(/商户\s*([^的\s]+)/);
    if (match) {
      queryKeyword = match[1].trim();
    }
  }
  
  // 移除前缀后缀
  queryKeyword = queryKeyword
    .replace(/^(查询|查找|搜索|找)\s*/i, '')
    .replace(/\s*(的|的id|的ID|id|ID|信息|详情)$/i, '')
    .trim();
  
  console.log(`\n查询关键词: "${queryKeyword}"`);
  
  // 执行查询
  let matchResult = null;
  
  // 检查是否为数字ID查询
  if (/^\d+$/.test(queryKeyword)) {
    const queryId = parseInt(queryKeyword);
    console.log(`执行ID查询: ${queryId}`);
    
    for (const merchant of merchantData) {
      const merchantId = parseInt(merchant.merchant_id) || merchant.merchant_id;
      if (merchantId == queryId) {
        const merchantName = merchant.sub_merchant_name || merchant.name || '';
        const mainName = merchant.main_merchant_name || merchant.main_name || '';
        
        replyMessage = `✅ 通过ID找到商户信息：\n` +
                      `📋 商户名称：${merchantName}\n` +
                      `🏢 主商户：${mainName}\n` +
                      `🆔 商户ID：${merchantId}`;
        matchResult = true;
        console.log(`✅ ID查询成功: ${merchantName}`);
        break;
      }
    }
    
    if (!matchResult) {
      replyMessage = `❌ 未找到ID为 ${queryKeyword} 的商户`;
      console.log(`❌ ID查询失败`);
    }
  } else {
    console.log(`执行商户名查询: "${queryKeyword}"`);
    
    // 商户名查询 - 精确匹配
    for (const merchant of merchantData) {
      const merchantName = merchant.sub_merchant_name || merchant.name || '';
      if (merchantName === queryKeyword) {
        const merchantId = merchant.merchant_id || merchant.id;
        const mainName = merchant.main_merchant_name || merchant.main_name || '';
        
        replyMessage = `✅ 找到商户信息：\n` +
                      `📋 商户名称：${merchantName}\n` +
                      `🏢 主商户：${mainName}\n` +
                      `🆔 商户ID：${merchantId}`;
        matchResult = true;
        console.log(`✅ 精确匹配成功: ${merchantName}`);
        break;
      }
    }
    
    // 模糊匹配
    if (!matchResult) {
      const queryLower = queryKeyword.toLowerCase();
      const fuzzyMatches = [];
      
      for (const merchant of merchantData) {
        const merchantName = merchant.sub_merchant_name || merchant.name || '';
        const merchantLower = merchantName.toLowerCase();
        
        if (merchantLower.includes(queryLower)) {
          fuzzyMatches.push(merchant);
        }
      }
      
      console.log(`模糊匹配结果: ${fuzzyMatches.length} 个`);
      
      if (fuzzyMatches.length > 0) {
        if (fuzzyMatches.length === 1) {
          const bestMatch = fuzzyMatches[0];
          const merchantName = bestMatch.sub_merchant_name || bestMatch.name || '';
          const merchantId = bestMatch.merchant_id || bestMatch.id;
          const mainName = bestMatch.main_merchant_name || bestMatch.main_name || '';
          
          replyMessage = `✅ 找到相似商户：\n` +
                        `📋 商户名称：${merchantName}\n` +
                        `🏢 主商户：${mainName}\n` +
                        `🆔 商户ID：${merchantId}`;
        } else {
          replyMessage = `🔍 找到 ${fuzzyMatches.length} 个相似商户：\n`;
          fuzzyMatches.slice(0, 5).forEach((merchant, index) => {
            const name = merchant.sub_merchant_name || merchant.name || '';
            const id = merchant.merchant_id || merchant.id;
            replyMessage += `${index + 1}. ${name} (ID: ${id})\n`;
          });
          if (fuzzyMatches.length > 5) {
            replyMessage += `... 还有 ${fuzzyMatches.length - 5} 个结果`;
          }
        }
      } else {
        replyMessage = `❌ 未找到商户："${queryKeyword}"\n\n💡 建议：\n` +
                      `• 检查商户名称拼写\n` +
                      `• 尝试使用商户ID查询\n` +
                      `• 使用部分关键词搜索`;
      }
    }
  }
}

console.log(`\n生成的回复消息: ${replyMessage}`);

// 5. 输出结果
const outputData = {
  // 回复消息（格式化文本）
  replyMessage: replyMessage,
  
  // Lark消息格式（用于HTTP Request）
  larkMessage: {
    msg_type: "text",
    content: {
      text: replyMessage
    }
  },
  
  // Lark回复参数（从事件数据中提取）
  larkParams: larkParams,
  
  // 完整的回复消息体（包含回复参数）
  larkReply: {
    msg_type: "text",
    content: {
      text: replyMessage
    },
    ...larkParams
  },
  
  // 数据来源信息
  dataSource: {
    merchantCount: merchantData.length,
    hasLarkEvent: !!larkEventData,
    paramCount: Object.keys(larkParams).length,
    queryText: cleanText
  }
};

console.log(`\n=== 最终输出 ===`);
console.log(`输出字段: ${Object.keys(outputData).join(', ')}`);
console.log(`Lark参数数量: ${Object.keys(larkParams).length}`);
console.log(`商户数据数量: ${merchantData.length}`);

results.push({
  json: outputData
});

return results;

// sy.json优化版本特点：
// 1. 智能识别混合数据结构（商户数据 + Lark事件）
// 2. 从多个输入项中分别提取商户数据和Lark参数
// 3. 支持从rawEvent中提取完整的Lark参数
// 4. 详细的console.log输出便于调试
// 5. 包含dataSource字段显示数据来源信息
// 6. 完整的4字段输出：replyMessage, larkMessage, larkParams, larkReply
// 7. 支持双向查询和中文格式
// 
// 适用场景：
// - 输入数据包含多个项目，其中一些包含商户数据，另一些包含Lark事件
// - 需要从rawEvent中提取完整的Lark回复参数
// - 需要详细的调试信息来排查问题