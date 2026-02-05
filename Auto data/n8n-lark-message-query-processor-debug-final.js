// n8n Code节点：Lark消息查询处理器 - 终极调试版本
// 专门解决"还不行"的问题 - 详细诊断数据结构

const items = $input.all();
const results = [];

console.log('=== 开始调试 ===');
console.log('输入项数量:', items.length);

for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
  const item = items[itemIndex];
  
  console.log(`\n--- 处理第 ${itemIndex + 1} 项 ---`);
  console.log('完整item结构:', JSON.stringify(item, null, 2));
  
  try {
    // 1. 提取消息文本 - 多种方式尝试
    let messageText = '';
    let textSource = '';
    
    if (item.json.messageText) {
      messageText = item.json.messageText;
      textSource = 'messageText';
    } else if (item.json.content) {
      try {
        const content = JSON.parse(item.json.content);
        messageText = content.text || '';
        textSource = 'content.text';
      } catch (e) {
        messageText = item.json.content;
        textSource = 'content(直接)';
      }
    } else if (item.json.text) {
      messageText = item.json.text;
      textSource = 'text';
    } else if (item.json.message && item.json.message.content) {
      messageText = item.json.message.content;
      textSource = 'message.content';
    }
    
    console.log('消息文本来源:', textSource);
    console.log('原始消息文本:', JSON.stringify(messageText));
    console.log('清理后消息文本:', JSON.stringify(messageText.trim()));
    
    const cleanText = messageText.trim();
    
    // 2. 查找商户数据 - 穷尽所有可能的路径
    let merchantData = [];
    let merchantSource = '';
    
    const possibleMerchantPaths = [
      'filtered_merchants',
      'merchants', 
      'data.filtered_merchants',
      'data.merchants',
      'json.filtered_merchants',
      'json.merchants',
      'body.filtered_merchants',
      'body.merchants'
    ];
    
    console.log('\n=== 查找商户数据 ===');
    console.log('item.json的所有键:', Object.keys(item.json));
    
    // 直接检查顶级属性
    for (const path of possibleMerchantPaths) {
      const pathParts = path.split('.');
      let current = item.json;
      let valid = true;
      
      for (const part of pathParts) {
        if (current && typeof current === 'object' && current[part] !== undefined) {
          current = current[part];
        } else {
          valid = false;
          break;
        }
      }
      
      if (valid && Array.isArray(current) && current.length > 0) {
        merchantData = current;
        merchantSource = path;
        console.log(`✅ 在 ${path} 找到商户数据:`, current.length, '条');
        break;
      } else {
        console.log(`❌ ${path}: ${valid ? '不是数组或为空' : '路径不存在'}`);
      }
    }
    
    // 如果还没找到，遍历所有属性寻找包含merchant_id的数组
    if (merchantData.length === 0) {
      console.log('尝试深度搜索商户数据...');
      
      function findMerchantData(obj, path = '') {
        if (Array.isArray(obj)) {
          if (obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 
              (obj[0].merchant_id || obj[0].sub_merchant_name)) {
            console.log(`🔍 在 ${path} 发现商户数据:`, obj.length, '条');
            console.log('示例数据:', obj[0]);
            return obj;
          }
        } else if (obj && typeof obj === 'object') {
          for (const key in obj) {
            const result = findMerchantData(obj[key], path ? `${path}.${key}` : key);
            if (result) return result;
          }
        }
        return null;
      }
      
      const foundData = findMerchantData(item.json);
      if (foundData) {
        merchantData = foundData;
        merchantSource = '深度搜索';
      }
    }
    
    console.log('最终商户数据数量:', merchantData.length);
    console.log('商户数据来源:', merchantSource);
    
    if (merchantData.length > 0) {
      console.log('商户数据示例:');
      merchantData.slice(0, 3).forEach((merchant, i) => {
        console.log(`  ${i + 1}. ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`);
      });
      
      // 特别检查betfiery
      const betfieryMerchant = merchantData.find(m => m.sub_merchant_name === 'betfiery');
      if (betfieryMerchant) {
        console.log('✅ 找到betfiery商户:', betfieryMerchant);
      } else {
        console.log('❌ 未找到betfiery商户');
        console.log('所有商户名称:', merchantData.map(m => m.sub_merchant_name));
      }
    }
    
    // 3. 执行查询匹配
    console.log('\n=== 执行查询匹配 ===');
    
    if (!cleanText) {
      results.push({
        json: {
          ...item.json,
          queryType: 'empty',
          debug: {
            textSource,
            merchantSource,
            merchantCount: merchantData.length
          },
          result: {
            success: false,
            message: '请输入要查询的商户名称'
          }
        }
      });
      continue;
    }
    
    // 提取查询关键词
    let queryKeyword = cleanText;
    
    // 处理中文查询格式
    if (cleanText.includes('商户') && cleanText.includes('的')) {
      const match = cleanText.match(/商户\s*([^的]+?)\s*的/);
      if (match) {
        queryKeyword = match[1].trim();
        console.log('从中文格式提取关键词:', queryKeyword);
      }
    }
    
    // 移除查询前缀
    queryKeyword = queryKeyword
      .replace(/^(查询|查找|搜索|找|look|find|search)\s*/i, '')
      .replace(/\s*(的|的id|的ID|id|ID|信息|详情)$/i, '')
      .trim();
    
    console.log('最终查询关键词:', JSON.stringify(queryKeyword));
    
    // 执行匹配
    let matchResult = null;
    
    // 精确匹配
    for (const merchant of merchantData) {
      console.log(`检查精确匹配: "${merchant.sub_merchant_name}" === "${queryKeyword}"?`);
      if (merchant.sub_merchant_name === queryKeyword) {
        matchResult = {
          type: 'merchant_exact',
          success: true,
          merchant_id: merchant.merchant_id,
          sub_merchant_name: merchant.sub_merchant_name,
          main_merchant_name: merchant.main_merchant_name,
          message: `✅ 找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
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
        console.log(`检查模糊匹配: "${merchantLower}".includes("${queryLower}")?`);
        
        if (merchantLower.includes(queryLower)) {
          matchResult = {
            type: 'merchant_fuzzy',
            success: true,
            merchant_id: merchant.merchant_id,
            sub_merchant_name: merchant.sub_merchant_name,
            main_merchant_name: merchant.main_merchant_name,
            message: `✅ 找到相似商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
          };
          console.log('✅ 模糊匹配成功!');
          break;
        }
      }
    }
    
    // 如果还是没找到
    if (!matchResult) {
      matchResult = {
        type: 'no_match',
        success: false,
        message: `❌ 未找到商户: ${queryKeyword}`
      };
      console.log('❌ 未找到任何匹配');
    }
    
    results.push({
      json: {
        ...item.json,
        queryType: matchResult.type,
        queryText: cleanText,
        extractedQuery: queryKeyword,
        debug: {
          originalMessage: messageText,
          textSource,
          merchantSource,
          merchantCount: merchantData.length,
          merchantSample: merchantData.slice(0, 2),
          allMerchantNames: merchantData.map(m => m.sub_merchant_name),
          itemKeys: Object.keys(item.json),
          matchAttempts: {
            exactMatch: merchantData.some(m => m.sub_merchant_name === queryKeyword),
            fuzzyMatch: merchantData.some(m => m.sub_merchant_name.toLowerCase().includes(queryKeyword.toLowerCase()))
          }
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

console.log('=== 调试结束 ===');
return results;

// 使用说明：
// 1. 这个版本会输出详细的调试信息到n8n控制台
// 2. 会显示完整的数据结构和查找过程
// 3. 会告诉你数据在哪里，为什么匹配失败
// 4. 运行后查看n8n的执行日志，找到问题根源