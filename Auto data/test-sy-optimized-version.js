// 测试sy.json优化版本
const fs = require('fs');

console.log('=== 测试sy.json优化版本 ===\n');

// 读取sy.json数据
const syData = JSON.parse(fs.readFileSync('sy.json', 'utf8'));

console.log(`sy.json包含 ${syData.length} 个数据项:`);
syData.forEach((item, index) => {
  console.log(`项目 ${index + 1}:`, Object.keys(item));
});

// 模拟n8n执行环境
function simulateN8N(testInputs) {
  const $input = {
    all: () => testInputs.map(item => ({ json: item }))
  };
  
  // 读取并执行代码
  const code = fs.readFileSync('n8n-lark-query-sy-optimized.js', 'utf8');
  
  // 执行代码
  const func = new Function('$input', 'console', code + '; return results;');
  return func($input, console);
}

console.log('\n=== 执行优化版本处理 ===\n');

const results = simulateN8N(syData);
const result = results[0];

console.log('\n=== 处理结果 ===\n');

console.log('📤 完整输出结果:');
console.log(JSON.stringify(result.json, null, 2));

console.log('\n=== 各字段详解 ===\n');

console.log('1️⃣ replyMessage (格式化回复文本):');
console.log(result.json.replyMessage);

console.log('\n2️⃣ larkMessage (基础消息格式):');
console.log(JSON.stringify(result.json.larkMessage, null, 2));

console.log('\n3️⃣ larkParams (提取的回复参数):');
console.log(JSON.stringify(result.json.larkParams, null, 2));

console.log('\n4️⃣ larkReply (完整回复消息体):');
console.log(JSON.stringify(result.json.larkReply, null, 2));

console.log('\n5️⃣ dataSource (数据来源信息):');
console.log(JSON.stringify(result.json.dataSource, null, 2));

console.log('\n=== 验证结果 ===\n');

const hasLarkParams = Object.keys(result.json.larkParams).length > 0;
const hasMerchantData = result.json.dataSource.merchantCount > 0;
const hasQueryResult = result.json.replyMessage.includes('betfiery');

console.log('✅ 验证项目:');
console.log(`- 是否提取到Lark参数: ${hasLarkParams ? '✅ 是' : '❌ 否'}`);
console.log(`- 是否找到商户数据: ${hasMerchantData ? '✅ 是' : '❌ 否'}`);
console.log(`- 是否正确查询betfiery: ${hasQueryResult ? '✅ 是' : '❌ 否'}`);

if (hasLarkParams) {
  console.log('\n📋 提取到的Lark参数:');
  Object.keys(result.json.larkParams).forEach(key => {
    console.log(`  - ${key}: ${typeof result.json.larkParams[key] === 'object' ? 'Object' : result.json.larkParams[key]}`);
  });
}

console.log('\n=== 使用建议 ===\n');

if (hasLarkParams && hasMerchantData && hasQueryResult) {
  console.log('🎉 完美！所有功能都正常工作：');
  console.log('1. 成功提取了Lark回复参数');
  console.log('2. 成功找到了商户数据');
  console.log('3. 成功查询到了betfiery商户信息');
  console.log('\n推荐使用这个优化版本：n8n-lark-query-sy-optimized.js');
  
  console.log('\n🔗 HTTP Request配置建议:');
  console.log('方式1 - Webhook回复:');
  console.log('  Body: {{ $json.larkMessage }}');
  console.log('方式2 - API回复:');
  console.log('  Body: {{ $json.larkReply }}');
} else {
  console.log('⚠️  存在问题，需要进一步调试:');
  if (!hasLarkParams) console.log('- 未能提取Lark参数');
  if (!hasMerchantData) console.log('- 未能找到商户数据');
  if (!hasQueryResult) console.log('- 未能正确查询商户');
}

console.log('\n✅ 测试完成！');