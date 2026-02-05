// 测试Lark参数提取问题诊断
const fs = require('fs');

console.log('=== Lark参数提取问题诊断 ===\n');

// 用户实际的数据结构（根据上下文提供的数据）
const userActualData = {
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
    "queryResult": {"success": false, "type": "empty"},
    "queryText": "Fairy"
  }
};

// 标准的Lark消息事件数据结构
const standardLarkData = {
  json: {
    // Lark消息事件参数
    "message_id": "om_1d0b5774b1088e8b2cc4c2d6572f",
    "chat_id": "oc_a0553eda9014c201e6969b478895c230",
    "open_chat_id": "oc_a0553eda9014c201e6969b478895c230",
    "tenant_key": "16390ff6025f577c",
    "sender": {
      "sender_id": {
        "open_id": "ou_a7c7890e14f916de17ed9a3956d11317",
        "union_id": "on_f58e00e3f0332132ea1223a1d1af6691",
        "user_id": "22779g92"
      },
      "sender_type": "user"
    },
    
    // 查询消息
    "queryText": "Fairy",
    
    // 商户数据
    "filtered_merchants": [
      {"sub_merchant_name": "Fairy", "main_merchant_name": "Fairy", "merchant_id": "1766396139"},
      {"sub_merchant_name": "supergaming", "main_merchant_name": "supergaming", "merchant_id": "1767603071"}
    ]
  }
};

// 模拟n8n执行环境
function simulateN8N(testInput, codeFile) {
  const $input = {
    all: () => [testInput]
  };
  
  // 读取并执行代码
  const code = fs.readFileSync(codeFile, 'utf8');
  
  // 执行代码
  const func = new Function('$input', 'console', code + '; return results;');
  return func($input, console);
}

console.log('🔍 问题分析：\n');

console.log('1️⃣ 用户当前数据结构分析:');
console.log('数据字段:', Object.keys(userActualData.json));
console.log('是否包含message_id:', 'message_id' in userActualData.json);
console.log('是否包含chat_id:', 'chat_id' in userActualData.json);
console.log('是否包含sender:', 'sender' in userActualData.json);
console.log('是否包含tenant_key:', 'tenant_key' in userActualData.json);

console.log('\n❌ 问题发现：用户数据中缺少Lark消息事件参数！');

console.log('\n2️⃣ 标准Lark数据结构对比:');
console.log('标准数据字段:', Object.keys(standardLarkData.json));
console.log('包含message_id:', 'message_id' in standardLarkData.json);
console.log('包含chat_id:', 'chat_id' in standardLarkData.json);
console.log('包含sender:', 'sender' in standardLarkData.json);
console.log('包含tenant_key:', 'tenant_key' in standardLarkData.json);

console.log('\n✅ 标准数据包含所有必要的Lark参数！');

console.log('\n3️⃣ 测试用户数据处理结果:');
console.log('--- 使用调试版本处理用户数据 ---');
try {
  const userResults = simulateN8N(userActualData, 'n8n-lark-query-debug-params.js');
  const userResult = userResults[0];
  
  console.log('\n用户数据处理结果:');
  console.log('larkParams:', JSON.stringify(userResult.json.larkParams, null, 2));
  console.log('larkParams是否为空:', Object.keys(userResult.json.larkParams).length === 0);
  console.log('回复消息:', userResult.json.replyMessage);
} catch (error) {
  console.log('处理用户数据时出错:', error.message);
}

console.log('\n4️⃣ 测试标准数据处理结果:');
console.log('--- 使用调试版本处理标准数据 ---');
try {
  const standardResults = simulateN8N(standardLarkData, 'n8n-lark-query-debug-params.js');
  const standardResult = standardResults[0];
  
  console.log('\n标准数据处理结果:');
  console.log('larkParams:', JSON.stringify(standardResult.json.larkParams, null, 2));
  console.log('larkParams是否为空:', Object.keys(standardResult.json.larkParams).length === 0);
  console.log('回复消息:', standardResult.json.replyMessage);
} catch (error) {
  console.log('处理标准数据时出错:', error.message);
}

console.log('\n📋 解决方案建议:\n');

console.log('🔹 方案1: 检查数据来源');
console.log('- 确认数据是直接来自Lark Webhook还是经过其他节点处理');
console.log('- 如果经过其他节点，检查是否丢失了Lark事件参数');
console.log('- 建议在Code节点前添加一个临时节点查看原始数据');

console.log('\n🔹 方案2: 手动添加参数');
console.log('- 如果无法获取原始Lark参数，可以手动设置：');
console.log('```javascript');
console.log('// 在Code节点中手动设置参数');
console.log('larkParams = {');
console.log('  chat_id: "YOUR_CHAT_ID",');
console.log('  message_id: "YOUR_MESSAGE_ID"');
console.log('};');
console.log('```');

console.log('\n🔹 方案3: 使用Webhook回复');
console.log('- 如果是机器人回复，可以直接使用Webhook URL');
console.log('- 不需要message_id等参数，只需要消息内容');
console.log('- 使用 {{ $json.larkMessage }} 作为HTTP Request的Body');

console.log('\n🔹 方案4: 修改工作流结构');
console.log('- 确保Lark Webhook节点直接连接到Code节点');
console.log('- 避免中间节点丢失原始事件参数');
console.log('- 如果需要处理数据，在Code节点内部完成');

console.log('\n📊 数据流程对比:\n');

console.log('❌ 当前流程（参数丢失）:');
console.log('Lark Webhook → 数据处理节点 → Code节点');
console.log('                ↓ (丢失参数)');
console.log('         只保留业务数据');

console.log('\n✅ 推荐流程（保留参数）:');
console.log('Lark Webhook → Code节点（同时处理数据和参数）');
console.log('     ↓');
console.log('完整的事件数据');

console.log('\n🎯 立即可用的解决方案:\n');

console.log('如果你现在就需要回复消息，可以：');
console.log('1. 使用 {{ $json.larkMessage }} 发送到Webhook URL');
console.log('2. 或者手动设置chat_id参数');
console.log('3. 或者使用调试版本查看具体缺少哪些参数');

console.log('\n✅ 诊断完成！请根据上述建议调整你的工作流。');