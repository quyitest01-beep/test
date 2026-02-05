// 测试工作版本的查询处理器
const fs = require('fs');

// 模拟真实的n8n数据结构
const testInputs = [
  // 测试1: 标准数据结构
  {
    json: {
      messageText: "betfiery",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662},
        {"sub_merchant_name": "rico100", "main_merchant_name": "RD1", "merchant_id": 1698202814}
      ]
    }
  },
  
  // 测试2: 中文查询格式
  {
    json: {
      messageText: "商户betfiery的id",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662}
      ]
    }
  },
  
  // 测试3: 嵌套数据结构
  {
    json: {
      content: "betfiery",
      data: {
        filtered_merchants: [
          {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251}
        ]
      }
    }
  },
  
  // 测试4: 模糊匹配
  {
    json: {
      text: "bet",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "BetWinner", "main_merchant_name": "RD2", "merchant_id": 1698203001}
      ]
    }
  },
  
  // 测试5: ID查询
  {
    json: {
      messageText: "1698202251",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251}
      ]
    }
  },
  
  // 测试6: 无匹配
  {
    json: {
      messageText: "nonexistent",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251}
      ]
    }
  }
];

// 模拟n8n执行环境
function simulateN8N(testInput) {
  // 模拟$input.all()
  const $input = {
    all: () => [testInput]
  };
  
  // 读取并执行代码
  const code = fs.readFileSync('n8n-lark-message-query-processor-working.js', 'utf8');
  
  // 创建执行环境
  const context = {
    $input,
    console: {
      log: () => {} // 静默console.log
    }
  };
  
  // 执行代码
  const func = new Function('$input', 'console', code + '; return results;');
  return func($input, context.console);
}

// 运行测试
console.log('=== 测试工作版本查询处理器 ===\n');

testInputs.forEach((testInput, index) => {
  console.log(`测试 ${index + 1}:`);
  console.log(`输入消息: "${testInput.json.messageText || testInput.json.content || testInput.json.text}"`);
  
  try {
    const results = simulateN8N(testInput);
    const result = results[0];
    
    console.log(`查询类型: ${result.json.queryType}`);
    console.log(`提取关键词: "${result.json.extractedQuery}"`);
    console.log(`匹配成功: ${result.json.result.success}`);
    console.log(`消息: ${result.json.result.message}`);
    
    if (result.json.result.success && result.json.result.merchant_id) {
      console.log(`✅ 商户ID: ${result.json.result.merchant_id}`);
      console.log(`   商户名: ${result.json.result.sub_merchant_name}`);
    }
    
  } catch (error) {
    console.log(`❌ 执行错误: ${error.message}`);
  }
  
  console.log('');
});

// 特别测试betfiery查询
console.log('=== 特别测试betfiery查询 ===');

const betfieryTests = [
  "betfiery",
  "商户betfiery的id", 
  "查询betfiery",
  "betfiery的信息",
  "BETFIERY",
  "bet"
];

const merchantData = [
  {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
  {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662}
];

betfieryTests.forEach(query => {
  console.log(`\n查询: "${query}"`);
  
  const testInput = {
    json: {
      messageText: query,
      filtered_merchants: merchantData
    }
  };
  
  try {
    const results = simulateN8N(testInput);
    const result = results[0].json.result;
    
    if (result.success) {
      console.log(`✅ 成功: ${result.message}`);
    } else {
      console.log(`❌ 失败: ${result.message}`);
    }
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
  }
});