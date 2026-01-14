# Lark/Telegram 消息处理说明

## 📋 功能说明

"提取消息内容"节点现在支持同时处理：
1. **Lark群消息** - 来自飞书群聊
2. **Telegram群消息** - 来自TG群聊
3. **Lark Challenge验证** - Webhook URL验证

## 🔍 消息识别逻辑

### 1. Lark Challenge验证
**识别条件**：`body.type === 'url_verification' && body.challenge`

**输出**：
```json
{
  "isChallenge": true,
  "challenge": "xxx",
  "type": "url_verification",
  "source": "lark"
}
```

### 2. Telegram消息
**识别条件**：`body.update_id !== undefined || body.message`

**输出**：
```json
{
  "isChallenge": false,
  "source": "telegram",
  "messageId": "39",
  "chatId": "-1003129050838",
  "chatTitle": "查数测试",
  "chatType": "supergroup",
  "senderId": "6681153969",
  "senderName": "Gaming Panda-Poon",
  "senderUsername": "GamingPanda_Poon",
  "messageText": "1",
  "messageTime": "2025-11-19T14:23:51.000Z",
  "timestamp": 1763533431,
  "rawEvent": {...}
}
```

### 3. Lark消息
**识别条件**：其他情况（有`body.event`）

**输出**：
```json
{
  "isChallenge": false,
  "source": "lark",
  "messageId": "om_x100b5ee1bd93bca8e2b1689a7de8b56",
  "chatId": "oc_da0ab0d3b6a104f72f3a4c8f00ecddaa",
  "senderId": "22779g92",
  "senderName": "未知用户",
  "messageText": "1",
  "messageTime": "2025-11-19T14:02:59.000Z",
  "timestamp": 1763532597,
  "rawEvent": {...}
}
```

## 📊 统一输出字段

所有消息类型都会包含以下字段：

| 字段 | Lark | Telegram | 说明 |
|------|------|----------|------|
| `source` | `"lark"` | `"telegram"` | 消息来源 |
| `messageId` | ✅ | ✅ | 消息ID |
| `chatId` | ✅ | ✅ | 聊天ID |
| `senderId` | ✅ | ✅ | 发送者ID |
| `senderName` | ✅ | ✅ | 发送者名称 |
| `messageText` | ✅ | ✅ | 消息文本 |
| `messageTime` | ✅ | ✅ | ISO格式时间 |
| `timestamp` | ✅ | ✅ | Unix时间戳 |
| `rawEvent` | ✅ | ✅ | 原始事件数据 |

### Telegram特有字段

- `chatTitle`: 群组名称
- `chatType`: 聊天类型（supergroup, group等）
- `senderUsername`: 发送者用户名

## 🔄 下游处理

### 在"构建Challenge响应"节点中

节点会自动识别消息来源，并格式化时间：

**正常消息输出**（Lark或Telegram）：
```json
{
  "isChallenge": false,
  "source": "telegram",  // 或 "lark"
  "messageId": "39",
  "chatId": "-1003129050838",
  "chatTitle": "查数测试",  // Telegram特有
  "senderId": "6681153969",
  "senderName": "Gaming Panda-Poon",
  "senderUsername": "GamingPanda_Poon",  // Telegram特有
  "messageText": "1",
  "messageTime": "2025-11-19T14:23:51.000Z",
  "timestamp": 1763533431,
  "formattedTime": "251119 142351",  // YYMMDD hhmmss格式
  "timeFormat": "YYMMDD hhmmss",
  "rawEvent": {...}
}
```

### 根据消息来源处理

在下游节点中，可以根据`source`字段区分处理：

```javascript
if ($json.source === 'telegram') {
  // 处理Telegram消息
  const chatTitle = $json.chatTitle;
  const username = $json.senderUsername;
} else if ($json.source === 'lark') {
  // 处理Lark消息
}
```

## 📝 示例：Telegram消息输入

```json
[
  {
    "update_id": 526699013,
    "message": {
      "message_id": 39,
      "from": {
        "id": 6681153969,
        "is_bot": false,
        "first_name": "Gaming Panda-Poon",
        "username": "GamingPanda_Poon",
        "language_code": "zh-hans"
      },
      "chat": {
        "id": -1003129050838,
        "title": "查数测试",
        "type": "supergroup"
      },
      "date": 1763533431,
      "text": "1"
    }
  }
]
```

**处理后输出**：
```json
{
  "isChallenge": false,
  "source": "telegram",
  "messageId": "39",
  "chatId": "-1003129050838",
  "chatTitle": "查数测试",
  "chatType": "supergroup",
  "senderId": "6681153969",
  "senderName": "Gaming Panda-Poon",
  "senderUsername": "GamingPanda_Poon",
  "messageText": "1",
  "messageTime": "2025-11-19T14:23:51.000Z",
  "timestamp": 1763533431,
  "rawEvent": {...}
}
```

---

**更新时间**: 2025-11-19  
**版本**: V1.0



