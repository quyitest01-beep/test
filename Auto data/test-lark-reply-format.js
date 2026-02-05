// 测试Lark回复消息格式
const fs = require('fs');

// 模拟测试数据
const testInputs = [
  // 测试1: 商户名查询
  {
    json: {
      messageText: "betfiery",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662}
      ]
    }
  },
  
  // 测试2: ID查询
  {
    json: {
      messageText: "1698202251",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662}
      ]
    }
  },
  
  // 测试3: 模糊查询
  {
    json: {
      messageText: "bet",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
        {"sub_merchant_name": "BetWinner", "main_merchant_name": "RD2", "merchant_id": 1698203001}
      ]
    }
  },
  
  // 测试4: 未找到
  {
    json: {
      messageText: "nonexistent",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251}
      ]
    }
  },
  
  // 测试5: 中文查询
  {
    json: {
      messageText: "商户betfiery的id",
      filtered_merchants: [
        {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251}
      ]
    }
  }
];

// 模拟n8n执行环境
function simulateN8N(testInputs) {
  const $input = {
    all: () => testInputs
  };
  
  // 读取并执行代码
  const code = fs.readFileSync('n8n-lark-query-with-reply.js', 'utf8');
  
  // 执行代码
  const func = new Function('$input', code + '; return results;');
  return func($input);
}

// 运行测试
console.log('=== Lark回复消息格式测试 ===\n');

const results = simulateN8N(testInputs);

results.forEach((result, index) => {
  console.log(`--- 测试 ${index + 1} ---`);
  console.log(`输入查询: "${testInputs[index].json.messageText}"`);
  console.log(`查询成功: ${result.json.queryResult.success}`);
  console.log(`查询类型: ${result.json.queryResult.type}`);
  
  console.log('\n📱 Lark回复消息:');
  console.log(result.json.replyMessage);
  
  console.log('\n📋 Lark消息格式 (用于HTTP Request):');
  console.log(JSON.stringify(result.json.larkMessage, null, 2));
  
  console.log('\n📝 简化回复 (用于其他节点):');
  console.log(`"${result.json.reply}"`);
  
  console.log('\n' + '='.repeat(50) + '\n');
});

// 验证输出格式
console.log('=== 输出格式验证 ===');

const sampleResult = results[0];
const requiredFields = ['replyMessage', 'larkMessage', 'reply', 'queryResult'];

console.log('检查必需字段:');
requiredFields.forEach(field => {
  const exists = sampleResult.json.hasOwnProperty(field);
  console.log(`${exists ? '✅' : '❌'} ${field}: ${exists ? '存在' : '缺失'}`);
});

console.log('\nLark消息格式验证:');
const larkMsg = sampleResult.json.larkMessage;
const hasCorrectFormat = larkMsg && 
                        larkMsg.msg_type === 'text' && 
                        larkMsg.content && 
                        typeof larkMsg.content.text === 'string';

console.log(`${hasCorrectFormat ? '✅' : '❌'} Lark消息格式: ${hasCorrectFormat ? '正确' : '错误'}`);

console.log('\n🎉 测试完成！后续节点可以直接使用以下字段：');
console.log('• result.json.replyMessage - 格式化的回复文本');
console.log('• result.json.larkMessage - 标准Lark消息格式');
console.log('• result.json.reply - 简化的回复文本');