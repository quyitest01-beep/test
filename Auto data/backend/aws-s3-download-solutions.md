# AWS S3 下载解决方案（n8n Code 节点不支持 aws-sdk）

## 问题
n8n 的 Code 节点不支持 `require('aws-sdk')`，无法在 Code 节点中生成预签名 URL。

## 解决方案

### 方案1：直接修复 HTTP Request 节点的 AWS 认证区域配置（推荐）

**步骤**：

1. **检查 AWS 凭证配置**：
   - 在 n8n 中，打开 "Credentials" → 找到你的 AWS 凭证
   - 确保 "Region" 字段设置为 `us-west-2`
   - 如果没有 "Region" 字段，需要更新凭证或创建新凭证

2. **HTTP Request 节点配置**：

```json
{
  "parameters": {
    "url": "=https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/{{ $json.queryId }}.csv",
    "method": "GET",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "aws",
    "sendQuery": false,
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "x-amz-content-sha256",
          "value": "UNSIGNED-PAYLOAD"
        }
      ]
    },
    "options": {
      "response": {
        "response": {
          "responseFormat": "file",
          "outputPropertyName": "data"
        }
      },
      "timeout": 300000,
      "redirect": {
        "followRedirects": true,
        "maxRedirects": 5
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

**关键点**：
- URL 中的区域必须是 `us-west-2`
- AWS 凭证中的区域也必须设置为 `us-west-2`
- 两者必须匹配

---

### 方案2：使用 n8n 的 AWS S3 节点（如果可用）

如果 n8n 有 AWS S3 节点，可以直接使用它来下载文件，不需要 HTTP Request 节点。

**配置**：
- **Operation**: `Download`
- **Bucket Name**: `aws-athena-query-results-us-west-2-034986963036`
- **File Key**: `={{ $json.queryId }}.csv`
- **Region**: `us-west-2`

---

### 方案3：使用 HTTP 请求调用 AWS API 生成预签名 URL（复杂，不推荐）

如果必须使用预签名 URL，可以使用 HTTP 请求调用 AWS API，但这需要手动实现 AWS Signature Version 4，比较复杂。

---

## 推荐：修复 AWS 凭证区域配置

**最简单的方法**：

1. **更新 AWS 凭证**：
   - 在 n8n 中，编辑你的 AWS 凭证
   - 添加或修改 "Region" 字段为 `us-west-2`
   - 保存

2. **HTTP Request 节点配置**：
   - URL: `=https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/{{ $json.queryId }}.csv`
   - Authentication: 选择你的 AWS 凭证
   - Response Format: `File`
   - Output Property Name: `data`

3. **测试**：运行节点，应该可以正常下载文件

---

## 如果仍然报错

如果更新凭证后仍然报错，可以尝试：

1. **创建新的 AWS 凭证**：
   - 在 n8n 中创建新的 AWS 凭证
   - 明确设置 Region 为 `us-west-2`
   - 在 HTTP Request 节点中使用新凭证

2. **检查 URL 格式**：
   - 确保 URL 格式正确：`https://{bucket}.s3.{region}.amazonaws.com/{key}`
   - 区域必须与凭证中的区域匹配

3. **使用 AWS S3 节点**（如果可用）：
   - 直接使用 n8n 的 AWS S3 节点下载文件
   - 不需要处理 HTTP 请求和认证问题




