# Lark查询回复集成指南

## 🎯 功能概述

这个Code节点处理查询后，直接输出格式化的Lark回复消息，后续节点可以直接使用来回复用户。

## 📤 输出格式

Code节点处理后，每个输出项包含以下字段：

### 1. `replyMessage` - 格式化回复文本
```
✅ 找到商户信息：
📋 商户名称：betfiery
🏢 主商户：RD1
🆔 商户ID：1698202251
```

### 2. `larkMessage` - 标准Lark消息格式
```json
{
  "msg_type": "text",
  "content": {
    "text": "✅ 找到商户信息：\n📋 商户名称：betfiery\n🏢 主商户：RD1\n🆔 商户ID：1698202251"
  }
}
```

### 3. `reply` - 简化回复文本
```
✅ 找到商户信息：
📋 商户名称：betfiery
🏢 主商户：RD1
🆔 商户ID：1698202251
```

### 4. `queryResult` - 查询结果详情
```json
{
  "success": true,
  "type": "merchant_exact",
  "merchant_id": 1698202251,
  "sub_merchant_name": "betfiery",
  "main_merchant_name": "RD1"
}
```

## 🔗 后续节点集成

### 方案1：HTTP Request节点（推荐）
直接发送到Lark Webhook：

**配置：**
- Method: POST
- URL: `https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL`
- Body: `{{ $json.larkMessage }}`

### 方案2：其他消息节点
使用简化的回复文本：

**配置：**
- Message: `{{ $json.reply }}`
- 或者: `{{ $json.replyMessage }}`

## 📋 消息格式示例

### 成功查询（商户名→ID）
```
✅ 找到商户信息：
📋 商户名称：betfiery
🏢 主商户：RD1
🆔 商户ID：1698202251
```

### 成功查询（ID→商户名）
```
✅ 通过ID找到商户信息：
📋 商户名称：betfiery
🏢 主商户：RD1
🆔 商户ID：1698202251
```

### 模糊匹配（多个结果）
```
🔍 找到 2 个相似商户：
1. betfiery (ID: 1698202251)
2. BetWinner (ID: 1698203001)
```

### 查询失败
```
❌ 未找到商户："nonexistent"

💡 建议：
• 检查商户名称拼写
• 尝试使用商户ID查询
• 使用部分关键词搜索
```

### 错误处理
```
处理查询时发生错误，请稍后重试
```

## 🛠️ 完整工作流示例

### 工作流结构
```
Lark Webhook → Code节点 → HTTP Request → (回复用户)
     ↓              ↓           ↓
  接收消息      处理查询    发送回复
```

### 节点配置

#### 1. Code节点
- 使用 `n8n-lark-query-with-reply.js` 代码
- 确保输入包含商户数据和消息文本

#### 2. HTTP Request节点
- Method: `POST`
- URL: `https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL`
- Headers: `Content-Type: application/json`
- Body: `{{ $json.larkMessage }}`

## 🎨 自定义消息格式

如果需要自定义回复格式，可以修改代码中的消息模板：

### 简化格式
```javascript
replyMessage = `商户：${merchantName}，ID：${merchantId}`;
```

### 详细格式
```javascript
replyMessage = `🏪 商户信息查询结果\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `📋 商户名称：${merchantName}\n` +
              `🏢 主商户：${mainName}\n` +
              `🆔 商户ID：${merchantId}\n` +
              `⏰ 查询时间：${new Date().toLocaleString()}`;
```

### 卡片格式（富文本）
```javascript
larkMessage = {
  msg_type: "interactive",
  card: {
    elements: [
      {
        tag: "div",
        text: {
          content: `**商户名称：** ${merchantName}\n**商户ID：** ${merchantId}`,
          tag: "lark_md"
        }
      }
    ]
  }
}
```

## 🔧 故障排除

### 问题1：回复消息为空
**检查：**
- 确保Code节点正确处理了输入数据
- 查看 `queryResult.success` 是否为true
- 检查商户数据是否正确传递

### 问题2：Lark消息发送失败
**检查：**
- Webhook URL是否正确
- HTTP Request节点配置是否正确
- 消息格式是否符合Lark API要求

### 问题3：消息格式显示异常
**检查：**
- 确保使用 `{{ $json.larkMessage }}` 而不是 `{{ $json.replyMessage }}`
- 检查消息中的特殊字符是否正确转义

## 📊 监控和日志

### 添加日志记录
在Code节点中添加：
```javascript
console.log('查询结果:', queryResult);
console.log('回复消息:', replyMessage);
```

### 成功率监控
可以添加统计逻辑：
```javascript
// 在结果中添加统计信息
statistics: {
  totalQueries: items.length,
  successfulQueries: results.filter(r => r.json.queryResult.success).length,
  timestamp: new Date().toISOString()
}
```

---

**总结：** 使用这个Code节点，你可以直接获得格式化的Lark回复消息，后续节点只需要简单配置就能发送回复给用户。