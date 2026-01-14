# n8n 取消 Athena 查询解决方案

## 🚨 问题

在 n8n 的 Code 节点中使用 AWS SDK 时出现错误：
```
Cannot find module '@aws-sdk/client-athena' [line 1]
```

## ✅ 解决方案

**不要在 n8n Code 节点中直接使用 AWS SDK**，而是通过后端 API 来取消查询。

## 🎯 方案 1: 使用 Code 节点 + fetch（推荐）

### 步骤 1: 准备输入数据

在 Code 节点的 INPUT 中，确保包含以下字段：

```json
{
  "QueryExecutionId": "e6cc8574-bd83-403c-8234-be64a3e5b19f",
  "API_BASE_URL": "http://localhost:8000",
  "API_KEY": "your-api-key-here"
}
```

### 步骤 2: 使用提供的代码

将 `n8n-workflows/cancel-query-without-sdk.js` 中的代码复制到 Code 节点中。

### 步骤 3: 配置 API 地址

根据你的实际情况修改：
- **本地开发**: `http://localhost:8000`
- **远程服务器**: `http://your-server-ip:8000`
- **Cloudflare Tunnel**: `https://your-tunnel-url.com`

### 步骤 4: 配置 API Key

确保在输入数据中提供 API Key，或者在代码中直接设置：

```javascript
const apiKey = 'your-api-key-here'; // 从 backend/.env 获取
```

## 🎯 方案 2: 使用 HTTP Request 节点（更简单）

### 步骤 1: 添加 HTTP Request 节点

1. 在 n8n 工作流中添加 **HTTP Request** 节点
2. 配置如下：

**基本设置**:
- **Method**: `POST`
- **URL**: `http://localhost:8000/api/query/cancel/{{ $json.QueryExecutionId }}`
  > 替换 `localhost:8000` 为你的实际服务器地址

**认证设置**:
- **Authentication**: `Header Auth`
- **Name**: `X-API-Key`
- **Value**: 你的 API 密钥（从 `backend/.env` 获取）

**Headers**:
- `Content-Type`: `application/json`

### 步骤 2: 连接节点

```
[输入节点] → [HTTP Request] → [输出节点]
```

## 📋 API 接口说明

### 取消查询接口

**端点**: `POST /api/query/cancel/:queryId`

**路径参数**:
- `queryId` (必需): Athena 查询执行 ID

**请求头**:
```
X-API-Key: your-api-key-here
Content-Type: application/json
```

**响应示例（成功）**:
```json
{
  "success": true,
  "message": "Query cancelled successfully",
  "requestId": "xxx"
}
```

**响应示例（失败）**:
```json
{
  "success": false,
  "message": "Query ID is required",
  "requestId": "xxx"
}
```

## 🔧 完整工作流示例

### 使用 Code 节点

```
[Start] → [Code: 取消查询] → [处理结果]
```

**Code 节点代码**: 见 `n8n-workflows/cancel-query-without-sdk.js`

### 使用 HTTP Request 节点

```
[Start] → [HTTP Request: 取消查询] → [处理结果]
```

**HTTP Request 配置**:
- URL: `http://localhost:8000/api/query/cancel/{{ $json.QueryExecutionId }}`
- Method: `POST`
- Auth: Header Auth with `X-API-Key`

## 🚀 快速测试

### 测试 1: 使用 curl

```bash
curl -X POST http://localhost:8000/api/query/cancel/e6cc8574-bd83-403c-8234-be64a3e5b19f \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json"
```

### 测试 2: 在 n8n 中测试

1. 确保后端服务运行中
2. 在 Code 节点或 HTTP Request 节点中执行
3. 检查输出结果

## ⚠️ 注意事项

1. **后端服务必须运行**
   ```bash
   cd backend
   node server.js
   ```

2. **API Key 必须正确**
   - 检查 `backend/.env` 中的 `API_KEYS` 配置
   - 确保请求头中包含正确的 `X-API-Key`

3. **查询 ID 格式**
   - 必须是有效的 UUID 格式
   - 例如: `e6cc8574-bd83-403c-8234-be64a3e5b19f`

4. **网络连接**
   - 确保 n8n 可以访问后端服务
   - 检查防火墙设置

## 🔍 故障排查

### 错误: "Cannot find module '@aws-sdk/client-athena'"

**原因**: n8n 环境不支持 AWS SDK

**解决**: 使用本文档提供的方案，通过后端 API 调用

### 错误: "连接失败" 或 "ECONNREFUSED"

**原因**: 后端服务未运行

**解决**:
```bash
cd backend
node server.js
```

### 错误: "401 Unauthorized"

**原因**: API Key 错误或缺失

**解决**:
1. 检查 `backend/.env` 中的 `API_KEYS`
2. 确保请求头中包含 `X-API-Key`
3. 验证 API Key 值是否正确

### 错误: "404 Not Found"

**原因**: 查询 ID 不存在或已过期

**解决**: 检查查询 ID 是否正确，或查询是否已完成

## 📚 相关文档

- [API 密钥配置指南](./API_KEY_GUIDE.md)
- [n8n AWS SDK 问题解决方案](./N8N_AWS_SDK_SOLUTION.md)
- [后端 API 文档](./API_使用说明.md)

## 🎉 总结

**最佳实践**:
1. ✅ 使用 HTTP Request 节点（最简单）
2. ✅ 或使用 Code 节点 + fetch（更灵活）
3. ❌ 不要在 Code 节点中使用 AWS SDK

这样可以完全避免 AWS SDK 依赖问题，同时保持功能完整！




