# 方案1：HTTP Request节点配置

## 📋 完整配置步骤

### 1. Code节点
使用 `n8n-lark-webhook-with-file-link.js` 的代码

### 2. HTTP Request节点配置

#### Basic Settings
- **Method**: `POST`
- **URL**: `={{ $json.webhookRequest.url }}`

#### Headers
点击 "Add Header" 添加：
- **Name**: `Content-Type`
- **Value**: `application/json; charset=utf-8`

#### Body
- **Body Content Type**: `JSON`
- **JSON**: `={{ $json.webhookRequest.body }}`

---

## 🎯 具体配置截图指南

### HTTP Request节点界面配置

```
┌─────────────────────────────────────┐
│ HTTP Request                        │
├─────────────────────────────────────┤
│ Method: POST                        │
│ URL: ={{ $json.webhookRequest.url }}│
├─────────────────────────────────────┤
│ ☑ Send Headers                      │
│ Headers:                            │
│   Name: Content-Type                │
│   Value: application/json; charset=utf-8 │
├─────────────────────────────────────┤
│ ☑ Send Body                         │
│ Body Content Type: JSON             │
│ JSON: ={{ $json.webhookRequest.body }}│
└─────────────────────────────────────┘
```

---

## 📝 详细配置值

### URL字段
```
={{ $json.webhookRequest.url }}
```

### Headers配置
```
Name: Content-Type
Value: application/json; charset=utf-8
```

### JSON Body字段
```
={{ $json.webhookRequest.body }}
```

---

## 🔍 配置验证

配置完成后，HTTP节点应该会发送这样的请求：

**URL**:
```
https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909
```

**Headers**:
```
Content-Type: application/json; charset=utf-8
```

**Body**:
```json
{
  "msg_type": "interactive",
  "card": {
    "config": {
      "wide_screen_mode": true,
      "enable_forward": true
    },
    "header": {
      "template": "blue",
      "title": {
        "tag": "plain_text",
        "content": "周报"
      }
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**报告周期：** 2024-11-10\n**生成时间：** 2024-11-17 10:30:00"
        }
      },
      {
        "tag": "hr"
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "📄 **报告文件：** 周报.pdf\n\n🔗 **文件ID：** `file_abc123`\n\n💡 *请联系管理员获取文件下载链接*"
        }
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": {
              "tag": "plain_text",
              "content": "📥 申请下载"
            },
            "type": "primary",
            "value": {
              "file_key": "file_abc123",
              "file_name": "周报.pdf"
            }
          }
        ]
      }
    ]
  }
}
```

---

## ⚠️ 常见问题

### Q1: URL显示undefined
**原因**: Code节点没有正确输出 `webhookRequest.url`
**解决**: 检查Code节点是否使用了正确的代码

### Q2: Body显示undefined  
**原因**: Code节点没有正确输出 `webhookRequest.body`
**解决**: 检查Code节点的return语句

### Q3: 发送失败
**原因**: Webhook URL可能无效
**解决**: 确认webhook URL是否正确

---

## 🧪 测试步骤

### 1. 测试Code节点输出
运行Code节点后，检查JSON输出是否包含：
- `webhookRequest.url`
- `webhookRequest.body`

### 2. 测试HTTP请求
运行HTTP节点，应该返回：
```json
{
  "StatusCode": "ok"
}
```

### 3. 检查Lark群
群里应该收到包含文件信息的卡片消息。

---

## 🎨 卡片效果预览

发送成功后，Lark群里会显示：

```
┌─────────────────────────────────┐
│ 📊 周报                         │
├─────────────────────────────────┤
│ 报告周期： 2024-11-10           │
│ 生成时间： 2024-11-17 10:30:00  │
│ ─────────────────────────────── │
│ 📄 报告文件： 周报.pdf          │
│                                 │
│ 🔗 文件ID： file_abc123         │
│                                 │
│ 💡 请联系管理员获取文件下载链接  │
│                                 │
│ [📥 申请下载]                   │
└─────────────────────────────────┘
```

这样用户就能看到文件信息，并可以通过按钮申请下载！