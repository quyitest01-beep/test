# Lark 文件附件发送指南

## 问题说明

Lark API 发送文件附件需要两个步骤：
1. **先上传文件**到 Lark 服务器，获取 `file_key`
2. **发送消息**时使用 `file_key` 引用文件

## 方案一：使用文件上传 API（推荐）

### 步骤 1：上传文件获取 file_key

在发送卡片消息之前，先调用 Lark 文件上传 API：

**HTTP Request 节点配置：**

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/files`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
  - `Content-Type`: `multipart/form-data`
- **Body**:
  - `file_type`: `stream`
  - `file`: `={{ $binary.csv }}` (或 `$binary.data`、`$binary.file` 等)
  - `file_name`: `={{ $json.fileName }}`

**响应示例：**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "file_key": "file_vxxxxx"
  }
}
```

### 步骤 2：发送文件消息

获取 `file_key` 后，发送文件消息：

**HTTP Request 节点配置：**

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
  - `Content-Type`: `application/json`
- **Body (JSON)**:
```json
{
  "receive_id": "={{ $json.receive_id }}",
  "msg_type": "file",
  "content": "{\"file_key\":\"{{ $json.file_key }}\"}"
}
```

## 方案二：在卡片中添加下载链接

如果文件存储在 S3 或其他可访问的位置，可以在卡片中添加下载按钮：

### 修改卡片内容

在 `build-lark-card-message.js` 中，如果有文件下载链接，可以这样配置：

```javascript
if (json.fileDownloadUrl) {
  card.elements.push({
    "tag": "action",
    "actions": [
      {
        "tag": "button",
        "text": {
          "tag": "plain_text",
          "content": "📥 下载文件"
        },
        "type": "primary",
        "url": json.fileDownloadUrl
      }
    ]
  });
}
```

## 方案三：先发送卡片，再发送文件（最简单）

### 工作流结构

1. **构建消息内容** Code 节点 → 输出卡片消息和二进制文件
2. **发送卡片消息** HTTP Request 节点 → 发送卡片
3. **上传文件** HTTP Request 节点 → 上传文件获取 file_key
4. **发送文件消息** HTTP Request 节点 → 使用 file_key 发送文件

### 节点配置示例

#### 节点 1：构建消息内容（已有）
输出：`requestBodyJson`、`binary.csv`、`fileName`、`needsFileUpload`

#### 节点 2：发送卡片消息（已有）
使用 `requestBodyJson` 发送卡片

#### 节点 3：上传文件（新增）

**HTTP Request 节点配置：**

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/files`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
- **Body**:
  - **Send Body**: `true` ✅
  - **Body Content Type**: `Multipart-Form-Data` ⚠️ **重要：必须选择这个，不能选 JSON**
  - **Specify Body**: `Using Fields Below`
  - **Body Parameters**:
    - **Name**: `file_type`, **Value**: `stream`
    - **Name**: `file`, **Value**: `={{ $binary.csv }}` ⚠️ **使用表达式引用二进制数据**
    - **Name**: `file_name`, **Value**: `={{ $json.fileName }}`

**关键配置点：**
1. ✅ **Body Content Type 必须选择 "Multipart-Form-Data"**，不能选 "JSON"
2. ✅ **file 字段使用表达式** `={{ $binary.csv }}`，n8n 会自动处理二进制数据
3. ✅ **Specify Body 选择 "Using Fields Below"**，然后添加参数

#### 节点 4：发送文件消息（新增）

**HTTP Request 节点配置：**

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id`
- **Headers**:
  - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
  - `Content-Type`: `application/json`
- **Body (JSON)**:
```json
{
  "receive_id": "={{ $json.receive_id }}",
  "msg_type": "file",
  "content": "={{ JSON.stringify({ file_key: $json.data.file_key }) }}"
}
```

## 完整工作流示例

```
构建消息内容 (Code)
    ↓
发送卡片消息 (HTTP Request) - 使用 requestBodyJson
    ↓
上传文件 (HTTP Request) - 上传 binary.csv
    ↓
发送文件消息 (HTTP Request) - 使用 file_key
```

## 注意事项

1. **文件大小限制**：Lark 对文件大小有限制（通常为 100MB），请确保文件不超过限制
2. **文件类型**：支持常见文件类型（CSV、Excel、PDF 等）
3. **权限**：确保 `tenant_access_token` 有文件上传和发送消息的权限
4. **错误处理**：如果文件上传失败，应该跳过文件发送步骤，只发送卡片消息

## 调试建议

1. 检查二进制数据是否存在：在 Code 节点中添加 `console.log(item.binary)`
2. 检查文件上传响应：查看 HTTP Request 节点的响应，确认 `file_key` 是否正确获取
3. 检查消息发送：确认 `receive_id` 和 `file_key` 都正确传递

