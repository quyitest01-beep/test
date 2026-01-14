# AWS S3 大文件下载 HTTP 节点配置

## 方案1：使用 AWS S3 REST API（推荐）

### 节点配置

**节点类型**：HTTP Request

**参数配置**：

```json
{
  "url": "=https://{{ $json.bucketName }}.s3.{{ $json.region || 'us-west-2' }}.amazonaws.com/{{ $json.fileKey }}",
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
}
```

**说明**：
- `url`: 使用 S3 REST API 的 URL 格式
- `authentication`: 使用 AWS 凭证进行签名
- `responseFormat`: 设置为 `file` 以处理大文件
- `timeout`: 设置为 300 秒（5分钟）以处理大文件

---

## 方案2：使用预签名 URL（如果上游提供）

### 节点配置

**节点类型**：HTTP Request

**参数配置**：

```json
{
  "url": "={{ $json.presignedUrl }}",
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
}
```

**说明**：
- 如果上游节点已经生成了预签名 URL，直接使用即可
- 不需要额外的认证配置

---

## 方案3：使用 Code 节点生成预签名 URL + HTTP 节点下载

### 步骤1：Code 节点生成预签名 URL

```javascript
// n8n Code节点：生成 AWS S3 预签名 URL
const AWS = require('aws-sdk');

// 从输入中获取参数
const item = $input.first().json;
const bucketName = item.bucketName || 'aws-athena-query-results-us-west-2-034986963036';
const fileKey = item.fileKey || item.queryId + '.csv';
const region = item.region || 'us-west-2';
const expiresIn = item.expiresIn || 3600; // 1小时

// 配置 AWS S3
const s3 = new AWS.S3({
  region: region,
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
    fileKey: fileKey,
    region: region
  }
}];
```

### 步骤2：HTTP 节点下载文件

**节点类型**：HTTP Request

**参数配置**：

```json
{
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
}
```

---

## 方案4：直接使用 HTTP 节点 + AWS Signature V4（完整配置）

### 节点配置

**节点类型**：HTTP Request

**参数配置**：

```json
{
  "url": "=https://{{ $json.bucketName }}.s3.{{ $json.region || 'us-west-2' }}.amazonaws.com/{{ $json.fileKey }}",
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
    "proxy": "default"
  }
}
```

**AWS 凭证配置**：
- 在 n8n 中配置 AWS 凭证（Access Key ID 和 Secret Access Key）
- 确保凭证有 S3 读取权限

---

## 推荐配置（最简单）

### HTTP Request 节点配置

**基本设置**：
- **Method**: `GET`
- **URL**: `=https://{{ $json.bucketName }}.s3.us-west-2.amazonaws.com/{{ $json.fileKey }}`
- **Authentication**: `AWS` (选择已配置的 AWS 凭证)

**Headers**（可选）：
- `x-amz-content-sha256`: `UNSIGNED-PAYLOAD`

**Options**：
- **Response Format**: `File`
- **Output Property Name**: `data`
- **Timeout**: `300000` (300秒，5分钟)
- **Follow Redirects**: `true`
- **Max Redirects**: `5`

**完整 JSON 配置**：

```json
{
  "url": "=https://{{ $json.bucketName }}.s3.us-west-2.amazonaws.com/{{ $json.fileKey }}",
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
}
```

---

## 注意事项

1. **文件大小限制**：
   - HTTP 节点可以处理更大的文件，但受 n8n 服务器内存限制
   - 如果文件非常大（>100MB），建议使用流式处理或分块下载

2. **超时设置**：
   - 根据文件大小调整 `timeout` 值
   - 大文件可能需要更长的超时时间

3. **内存使用**：
   - 使用 `responseFormat: "file"` 可以将响应保存为文件而不是加载到内存
   - 这对于大文件很重要

4. **错误处理**：
   - 建议在节点上启用 `onError: "continueRegularOutput"` 以处理下载失败的情况

5. **区域设置**：
   - 确保 S3 bucket 的区域与 URL 中的区域匹配
   - 如果 bucket 在不同区域，需要修改 URL

---

## 工作流示例

```
[上游节点] 
  ↓ (输出: { bucketName, fileKey, queryId })
[HTTP Request - 下载 S3 文件]
  ↓ (输出: binary.data)
[处理文件数据]
```




