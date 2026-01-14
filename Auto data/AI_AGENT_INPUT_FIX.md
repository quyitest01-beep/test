# AI Agent 节点输入数据修复

## 🔍 问题分析

从你的截图可以看到：
- **输入数据**包含：`type: "telegram"`, `senderid: 6681153969`, `messagid: 40`, `chatid: -1003129050838`, `text: 1`
- **AI输出**却是：`type: "unknown"`, `senderid: 0`, `messagid: 0`, `chatid: "0"`

**问题原因**：
- AI Agent 节点的 Prompt 只传递了 `{{ $json.text }}`，只传了文本内容
- System Message 虽然说明了需要哪些字段，但没有明确告诉AI要从输入数据中获取这些值
- AI 不知道从哪里获取这些字段，所以使用了默认值

## ✅ 解决方案

### 1. 更新 System Message

在 System Message 中明确要求：
- 必须使用用户提供的输入数据中的字段值
- 不要自己编造或使用默认值
- 只有 `isQueryRequest` 和 `reason` 需要AI判断

### 2. 更新 User Message（Prompt）

在 Prompt 中传递完整的上下文信息，包括：
- type（消息来源）
- senderid（发送者ID）
- messagid（消息ID）
- chatid（聊天ID）
- text（消息文本）

并明确告诉AI要使用这些值。

## 📋 修改后的配置

### System Message

```
你是一个专业的查数意图识别助手。你的任务是判断用户消息是否是查数请求。

...

关键要求：
1. 你必须使用用户提供的输入数据中的字段值，不要自己编造
2. type字段必须使用输入数据中的type值（telegram或lark）
3. senderid、messagid、chatid、text字段必须完全使用输入数据中的对应值
4. 只有isQueryRequest和reason字段需要你根据消息内容判断
5. 如果输入数据中没有某个字段，才可以使用默认值（如0或"unknown"）
```

### User Message（Prompt）

```
请根据以下消息信息判断是否是查数请求。

输入数据（必须使用这些值）：
- type（消息来源）：telegram
- senderid（发送者ID）：6681153969
- messagid（消息ID）：40
- chatid（聊天ID）：-1003129050838
- text（消息文本）：1

请严格按照以下要求返回JSON数组：
1. 使用上面提供的type、senderid、messagid、chatid、text值，不要修改
2. 根据text内容判断isQueryRequest（"true"或"false"）
3. 提供reason说明判断理由
```

## 🔧 如果使用 AI Agent 节点

如果使用的是 AI Agent 节点（不是 OpenAI 节点），配置方式可能不同：

### 方法1：在 System Message 中传递数据

在 System Message 中包含输入数据的说明，让AI知道要使用这些值。

### 方法2：在 Prompt 中传递完整上下文

确保 Prompt 字段传递完整的上下文信息，不只是 `{{ $json.text }}`。

### 方法3：使用 Code 节点预处理

在 AI Agent 节点前添加 Code 节点，构建包含完整上下文的 prompt：

```javascript
return {
  json: {
    prompt: `请根据以下消息信息判断是否是查数请求。

输入数据（必须使用这些值）：
- type（消息来源）：${$json.type || $json.source || 'unknown'}
- senderid（发送者ID）：${$json.senderid || $json.senderId || 0}
- messagid（消息ID）：${$json.messagid || $json.messageId || 0}
- chatid（聊天ID）：${$json.chatid || $json.chatId || ''}
- text（消息文本）：${$json.text || $json.messageText || ''}

请严格按照以下要求返回JSON数组：
1. 使用上面提供的type、senderid、messagid、chatid、text值，不要修改
2. 根据text内容判断isQueryRequest（"true"或"false"）
3. 提供reason说明判断理由`
  }
};
```

然后在 AI Agent 节点的 Prompt 中使用：`{{ $json.prompt }}`

## 📊 预期输出

修改后，AI 应该输出：

```json
[
  {
    "isQueryRequest": "false",
    "type": "telegram",  // ✅ 使用输入数据
    "senderid": 6681153969,  // ✅ 使用输入数据
    "messagid": 40,  // ✅ 使用输入数据
    "chatid": -1003129050838,  // ✅ 使用输入数据
    "text": "1",  // ✅ 使用输入数据
    "reason": "消息文本过短且不包含任何查询或数据相关关键词，不符合查数请求特征。"
  }
]
```

---

**更新时间**: 2025-11-19  
**版本**: V1.0



