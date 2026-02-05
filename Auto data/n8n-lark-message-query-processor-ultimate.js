// n8n Code节点：终极版本 - 完全兼容所有数据结构
const items = $input.all();
const results = [];

console.log('=== 终极版本开始 ===');
console.log('输入项数量:', items.length);

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(`\n--- 处理第 ${i + 1} 项 ---`);
  
  try {
    // 1. 完整输出数据结构用于调试
    console.log('完整item结构:', JSON.stringify(item, null, 2));
    
    // 2. 提取消息文本 - 尝试所有可能的字段
    let messageText = '';
    const textFields = ['queryText', 'messageText', 'content', 'text', 'message'];
    
    for (const field of textFields) {
      if (item.json[field]) {
        messageText = item.json[field];
        console.log(`从 ${field} 获取消息:`, JSON.stringify(messageText));
        break;
      }
    }
    
    // 如果消息是对象，尝试提取text字段
    if (typeof messageText === 'object' && messageText.text) {
      messageText = messageText.text;
    }
    
    const cleanText = String(messageText).trim();
    console.log('最终消息文本:', JSON.stringify(cleanText));
    
    // 3. 深度搜索商户数据 - 在整个对象中查找
    let merchantData = [];
    
    function findMerchantArray(obj, path = '') {
      if (Array.isArray(obj)) {
        // 检查是否是商户数组
        if (obj.length > 0 && obj[0] && typeof obj[0] === 'object') {
          const firstItem = obj[0];
          if (firstItem.merchant_id || firstItem.sub_merchant_name || firstItem.main_merchant_name) {
            console.log(`🎯 在 ${path} 找到商户数组:`, obj.length, '条');
            console.log('示例商户:', firstItem);
            return obj;
          }
        }
      } else if (obj && typeof obj === 'object') {
        for (const key in obj) {
          const result = findMerchantArray(obj[key], path ? `${path}.${key}` : key);
          if (result) return result;
        }
      }
      return null;
    }
    
    merchantData = findMerchantArray(item.json) || [];
    
    console.log('找到的商户数据数量:', merchantData.length);
    
    // 如果还是没找到，尝试从其他输入项获取
    if (merchantData.length === 0) {
      console.log('从当前项未找到商户数据，尝试其他输入项...');
      for (let j = 0; j < items.length; j++) {
        if (j !== i) {
          const otherMerchants = findMerchantArray(items[j].json);
          if (otherMerchants && otherMerchants.length > 0) {
            merchantData = otherMerchants;
            console.log(`从第 ${j + 1} 项获取商户数据:`, merchantData.length, '条');
            break;
          }
        }
      }
    }
    
    // 显示找到的商户
    if (merchantData.length > 0) {
      console.log('商户列表:');
      merchantData.forEach((merchant, index) => {
        console.log(`  ${index + 1}. ${merchant.sub_merchant_name || merchant.name || '未知'} (ID: ${merchant.merchant_id || merchant.id || '未知'})`);
      });
    } else {
      console.log('❌ 完全没有找到商户数据');
    }
    
    // 4. 处理查询
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
    
    // 5. 提取查询关键词
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
    
    // 6. 执行匹配
    let matchResult = null;
    
    if (merchantData.length === 0) {
      matchResult = {
        type: 'no_data',
        success: false,
        message: '没有可用的商户数据'
      };
    } else {
      // 检查是否为纯数字ID查询
      if (/^\d+$/.test(queryKeyword)) {
        console.log('检测到数字ID查询:', queryKeyword);
        const queryId = parseInt(queryKeyword);
        
        for (const merchant of merchantData) {
          const merchantId = merchant.merchant_id || merchant.id;
          console.log(`检查ID匹配: ${merchantId} === ${queryId}`);
          
          if (merchantId === queryId) {
            const merchantName = merchant.sub_merchant_name || merchant.name || '';
            matchResult = {
              type: 'merchant_by_id',
              success: true,
              merchant_id: merchantId,
              sub_merchant_name: merchantName,
              main_merchant_name: merchant.main_merchant_name || merchant.main_name || '',
              message: `通过ID找到商户: ${merchantName} (ID: ${merchantId})`
            };
            console.log('✅ ID匹配成功!');
            break;
          }
        }
        
        if (!matchResult) {
          matchResult = {
            type: 'id_not_found',
            success: false,
            message: `未找到ID为 ${queryKeyword} 的商户`
          };
          console.log('❌ ID未找到');
        }
      } else {
        // 精确匹配商户名
        for (const merchant of merchantData) {
          const merchantName = merchant.sub_merchant_name || merchant.name || '';
          console.log(`检查精确匹配: "${merchantName}" === "${queryKeyword}"`);
          
          if (merchantName === queryKeyword) {
            matchResult = {
              type: 'merchant_exact',
              success: true,
              merchant_id: merchant.merchant_id || merchant.id,
              sub_merchant_name: merchantName,
              main_merchant_name: merchant.main_merchant_name || merchant.main_name || '',
              message: `找到商户: ${merchantName} (ID: ${merchant.merchant_id || merchant.id})`
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
            const merchantName = merchant.sub_merchant_name || merchant.name || '';
            const merchantLower = merchantName.toLowerCase();
            console.log(`检查模糊匹配: "${merchantLower}".includes("${queryLower}")`);
            
            if (merchantLower.includes(queryLower)) {
              matchResult = {
                type: 'merchant_fuzzy',
                success: true,
                merchant_id: merchant.merchant_id || merchant.id,
                sub_merchant_name: merchantName,
                main_merchant_name: merchant.main_merchant_name || merchant.main_name || '',
                message: `找到相似商户: ${merchantName} (ID: ${merchant.merchant_id || merchant.id})`
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
    }
    
    // 7. 返回结果
    results.push({
      json: {
        ...item.json,
        queryType: matchResult.type,
        queryText: cleanText,
        extractedQuery: queryKeyword,
        debug: {
          merchantCount: merchantData.length,
          merchantNames: merchantData.map(m => m.sub_merchant_name || m.name || '未知'),
          allKeys: Object.keys(item.json),
          hasFilteredMerchants: !!item.json.filtered_merchants,
          filteredMerchantsType: typeof item.json.filtered_merchants
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

console.log('=== 终极版本完成 ===');
return results;

// 终极版本特点：
// 1. 完整输出数据结构用于调试
// 2. 深度搜索所有可能的商户数据位置
// 3. 兼容不同的字段名称
// 4. 从其他输入项获取数据
// 5. 详细的每一步日志
// 6. 支持反向查询：通过ID查商户名
//
// 支持的查询格式：
// - 商户名查ID: "betfiery" → 返回ID和详细信息
// - ID查商户名: "1698202251" → 返回商户名和详细信息
// - 中文格式: "商户betfiery的id" → 提取betfiery进行查询
// - 模糊匹配: "bet" → 找到包含bet的商户