# n8n Lark群消息智能查询工作流配置指南

## 概述
配置一个完整的n8n工作流，用于处理Lark群中的商户ID、游戏ID和游戏代码查询请求。

## 工作流架构
```
Lark群消息 → Webhook接收 → 消息解析 → 查询处理 → 结果格式化 → 回复发送
```

## 第一步：创建Webhook接收节点

### 1.1 Webhook节点配置
- **节点类型**: Webhook (Trigger)
- **HTTP Method**: POST
- **Path**: `/lark-query`
- **Authentication**: None
- **Response Mode**: Respond Immediately

## 第二步：消息验证和解析

### 2.1 消息验证Code节点
```javascript
// Lark消息验证和基础解析
const body = $input.first().json.body;

// 处理URL验证
if (body.type === 'url_verification') {
  return [{
    json: {
      challenge: body.challenge
    }
  }];
}

// 解析消息事件
if (body.header && body.header.event_type === 'im.message.receive_v1') {
  const message = body.event.message;
  const sender = body.event.sender;
  
  // 解析消息内容
  let messageText = '';
  if (message.message_type === 'text') {
    const content = JSON.parse(message.content);
    messageText = content.text;
  }
  
  return [{
    json: {
      messageId: message.message_id,
      chatId: message.chat_id,
      messageText: messageText,
      senderId: sender.sender_id.user_id,
      senderType: sender.sender_type,
      createTime: message.create_time,
      // 添加商户和游戏数据（从其他数据源获取）
      filtered_merchants: [], // 需要从数据源填充
      games: [] // 需要从数据源填充
    }
  }];
}

// 非消息事件，直接返回
return [{ json: { skip: true } }];
```

## 第三步：数据源集成

### 3.1 获取商户数据
添加HTTP Request节点或Code节点获取商户数据：

```javascript
// 获取商户数据（示例）
const merchantData = [
  {"sub_merchant_name": "betfiery", "main_merchant_name": "RD1", "merchant_id": 1698202251},
  {"sub_merchant_name": "aajogo", "main_merchant_name": "RD1", "merchant_id": 1698202662},
  {"sub_merchant_name": "rico100", "main_merchant_name": "RD1", "merchant_id": 1698202814},
  // ... 更多商户数据
];

// 获取游戏数据（示例）
const gameData = [
  {"game_id": 1001, "game_name": "Dragon Tiger", "game_code": "DT001"},
  {"game_id": 1002, "game_name": "Baccarat Pro", "game_code": "BAC001"},
  // ... 更多游戏数据
];

return [{
  json: {
    ...$json,
    filtered_merchants: merchantData,
    games: gameData
  }
}];
```

## 第四步：智能查询处理

### 4.1 查询处理Code节点
将 `n8n-lark-message-query-processor.js` 的内容复制到Code节点中。

**关键功能**：
- 智能识别查询类型（商户/游戏）
- 支持精确匹配和模糊匹配
- 区分大小写匹配
- 处理特殊字符和数字ID
- 生成搜索建议

## 第五步：结果格式化

### 5.1 结果格式化Code节点
```javascript
// 格式化查询结果为Lark消息
const result = $json.result;
const queryText = $json.queryText;

let replyMessage = '';

if (result.success) {
  // 成功匹配的情况
  if (result.merchant_id) {
    // 商户匹配结果
    replyMessage = `🏢 **商户查询结果**\n\n` +
                  `📋 **商户名称**: ${result.sub_merchant_name}\n` +
                  `🏷️ **主商户**: ${result.main_merchant_name}\n` +
                  `🆔 **商户ID**: ${result.merchant_id}\n` +
                  `🎯 **匹配类型**: ${result.matchType === 'exact' ? '精确匹配' : '模糊匹配'}`;
    
    if (result.similarity) {
      replyMessage += `\n📊 **相似度**: ${(result.similarity * 100).toFixed(1)}%`;
    }
  } else if (result.game_id) {
    // 游戏匹配结果
    replyMessage = `🎮 **游戏查询结果**\n\n` +
                  `🎯 **游戏名称**: ${result.game_name}\n` +
                  `🏷️ **游戏代码**: ${result.game_code}\n` +
                  `🆔 **游戏ID**: ${result.game_id}\n` +
                  `🎯 **匹配类型**: ${result.matchType === 'exact' ? '精确匹配' : '模糊匹配'}`;
    
    if (result.similarity) {
      replyMessage += `\n📊 **相似度**: ${(result.similarity * 100).toFixed(1)}%`;
    }
  }
  
  // 添加其他匹配选项
  if (result.alternativeMatches && result.alternativeMatches.length > 0) {
    replyMessage += `\n\n🔍 **其他可能的匹配**:`;
    result.alternativeMatches.slice(0, 3).forEach((match, index) => {
      if (match.merchant_id) {
        replyMessage += `\n${index + 1}. ${match.sub_merchant_name} (ID: ${match.merchant_id})`;
      } else if (match.game_id) {
        replyMessage += `\n${index + 1}. ${match.game_name} (代码: ${match.game_code})`;
      }
    });
  }
} else {
  // 未找到匹配的情况
  if ($json.queryType === 'empty') {
    replyMessage = `❓ **使用帮助**\n\n` +
                  `请输入要查询的内容：\n` +
                  `• 商户名称 (如: betfiery)\n` +
                  `• 游戏名称 (如: Dragon Tiger)\n` +
                  `• 游戏代码 (如: DT001)\n\n` +
                  `💡 支持模糊搜索，输入部分名称即可`;
  } else if ($json.queryType === 'numeric_id') {
    replyMessage = `🔢 **数字ID查询**\n\n` +
                  `检测到数字ID: **${queryText}**\n\n` +
                  `请提供更多信息：\n` +
                  `• 这是商户ID还是游戏ID？\n` +
                  `• 或者提供名称进行查询\n\n` +
                  `💡 建议使用名称查询更准确`;
  } else {
    replyMessage = `❌ **未找到匹配结果**\n\n` +
                  `查询内容: **${queryText}**\n\n`;
    
    if (result.suggestions && result.suggestions.length > 0) {
      replyMessage += `🔍 **相关建议**:\n`;
      result.suggestions.slice(0, 5).forEach((suggestion, index) => {
        replyMessage += `${index + 1}. ${suggestion}\n`;
      });
      replyMessage += `\n💡 请尝试使用上述建议进行查询`;
    } else {
      replyMessage += `💡 **查询提示**:\n` +
                     `• 检查拼写是否正确\n` +
                     `• 尝试使用部分名称\n` +
                     `• 商户名称区分大小写`;
    }
  }
}

// 构建Lark消息格式
const messagePayload = {
  receive_id: $json.chatId,
  msg_type: "text",
  content: JSON.stringify({
    text: replyMessage
  })
};

return [{
  json: {
    messagePayload: messagePayload,
    chatId: $json.chatId,
    replyText: replyMessage
  }
}];
```

## 第六步：获取访问Token

### 6.1 Token获取Code节点
```javascript
// 获取Lark访问Token
const axios = require('axios');

try {
  const tokenResponse = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    app_id: 'cli_a9978e93ce389ed2', // 替换为你的App ID
    app_secret: 'D3krx1JapAYPIeLjCdROi6OvF8hnV2wL' // 替换为你的App Secret
  });

  if (tokenResponse.data.code !== 0) {
    throw new Error(`获取Token失败: ${tokenResponse.data.msg}`);
  }

  return [{
    json: {
      ...$json,
      tenantAccessToken: tokenResponse.data.tenant_access_token
    }
  }];
} catch (error) {
  return [{
    json: {
      ...$json,
      error: `Token获取失败: ${error.message}`,
      tenantAccessToken: null
    }
  }];
}
```

## 第七步：发送回复消息

### 7.1 HTTP Request节点配置
- **Method**: POST
- **URL**: `https://open.larksuite.com/open-apis/im/v1/messages`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenantAccessToken }}`
  - `Content-Type`: `application/json`
- **Query Parameters**:
  - `receive_id_type`: `chat_id`
- **Body**: `{{ $json.messagePayload }}`

## 第八步：错误处理

### 8.1 错误处理分支
添加Switch节点处理不同情况：

**条件1**: `{{ $json.skip === true }}` - 跳过非消息事件
**条件2**: `{{ $json.error }}` - 处理错误情况
**条件3**: `{{ $json.tenantAccessToken }}` - 正常处理流程

## 完整工作流示例

```
Webhook (接收Lark消息)
    ↓
Code (消息验证和解析)
    ↓
Switch (消息类型判断)
    ├── 跳过分支 → End
    └── 消息处理分支
        ↓
Code (获取数据源)
    ↓
Code (智能查询处理)
    ↓
Code (结果格式化)
    ↓
Code (获取Token)
    ↓
Switch (错误处理)
    ├── 错误分支 → 错误回复
    └── 正常分支 → HTTP Request (发送回复)
```

## 测试用例

### 9.1 测试消息示例
在Lark群中发送以下消息进行测试：

1. **精确匹配测试**:
   - `betfiery` → 应返回商户信息
   - `Dragon Tiger` → 应返回游戏信息
   - `DT001` → 应返回游戏信息

2. **模糊匹配测试**:
   - `bet` → 应返回包含"bet"的商户
   - `dragon` → 应返回包含"dragon"的游戏

3. **查询前缀测试**:
   - `查询 betfiery` → 应正确识别并匹配
   - `搜索 game` → 应返回相关游戏

4. **错误处理测试**:
   - `nonexistent` → 应返回未找到提示
   - `12345` → 应提示需要更多信息
   - 空消息 → 应返回使用帮助

## 性能优化

### 10.1 数据缓存
- 将商户和游戏数据缓存在内存中
- 定期更新数据源
- 使用索引提高查询速度

### 10.2 响应优化
- 限制返回结果数量
- 异步处理大量数据
- 添加查询超时机制

## 安全考虑

### 11.1 访问控制
- 验证消息来源
- 限制查询频率
- 记录查询日志

### 11.2 数据保护
- 敏感信息脱敏
- 权限分级访问
- 审计日志记录

---

通过以上配置，你就可以在Lark群中实现智能的商户和游戏查询功能了。