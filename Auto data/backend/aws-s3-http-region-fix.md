# AWS S3 HTTP 请求区域错误修复指南

## 错误信息
```
AuthorizationHeaderMalformed The authorization header is malformed; 
the region 's3' is wrong; expecting 'us-west-2'
```

## 问题原因
HTTP Request 节点使用 AWS 认证时，区域配置不正确。URL 中使用的是 `us-west-2`，但授权头中使用了错误的区域 `s3`。

## 解决方案

### 方案1：在 AWS 凭证中指定区域（推荐）

1. **检查 AWS 凭证配置**：
   - 在 n8n 中，打开 "Credentials" → 找到你的 AWS 凭证
   - 确保 "Region" 字段设置为 `us-west-2`
   - 如果没有 "Region" 字段，需要添加或更新凭证

2. **如果无法修改凭证**，使用方案2或方案3

---

### 方案2：使用 Code 节点生成预签名 URL（最简单，推荐）

**优点**：不需要在 HTTP Request 节点中配置 AWS 认证，避免区域问题

#### 步骤1：Code 节点生成预签名 URL

```javascript
// n8n Code节点：生成 AWS S3 预签名 URL
const AWS = require('aws-sdk');

// 从输入中获取参数
const item = $input.first().json;
const bucketName = 'aws-athena-query-results-us-west-2-034986963036';
const fileKey = item.queryId + '.csv';
const region = 'us-west-2';
const expiresIn = 3600; // 1小时

// 配置 AWS S3（使用 n8n 的 AWS 凭证）
const s3 = new AWS.S3({
  region: region
  // AWS 凭证应该已经在 n8n 的 AWS 凭证中配置
});

// 生成预签名 URL
const params = {
  Bucket: bucketName,
  Key: fileKey,
  Expires: expiresIn
};

const presignedUrl = s3.getSignedUrl('getObject', params);

console.log(`Generated presigned URL for ${bucketName}/${fileKey}`);
console.log(`URL expires in ${expiresIn} seconds`);

return [{
  json: {
    ...item,
    presignedUrl: presignedUrl,
    bucketName: bucketName,
    fileKey: fileKey
  }
}];
```

#### 步骤2：HTTP Request 节点使用预签名 URL

**节点配置**：

```json
{
  "parameters": {
    "url": "={{ $json.presignedUrl }}",
    "method": "GET",
    "sendQuery": false,
    "sendHeaders": false,
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
- URL 使用 `{{ $json.presignedUrl }}`
- **不需要** AWS 认证（`authentication` 设置为 `none` 或不设置）
- **不需要** Headers

---

### 方案3：在 HTTP Request 节点中明确指定区域

如果必须使用 AWS 认证，需要在 HTTP Request 节点的设置中明确指定区域。

**节点配置**：

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
      },
      "aws": {
        "region": "us-west-2"
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

**注意**：n8n 的 HTTP Request 节点可能不支持在 `options.aws.region` 中指定区域。如果这个选项不可用，请使用方案2（预签名 URL）。

---

## 推荐工作流

```
[上游节点] 
  ↓ (输出: { queryId })
[Code 节点 - 生成预签名 URL]
  ↓ (输出: { queryId, presignedUrl })
[HTTP Request - 下载文件]
  ↓ (输出: binary.data)
[处理文件数据]
```

---

## 快速修复步骤（使用预签名 URL）

1. **在 HTTP Request 节点之前添加 Code 节点**

2. **Code 节点代码**（使用上面的代码）

3. **修改 HTTP Request 节点**：
   - URL: `={{ $json.presignedUrl }}`
   - Authentication: `None`（或不设置）
   - 移除所有 Headers
   - Response Format: `File`
   - Output Property Name: `data`

4. **运行测试**

这样就不需要处理 AWS 区域配置问题了。




