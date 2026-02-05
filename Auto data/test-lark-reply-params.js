// 测试包含Lark回复参数的版本
const fs = require('fs');

// 模拟真实的Lark消息事件数据
const testInput = {
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
    "messageText": "Fairy",
    
    // 商户数据
    "filtered_merchants": [
      {"sub_merchant_name": "Fairy", "main_merchant_name": "Fairy", "merchant_id": "1766396139"},
      {"sub_merchant_name": "supergaming", "main_merchant_name": "supergaming", "merchant_id": "1767603071"},
      {"sub_merchant_name": "amark", "main_merchant_name": "amark", "merchant_id": "1768464209"}
    ]
  }
};

// 模拟n8n执行环境
function simulateN8N(testInput) {
  const $input = {
    all: () => [testInput]
  };
  
  // 读取并执行代码
  const code = fs.readFileSync('n8n-lark-query-with-reply-params.js', 'utf8');
  
  // 执行代码
  const func = new Function('$input', code + '; return results;');
  return func($input);
}

console.log('=== Lark回复参数测试 ===\n');

const results = simulateN8N(testInput);
const result = results[0];

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

console.log('\n=== 使用场景 ===\n');

console.log('🔹 场景1: 发送到Webhook (不需要回复参数)');
console.log('使用字段: {{ $json.larkMessage }}');
console.log('URL: https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK');

console.log('\n🔹 场景2: 回复特定消息 (需要回复参数)');
console.log('使用字段: {{ $json.larkReply }}');
console.log('URL: https://open.larksuite.com/open-apis/im/v1/messages/reply');

console.log('\n🔹 场景3: 发送到特定聊天 (需要chat_id)');
console.log('使用字段: {{ $json.larkMessage }} + {{ $json.larkParams.chat_id }}');
console.log('URL: https://open.larksuite.com/open-apis/im/v1/messages');

console.log('\n✅ 测试完成！现在包含了所有必要的Lark回复参数。');