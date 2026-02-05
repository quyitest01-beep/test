// n8n Code节点：增强版Lark消息查询处理器 - 空格兼容版
// 基于sy.json数据结构，增加ID反向查询商户名功能，兼容各种空格字符

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

// 增强的文本清理函数 - 兼容各种空格字符
function cleanText(text) {
  if (!text) return '';
  
  return String(text)
    // 替换各种空格字符为标准空格
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ') // 各种Unicode空格
    .replace(/[\t\r\n]/g, ' ') // 制表符、回车、换行
    .replace(/\s+/g, ' ') // 多个连续空格合并为一个
    .trim(); // 去除首尾空格
}

const cleanedText = cleanText(messageText);
console.log(`\n原始消息文本: "${messageText}"`);
console.log(`清理后文本: "${cleanedText}"`);

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

// 4. 增强版查询处理 - 支持双向查询和空格兼容
let replyMessage = '';
let queryKeyword = ''; // 初始化变量
let searchType = 'unknown'; // 初始化搜索类型

if (!cleanedText) {
  replyMessage = '请输入要查询的商户名称或ID';
} else if (merchantData.length === 0) {
  replyMessage = '抱歉，当前没有可用的商户数据';
} else {
  // 提取查询关键词 - 增强的正则表达式，兼容各种空格
  queryKeyword = cleanedText;
  
  // 处理各种中文格式 - 使用\s+匹配任意空格字符
  const patterns = [
    /商户\s*([^的\s]+)/,                    // "商户betfiery的id" 或 "商户　betfiery　的id"
    /ID\s*([0-9]+)/i,                      // "ID 1698202251" 或 "ID　1698202251"
    /id\s*([0-9]+)/,                       // "id 1698202251"
    /([0-9]+)\s*的\s*商户/,                // "1698202251的商户" 或 "1698202251　的　商户"
    /([0-9]+)\s*对应\s*的\s*商户/,         // "1698202251对应的商户"
    /查询\s*([^的\s]+)/,                   // "查询betfiery" 或 "查询　betfiery"
    /查找\s*([^的\s]+)/,                   // "查找betfiery"
    /搜索\s*([^的\s]+)/,                   // "搜索betfiery"
    /找\s*([^的\s]+)/,                     // "找betfiery"
  ];
  
  for (const pattern of patterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      queryKeyword = cleanText(match[1]); // 对提取的关键词也进行清理
      console.log(`✅ 匹配到模式: ${pattern.source}, 提取关键词: "${queryKeyword}"`);
      break;
    }
  }
  
  // 如果没有匹配到特定模式，进行通用清理
  if (queryKeyword === cleanedText) {
    queryKeyword = cleanedText
      .replace(/^(查询|查找|搜索|找)\s*/i, '')
      .replace(/\s*(的|的id|的ID|id|ID|信息|详情|商户|名称)$/i, '')
      .trim();
    queryKeyword = cleanText(queryKeyword); // 再次清理
  }
  
  console.log(`\n最终查询关键词: "${queryKeyword}"`);
  
  // 执行查询
  let matchResult = null;
  
  // 检查是否为数字ID查询
  if (/^\d+$/.test(queryKeyword)) {
    searchType = 'id_search';
    const queryId = queryKeyword;
    console.log(`执行ID查询: ${queryId}`);
    
    for (const merchant of merchantData) {
      const merchantId = String(merchant.merchant_id || merchant.id || '').trim();
      if (merchantId === queryId) {
        const merchantName = cleanText(merchant.sub_merchant_name || merchant.name || '');
        const mainName = cleanText(merchant.main_merchant_name || merchant.main_name || '');
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
      replyMessage = `❌ 未找到ID为 ${queryKeyword} 的商户\n\n💡 提示：\n` +
                    `• 请检查商户ID是否正确\n` +
                    `• 当前数据库共有 ${merchantData.length} 个商户`;
      console.log(`❌ ID查询失败`);
    }
  } else {
    searchType = 'name_search';
    console.log(`执行商户名查询: "${queryKeyword}"`);
    
    // 商户名查询 - 精确匹配（忽略空格差异）
    for (const merchant of merchantData) {
      const merchantName = cleanText(merchant.sub_merchant_name || merchant.name || '');
      if (merchantName === queryKeyword) {
        const merchantId = String(merchant.merchant_id || merchant.id || '').trim();
        const mainName = cleanText(merchant.main_merchant_name || merchant.main_name || '');
        replyMessage = `✅ 找到商户信息：\n` +
                      `📋 商户名称：${merchantName}\n` +
                      `🏢 主商户：${mainName}\n` +
                      `🆔 商户ID：${merchantId}`;
        matchResult = true;
        console.log(`✅ 精确匹配成功: ${merchantName}`);
        break;
      }
    }
    
    // 模糊匹配（忽略空格差异）
    if (!matchResult) {
      const queryLower = queryKeyword.toLowerCase();
      const fuzzyMatches = [];
      
      for (const merchant of merchantData) {
        const merchantName = cleanText(merchant.sub_merchant_name || merchant.name || '');
        const merchantLower = merchantName.toLowerCase();
        
        // 检查包含关系（双向）
        if (merchantLower.includes(queryLower) || queryLower.includes(merchantLower)) {
          fuzzyMatches.push(merchant);
        }
      }
      
      console.log(`模糊匹配结果: ${fuzzyMatches.length} 个`);
      
      if (fuzzyMatches.length > 0) {
        searchType = 'fuzzy_match';
        if (fuzzyMatches.length === 1) {
          const bestMatch = fuzzyMatches[0];
          const merchantName = cleanText(bestMatch.sub_merchant_name || bestMatch.name || '');
          const merchantId = String(bestMatch.merchant_id || bestMatch.id || '').trim();
          const mainName = cleanText(bestMatch.main_merchant_name || bestMatch.main_name || '');
          replyMessage = `✅ 找到相似商户：\n` +
                        `📋 商户名称：${merchantName}\n` +
                        `🏢 主商户：${mainName}\n` +
                        `🆔 商户ID：${merchantId}`;
        } else {
          replyMessage = `🔍 找到 ${fuzzyMatches.length} 个相似商户：\n`;
          fuzzyMatches.slice(0, 5).forEach((merchant, index) => {
            const name = cleanText(merchant.sub_merchant_name || merchant.name || '');
            const id = String(merchant.merchant_id || merchant.id || '').trim();
            replyMessage += `${index + 1}. ${name} (ID: ${id})\n`;
          });
          if (fuzzyMatches.length > 5) {
            replyMessage += `... 还有 ${fuzzyMatches.length - 5} 个结果`;
          }
        }
      } else {
        searchType = 'not_found';
        replyMessage = `❌ 未找到商户："${queryKeyword}"\n\n💡 建议：\n` +
                      `• 检查商户名称拼写\n` +
                      `• 尝试使用商户ID查询\n` +
                      `• 使用部分关键词搜索\n` +
                      `• 当前数据库共有 ${merchantData.length} 个商户`;
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
    queryText: cleanedText,
    originalText: messageText,
    queryKeyword: queryKeyword,
    searchType: searchType
  }
};

console.log(`\n=== 最终输出 ===`);
console.log(`输出字段: ${Object.keys(outputData).join(', ')}`);
console.log(`Lark参数数量: ${Object.keys(larkParams).length}`);
console.log(`商户数据数量: ${merchantData.length}`);
console.log(`原始文本: "${messageText}"`);
console.log(`清理后文本: "${cleanedText}"`);
console.log(`查询关键词: "${queryKeyword}"`);
console.log(`搜索类型: ${searchType}`);

results.push({json: outputData});
return results;

// 空格兼容版特点：
// 1. 新增 cleanText() 函数，处理各种Unicode空格字符
// 2. 支持全角空格（　）、不间断空格、制表符等
// 3. 增强的正则表达式模式匹配，使用\s+匹配任意空格
// 4. 对商户名称和ID也进行空格清理和标准化
// 5. 在调试输出中显示原始文本和清理后文本的对比
// 6. 支持的查询格式示例：
//    - "商户　betfiery　的id" （全角空格）
//    - "ID　　1698202251" （多个全角空格）
//    - "1698202251　　的　　商户" （全角空格分隔）
//    - "查询　　betfiery" （全角空格）
//    - 以及各种制表符、换行符等空白字符的组合