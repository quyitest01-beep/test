// n8n Code节点：Lark消息查询处理器 - 针对实际数据结构的最终修复版本
const items = $input.all();
const results = [];

// 添加详细日志
console.log('=== 开始处理 ===');
console.log('输入项数量:', items.length);

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(`\n--- 处理第 ${i + 1} 项 ---`);
  
  try {
    // 1. 提取消息文本
    let messageText = '';
    
    // 从你的截图看，消息在 queryText 字段
    if (item.json.queryText) {
      messageText = item.json.queryText;
    } else if (item.json.messageText) {
      messageText = item.json.messageText;
    } else if (item.json.content) {
      messageText = item.json.content;
    } else if (item.json.text) {
      messageText = item.json.text;
    }
    
    console.log('提取的消息文本:', JSON.stringify(messageText));
    
    const cleanText = messageText.trim();
    
    // 2. 获取商户数据 - 根据你的截图，数据在 filtered_merchants
    let merchantData = [];
    
    console.log('检查数据路径...');
    console.log('item.json keys:', Object.keys(item.json));
    
    // 直接从你的数据结构获取
    if (item.json.filtered_merchants && Array.isArray(item.json.filtered_merchants)) {
      merchantData = item.json.filtered_merchants;
      console.log('✅ 从 filtered_merchants 获取数据:', merchantData.length, '条');
    } else {
      console.log('❌ filtered_merchants 不存在或不是数组');
      console.log('filtered_merchants 值:', item.json.filtered_merchants);
    }
    
    // 显示商户数据详情
    if (merchantData.length > 0) {
      console.log('商户数据详情:');
      merchantData.forEach((merchant, index) => {
        console.log(`  ${index + 1}. ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`);
      });
      
      // 特别检查betfiery
      const betfiery = merchantData.find(m => m.sub_merchant_name === 'betfiery');
      console.log('betfiery商户:', betfiery ? '存在' : '不存在');
    } else {
      console.log('❌ 商户数据为空');
    }
    
    // 3. 处理查询
    if (!cleanText) {
      results.push({
        json: {
          ...item.json,
          queryType: 'empty',
          result: {
            success: false,
            message: '请输入要查询的商户名称'
          }
        }
      });
      continue;
    }
    
    // 4. 提取查询关键词
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
    
    console.log('查询关键词:', JSON.stringify(queryKeyword));
    
    // 5. 执行匹配
    let matchResult = null;
    
    if (merchantData.length === 0) {
      matchResult = {
        type: 'no_data',
        success: false,
        message: '没有可用的商户数据'
      };
    } else {
      // 精确匹配
      for (const merchant of merchantData) {
        console.log(`检查精确匹配: "${merchant.sub_merchant_name}" === "${queryKeyword}"`);
        if (merchant.sub_merchant_name === queryKeyword) {
          matchResult = {
            type: 'merchant_exact',
            success: true,
            merchant_id: merchant.merchant_id,
            sub_merchant_name: merchant.sub_merchant_name,
            main_merchant_name: merchant.main_merchant_name,
            message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
          };
          console.log('✅ 精确匹配成功!');
          break;
        }
      }
      
      // 模糊匹配
      if (!matchResult) {
        console.log('尝试模糊匹配...');
        const queryLower = queryKeyword.toLowerCase();
        
        for (const merchant of merchantData) {
          const merchantLower = merchant.sub_merchant_name.toLowerCase();
          console.log(`检查模糊匹配: "${merchantLower}".includes("${queryLower}")`);
          
          if (merchantLower.includes(queryLower)) {
            matchResult = {
              type: 'merchant_fuzzy',
              success: true,
              merchant_id: merchant.merchant_id,
              sub_merchant_name: merchant.sub_merchant_name,
              main_merchant_name: merchant.main_merchant_name,
              message: `找到相似商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
            };
            console.log('✅ 模糊匹配成功!');
            break;
          }
        }
      }
      
      // 未找到匹配
      if (!matchResult) {
        matchResult = {
          type: 'no_match',
          success: false,
          message: `未找到商户: "${queryKeyword}"`
        };
        console.log('❌ 未找到匹配');
      }
    }
    
    // 6. 返回结果
    results.push({
      json: {
        ...item.json,
        queryType: matchResult.type,
        queryText: cleanText,
        extractedQuery: queryKeyword,
        debug: {
          merchantCount: merchantData.length,
          merchantNames: merchantData.map(m => m.sub_merchant_name),
          inputKeys: Object.keys(item.json)
        },
        result: matchResult
      }
    });
    
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

console.log('=== 处理完成 ===');
return results;

// 这个版本专门针对你的数据结构优化：
// 1. 直接读取 filtered_merchants 数组
// 2. 详细的控制台日志输出
// 3. 逐步调试每个环节
// 4. 确保能找到betfiery商户