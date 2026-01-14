# Lark附件下载HTTP请求配置修复

## ⚠️ 错误信息

### 错误1
```
Bad request - please check your parameters [item 1]
request trigger frequency limit
```

### 错误2
```
Bad request - please check your parameters [item 0]
field validation failed
```

## 🔍 问题诊断

### 错误1原因

1. **查询参数格式错误**：使用了错误的查询参数名称和格式
2. **URL重复拼接**：URL中已包含查询参数，但又在queryParameters中重复添加
3. **频率限制**：可能因为配置错误导致大量重复请求触发频率限制

### 错误2原因

1. **attachment_id为空或无效**：聚合器输出的attachment_id可能为空字符串或格式不正确
2. **URL拼接问题**：attachment_id可能包含特殊字符导致URL解析错误
3. **字段验证失败**：Lark API验证attachment_id字段时发现格式不正确

### 错误配置示例

```json
{
  "url": "={{ $json.url }}",  // ✅ URL正确，但后面会重复添加参数
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "attachment_ids",  // ❌ 错误：参数名应该是 attachment_id
        "value": "={{ $json.attachment_id }}"
      }
    ]
  }
}
```

**问题**：
- 参数名错误：`attachment_ids` 应该是 `attachment_id`
- URL和queryParameters重复：会导致URL变成 `base_url?attachment_ids=xxx&attachment_ids=xxx`

## ✅ 正确配置

### 方法1：只使用URL拼接（推荐）

```json
{
  "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}",
  "sendQuery": false,
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "={{ $json.headers.Authorization }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "options": {}
}
```

**关键点**：
- ✅ `sendQuery: false` - 不启用queryParameters
- ✅ URL直接拼接参数：`?attachment_id={{ $json.attachment_id }}`
- ✅ 参数名：`attachment_id`（不是 `attachment_ids`）

### 方法2：使用queryParameters

```json
{
  "url": "={{ $json.url }}",
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "attachment_id",  // ✅ 正确的参数名
        "value": "={{ $json.attachment_id }}"
      }
    ]
  },
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "={{ $json.headers.Authorization }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "options": {}
}
```

**关键点**：
- ✅ `sendQuery: true` - 启用queryParameters
- ✅ URL不包含查询参数
- ✅ 参数名：`attachment_id`

## 📝 完整配置示例

### 节点1：附件聚合器（Code节点）

使用 `backend/lark-attachment-multi-fetcher.js`

**输出**：每个附件一个对象
```json
{
  "url": "https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/.../attachments/download_url",
  "headers": {
    "Authorization": "Bearer xxx",
    "Content-Type": "application/json"
  },
  "attachment_id": "Wvg8bKugFo7Hrkx7StXlnaG5gHc"
}
```

### 节点2：HTTP Request（推荐配置）

```json
{
  "parameters": {
    "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}",
    "sendQuery": false,
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "={{ $json.headers.Authorization }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "查询附件下载链接"
}
```

## 🔧 修复步骤

### 步骤1：修改HTTP Request节点

1. 打开HTTP Request节点配置
2. 修改URL为：`={{ $json.url }}?attachment_id={{ $json.attachment_id }}`
3. 设置 `sendQuery` 为 `false`
4. 删除或清空 `queryParameters`

### 步骤2：验证配置

**预期URL格式**：
```
https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/poon@gaming-panda.com/messages/aHNTR1VWMDlIeTlsb1YwUk8yVXJwSnJLS2NjPQ==/attachments/download_url?attachment_id=Wvg8bKugFo7Hrkx7StXlnaG5gHc
```

### 步骤3：测试

1. 执行工作流
2. 检查控制台日志
3. 验证返回结果

## 📚 Lark API文档参考

Lark Mail Attachment API文档：
- 端点：`GET /open-apis/mail/v1/user_mailboxes/{user_mailbox_id}/messages/{message_id}/attachments/download_url`
- 查询参数：`attachment_id` （单个字符串，不是数组）
- 认证：`Authorization: Bearer {tenant_access_token}`

## ⚠️ 常见错误

| 错误配置 | 正确配置 | 说明 |
|---------|---------|------|
| `attachment_ids` | `attachment_id` | 参数名是单数 |
| `sendQuery: true` 且URL包含参数 | `sendQuery: false` | 避免重复参数 |
| 缺少 `attachment_id` | 添加 `?attachment_id=xxx` | 必需参数 |
| URL拼接错误 | 使用 `{{ $json.url }}?attachment_id={{ $json.attachment_id }}` | 正确的拼接方式 |

## 🎯 完整工作流

```
┌──────────────────────┐
│  邮件筛选器          │
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  附件聚合器          │  <-- Code: lark-attachment-multi-fetcher.js
└──────────┬───────────┘     输出：多个附件请求对象
           │
┌──────────▼───────────┐
│  HTTP Request        │  <-- URL: ={{ $json.url }}?attachment_id={{ $json.attachment_id }}
└──────────┬───────────┘     sendQuery: false
           │
┌──────────▼───────────┐
│  处理下载链接        │
└──────────────────────┘
```

## 📞 问题排查

### 对于错误1（频率限制）

1. **检查聚合器输出**：确认 `attachment_id` 字段存在
2. **检查URL格式**：确认URL拼接正确
3. **检查token**：确认 `tenant_access_token` 有效
4. **检查频率限制**：如果有频率限制错误，等待后重试
5. **查看Lark API文档**：确认API参数要求

### 对于错误2（字段验证失败）

#### 第一步：验证attachment_id是否存在

在聚合器节点后添加一个Set节点，查看输出：

```json
{
  "url": "={{ $json.url }}",
  "attachment_id": "={{ $json.attachment_id }}",
  "attachment_id_length": "={{ $json.attachment_id.length }}",
  "attachment_filename": "={{ $json.attachment_filename }}"
}
```

**检查点**：
- ✅ `attachment_id` 不为空
- ✅ `attachment_id_length` > 0
- ✅ `attachment_id` 是字符串

#### 第二步：检查URL编码

如果attachment_id包含特殊字符，可能需要URL编码：

```json
{
  "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id.encodeURIComponent() }}"
}
```

#### 第三步：验证完整URL

在聚合器输出中查看生成的完整URL，手动复制到浏览器测试（添加Authorization header）。

#### 第四步：检查Lark API参数要求

Lark API可能需要：
- `attachment_id` 作为查询参数 ✓
- `Authorization: Bearer {token}` header ✓
- **不需要** `Content-Type: application/json` header（GET请求）

#### 第五步：移除不必要的header

```json
{
  "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}",
  "sendQuery": false,
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "={{ $json.headers.Authorization }}"
      }
      // ❌ 移除 Content-Type，GET请求不需要
    ]
  }
}
```

**关键点**：
- ✅ GET请求通常不需要 `Content-Type` header
- ✅ 只保留 `Authorization` header

## 🎯 推荐配置（最终版）

```json
{
  "parameters": {
    "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}",
    "sendQuery": false,
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "={{ $json.headers.Authorization }}"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "name": "HTTP Request"
}
```

**关键修改**：
- ✅ 移除 `Content-Type` header
- ✅ 只保留 `Authorization` header
- ✅ `sendQuery: false`
- ✅ URL直接拼接参数

## 🔗 相关文件

- `backend/lark-attachment-multi-fetcher.js` - 附件聚合器
- `LARK_ATTACHMENT_MULTI_FETCH_GUIDE.md` - 使用指南

