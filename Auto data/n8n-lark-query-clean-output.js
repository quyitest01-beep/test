// n8n Code节点：Lark消息查询处理器 - 精简输出版本
// 只保留回复消息和Lark消息格式，去掉无用数据

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // 1. 提取消息文本
    let messageText = '';
    const textFields = ['queryText', 'messageText', 'content', 'text', 'message'];
    
    for (const field of textFields) {
      if (item.json[field]) {
        messageText = item.json[field];
        break;
      }
    }
    
    if (typeof messageText === 'object' && messageText.text) {
      messageText = messageText.text;
    }
    
    const cleanText = String(messageText).trim();
    
    // 2. 深度搜索商户数据
    let merchantData = [];
    
    function findMerchantArray(obj) {
      if (Array.isArray(obj)) {
        if (obj.length > 0 && obj[0] && typeof obj[0] === 'object') {
          const firstItem = obj[0];
          if (firstItem.merchant_id || firstItem.sub_merchant_name || firstItem.main_merchant_name) {
            return obj;
          }
        }
      } else if (obj && typeof obj === 'object') {
        for (const key in obj) {
          const result = findMerchantArray(obj[key]);
          if (result) return result;
        }
      }
      return null;
    }
    
    merchantData = findMerchantArray(item.json) || [];
    
    // 如果当前项没有数据，从其他项获取
    if (merchantData.length === 0) {
      for (let j = 0; j < items.length; j++) {
        if (j !== items.indexOf(item)) {
          const otherMerchants = findMerchantArray(items[j].json);
          if (otherMerchants && otherMerchants.length > 0) {
            merchantData = otherMerchants;
            break;
          }
        }
      }
    }
    
    // 3. 处理查询并生成回复消息
    let replyMessage = '';
    
    if (!cleanText) {
      replyMessage = '请输入要查询的商户名称或ID';
    } else if (merchantData.length === 0) {
      replyMessage = '抱歉，当前没有可用的商户数据';
    } else {
      // 提取查询关键词
      let queryKeyword = cleanText;
      
      // 处理中文格式
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
      
      // 执行查询
      let matchResult = null;
      
      // 检查是否为数字ID查询
      if (/^\d+$/.test(queryKeyword)) {
        const queryId = parseInt(queryKeyword);
        
        for (const merchant of merchantData) {
          const merchantId = merchant.merchant_id || merchant.id;
          if (merchantId == queryId) { // 使用 == 支持字符串和数字比较
            const merchantName = merchant.sub_merchant_name || merchant.name || '';
            const mainName = merchant.main_merchant_name || merchant.main_name || '';
            
            replyMessage = `✅ 通过ID找到商户信息：\n` +
                          `📋 商户名称：${merchantName}\n` +
                          `🏢 主商户：${mainName}\n` +
                          `🆔 商户ID：${merchantId}`;
            matchResult = true;
            break;
          }
        }
        
        if (!matchResult) {
          replyMessage = `❌ 未找到ID为 ${queryKeyword} 的商户`;
        }
      } else {
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
    
    // 4. 只输出必要的字段
    results.push({
      json: {
        // 回复消息（格式化文本）
        replyMessage: replyMessage,
        
        // Lark消息格式（用于HTTP Request）
        larkMessage: {
          msg_type: "text",
          content: {
            text: replyMessage
          }
        }
      }
    });
    
  } catch (error) {
    // 错误处理
    const errorMessage = '处理查询时发生错误，请稍后重试';
    
    results.push({
      json: {
        replyMessage: errorMessage,
        larkMessage: {
          msg_type: "text",
          content: {
            text: errorMessage
          }
        }
      }
    });
  }
}

return results;

// 精简版本特点：
// 1. 只输出 replyMessage 和 larkMessage 两个字段
// 2. 去掉所有调试信息和无用数据
// 3. 支持双向查询（商户名↔ID）
// 4. 支持中文查询格式
// 5. 包含模糊匹配功能
// 6. 友好的错误提示