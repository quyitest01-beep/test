// n8n Code节点：Lark消息查询处理器 - 调试版本
// 添加详细的调试信息来诊断no_match问题

const items = $input.all();

// 处理每个输入项
const results = [];

for (const item of items) {
  try {
    // 调试：打印原始输入数据
    console.log('=== 调试信息 ===');
    console.log('原始item.json:', JSON.stringify(item.json, null, 2));
    
    // 提取消息文本
    let messageText = '';
    
    // 从Lark消息事件中提取文本
    if (item.json.messageText) {
      messageText = item.json.messageText;
      console.log('从messageText提取:', messageText);
    } else if (item.json.content) {
      try {
        const content = JSON.parse(item.json.content);
        messageText = content.text || '';
        console.log('从content解析提取:', messageText);
      } catch (e) {
        messageText = item.json.content;
        console.log('content解析失败，直接使用:', messageText);
      }
    } else if (item.json.text) {
      messageText = item.json.text;
      console.log('从text提取:', messageText);
    }
    
    // 调试：检查消息文本
    console.log('最终messageText:', `"${messageText}"`);
    console.log('messageText长度:', messageText.length);
    console.log('messageText类型:', typeof messageText);
    
    // 清理和标准化输入文本
    const cleanText = messageText.trim();
    console.log('清理后文本:', `"${cleanText}"`);
    
    if (!cleanText) {
      console.log('文本为空，返回empty类型');
      results.push({
        json: {
          ...item.json,
          queryType: 'empty',
          queryText: '',
          debug: {
            originalText: messageText,
            cleanText: cleanText,
            reason: 'empty_text'
          },
          result: {
            success: false,
            message: '请输入要查询的商户名称、游戏名称或游戏代码'
          }
        }
      });
      continue;
    }
    
    // 获取商户和游戏数据
    const merchantData = item.json.filtered_merchants || [];
    const gameData = item.json.games || [];
    
    // 调试：检查数据源
    console.log('商户数据数量:', merchantData.length);
    console.log('游戏数据数量:', gameData.length);
    
    if (merchantData.length > 0) {
      console.log('商户数据示例:', merchantData.slice(0, 3));
    }
    if (gameData.length > 0) {
      console.log('游戏数据示例:', gameData.slice(0, 3));
    }
    
    // 智能识别查询类型和执行匹配
    const queryResult = identifyAndMatchDebug(cleanText, merchantData, gameData);
    
    results.push({
      json: {
        ...item.json,
        queryType: queryResult.type,
        queryText: cleanText,
        debug: {
          originalText: messageText,
          cleanText: cleanText,
          merchantCount: merchantData.length,
          gameCount: gameData.length,
          processingSteps: queryResult.debugSteps || []
        },
        result: queryResult
      }
    });
    
  } catch (error) {
    console.log('处理错误:', error.message);
    results.push({
      json: {
        ...item.json,
        queryType: 'error',
        queryText: messageText || '',
        debug: {
          error: error.message,
          stack: error.stack
        },
        result: {
          success: false,
          message: `处理错误: ${error.message}`
        }
      }
    });
  }
}

// 调试版智能识别和匹配函数
function identifyAndMatchDebug(queryText, merchants, games) {
  const debugSteps = [];
  
  // 移除常见的查询前缀词
  const cleanQuery = queryText
    .replace(/^(查询|查找|搜索|找|look|find|search)\s*/i, '')
    .trim();
  
  debugSteps.push(`原始查询: "${queryText}"`);
  debugSteps.push(`清理后查询: "${cleanQuery}"`);
  
  // 1. 首先尝试精确匹配商户名称
  debugSteps.push('开始精确匹配商户...');
  for (let i = 0; i < merchants.length; i++) {
    const merchant = merchants[i];
    debugSteps.push(`检查商户 ${i+1}: sub_merchant_name="${merchant.sub_merchant_name}", main_merchant_name="${merchant.main_merchant_name}"`);
    
    // 检查子商户名称（区分大小写）
    if (merchant.sub_merchant_name === cleanQuery) {
      debugSteps.push(`✅ 精确匹配子商户名称: ${merchant.sub_merchant_name}`);
      return {
        type: 'merchant_exact',
        success: true,
        matchType: 'exact',
        matchedField: 'sub_merchant_name',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (${merchant.main_merchant_name})`,
        debugSteps: debugSteps
      };
    }
    
    // 检查主商户名称（区分大小写）
    if (merchant.main_merchant_name === cleanQuery) {
      debugSteps.push(`✅ 精确匹配主商户名称: ${merchant.main_merchant_name}`);
      return {
        type: 'merchant_exact',
        success: true,
        matchType: 'exact',
        matchedField: 'main_merchant_name',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (${merchant.main_merchant_name})`,
        debugSteps: debugSteps
      };
    }
  }
  debugSteps.push('❌ 精确匹配商户失败');
  
  // 2. 尝试精确匹配游戏名称或代码
  debugSteps.push('开始精确匹配游戏...');
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    debugSteps.push(`检查游戏 ${i+1}: game_name="${game.game_name}", game_code="${game.game_code}"`);
    
    // 检查游戏名称（区分大小写）
    if (game.game_name === cleanQuery) {
      debugSteps.push(`✅ 精确匹配游戏名称: ${game.game_name}`);
      return {
        type: 'game_exact',
        success: true,
        matchType: 'exact',
        matchedField: 'game_name',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (代码: ${game.game_code})`,
        debugSteps: debugSteps
      };
    }
    
    // 检查游戏代码（区分大小写）
    if (game.game_code === cleanQuery) {
      debugSteps.push(`✅ 精确匹配游戏代码: ${game.game_code}`);
      return {
        type: 'game_exact',
        success: true,
        matchType: 'exact',
        matchedField: 'game_code',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (代码: ${game.game_code})`,
        debugSteps: debugSteps
      };
    }
  }
  debugSteps.push('❌ 精确匹配游戏失败');
  
  // 3. 尝试模糊匹配商户名称
  debugSteps.push('开始模糊匹配商户...');
  const queryLower = cleanQuery.toLowerCase();
  debugSteps.push(`小写查询: "${queryLower}"`);
  
  const merchantMatches = [];
  for (let i = 0; i < merchants.length; i++) {
    const merchant = merchants[i];
    const subNameLower = merchant.sub_merchant_name.toLowerCase();
    const mainNameLower = merchant.main_merchant_name.toLowerCase();
    
    debugSteps.push(`检查商户 ${i+1}: "${subNameLower}" 包含 "${queryLower}"? ${subNameLower.includes(queryLower)}`);
    debugSteps.push(`检查商户 ${i+1}: "${mainNameLower}" 包含 "${queryLower}"? ${mainNameLower.includes(queryLower)}`);
    
    if (subNameLower.includes(queryLower)) {
      const score = calculateSimilarity(queryLower, subNameLower);
      merchantMatches.push({
        ...merchant,
        score,
        matchedField: 'sub_merchant_name'
      });
      debugSteps.push(`✓ 模糊匹配子商户: ${merchant.sub_merchant_name}, 相似度: ${score}`);
    } else if (mainNameLower.includes(queryLower)) {
      const score = calculateSimilarity(queryLower, mainNameLower);
      merchantMatches.push({
        ...merchant,
        score,
        matchedField: 'main_merchant_name'
      });
      debugSteps.push(`✓ 模糊匹配主商户: ${merchant.main_merchant_name}, 相似度: ${score}`);
    }
  }
  
  if (merchantMatches.length > 0) {
    merchantMatches.sort((a, b) => b.score - a.score);
    const bestMatch = merchantMatches[0];
    debugSteps.push(`✅ 找到最佳商户匹配: ${bestMatch.sub_merchant_name}, 相似度: ${bestMatch.score}`);
    
    return {
      type: 'merchant_fuzzy',
      success: true,
      matchType: 'fuzzy',
      matchedField: bestMatch.matchedField,
      merchant_id: bestMatch.merchant_id,
      sub_merchant_name: bestMatch.sub_merchant_name,
      main_merchant_name: bestMatch.main_merchant_name,
      similarity: bestMatch.score,
      message: `找到相似商户: ${bestMatch.sub_merchant_name} (${bestMatch.main_merchant_name}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`,
      debugSteps: debugSteps
    };
  }
  debugSteps.push('❌ 模糊匹配商户失败');
  
  // 4. 尝试模糊匹配游戏名称
  debugSteps.push('开始模糊匹配游戏...');
  const gameMatches = [];
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const gameNameLower = game.game_name.toLowerCase();
    const gameCodeLower = game.game_code.toLowerCase();
    
    debugSteps.push(`检查游戏 ${i+1}: "${gameNameLower}" 包含 "${queryLower}"? ${gameNameLower.includes(queryLower)}`);
    debugSteps.push(`检查游戏 ${i+1}: "${gameCodeLower}" 包含 "${queryLower}"? ${gameCodeLower.includes(queryLower)}`);
    
    if (gameNameLower.includes(queryLower)) {
      const score = calculateSimilarity(queryLower, gameNameLower);
      gameMatches.push({
        ...game,
        score,
        matchedField: 'game_name'
      });
      debugSteps.push(`✓ 模糊匹配游戏名: ${game.game_name}, 相似度: ${score}`);
    } else if (gameCodeLower.includes(queryLower)) {
      const score = calculateSimilarity(queryLower, gameCodeLower);
      gameMatches.push({
        ...game,
        score,
        matchedField: 'game_code'
      });
      debugSteps.push(`✓ 模糊匹配游戏代码: ${game.game_code}, 相似度: ${score}`);
    }
  }
  
  if (gameMatches.length > 0) {
    gameMatches.sort((a, b) => b.score - a.score);
    const bestMatch = gameMatches[0];
    debugSteps.push(`✅ 找到最佳游戏匹配: ${bestMatch.game_name}, 相似度: ${bestMatch.score}`);
    
    return {
      type: 'game_fuzzy',
      success: true,
      matchType: 'fuzzy',
      matchedField: bestMatch.matchedField,
      game_id: bestMatch.game_id,
      game_name: bestMatch.game_name,
      game_code: bestMatch.game_code,
      similarity: bestMatch.score,
      message: `找到相似游戏: ${bestMatch.game_name} (代码: ${bestMatch.game_code}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`,
      debugSteps: debugSteps
    };
  }
  debugSteps.push('❌ 模糊匹配游戏失败');
  
  // 5. 检查是否为纯数字ID查询
  if (/^\d+$/.test(cleanQuery)) {
    debugSteps.push('✓ 识别为数字ID');
    return {
      type: 'numeric_id',
      success: false,
      query: cleanQuery,
      message: `数字ID "${cleanQuery}" 需要更多上下文信息。请指定是商户ID还是游戏ID，或提供名称进行查询。`,
      debugSteps: debugSteps
    };
  }
  
  // 6. 未找到匹配
  debugSteps.push('❌ 所有匹配方式都失败');
  return {
    type: 'no_match',
    success: false,
    query: cleanQuery,
    message: `未找到匹配的商户或游戏: "${cleanQuery}"`,
    debugSteps: debugSteps
  };
}

// 计算字符串相似度
function calculateSimilarity(str1, str2) {
  // 简单的包含关系评分
  if (str1 === str2) return 1.0;
  if (str2.includes(str1)) return 0.8;
  if (str1.includes(str2)) return 0.6;
  
  // Levenshtein距离相似度
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return Math.max(0.3, 1 - (distance / maxLength));
}

// Levenshtein距离算法
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

return results;

// 调试版使用说明：
// 1. 将此代码替换到n8n的Code节点中
// 2. 运行后查看输出中的debug字段
// 3. 检查console.log输出（在n8n的执行日志中）
// 4. debug.processingSteps 包含详细的匹配过程
// 
// 常见no_match原因：
// - 输入数据中没有filtered_merchants数组
// - 商户名称大小写不匹配
// - 消息文本提取失败
// - 数据格式不正确