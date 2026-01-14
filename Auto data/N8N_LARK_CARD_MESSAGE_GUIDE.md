# Lark 消息卡片发送配置指南

## 功能说明
使用 Code 节点构建 Lark 消息卡片内容，然后通过 HTTP Request 节点发送卡片消息。

## 节点流程

1. **Code 节点**：`build-lark-card-message.js` - 构建卡片内容
2. **HTTP Request 节点**：发送卡片消息到 Lark API

## Code 节点配置

### 节点名称
`构建Lark消息卡片`

### 代码
使用 `n8n-workflows/build-lark-card-message.js` 中的代码

### 输入数据格式
```json
{
  "queryId": "236c31b5-e973-4b3c-af19-6084c37f2c6d",
  "text": "查一下2025/11月按游戏、币种维度区分，所有游戏的累计投注额",
  "result": "查询完成",
  "recordCount": 771,
  "filePresent": true,
  "fileInfo": {
    "fileName": "2025-11-累计投注额.csv",
    "formattedSize": "31.92 KB"
  },
  "chatid": "oc_da0ab0d3b6a104f72f3a4c8f00ecddaa",
  "messageText": "📄 查数结果已生成，请查收附件：\n• 文件：2025-11-累计投注额.csv（31.92 KB）"
}
```

### 输出数据格式
```json
{
  "receive_id": "oc_da0ab0d3b6a104f72f3a4c8f00ecddaa",
  "receive_id_type": "chat_id",
  "msg_type": "interactive",
  "content": "{\"config\":{\"wide_screen_mode\":true},\"header\":{...},\"elements\":[...]}",
  "card": {...},
  "cardContent": "...",
  // ... 其他原始字段
}
```

## HTTP Request 节点配置

### 基本设置
- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`
- **Send Query**: `false`（查询参数已在 URL 中）

### Headers
- **Authorization**: `=Bearer {{ $json.tenant_access_token }}`
- **Content-Type**: `application/json; charset=utf-8`

### Body (JSON)
在 n8n 的 JSON Body 字段中输入：
```json
{
  "receive_id": "={{ $json.receive_id }}",
  "msg_type": "={{ $json.msg_type }}",
  "content": "={{ $json.content }}"
}
```

**重要**：`content` 字段在 Code 节点中已经是 JSON 字符串，在 HTTP Request 的 JSON Body 中直接使用 `{{ $json.content }}` 即可，n8n 会自动处理字符串转义。

### 完整配置示例
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id",
  "sendQuery": false,
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $json.tenant_access_token }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json; charset=utf-8"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"receive_id\": \"{{ $json.receive_id }}\",\n  \"msg_type\": \"{{ $json.msg_type }}\",\n  \"content\": \"{{ $json.content }}\"\n}"
```

**注意**：`content` 字段需要用双引号包裹，因为它是 JSON 字符串。n8n 会自动处理转义。
}
```

**注意**：`content` 字段在 Code 节点中已经是 JSON 字符串，所以在 HTTP Request 中直接使用 `{{ $json.content }}` 即可，不需要再次 JSON.stringify。

## 卡片内容说明

### 卡片结构
- **Header**: 蓝色主题，标题"📊 查数结果"
- **查询内容**: 显示原始查询文本
- **查询状态**: 显示查询状态和记录数
- **文件信息**: 如果有文件，显示文件名和大小
- **消息内容**: 显示 messageText（如果有）
- **查询ID**: 底部显示查询ID用于追踪

### 卡片元素
- `div`: 文本内容区域
- `hr`: 分隔线
- `note`: 备注信息
- `fields`: 多列布局（is_short: true 表示短列）

## 自定义卡片内容

如果需要自定义卡片内容，可以修改 `build-lark-card-message.js` 中的 `card` 对象结构。

### 添加按钮
```javascript
{
  "tag": "action",
  "actions": [
    {
      "tag": "button",
      "text": {
        "tag": "plain_text",
        "content": "📥 下载文件"
      },
      "type": "primary",
      "url": "https://your-download-url.com/file.csv"
    }
  ]
}
```

### 添加图片
```javascript
{
  "tag": "img",
  "img_key": "img_v2_xxx",
  "alt": {
    "tag": "plain_text",
    "content": "查询结果图表"
  }
}
```

### 添加表格
```javascript
{
  "tag": "table",
  "table_width": "fit_content",
  "rows": [
    {
      "cells": [
        {
          "tag": "div",
          "text": {
            "tag": "lark_md",
            "content": "币种"
          }
        },
        {
          "tag": "div",
          "text": {
            "tag": "lark_md",
            "content": "游戏代码"
          }
        }
      ]
    }
  ]
}
```

## 注意事项

1. **content 字段格式**：必须是 JSON 字符串，Code 节点已处理
2. **receive_id_type**：必须作为查询参数放在 URL 中
3. **卡片大小限制**：卡片消息请求体最大不能超过 30KB
4. **Markdown 格式**：使用 `lark_md` 标签支持 Markdown 语法
5. **宽屏模式**：`wide_screen_mode: true` 启用宽屏显示

## 测试

### 测试数据
使用上游提供的测试数据，确保：
- `chatid` 字段存在
- `tenant_access_token` 有效
- 卡片内容不超过 30KB

### 预期响应
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "message_id": "om_xxx"
  }
}
```

## 错误处理

### 常见错误

1. **400 Bad Request - 卡片格式错误**
   - 原因：卡片 JSON 格式不正确
   - 解决：检查 `content` 字段是否为有效的 JSON 字符串

2. **400 Bad Request - 卡片内容过大**
   - 原因：卡片内容超过 30KB
   - 解决：简化卡片内容，减少文本或移除不必要的元素

3. **400 Bad Request - receive_id 无效**
   - 原因：`chatid` 不正确或机器人不在群组中
   - 解决：检查 `chatid` 是否正确，确保机器人在群组中

