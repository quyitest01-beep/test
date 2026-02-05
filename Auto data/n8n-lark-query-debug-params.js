// n8n Code节点：Lark消息查询处理器 - 参数调试版本
// 专门用于调试和检查larkParams提取问题

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    console.log('=== 调试信息 ===');
    console.log('输入数据的所有字段:', Object.keys(item.json));
    console.log('输入数据结构:', JSON.stringify(item.json, null, 2));
    
    // 1. 提取消息文本
    let messageText = '';
    const textFields = ['queryText', 'messageText', 'content', 'text', 'message'];
    
    for (const field of textFields) {
      if (item.json[field]) {
        messageText = item.json[field];
        console.log(`找到消息文本字段: ${field} = "${messageText}"`);
        break;
      }
    }
    
    if (typeof messageText === 'object' && messageText.text) {
      messageText = messageText.text;
    }
    
    const cleanText = String(messageText).trim();
    console.log('清理后的消息文本:', cleanText);
    
    // 2. 详细检查Lark回复参数提取
    let larkParams = {};
    const paramFields = ['message_id', 'chat_id', 'open_chat_id', 'sender', 'tenant_key'];
    
    console.log('\n=== Lark参数提取检查 ===');
    
    // 直接字段检查
    for (const field of paramFields) {
      if (item.json[field]) {
        larkParams[field] = item.json[field];
        console.log(`✅ 找到参数: ${field} =`, item.json[field]);
      } else {
        console.log(`❌ 未找到参数: ${field}`);
      }
    }
    
    // 嵌套结构检查
    if (item.json.event) {
      console.log('\n检查event结构:', JSON.stringify(item.json.event, null, 2));
      
      if (item.json.event.message) {
        const eventMsg = item.json.event.message;
        console.log('检查event.message结构:', JSON.stringify(eventMsg, null, 2));
        
        for (const field of ['message_id', 'chat_id', 'open_chat_id']) {
          if (eventMsg[field]) {
            larkParams[field] = eventMsg[field];
            console.log(`✅ 从event.message找到: ${field} =`, eventMsg[field]);
          }
        }
      }
      
      if (item.json.event.sender) {
        larkParams.sender = item.json.event.sender;
        console.log('✅ 从event找到sender:', item.json.event.sender);
      }
    }
    
    // 其他可能的嵌套结构
    if (item.json.header) {
      console.log('\n检查header结构:', JSON.stringify(item.json.header, null, 2));
      if (item.json.header.tenant_key) {
        larkParams.tenant_key = item.json.header.tenant_key;
        console.log('✅ 从header找到tenant_key:', item.json.header.tenant_key);
      }
    }
    
    console.log('\n最终提取的larkParams:', JSON.stringify(larkParams, null, 2));
    console.log('larkParams是否为空:', Object.keys(larkParams).length === 0);
    
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
    console.log(`\n找到商户数据: ${merchantData.length} 条`);
    
    // 如果当前项没有数据，从其他项获取
    if (merchantData.length === 0) {
      for (let j = 0; j < items.length; j++) {
        if (j !== items.indexOf(item)) {
          const otherMerchants = findMerchantArray(items[j].json);
          if (otherMerchants && otherMerchants.length > 0) {
            merchantData = otherMerchants;
            console.log(`从其他项获取商户数据: ${merchantData.length} 条`);
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
      
      console.log(`查询关键词: "${queryKeyword}"`);
      
      // 执行查询
      let matchResult = null;
      
      // 检查是否为数字ID查询
      if (/^\d+$/.test(queryKeyword)) {
        const queryId = parseInt(queryKeyword);
        console.log(`执行ID查询: ${queryId}`);
        
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
    
    // 5. 输出回复消息和必要参数
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
      
      // Lark回复参数（用于回复功能）
      larkParams: larkParams,
      
      // 完整的回复消息体（包含回复参数）
      larkReply: {
        msg_type: "text",
        content: {
          text: replyMessage
        },
        ...larkParams
      },
      
      // 调试信息
      debugInfo: {
        inputFields: Object.keys(item.json),
        extractedParams: Object.keys(larkParams),
        hasLarkParams: Object.keys(larkParams).length > 0,
        merchantCount: merchantData.length,
        queryText: cleanText
      }
    };
    
    console.log('\n=== 最终输出 ===');
    console.log('输出字段:', Object.keys(outputData));
    console.log('larkParams内容:', JSON.stringify(larkParams, null, 2));
    console.log('是否包含lark参数:', Object.keys(larkParams).length > 0);
    
    results.push({
      json: outputData
    });
    
  } catch (error) {
    console.error('处理错误:', error);
    
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
        debugInfo: {
          error: error.message,
          hasLarkParams: false
        }
      }
    });
  }
}

return results;

// 调试版本特点：
// 1. 详细的console.log输出，显示参数提取过程
// 2. 检查所有可能的嵌套结构
// 3. 输出debugInfo字段帮助诊断问题
// 4. 显示输入数据的完整结构
// 5. 标记每个步骤的成功/失败状态