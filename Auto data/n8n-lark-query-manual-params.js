// n8n Code节点：Lark消息查询处理器 - 手动参数版本
// 允许手动设置Lark回复参数

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
    
    // 2. 设置Lark回复参数
    let larkParams = {};
    
    // 首先尝试自动提取参数
    const paramFields = ['message_id', 'chat_id', 'open_chat_id', 'sender', 'tenant_key'];
    
    for (const field of paramFields) {
      if (item.json[field]) {
        larkParams[field] = item.json[field];
      }
    }
    
    // 检查嵌套结构
    if (item.json.event) {
      if (item.json.event.message) {
        const eventMsg = item.json.event.message;
        if (eventMsg.message_id) larkParams.message_id = eventMsg.message_id;
        if (eventMsg.chat_id) larkParams.chat_id = eventMsg.chat_id;
        if (eventMsg.open_chat_id) larkParams.open_chat_id = eventMsg.open_chat_id;
      }
      
      if (item.json.event.sender) {
        larkParams.sender = item.json.event.sender;
      }
    }
    
    if (item.json.header && item.json.header.tenant_key) {
      larkParams.tenant_key = item.json.header.tenant_key;
    }
    
    // 🔧 手动设置参数区域 - 根据你的实际情况修改
    // 如果自动提取失败，可以手动设置参数
    if (Object.keys(larkParams).length === 0) {
      // 方式1：设置固定的聊天ID（适用于固定群聊）
      larkParams = {
        chat_id: "YOUR_CHAT_ID_HERE",  // 替换为你的实际chat_id
        // message_id: "YOUR_MESSAGE_ID_HERE",  // 如果需要回复特定消息，取消注释并设置
        // tenant_key: "YOUR_TENANT_KEY_HERE"   // 如果需要，取消注释并设置
      };
      
      // 方式2：从环境变量获取（推荐）
      // larkParams = {
      //   chat_id: $env.LARK_CHAT_ID,
      //   tenant_key: $env.LARK_TENANT_KEY
      // };
      
      // 方式3：从工作流参数获取
      // larkParams = {
      //   chat_id: $workflow.settings.lark_chat_id,
      //   tenant_key: $workflow.settings.lark_tenant_key
      // };
    }
    
    // 3. 深度搜索商户数据
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
    
    // 4. 处理查询并生成回复消息
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
          if (merchantId == queryId) {
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
    
    // 5. 输出回复消息和参数
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
        },
        
        // Lark回复参数（手动设置或自动提取）
        larkParams: larkParams,
        
        // 完整的回复消息体（包含回复参数）
        larkReply: {
          msg_type: "text",
          content: {
            text: replyMessage
          },
          ...larkParams
        },
        
        // 参数来源信息
        paramSource: Object.keys(larkParams).length > 0 ? 
          (item.json.message_id ? 'auto_extracted' : 'manually_set') : 'none'
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
        },
        larkParams: {},
        larkReply: {
          msg_type: "text",
          content: {
            text: errorMessage
          }
        },
        paramSource: 'error'
      }
    });
  }
}

return results;

// 手动参数版本特点：
// 1. 支持自动提取和手动设置参数
// 2. 提供多种参数设置方式（固定值、环境变量、工作流参数）
// 3. 包含paramSource字段显示参数来源
// 4. 完整的4字段输出：replyMessage, larkMessage, larkParams, larkReply
// 5. 支持双向查询和中文格式
// 
// 使用方法：
// 1. 修改第47行的YOUR_CHAT_ID_HERE为你的实际chat_id
// 2. 根据需要取消注释其他参数
// 3. 或者使用环境变量/工作流参数的方式