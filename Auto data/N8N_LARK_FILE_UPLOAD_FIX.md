# Lark 文件上传节点配置修复

## ⚠️ 错误信息

```
source.on is not a function
```

## 🔍 问题原因

这个错误通常是因为 **"Body Content Type" 被错误地设置为 `JSON`**，而文件上传必须使用 `Multipart-Form-Data`。

## ✅ 正确配置步骤

### 步骤 1：打开 "上传文件" HTTP Request 节点

### 步骤 2：配置基本设置

- **Method**: `POST`
- **URL**: `https://open.larksuite.com/open-apis/im/v1/files`

### 步骤 3：配置 Headers

- **Send Headers**: `true` ✅
- **Header Parameters**:
  - **Name**: `Authorization`
  - **Value**: `=Bearer {{ $json.tenant_access_token }}`

### 步骤 4：配置 Body（关键步骤）

⚠️ **这是最容易出错的地方！**

1. **Send Body**: `true` ✅

2. **Body Content Type**: 
   - ❌ **不要选择 "JSON"**
   - ✅ **必须选择 "Multipart-Form-Data"**

3. **Specify Body**: 
   - ✅ 选择 **"Using Fields Below"**（或 "Keypair"）

4. **Body Parameters**（添加以下参数）：

   | Name | Value | 说明 |
   |------|-------|------|
   | `file_type` | `stream` | 固定值 |
   | `file` | `={{ $binary.csv }}` | ⚠️ 使用表达式，不是直接选择文件 |
   | `file_name` | `={{ $json.fileName }}` | 文件名 |

### 步骤 5：验证配置

配置完成后，应该看到：
- ✅ Body Content Type: `Multipart-Form-Data`
- ✅ Body Parameters 中有 3 个参数
- ✅ `file` 参数的值是 `={{ $binary.csv }}`（表达式格式）

## 📸 配置截图说明

### 正确的配置界面应该显示：

```
Send Body: ✅ ON
Body Content Type: [Multipart-Form-Data ▼]  ← 必须是这个
Specify Body: [Using Fields Below ▼]

Body Parameters:
┌─────────────┬──────────────────────┐
│ Name        │ Value                │
├─────────────┼──────────────────────┤
│ file_type   │ stream               │
│ file        │ ={{ $binary.csv }}   │ ← 表达式格式
│ file_name   │ ={{ $json.fileName }}│
└─────────────┴──────────────────────┘
```

### 错误的配置（会导致错误）：

```
Body Content Type: [JSON ▼]  ← ❌ 错误！会导致 "source.on is not a function"
```

## 🔧 如果仍然报错

### 检查 1：二进制数据是否存在

在 "构建消息内容" Code 节点中添加调试日志：

```javascript
console.log('Binary data:', item.binary);
console.log('Binary fields:', Object.keys(item.binary || {}));
```

### 检查 2：二进制字段名

如果 `$binary.csv` 不存在，尝试：
- `={{ $binary.data }}`
- `={{ $binary.file }}`
- `={{ $binary.document }}`

### 检查 3：文件大小

确保文件不超过 Lark 的限制（通常为 100MB）。

## 📝 完整配置示例（JSON 格式）

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://open.larksuite.com/open-apis/im/v1/files",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.tenant_access_token }}"
        }
      ]
    },
    "sendBody": true,
    "bodyContentType": "multipart-form-data",
    "specifyBody": "keypair",
    "bodyParameters": {
      "parameters": [
        {
          "name": "file_type",
          "value": "stream"
        },
        {
          "name": "file",
          "value": "={{ $binary.csv }}"
        },
        {
          "name": "file_name",
          "value": "={{ $json.fileName }}"
        }
      ]
    }
  }
}
```

## ✅ 验证步骤

1. 执行节点
2. 检查 OUTPUT 面板
3. 应该看到 Lark API 的响应，包含 `file_key` 字段
4. 如果没有错误，说明配置正确

## 🎯 下一步

配置正确后，继续配置 "发送文件消息" 节点，使用获取到的 `file_key` 发送文件消息。

