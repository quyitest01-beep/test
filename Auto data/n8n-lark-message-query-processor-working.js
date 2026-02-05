// n8n Code节点：Lark消息查询处理器 - 实用版本
// 基于实际n8n数据流优化

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // 1. 提取消息文本 - 支持多种Lark消息格式
    let messageText = '';
    
    if (item.json.messageText) {
      messageText = item.json.messageText;
    } else if (item.json.content) {
      if (typeof item.json.content === 'string') {
        try {
          const parsed = JSON.parse(item.json.content);
          messageText = parsed.text || item.json.content;
        } catch {
          messageText = item.json.content;
        }
      } else {
        messageText = item.json.content.text || '';
      }
    } else if (item.json.text) {
      messageText = item.json.text;
    } else if (item.json.message) {
      messageText = item.json.message.content || item.json.message.text || '';
    }
    
    const cleanText = messageText.trim();
    
    // 2. 获取商户数据 - 支持多种数据结构
    let merchantData = [];
    
    // 尝试常见的数据路径
    if (item.json.filtered_merchants) {
      merchantData = item.json.filtered_merchants;
    } else if (item.json.merchants) {
      merchantData = item.json.merchants;
    } else if (item.json.data && item.json.data.filtered_merchants) {
      merchantData = item.json.data.filtered_merchants;
    } else {
      // 在所有属性中查找商户数组
      for (const key in item.json) {
        const value = item.json[key];
        if (Array.isArray(value) && value.length > 0 && 
            value[0] && typeof value[0] === 'object' && 
            (value[0].merchant_id || value[0].sub_merchant_name)) {
          merchantData = value;
          break;
        }
      }
    }
    
    // 3. 处理空输入
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
    
    // 4. 智能提取查询关键词
    let queryKeyword = extractQueryKeyword(cleanText);
    
    // 5. 执行查询匹配
    const matchResult = findMerchant(queryKeyword, merchantData);
    
    results.push({
      json: {
        ...item.json,
        queryType: matchResult.type,
        queryText: cleanText,
        extractedQuery: queryKeyword,
        result: matchResult
      }
    });
    
  } catch (error) {
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

// 智能提取查询关键词
function extractQueryKeyword(text) {
  // 处理中文查询格式: "商户betfiery的id" -> "betfiery"
  const chineseMatch = text.match(/商户\s*([^的\s]+)/);
  if (chineseMatch) {
    return chineseMatch[1].trim();
  }
  
  // 处理"xxx的信息"格式: "betfiery的信息" -> "betfiery"
  const infoMatch = text.match(/^([^的]+?)的(信息|详情|id|ID)$/);
  if (infoMatch) {
    return infoMatch[1].trim();
  }
  
  // 移除常见前缀和后缀
  return text
    .replace(/^(查询|查找|搜索|找|look|find|search)\s*/i, '')
    .replace(/\s*(的|的id|的ID|id|ID|信息|详情|商户|merchant)$/i, '')
    .trim();
}

// 查找商户
function findMerchant(queryKeyword, merchants) {
  if (!queryKeyword || merchants.length === 0) {
    return {
      type: 'no_data',
      success: false,
      message: queryKeyword ? '没有可用的商户数据' : '查询关键词为空'
    };
  }
  
  // 1. 精确匹配子商户名
  for (const merchant of merchants) {
    if (merchant.sub_merchant_name === queryKeyword) {
      return {
        type: 'merchant_exact',
        success: true,
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
      };
    }
  }
  
  // 2. 精确匹配主商户名
  for (const merchant of merchants) {
    if (merchant.main_merchant_name === queryKeyword) {
      return {
        type: 'merchant_exact',
        success: true,
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
      };
    }
  }
  
  // 3. 模糊匹配（不区分大小写）
  const queryLower = queryKeyword.toLowerCase();
  const fuzzyMatches = [];
  
  for (const merchant of merchants) {
    const subNameLower = merchant.sub_merchant_name.toLowerCase();
    const mainNameLower = merchant.main_merchant_name.toLowerCase();
    
    if (subNameLower.includes(queryLower)) {
      fuzzyMatches.push({
        ...merchant,
        score: calculateScore(queryLower, subNameLower),
        matchField: 'sub_merchant_name'
      });
    } else if (mainNameLower.includes(queryLower)) {
      fuzzyMatches.push({
        ...merchant,
        score: calculateScore(queryLower, mainNameLower),
        matchField: 'main_merchant_name'
      });
    }
  }
  
  if (fuzzyMatches.length > 0) {
    // 选择最佳匹配
    fuzzyMatches.sort((a, b) => b.score - a.score);
    const best = fuzzyMatches[0];
    
    return {
      type: 'merchant_fuzzy',
      success: true,
      merchant_id: best.merchant_id,
      sub_merchant_name: best.sub_merchant_name,
      main_merchant_name: best.main_merchant_name,
      similarity: best.score,
      message: `找到相似商户: ${best.sub_merchant_name} (ID: ${best.merchant_id}) - 匹配度: ${(best.score * 100).toFixed(0)}%`
    };
  }
  
  // 4. 检查是否为数字ID
  if (/^\d+$/.test(queryKeyword)) {
    const merchantId = parseInt(queryKeyword);
    const foundById = merchants.find(m => m.merchant_id === merchantId);
    
    if (foundById) {
      return {
        type: 'merchant_by_id',
        success: true,
        merchant_id: foundById.merchant_id,
        sub_merchant_name: foundById.sub_merchant_name,
        main_merchant_name: foundById.main_merchant_name,
        message: `通过ID找到商户: ${foundById.sub_merchant_name} (ID: ${foundById.merchant_id})`
      };
    } else {
      return {
        type: 'id_not_found',
        success: false,
        message: `未找到ID为 ${queryKeyword} 的商户`
      };
    }
  }
  
  // 5. 未找到匹配
  return {
    type: 'no_match',
    success: false,
    message: `未找到商户: "${queryKeyword}"`
  };
}

// 计算匹配分数
function calculateScore(query, target) {
  if (query === target) return 1.0;
  if (target.startsWith(query)) return 0.9;
  if (target.includes(query)) return 0.7;
  return 0.5;
}

return results;

// 使用说明：
// 1. 支持多种消息文本格式
// 2. 自动查找商户数据数组
// 3. 智能提取中文查询关键词
// 4. 精确匹配 + 模糊匹配 + ID匹配
// 5. 返回详细的匹配信息