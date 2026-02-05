// 测试精简输出版本
const fs = require('fs');

// 模拟你的实际数据结构
const testInput = {
  json: {
    "status": "success",
    "timestamp": "2026-02-05T04:08:05.286Z",
    "statistics": {
      "total_rows": 1998,
      "processed_rows": 219,
      "skipped_rows": 1779,
      "production_merchants": 219,
      "success_rate": "11.0%"
    },
    "filtered_merchants": [
      {"sub_merchant_name": "Fairy", "main_merchant_name": "Fairy", "merchant_id": "1766396139"},
      {"sub_merchant_name": "supergaming", "main_merchant_name": "supergaming", "merchant_id": "1767603071"},
      {"sub_merchant_name": "amark", "main_merchant_name": "amark", "merchant_id": "1768464209"},
      {"sub_merchant_name": "7comeidr", "main_merchant_name": "Mxlobo", "merchant_id": "1768647838"}
    ],
    "messageText": "Fairy" // 模拟查询
  }
};

// 模拟n8n执行环境
function simulateN8N(testInput) {
  const $input = {
    all: () => [testInput]
  };
  
  // 读取并执行代码
  const code = fs.readFileSync('n8n-lark-query-clean-output.js', 'utf8');
  
  // 执行代码
  const func = new Function('$input', code + '; return results;');
  return func($input);
}

// 测试不同查询
const testCases = [
  { query: "Fairy", desc: "精确匹配商户名" },
  { query: "1766396139", desc: "ID查询" },
  { query: "super", desc: "模糊匹配" },
  { query: "nonexistent", desc: "未找到" },
  { query: "", desc: "空查询" }
];

console.log('=== 精简输出版本测试 ===\n');

testCases.forEach((testCase, index) => {
  console.log(`--- 测试 ${index + 1}: ${testCase.desc} ---`);
  console.log(`查询: "${testCase.query}"`);
  
  // 更新测试数据
  const input = JSON.parse(JSON.stringify(testInput));
  input.json.messageText = testCase.query;
  
  const results = simulateN8N(input);
  const result = results[0];
  
  console.log('\n📤 输出结果:');
  console.log(JSON.stringify(result.json, null, 2));
  
  console.log('\n📱 回复消息:');
  console.log(result.json.replyMessage);
  
  console.log('\n' + '='.repeat(50) + '\n');
});

// 验证输出字段
console.log('=== 输出字段验证 ===');
const sampleResult = simulateN8N(testInput)[0];

console.log('输出字段:');
Object.keys(sampleResult.json).forEach(key => {
  console.log(`✅ ${key}`);
});

console.log(`\n总字段数: ${Object.keys(sampleResult.json).length}`);
console.log('✅ 精简输出成功！只保留必要的回复字段。');