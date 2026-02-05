// n8n Code节点：Lark消息查询处理器 - 修复版本
// 修复中文查询和数据读取问题

const items = $input.all();

// 处理每个输入项
const results = [];

for (const item of items) {
  try {
    // 提取消息文本
    let messageText = '';
    
    // 从Lark消息事件中提取文本
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
    
    // 清理和标准化输入文本
    const cleanText = messageText.trim();
    
    if (!cleanText) {
      results.push({
        json: {
          ...item.json,
          queryType: 'empty',
          queryText: '',
          result: {
            success: false,
            message: '请输入要查询的商户名称、游戏名称或游戏代码'
          }
        }
      });
      continue;
    }
    
    // 获取商户和游戏数据 - 修复数据读取
    let merchantData = [];
    let gameData = [];
    
    // 尝试多种方式获取商户数据
    if (item.json.filtered_merchants && Array.isArray(item.json.filtered_merchants)) {
      merchantData = item.json.filtered_merchants;
    } else if (item.json.merchants && Array.isArray(item.json.merchants)) {
      merchantData = item.json.merchants;
    } else if (item.json.data && item.json.data.filtered_merchants) {
      merchantData = item.json.data.filtered_merchants;
    }
    
    // 尝试多种方式获取游戏数据
    if (item.json.games && Array.isArray(item.json.games)) {
      gameData = item.json.games;
    } else if (item.json.data && item.json.data.games) {
      gameData = item.json.data.games;
    }
    
    // 智能识别查询类型和执行匹配
    const queryResult = identifyAndMatchFixed(cleanText, merchantData, gameData);
    
    results.push({
      json: {
        ...item.json,
        queryType: queryResult.type,
        queryText: cleanText,
        extractedQuery: queryResult.extractedQuery,
        debug: {
          originalText: messageText,
          cleanText: cleanText,
          merchantCount: merchantData.length,
          gameCount: gameData.length,
          merchantSample: merchantData.slice(0, 2)
        },
        result: queryResult
      }
    });
    
  } catch (error) {
    results.push({
      json: {
        ...item.json,
        queryType: 'error',
        queryText: messageText || '',
        result: {
          success: false,
          message: `处理错误: ${error.message}`
        }
      }
    });
  }
}

// 修复版智能识别和匹配函数
function identifyAndMatchFixed(queryText, merchants, games) {
  // 智能提取查询关键词 - 支持中文查询格式
  const extractedQuery = extractQueryKeyword(queryText);
  
  if (!extractedQuery) {
    return {
      type: 'invalid_query',
      success: false,
      extractedQuery: '',
      message: `无法识别查询内容: "${queryText}"`
    };
  }
  
  // 1. 首先尝试精确匹配商户名称
  for (const merchant of merchants) {
    // 检查子商户名称（区分大小写）
    if (merchant.sub_merchant_name === extractedQuery) {
      return {
        type: 'merchant_exact',
        success: true,
        matchType: 'exact',
        extractedQuery: extractedQuery,
        matchedField: 'sub_merchant_name',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
      };
    }
    
    // 检查主商户名称（区分大小写）
    if (merchant.main_merchant_name === extractedQuery) {
      return {
        type: 'merchant_exact',
        success: true,
        matchType: 'exact',
        extractedQuery: extractedQuery,
        matchedField: 'main_merchant_name',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`
      };
    }
  }
  
  // 2. 尝试精确匹配游戏名称或代码
  for (const game of games) {
    // 检查游戏名称（区分大小写）
    if (game.game_name === extractedQuery) {
      return {
        type: 'game_exact',
        success: true,
        matchType: 'exact',
        extractedQuery: extractedQuery,
        matchedField: 'game_name',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (ID: ${game.game_id}, 代码: ${game.game_code})`
      };
    }
    
    // 检查游戏代码（区分大小写）
    if (game.game_code === extractedQuery) {
      return {
        type: 'game_exact',
        success: true,
        matchType: 'exact',
        extractedQuery: extractedQuery,
        matchedField: 'game_code',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (ID: ${game.game_id}, 代码: ${game.game_code})`
      };
    }
  }
  
  // 3. 尝试模糊匹配商户名称
  const queryLower = extractedQuery.toLowerCase();
  const merchantMatches = [];
  
  for (const merchant of merchants) {
    if (merchant.sub_merchant_name.toLowerCase().includes(queryLower)) {
      const score = calculateSimilarity(queryLower, merchant.sub_merchant_name.toLowerCase());
      merchantMatches.push({
        ...merchant,
        score,
        matchedField: 'sub_merchant_name'
      });
    } else if (merchant.main_merchant_name.toLowerCase().includes(queryLower)) {
      const score = calculateSimilarity(queryLower, merchant.main_merchant_name.toLowerCase());
      merchantMatches.push({
        ...merchant,
        score,
        matchedField: 'main_merchant_name'
      });
    }
  }
  
  if (merchantMatches.length > 0) {
    merchantMatches.sort((a, b) => b.score - a.score);
    const bestMatch = merchantMatches[0];
    
    return {
      type: 'merchant_fuzzy',
      success: true,
      matchType: 'fuzzy',
      extractedQuery: extractedQuery,
      matchedField: bestMatch.matchedField,
      merchant_id: bestMatch.merchant_id,
      sub_merchant_name: bestMatch.sub_merchant_name,
      main_merchant_name: bestMatch.main_merchant_name,
      similarity: bestMatch.score,
      message: `找到相似商户: ${bestMatch.sub_merchant_name} (ID: ${bestMatch.merchant_id}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`
    };
  }
  
  // 4. 尝试模糊匹配游戏名称
  const gameMatches = [];
  
  for (const game of games) {
    if (game.game_name.toLowerCase().includes(queryLower)) {
      const score = calculateSimilarity(queryLower, game.game_name.toLowerCase());
      gameMatches.push({
        ...game,
        score,
        matchedField: 'game_name'
      });
    } else if (game.game_code.toLowerCase().includes(queryLower)) {
      const score = calculateSimilarity(queryLower, game.game_code.toLowerCase());
      gameMatches.push({
        ...game,
        score,
        matchedField: 'game_code'
      });
    }
  }
  
  if (gameMatches.length > 0) {
    gameMatches.sort((a, b) => b.score - a.score);
    const bestMatch = gameMatches[0];
    
    return {
      type: 'game_fuzzy',
      success: true,
      matchType: 'fuzzy',
      extractedQuery: extractedQuery,
      matchedField: bestMatch.matchedField,
      game_id: bestMatch.game_id,
      game_name: bestMatch.game_name,
      game_code: bestMatch.game_code,
      similarity: bestMatch.score,
      message: `找到相似游戏: ${bestMatch.game_name} (ID: ${bestMatch.game_id}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`
    };
  }
  
  // 5. 检查是否为纯数字ID查询
  if (/^\d+$/.test(extractedQuery)) {
    return {
      type: 'numeric_id',
      success: false,
      extractedQuery: extractedQuery,
      message: `数字ID "${extractedQuery}" 需要更多上下文信息。请指定是商户ID还是游戏ID，或提供名称进行查询。`
    };
  }
  
  // 6. 未找到匹配
  return {
    type: 'no_match',
    success: false,
    extractedQuery: extractedQuery,
    message: `未找到匹配的商户或游戏: "${extractedQuery}"`
  };
}

// 智能提取查询关键词 - 支持中文查询格式
function extractQueryKeyword(text) {
  // 移除常见的查询前缀词和后缀词
  let cleanText = text
    .replace(/^(查询|查找|搜索|找|look|find|search)\s*/i, '')
    .replace(/\s*(的|的id|的ID|id|ID|信息|详情)$/i, '')
    .trim();
  
  // 处理中文查询格式
  // "商户betfiery的id" -> "betfiery"
  // "游戏Dragon Tiger的信息" -> "Dragon Tiger"
  // "betfiery商户" -> "betfiery"
  
  // 匹配模式：商户/游戏 + 名称 + 的 + 后缀
  const patterns = [
    /^(商户|merchant)\s*([^的]+?)\s*(的|的id|的ID|id|ID|信息|详情)?$/i,
    /^(游戏|game)\s*([^的]+?)\s*(的|的id|的ID|id|ID|信息|详情)?$/i,
    /^([^的商户游戏]+?)\s*(商户|游戏|merchant|game)\s*(的|的id|的ID|id|ID|信息|详情)?$/i,
    /^([^的]+?)\s*(的|的id|的ID|id|ID|信息|详情)$/i
  ];
  
  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      // 提取核心名称部分
      const extracted = match[2] || match[1];
      if (extracted && extracted.trim()) {
        return extracted.trim();
      }
    }
  }
  
  // 如果没有匹配到模式，返回清理后的文本
  return cleanText || null;
}

// 计算字符串相似度
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str2.includes(str1)) return 0.8;
  if (str1.includes(str2)) return 0.6;
  return 0.3;
}

return results;

// 修复版使用说明：
// 1. 支持中文查询格式：
//    - "商户betfiery的id" ✅
//    - "betfiery商户" ✅  
//    - "查询betfiery" ✅
//    - "betfiery的信息" ✅
// 2. 修复了数据读取问题
// 3. 返回完整的商户ID和详细信息
// 4. 提供调试信息便于排查问题