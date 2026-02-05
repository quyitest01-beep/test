# Lark回复参数完整指南

## 🎯 输出字段说明

Code节点处理后，输出包含4个字段：

### 1. `replyMessage` - 格式化回复文本
纯文本格式，适用于显示或日志记录
```
✅ 找到商户信息：
📋 商户名称：Fairy
🏢 主商户：Fairy
🆔 商户ID：1766396139
```

### 2. `larkMessage` - 基础消息格式
标准Lark消息格式，用于Webhook发送
```json
{
  "msg_type": "text",
  "content": {
    "text": "✅ 找到商户信息：\n📋 商户名称：Fairy..."
  }
}
```

### 3. `larkParams` - 回复参数
从原始消息中提取的回复所需参数
```json
{
  "message_id": "om_1d0b5774b1088e8b2cc4c2d6572f",
  "chat_id": "oc_a0553eda9014c201e6969b478895c230",
  "sender": {...},
  "tenant_key": "16390ff6025f577c"
}
```

### 4. `larkReply` - 完整回复消息体
包含消息内容和回复参数的完整消息体
```json
{
  "msg_type": "text",
  "content": {...},
  "message_id": "om_1d0b5774b1088e8b2cc4c2d6572f",
  "chat_id": "oc_a0553eda9014c201e6969b478895c230",
  ...
}
```

## 🔗 使用场景

### 场景1：Webhook回复（推荐）
**适用：** 机器人通过Webhook回复群消息

**HTTP Request配置：**
- Method: `POST`
- URL: `https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL`
- Body: `{{ $json.larkMessage }}`

### 场景2：API回复特定消息
**适用：** 通过API回复特定的消息

**HTTP Request配置：**
- Method: `POST`
- URL: `https://open.larksuite.com/open-apis/im/v1/messages/reply`
- Headers: `Authorization: Bearer YOUR_ACCESS_TOKEN`
- Body: `{{ $json.larkReply }}`

### 场景3：发送到特定聊天
**适用：** 发送消息到指定的聊天群

**HTTP Request配置：**
- Method: `POST`
- URL: `https://open.larksuite.com/open-apis/im/v1/messages`
- Headers: `Authorization: Bearer YOUR_ACCESS_TOKEN`
- Body: 
```json
{
  "receive_id": "{{ $json.larkParams.chat_id }}",
  "msg_type": "text",
  "content": "{{ $json.larkMessage.content }}"
}
```

## 📋 自动提取的参数

代码会自动从输入数据中提取以下参数：

| 参数 | 说明 | 用途 |
|------|------|------|
| `message_id` | 原始消息ID | 回复特定消息 |
| `chat_id` | 聊天ID | 发送到特定聊天 |
| `open_chat_id` | 开放聊天ID | 群聊标识 |
| `sender` | 发送者信息 | 用户识别 |
| `tenant_key` | 租户密钥 | 企业标识 |

## 🛠️ 实际配置示例

### 示例1：简单Webhook回复
```yaml
HTTP Request节点:
  Method: POST
  URL: https://open.larksuite.com/open-apis/bot/v2/hook/0ea0ae10-58a5-41d1-93c3-24e20ec25cf0
  Body: {{ $json.larkMessage }}
```

### 示例2：带认证的API回复
```yaml
HTTP Request节点:
  Method: POST
  URL: https://open.larksuite.com/open-apis/im/v1/messages/reply
  Headers:
    Authorization: Bearer t-g1044ghEGNOJ64PLAOHQD56OOWTFE3CHBKN6NOXQ
    Content-Type: application/json
  Body: {{ $json.larkReply }}
```

## 🔍 调试和验证

### 检查提取的参数
在Code节点后添加一个临时节点查看输出：
```javascript
// 查看所有字段
console.log('所有字段:', Object.keys($json));

// 查看回复参数
console.log('回复参数:', $json.larkParams);

// 查看完整回复体
console.log('完整回复:', $json.larkReply);
```

### 常见问题排查

**问题1：larkParams为空**
- 检查输入数据是否包含Lark消息事件
- 确认字段名称是否正确（message_id, chat_id等）

**问题2：回复失败**
- 验证Webhook URL是否正确
- 检查Access Token是否有效
- 确认消息格式是否符合Lark API要求

**问题3：参数不完整**
- 查看原始输入数据结构
- 可能需要调整参数提取逻辑

## 📊 数据流程图

```
Lark消息事件 → Code节点处理 → 输出4个字段
     ↓              ↓              ↓
  包含参数      提取+查询      replyMessage
  message_id    商户数据       larkMessage  
  chat_id       生成回复       larkParams
  sender        格式化         larkReply
     ↓              ↓              ↓
HTTP Request → 发送回复 → 用户收到回复
```

## 🎨 自定义扩展

### 添加更多参数
如果需要提取其他参数，在代码中添加：
```javascript
if (item.json.your_custom_field) {
  larkParams.your_custom_field = item.json.your_custom_field;
}
```

### 修改回复格式
可以自定义消息格式：
```javascript
// 简化格式
replyMessage = `商户：${merchantName}，ID：${merchantId}`;

// 卡片格式
larkMessage = {
  msg_type: "interactive",
  card: { ... }
};
```

---

**总结：** 这个版本提供了完整的Lark回复功能，包含所有必要的参数，支持多种回复场景，让你可以灵活选择最适合的回复方式。