# AWS S3 HTTP Request 节点区域错误修复

## 错误信息
```
AuthorizationHeaderMalformed 
The authorization header is malformed; 
the region 's3' is wrong; expecting 'us-west-2'
```

## 问题原因

n8n 的 HTTP Request 节点在使用 AWS 认证时，可能从 bucket 名称中错误地解析了区域。

**当前 URL**：
```
https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/{{ $json.queryId }}.csv
```

n8n 可能将 bucket 名称中的 `us-west-2` 或 `s3` 误认为是区域。

## 解决方案

### 方案1：修改 AWS 凭证配置（推荐）

1. **编辑 AWS 凭证**：
   - 在 n8n 中，打开 "Credentials"
   - 找到你的 "AWS account" 凭证
   - 点击编辑（铅笔图标）
   - **确保 "Region" 字段明确设置为 `us-west-2`**
   - 如果没有 "Region" 字段，需要添加它
   - 保存凭证

2. **重新测试 HTTP Request 节点**

---

### 方案2：使用路径样式 URL（如果方案1不行）

修改 URL 格式，使用路径样式而不是虚拟主机样式：

**原 URL（虚拟主机样式）**：
```
https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/{{ $json.queryId }}.csv
```

**新 URL（路径样式）**：
```
https://s3.us-west-2.amazonaws.com/aws-athena-query-results-us-west-2-034986963036/{{ $json.queryId }}.csv
```

**HTTP Request 节点配置**：
- URL: `=https://s3.us-west-2.amazonaws.com/aws-athena-query-results-us-west-2-034986963036/{{ $json.queryId }}.csv`
- Authentication: AWS（选择你的凭证，确保区域是 `us-west-2`）
- Method: GET
- Response Format: File
- Output Property Name: data

---

### 方案3：使用 n8n 的 AWS S3 节点（最简单，如果可用）

如果 n8n 有 AWS S3 节点，直接使用它：

1. **添加 AWS S3 节点**
2. **配置**：
   - Operation: `Download` 或 `Get Object`
   - Bucket Name: `aws-athena-query-results-us-west-2-034986963036`
   - File Key: `={{ $json.queryId }}.csv`
   - Region: `us-west-2`
   - 选择你的 AWS 凭证

这样就不需要处理 HTTP 请求和区域配置问题。

---

### 方案4：在 HTTP Request 节点中添加 Headers（临时方案）

如果无法修改凭证，可以尝试在 HTTP Request 节点中添加 Headers：

**Headers 配置**：
- `x-amz-content-sha256`: `UNSIGNED-PAYLOAD`
- `Host`: `aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com`

但这可能不会完全解决问题，因为区域是在签名时确定的。

---

## 推荐步骤

1. **首先尝试方案1**：编辑 AWS 凭证，明确设置 Region 为 `us-west-2`
2. **如果方案1不行，尝试方案2**：使用路径样式 URL
3. **如果都不行，使用方案3**：使用 n8n 的 AWS S3 节点（如果可用）

---

## 检查 AWS 凭证配置

在 n8n 中检查 AWS 凭证：
1. 打开 "Credentials"
2. 找到你的 AWS 凭证
3. 查看是否有 "Region" 字段
4. 如果没有，需要：
   - 删除旧凭证
   - 创建新凭证
   - 在创建时明确设置 Region 为 `us-west-2`

---

## 快速测试

修改凭证后，重新运行 HTTP Request 节点。如果仍然报错，尝试使用路径样式 URL。




