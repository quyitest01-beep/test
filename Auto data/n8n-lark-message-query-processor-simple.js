// n8n Code节点：超简化版本 - 直接匹配你的数据结构
const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // 提取消息文本
    let messageText = '';
    if (item.json.messageText) {
      messageText = item.json.messageText;
    } else if (item.json.content) {
      try {
        const content = JSON.parse(item.json.content);
        messageText = content.text || '';
      } catch (e) {
        messageText = item.json.content;
      }
    } else if (item.json.text) {
      messageText = item.json.text;
    }
    
    const cleanText = messageText.trim();
    
    // 提取查询关键词
    let queryKeyword = cleanText;
    
    // 处理中文查询格式 "商户betfiery的id" -> "betfiery"
    if (cleanText.includes('商户') && cleanText.includes('的')) {
      const match = cleanText.match(/商户\s*([^的]+?)\s*的/);
      if (match) {
        queryKeyword = match[1].trim();
      }
    } else if (cleanText.includes('betfiery')) {
      queryKeyword = 'betfiery';
    }
    
    console.log('原始消息:', cleanText);
    console.log('提取关键词:', queryKeyword);
    
    // 直接在item.json中查找商户数据
    console.log('item.json keys:', Object.keys(item.json));
    
    let merchantData = [];
    
    // 尝试所有可能的路径
    if (item.json.filtered_merchants) {
      merchantData = item.json.filtered_merchants;
      console.log('找到filtered_merchants:', merchantData.length);
    } else if (item.json.merchants) {
      merchantData = item.json.merchants;
      console.log('找到merchants:', merchantData.length);
    } else {
      // 遍历所有属性寻找商户数据
      for (const key in item.json) {
        const value = item.json[key];
        if (Array.isArray(value) && value.length > 0 && value[0].sub_merchant_name) {
          merchantData = value;
          console.log(`找到商户数据在 ${key}:`, merchantData.length);
          break;
        }
      }
    }
    
    console.log('商户数据数量:', merchantData.length);
    if (merchantData.length > 0) {
      console.log('商户数据示例:', merchantData[0]);
    }
    
    // 查找匹配
    let foundMerchant = null;
    
    for (const merchant of merchantData) {
      console.log(`检查商户: ${merchant.sub_merchant_name} === ${queryKeyword}?`);
      if (merchant.sub_merchant_name === queryKeyword) {
        foundMerchant = merchant;
        console.log('✅ 找到精确匹配!');
        break;
      }
    }
    
    // 如果没有精确匹配，尝试模糊匹配
    if (!foundMerchant) {
      for (const merchant of merchantData) {
        if (merchant.sub_merchant_name.toLowerCase().includes(queryKeyword.toLowerCase())) {
          foundMerchant = merchant;
          console.log('✅ 找到模糊匹配!');
          break;
        }
      }
    }
    
    if (foundMerchant) {
      results.push({
        json: {
          ...item.json,
          queryType: 'merchant_found',
          queryText: cleanText,
          extractedQuery: queryKeyword,
          result: {
            success: true,
            merchant_id: foundMerchant.merchant_id,
            sub_merchant_name: foundMerchant.sub_merchant_name,
            main_merchant_name: foundMerchant.main_merchant_name,
            message: `✅ 找到商户: ${foundMerchant.sub_merchant_name} (ID: ${foundMerchant.merchant_id})`
          }
        }
      });
    } else {
      results.push({
        json: {
          ...item.json,
          queryType: 'no_match',
          queryText: cleanText,
          extractedQuery: queryKeyword,
          debug: {
            merchantCount: merchantData.length,
            availableMerchants: merchantData.map(m => m.sub_merchant_name).slice(0, 5)
          },
          result: {
            success: false,
            message: `❌ 未找到商户: ${queryKeyword}`
          }
        }
      });
    }
    
  } catch (error) {
    console.log('处理错误:', error);
    results.push({
      json: {
        ...item.json,
        queryType: 'error',
        result: {
          success: false,
          message: `处理错误: ${error.message}`
        }
      }
    });
  }
}

return results;

// 超简化版本说明：
// 1. 直接处理 "商户betfiery的id" 格式
// 2. 遍历所有可能的数据路径
// 3. 详细的console.log输出便于调试
// 4. 精确匹配 + 模糊匹配
// 5. 返回完整的商户信息