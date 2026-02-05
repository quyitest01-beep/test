// 测试Lark消息查询处理器
const fs = require('fs');

// 模拟测试数据
const testData = {
  // 商户数据
  filtered_merchants: [
    {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
    {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662},
    {"sub_merchant_name": "rico100", "main_merchant_name": "RD1", "merchant_id": 1698202814},
    {"sub_merchant_name": "BetWinner", "main_merchant_name": "RD2", "merchant_id": 1698203001},
    {"sub_merchant_name": "GameHub", "main_merchant_name": "RD3", "merchant_id": 1698203002},
    {"sub_merchant_name": "LuckySlots", "main_merchant_name": "RD3", "merchant_id": 1698203003}
  ],
  
  // 游戏数据（模拟）
  games: [
    {"game_id": 1001, "game_name": "Dragon Tiger", "game_code": "DT001"},
    {"game_id": 1002, "game_name": "Baccarat Pro", "game_code": "BAC001"},
    {"game_id": 1003, "game_name": "Roulette Master", "game_code": "ROU001"},
    {"game_id": 1004, "game_name": "Blackjack Elite", "game_code": "BJ001"},
    {"game_id": 1005, "game_name": "Slot Adventure", "game_code": "SLOT001"}
  ]
};

// 测试用例
const testCases = [
  // 精确匹配测试
  { messageText: "betfiery", expected: "merchant_exact" },
  { messageText: "BetWinner", expected: "merchant_exact" },
  { messageText: "Dragon Tiger", expected: "game_exact" },
  { messageText: "DT001", expected: "game_exact" },
  
  // 模糊匹配测试
  { messageText: "bet", expected: "merchant_fuzzy" },
  { messageText: "dragon", expected: "game_fuzzy" },
  { messageText: "slot", expected: "game_fuzzy" },
  
  // 带查询前缀测试
  { messageText: "查询 betfiery", expected: "merchant_exact" },
  { messageText: "搜索 Dragon", expected: "game_fuzzy" },
  { messageText: "find BetWinner", expected: "merchant_exact" },
  
  // 大小写敏感测试
  { messageText: "BETFIERY", expected: "no_match" }, // 应该不匹配（区分大小写）
  { messageText: "betFiery", expected: "no_match" }, // 应该不匹配（区分大小写）
  
  // 数字ID测试
  { messageText: "1698202251", expected: "numeric_id" },
  { messageText: "1001", expected: "numeric_id" },
  
  // 无匹配测试
  { messageText: "nonexistent", expected: "no_match" },
  { messageText: "xyz123", expected: "no_match" },
  
  // 空输入测试
  { messageText: "", expected: "empty" },
  { messageText: "   ", expected: "empty" },
  
  // 特殊字符测试
  { messageText: "rico100", expected: "merchant_exact" },
  { messageText: "BAC001", expected: "game_exact" }
];

// 模拟n8n Code节点执行环境
function simulateN8NExecution(messageText) {
  // 模拟$input.all()返回的数据
  const mockInput = [{
    json: {
      messageText: messageText,
      ...testData
    }
  }];
  
  // 读取并执行n8n代码
  const codeContent = fs.readFileSync('n8n-lark-message-query-processor.js', 'utf8');
  
  // 提取主要逻辑部分（去掉n8n特定的部分）
  const $input = {
    all: () => mockInput
  };
  
  // 执行代码逻辑
  eval(codeContent.replace('const items = $input.all();', 'const items = mockInput;').replace('return results;', ''));
  
  return results[0]; // 返回第一个结果
}

// 运行测试
function runTests() {
  console.log('=== Lark消息查询处理器测试 ===\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`测试 ${i + 1}: "${testCase.messageText}"`);
    
    try {
      const result = simulateN8NExecution(testCase.messageText);
      const actualType = result.json.queryType;
      const success = result.json.result.success;
      
      console.log(`  查询类型: ${actualType}`);
      console.log(`  匹配成功: ${success}`);
      console.log(`  消息: ${result.json.result.message || '无消息'}`);
      
      if (actualType === testCase.expected) {
        console.log(`  ✅ 测试通过`);
        passedTests++;
      } else {
        console.log(`  ❌ 测试失败 - 期望: ${testCase.expected}, 实际: ${actualType}`);
      }
      
      // 显示匹配结果详情
      if (success && result.json.result.merchant_id) {
        console.log(`  商户ID: ${result.json.result.merchant_id}`);
        console.log(`  商户名: ${result.json.result.sub_merchant_name}`);
      }
      if (success && result.json.result.game_id) {
        console.log(`  游戏ID: ${result.json.result.game_id}`);
        console.log(`  游戏名: ${result.json.result.game_name}`);
        console.log(`  游戏代码: ${result.json.result.game_code}`);
      }
      
    } catch (error) {
      console.log(`  ❌ 执行错误: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log(`=== 测试总结 ===`);
  console.log(`通过: ${passedTests}/${totalTests}`);
  console.log(`成功率: ${(passedTests / totalTests * 100).toFixed(1)}%`);
}

// 测试特定功能
function testSpecificFeatures() {
  console.log('\n=== 特定功能测试 ===\n');
  
  // 测试模糊匹配的相似度计算
  console.log('1. 模糊匹配测试:');
  const fuzzyTests = ['bet', 'game', 'slot', 'dragon'];
  
  for (const query of fuzzyTests) {
    console.log(`\n查询: "${query}"`);
    const result = simulateN8NExecution(query);
    
    if (result.json.result.success) {
      console.log(`  匹配结果: ${result.json.result.message}`);
      if (result.json.result.alternativeMatches) {
        console.log(`  其他匹配: ${result.json.result.alternativeMatches.length}个`);
      }
    } else {
      console.log(`  无匹配结果`);
      if (result.json.result.suggestions) {
        console.log(`  建议: ${result.json.result.suggestions.slice(0, 3).join(', ')}`);
      }
    }
  }
  
  // 测试大小写敏感性
  console.log('\n2. 大小写敏感性测试:');
  const caseTests = [
    { input: 'betfiery', desc: '正确大小写' },
    { input: 'BETFIERY', desc: '全大写' },
    { input: 'Betfiery', desc: '首字母大写' },
    { input: 'betFiery', desc: '混合大小写' }
  ];
  
  for (const test of caseTests) {
    const result = simulateN8NExecution(test.input);
    console.log(`  ${test.desc} "${test.input}": ${result.json.result.success ? '匹配' : '不匹配'}`);
  }
}

// 运行所有测试
runTests();
testSpecificFeatures();