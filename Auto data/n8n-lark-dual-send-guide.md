# Lark 双重发送：卡片通知 + 文件发送

## 场景说明

你的Code节点准备了两种数据：
1. **卡片通知** - 告诉群里"报告已生成"
2. **文件发送** - 发送实际的PDF文件

## 🔄 两种发送方式

### 方式1：卡片用Webhook，文件用API

**优点**：卡片发送更简单，不需要token管理
**缺点**：需要两个HTTP节点

#### HTTP节点1：发送卡片通知（Webhook）
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "={{ $json.webhookRequest.body }}"
}
```

#### HTTP节点2：发送PDF文件（API）
```json
{
  "method": "POST", 
  "url": "={{ $json.fileRequest.url }}",
  "headers": {
    "Authorization": "Bearer {{ $json.tenant_access_token }}",
    "Content-Type": "application/json"
  },
  "body": "={{ $json.fileRequest.body }}"
}
```

---

### 方式2：都用API（保持原来的方式）

**优点**：只需要一个token，统一管理
**缺点**：需要管理token过期

#### 修改你的Code节点
```javascript
// 卡片发送请求（API方式）
const cardRequest = {
  url: 'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id',
  body: {
    receive_id: 'oc_f138be619fd7e6ef75c45ce167a3bf24',
    msg_type: 'interactive',
    content: JSON.stringify(card)
  },
};

// 文件发送请求（API方式）
const fileRequest = {
  url: 'https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id',
  body: {
    receive_id: 'oc_f138be619fd7e6ef75c45ce167a3bf24',
    msg_type: 'file',
    content: JSON.stringify({ file_key: fileKey }),
  },
};
```

---

## 🎯 推荐方案

### 如果你想要最简单的配置：

**只修改卡片发送为Webhook**，文件发送保持API：

1. **修改Code节点**：使用 `n8n-lark-file-webhook-code.js`

2. **添加第一个HTTP节点**（发送卡片）：
   ```
   URL: https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909
   Body: ={{ $json.webhookRequest.body }}
   Headers: Content-Type: application/json
   ```

3. **修改第二个HTTP节点**（发送文件）：
   ```
   URL: ={{ $json.fileRequest.url }}
   Body: ={{ $json.fileRequest.body }}
   Headers: Authorization: Bearer {{ $json.tenant_access_token }}
   ```

---

## 📋 完整工作流

```
[数据整合Code节点]
    ↓
[HTTP节点1: 发送卡片通知 - Webhook]
    ↓
[HTTP节点2: 发送PDF文件 - API]
```

---

## 🔍 关键区别

| 发送内容 | 推荐方式 | 原因 |
|----------|----------|------|
| **卡片通知** | Webhook | 简单，无需token |
| **文件发送** | API | Webhook不支持文件 |

---

## ⚠️ 重要提醒

**文件发送必须用API**：
- Webhook **不支持**发送文件
- 文件发送需要 `file_key` 和 `tenant_access_token`
- 必须使用 `/im/v1/messages` API

**卡片发送可选择**：
- Webhook：简单，无需token
- API：统一管理，但需要token

---

## 🧪 测试步骤

1. **先测试卡片发送**：
   - 使用webhook URL
   - 发送简单的文本消息测试

2. **再测试文件发送**：
   - 确保有有效的 `file_key`
   - 确保 `tenant_access_token` 有效

3. **组合测试**：
   - 先发卡片通知
   - 再发PDF文件