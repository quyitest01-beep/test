// 简化版查询处理器测试
// 直接测试核心逻辑，不依赖n8n环境

// 测试数据
const testData = {
  filtered_merchants: [
    {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
    {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662},
    {"sub_merchant_name": "rico100", "main_merchant_name": "RD1", "merchant_id": 1698202814},
    {"sub_merchant_name": "BetWinner", "main_merchant_name": "RD2", "merchant_id": 1698203001},
    {"sub_merchant_name": "GameHub", "main_merchant_name": "RD3", "merchant_id": 1698203002}
  ],
  games: [
    {"game_id": 1001, "game_name": "Dragon Tiger", "game_code": "DT001"},
    {"game_id": 1002, "game_name": "Baccarat Pro", "game_code": "BAC001"},
    {"game_id": 1003, "game_name": "Roulette Master", "game_code": "ROU001"}
  ]
};

// 核心查询处理函数
function processQuery(messageText, merchants, games) {
  // 清理输入
  const cleanText = messageText.trim();
  
  if (!cleanText) {
    return {
      queryType: 'empty',
      success: false,
      message: '请输入要查询的商户名称、游戏名称或游戏代码'
    };
  }
  
  // 移除查询前缀
  const cleanQuery = cleanText
    .replace(/^(查询|查找|搜索|找|look|find|search)\s*/i, '')
    .trim();
  
  console.log(`原始输入: "${messageText}"`);
  console.log(`清理后查询: "${cleanQuery}"`);
  
  // 1. 精确匹配商户
  for (const merchant of merchants) {
    if (merchant.sub_merchant_name === cleanQuery) {
      return {
        queryType: 'merchant_exact',
        success: true,
        matchType: 'exact',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (${merchant.main_merchant_name})`
      };
    }
    
    if (merchant.main_merchant_name === cleanQuery) {
      return {
        queryType: 'merchant_exact',
        success: true,
        matchType: 'exact',
        merchant_id: merchant.merchant_id,
        sub_merchant_name: merchant.sub_merchant_name,
        main_merchant_name: merchant.main_merchant_name,
        message: `找到商户: ${merchant.sub_merchant_name} (${merchant.main_merchant_name})`
      };
    }
  }
  
  // 2. 精确匹配游戏
  for (const game of games) {
    if (game.game_name === cleanQuery) {
      return {
        queryType: 'game_exact',
        success: true,
        matchType: 'exact',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (代码: ${game.game_code})`
      };
    }
    
    if (game.game_code === cleanQuery) {
      return {
        queryType: 'game_exact',
        success: true,
        matchType: 'exact',
        game_id: game.game_id,
        game_name: game.game_name,
        game_code: game.game_code,
        message: `找到游戏: ${game.game_name} (代码: ${game.game_code})`
      };
    }
  }
  
  // 3. 模糊匹配商户
  const queryLower = cleanQuery.toLowerCase();
  const merchantMatches = [];
  
  for (const merchant of merchants) {
    if (merchant.sub_merchant_name.toLowerCase().includes(queryLower)) {
      merchantMatches.push({
        ...merchant,
        score: calculateSimilarity(queryLower, merchant.sub_merchant_name.toLowerCase())
      });
    } else if (merchant.main_merchant_name.toLowerCase().includes(queryLower)) {
      merchantMatches.push({
        ...merchant,
        score: calculateSimilarity(queryLower, merchant.main_merchant_name.toLowerCase())
      });
    }
  }
  
  if (merchantMatches.length > 0) {
    merchantMatches.sort((a, b) => b.score - a.score);
    const bestMatch = merchantMatches[0];
    
    return {
      queryType: 'merchant_fuzzy',
      success: true,
      matchType: 'fuzzy',
      merchant_id: bestMatch.merchant_id,
      sub_merchant_name: bestMatch.sub_merchant_name,
      main_merchant_name: bestMatch.main_merchant_name,
      similarity: bestMatch.score,
      message: `找到相似商户: ${bestMatch.sub_merchant_name} (${bestMatch.main_merchant_name}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`
    };
  }
  
  // 4. 模糊匹配游戏
  const gameMatches = [];
  
  for (const game of games) {
    if (game.game_name.toLowerCase().includes(queryLower)) {
      gameMatches.push({
        ...game,
        score: calculateSimilarity(queryLower, game.game_name.toLowerCase())
      });
    } else if (game.game_code.toLowerCase().includes(queryLower)) {
      gameMatches.push({
        ...game,
        score: calculateSimilarity(queryLower, game.game_code.toLowerCase())
      });
    }
  }
  
  if (gameMatches.length > 0) {
    gameMatches.sort((a, b) => b.score - a.score);
    const bestMatch = gameMatches[0];
    
    return {
      queryType: 'game_fuzzy',
      success: true,
      matchType: 'fuzzy',
      game_id: bestMatch.game_id,
      game_name: bestMatch.game_name,
      game_code: bestMatch.game_code,
      similarity: bestMatch.score,
      message: `找到相似游戏: ${bestMatch.game_name} (代码: ${bestMatch.game_code}) - 相似度: ${(bestMatch.score * 100).toFixed(1)}%`
    };
  }
  
  // 5. 数字ID检查
  if (/^\d+$/.test(cleanQuery)) {
    return {
      queryType: 'numeric_id',
      success: false,
      message: `数字ID "${cleanQuery}" 需要更多上下文信息。请指定是商户ID还是游戏ID，或提供名称进行查询。`
    };
  }
  
  // 6. 未找到匹配
  return {
    queryType: 'no_match',
    success: false,
    message: `未找到匹配的商户或游戏: "${cleanQuery}"`
  };
}

// 计算相似度
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str2.includes(str1)) return 0.8;
  if (str1.includes(str2)) return 0.6;
  return 0.3; // 基础相似度
}

// 测试用例
const testCases = [
  // 精确匹配测试
  { input: "betfiery", expected: "merchant_exact", desc: "精确匹配商户名" },
  { input: "BetWinner", expected: "merchant_exact", desc: "精确匹配商户名(大小写)" },
  { input: "RD1", expected: "merchant_exact", desc: "精确匹配主商户名" },
  { input: "Dragon Tiger", expected: "game_exact", desc: "精确匹配游戏名" },
  { input: "DT001", expected: "game_exact", desc: "精确匹配游戏代码" },
  
  // 模糊匹配测试
  { input: "bet", expected: "merchant_fuzzy", desc: "模糊匹配商户" },
  { input: "dragon", expected: "game_fuzzy", desc: "模糊匹配游戏" },
  
  // 带前缀测试
  { input: "查询 betfiery", expected: "merchant_exact", desc: "带查询前缀" },
  { input: "搜索 Dragon", expected: "game_fuzzy", desc: "带搜索前缀" },
  
  // 大小写测试
  { input: "BETFIERY", expected: "no_match", desc: "全大写(应该不匹配)" },
  { input: "betFiery", expected: "no_match", desc: "混合大小写(应该不匹配)" },
  
  // 数字ID测试
  { input: "1698202251", expected: "numeric_id", desc: "纯数字ID" },
  
  // 无匹配测试
  { input: "nonexistent", expected: "no_match", desc: "不存在的名称" },
  { input: "", expected: "empty", desc: "空输入" }
];

// 运行测试
console.log('=== Lark消息查询处理器测试 ===\n');

let passedTests = 0;
let totalTests = testCases.length;

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  console.log(`测试 ${i + 1}: ${testCase.desc}`);
  console.log(`输入: "${testCase.input}"`);
  
  const result = processQuery(testCase.input, testData.filtered_merchants, testData.games);
  
  console.log(`查询类型: ${result.queryType}`);
  console.log(`匹配成功: ${result.success}`);
  console.log(`消息: ${result.message}`);
  
  if (result.queryType === testCase.expected) {
    console.log(`✅ 测试通过`);
    passedTests++;
  } else {
    console.log(`❌ 测试失败 - 期望: ${testCase.expected}, 实际: ${result.queryType}`);
  }
  
  // 显示匹配结果详情
  if (result.success) {
    if (result.merchant_id) {
      console.log(`📋 商户ID: ${result.merchant_id}, 名称: ${result.sub_merchant_name}`);
    }
    if (result.game_id) {
      console.log(`🎮 游戏ID: ${result.game_id}, 名称: ${result.game_name}, 代码: ${result.game_code}`);
    }
    if (result.similarity) {
      console.log(`📊 相似度: ${(result.similarity * 100).toFixed(1)}%`);
    }
  }
  
  console.log('');
}

console.log(`=== 测试总结 ===`);
console.log(`通过: ${passedTests}/${totalTests}`);
console.log(`成功率: ${(passedTests / totalTests * 100).toFixed(1)}%`);

// 额外测试：验证betfiery确实存在
console.log('\n=== 数据验证 ===');
console.log('商户数据:');
testData.filtered_merchants.forEach((merchant, index) => {
  console.log(`${index + 1}. ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id}, 主商户: ${merchant.main_merchant_name})`);
});

console.log('\n直接查找betfiery:');
const betfieryResult = processQuery('betfiery', testData.filtered_merchants, testData.games);
console.log('结果:', JSON.stringify(betfieryResult, null, 2));