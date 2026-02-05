# Lark API 改为 Webhook 发送群消息

## 主要变化

### 原来的API方式
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id",
  "headers": {
    "Authorization": "Bearer {{ $json.tenant_access_token }}"
  },
  "body": {
    "receive_id": "oc_f138be619fd7e6ef75c45ce167a3bf24",
    "msg_type": "interactive",
    "content": "JSON.stringify($json.card_payload.card)"
  }
}
```

### 新的Webhook方式
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909",
  "headers": {
    "Content-Type": "application/json; charset=utf-8"
  },
  "body": {
    "msg_type": "interactive",
    "card": "$json.card_payload.card"
  }
}
```

---

## 🔄 修改步骤

### 1. 修改URL
```
原来：https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id
改为：https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909
```

### 2. 删除Authorization头
```
删除：Authorization: Bearer {{ $json.tenant_access_token }}
保留：Content-Type: application/json; charset=utf-8
```

### 3. 修改JSON Body
```javascript
// 原来
{
  "receive_id": "oc_f138be619fd7e6ef75c45ce167a3bf24",
  "msg_type": "interactive", 
  "content": JSON.stringify($json.card_payload.card)
}

// 改为
{
  "msg_type": "interactive",
  "card": $json.card_payload.card
}
```

---

## 📋 完整的HTTP Request节点配置

### Basic Settings
- **Method**: POST
- **URL**: `https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909`

### Headers
```
Content-Type: application/json; charset=utf-8
```

### Body (JSON)
```javascript
={{ {
  "msg_type": "interactive",
  "card": $json.card_payload.card
} }}
```

---

## 🎯 关键区别

| 项目 | API方式 | Webhook方式 |
|------|---------|-------------|
| **认证** | 需要 tenant_access_token | 不需要认证 |
| **群组指定** | 通过 receive_id 参数 | 通过 webhook URL |
| **消息格式** | content: JSON.stringify(card) | card: card对象 |
| **URL参数** | ?receive_id_type=chat_id | 无 |

---

## 📝 n8n配置示例

### 方式1：直接修改现有节点

1. **修改URL**：
   ```
   https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909
   ```

2. **删除Authorization头**：
   - 删除整个Authorization参数行

3. **修改JSON Body**：
   ```javascript
   ={{ {
     "msg_type": "interactive",
     "card": $json.card_payload.card
   } }}
   ```

### 方式2：使用配置文件

导入 `n8n-lark-webhook-config.json` 文件，或者复制其中的配置。

---

## 🔍 消息类型支持

### 交互式卡片（你当前使用的）
```javascript
{
  "msg_type": "interactive",
  "card": {
    // 卡片内容
  }
}
```

### 文本消息
```javascript
{
  "msg_type": "text",
  "content": {
    "text": "这是一条文本消息"
  }
}
```

### 富文本消息
```javascript
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "标题",
        "content": [
          [
            {
              "tag": "text",
              "text": "内容"
            }
          ]
        ]
      }
    }
  }
}
```

---

## ⚠️ 注意事项

### 1. Webhook限制
- 每个webhook每分钟最多发送20条消息
- 消息大小限制：30KB

### 2. 卡片格式
- 确保 `$json.card_payload.card` 包含有效的卡片JSON
- 不需要再用 `JSON.stringify()` 包装

### 3. 错误处理
Webhook会返回不同的错误码：
```javascript
{
  "code": 0,        // 成功
  "msg": "success",
  "data": {}
}
```

### 4. 调试
如果消息发送失败，检查：
- Webhook URL是否正确
- 卡片JSON格式是否有效
- 是否超过频率限制

---

## 🧪 测试消息

### 简单文本测试
```javascript
{
  "msg_type": "text",
  "content": {
    "text": "测试消息：Webhook配置成功！"
  }
}
```

### 测试你的卡片
保持原有的卡片数据结构，只需要修改HTTP请求配置即可。

---

## 📞 完整示例

如果你的原始数据是：
```javascript
$json.card_payload.card = {
  "elements": [...],
  "header": {...}
}
```

新的请求体应该是：
```javascript
{
  "msg_type": "interactive", 
  "card": {
    "elements": [...],
    "header": {...}
  }
}
```

这样就完成了从API到Webhook的迁移！