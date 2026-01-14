# Athena 批量查询 - 故障排查指南

## 当前错误：Bad request - please check your parameters

### 可能原因1：requestBody 格式问题

**检查方法：**
在 HTTP Request 节点前添加一个 Code 节点，使用 `debug-athena-request.js` 代码，查看输出。

**预期输出：**
```json
{
  "requestBody": {
    "QueryExecutionIds": ["id1", "id2", ...]
  }
}
```

**如果 requestBody 不存在：**
- 确保上游 Code 节点输出了 `requestBody` 字段
- 检查上游节点的输出格式

### 可能原因2：AWS 认证问题

AWS Athena API 需要正确的签名。检查以下几点：

1. **Region 配置**
   - 确保 AWS 凭证中的 Region 是 `us-west-2`
   - 或者在 HTTP Request 节点中明确指定 Region

2. **凭证类型**
   - 确保使用的是正确的 AWS 凭证类型
   - 检查 Access Key 和 Secret Key 是否正确

3. **服务名称**
   - AWS Athena 的服务名称是 `athena`
   - 确保签名算法正确

### 可能原因3：请求体序列化问题

n8n 的 `jsonBody` 表达式可能需要特殊处理。

**尝试方案A：直接使用表达式**
```javascript
={{ JSON.stringify($json.requestBody) }}
```

**尝试方案B：使用 Code 节点预处理**
在 HTTP Request 节点前添加 Code 节点，将 requestBody 转换为字符串：

```javascript
return {
  json: {
    requestBodyString: JSON.stringify($json.requestBody),
    requestBody: $json.requestBody
  }
};
```

然后在 HTTP Request 节点中使用：
- `specifyBody: "raw"`
- `body`: `={{ $json.requestBodyString }}`
- 添加 Header: `Content-Type: application/x-amz-json-1.1`

### 可能原因4：Header 配置问题

确保 Headers 正确：
- `Content-Type`: `application/x-amz-json-1.1`（注意是 `1.1`，不是 `1.0`）
- `X-Amz-Target`: `AmazonAthena.BatchGetQueryExecution`（注意大小写）

### 可能原因5：URL 或端点问题

确保 URL 正确：
- `https://athena.us-west-2.amazonaws.com/`（注意末尾的 `/`）

## 推荐解决方案

### 方案1：使用 Code 节点 + Raw Body（推荐）

**节点1：提取查询ID并构建请求体**
```javascript
// 使用 extract-query-ids-direct.js
```

**节点2：转换为字符串格式**
```javascript
// 将 requestBody 转换为 JSON 字符串
return {
  json: {
    requestBodyString: JSON.stringify($json.requestBody),
    originalData: $json
  }
};
```

**节点3：HTTP Request 节点**
- Method: `POST`
- URL: `https://athena.us-west-2.amazonaws.com/`
- Body Content Type: `Raw`
- Body: `={{ $json.requestBodyString }}`
- Headers:
  - `Content-Type`: `application/x-amz-json-1.1`
  - `X-Amz-Target`: `AmazonAthena.BatchGetQueryExecution`
- Authentication: AWS (配置正确的凭证)

### 方案2：使用 n8n 表达式直接构建

在 HTTP Request 节点的 `jsonBody` 中直接构建：

```javascript
={{ JSON.stringify({ QueryExecutionIds: $json.queryIds || [$json.queryId] }) }}
```

但需要确保上游数据有 `queryIds` 或 `queryId` 字段。

### 方案3：检查 AWS 认证配置

如果使用 n8n 的 AWS 凭证：
1. 进入 Credentials 设置
2. 检查 Region 是否为 `us-west-2`
3. 检查 Access Key 和 Secret Key 是否正确
4. 确保有 Athena 服务的访问权限

## 调试步骤

1. **添加调试节点**
   - 在 HTTP Request 节点前添加 Code 节点
   - 输出 `requestBody` 的内容和格式
   - 检查 JSON 序列化是否正常

2. **检查实际发送的请求**
   - 在 HTTP Request 节点的选项中启用 "Response" → "Full Response"
   - 查看实际发送的请求体

3. **测试单个查询ID**
   - 先用单个 ID 测试
   - 确认格式正确后再测试多个

4. **检查 AWS 日志**
   - 查看 AWS CloudTrail 日志
   - 确认请求是否到达 AWS

## 完整工作流示例

```
上游数据
    ↓
Code 节点：提取查询ID（extract-query-ids-direct.js）
    ↓
Code 节点：调试和验证（debug-athena-request.js）
    ↓
Code 节点：转换为字符串（可选）
    ↓
HTTP Request 节点：查询ID状态
    ↓
Code 节点：解析响应
```

## 常见错误对照表

| 错误信息 | 可能原因 | 解决方法 |
|---------|---------|---------|
| Bad request | requestBody 格式错误 | 使用 debug 节点检查格式 |
| Bad request | 使用了 bodyParameters | 改为 jsonBody 或 raw body |
| Unauthorized | AWS 认证失败 | 检查凭证和 Region |
| Invalid request | QueryExecutionIds 不是数组 | 确保是数组格式 |
| Missing parameter | 缺少 QueryExecutionIds | 检查上游数据 |





