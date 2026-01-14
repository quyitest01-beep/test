# n8n 集成 Athena 查询系统 - 完整方案

## 📋 方案概述

通过提供 Webhook API，使得 n8n 能够直接调用本系统查询 Athena 数据库，无需在 n8n 中配置 AWS SDK。

## ✨ 方案优势

1. **简单易用**：只需配置 HTTP Request 节点，无需复杂的 AWS 配置
2. **安全可控**：通过 API Key 认证，集中管理访问权限
3. **功能丰富**：支持 SQL 查询和自然语言查询两种模式
4. **灵活集成**：可与任何支持 HTTP 的工具集成（不仅限于 n8n）

## 🎯 实现内容

### 1. API 认证中间件
**文件**: `backend/middleware/apiKeyAuth.js`

- 支持 Header 和 Query Parameter 两种方式传递 API Key
- 支持多密钥配置（逗号分隔）
- 完整的日志记录和错误处理

### 2. Webhook API 路由
**文件**: `backend/routes/webhook.js`

提供 4 个主要接口：

#### a) SQL 查询接口
```
POST /api/webhook/query/sql
```
- 直接执行 SQL 查询
- 支持自定义数据库、超时时间、返回行数
- 适合已知 SQL 的场景

#### b) 自然语言查询接口
```
POST /api/webhook/query/natural
```
- 使用自然语言描述查询需求
- 自动生成并执行 SQL
- 返回生成的 SQL 供参考

#### c) 快速查询接口
```
GET /api/webhook/query/quick
```
- 简单的 GET 请求方式
- 通过 URL 参数传递查询
- 适合简单快速的查询场景

#### d) 健康检查
```
GET /api/webhook/health
```
- 检查服务状态
- 无需数据库连接
- 适合监控和测试

### 3. 测试工具

#### a) 自动化测试脚本
**文件**: `backend/test-webhook-api.js`

运行方式：
```bash
cd backend
npm run test:webhook
```

功能：
- 7 个完整的测试用例
- 彩色输出，直观易读
- 自动生成 curl 命令示例
- 测试结果汇总

#### b) Postman 测试集合
**文件**: `Athena-Webhook-API.postman_collection.json`

包含：
- 9 个预配置的请求示例
- 环境变量配置
- 认证测试用例
- 一键导入使用

### 4. 文档

#### a) 快速开始指南
**文件**: `QUICK_START.md`

内容：
- 5 分钟快速配置步骤
- 常见问题解答
- API 端点速查表
- curl 命令示例

#### b) 完整集成指南
**文件**: `N8N_INTEGRATION_GUIDE.md`

内容：
- 详细的 API 接口说明
- n8n 配置示例（5 个场景）
- 安全最佳实践
- 性能优化建议
- 故障排除指南

#### c) n8n 工作流示例
**文件**: `n8n-workflow-examples.json`

包含：
- 定时查询并发送报告
- 自然语言查询集成
- 可直接导入 n8n 使用

## 🚀 使用步骤

### 第 1 步：生成 API 密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

输出示例：
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 第 2 步：配置环境变量

编辑 `backend/.env`：

```bash
# 添加这一行（使用你生成的密钥）
API_KEYS=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# 如果需要多个密钥，用逗号分隔
# API_KEYS=key1,key2,key3
```

### 第 3 步：重启后端服务

```bash
cd backend
npm start
```

### 第 4 步：测试 API

```bash
cd backend
npm run test:webhook
```

或使用 curl：

```bash
curl -H "X-API-Key: 你的密钥" \
  http://localhost:8000/api/webhook/health
```

### 第 5 步：在 n8n 中配置

1. **创建凭证**（Credentials）
   - 类型：Header Auth
   - Header Name: `X-API-Key`
   - Header Value: 你的 API 密钥

2. **添加 HTTP Request 节点**
   - Method: `POST`
   - URL: `http://your-server:8000/api/webhook/query/sql`
   - Authentication: 选择上面创建的凭证
   - Body:
     ```json
     {
       "sql": "SELECT * FROM users LIMIT 10",
       "maxRows": 100
     }
     ```

3. **执行测试**
   - 点击 "Execute Node" 测试
   - 查看返回结果

## 📊 API 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "rows": [...],           // 数据行
    "columns": [...],        // 列信息
    "rowCount": 10,          // 返回行数
    "totalRows": 100,        // 总行数
    "executionTime": 1234,   // 执行时间（毫秒）
    "dataScanned": 15,       // 扫描数据量（MB）
    "cost": 0.001           // 查询成本（美元）
  },
  "meta": {
    "queryId": "abc-123",    // 查询ID
    "requestId": "req_456",  // 请求ID
    "timestamp": "..."       // 时间戳
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "Query execution failed",
  "message": "详细错误信息",
  "meta": {
    "requestId": "req_456",
    "timestamp": "..."
  }
}
```

## 🔒 安全建议

1. **API 密钥管理**
   - 使用强随机密钥（至少 32 字节）
   - 定期轮换密钥
   - 不同环境使用不同密钥
   - 使用 n8n 的 Credentials 功能存储密钥

2. **网络安全**
   - 生产环境使用 HTTPS
   - 配置 IP 白名单
   - 使用防火墙限制访问

3. **查询限制**
   - 始终设置 `maxRows` 限制
   - 设置合理的 `timeout`
   - 监控查询成本

## 📈 常见使用场景

### 场景 1：定时数据报告
```yaml
触发器: Schedule (每天 9:00)
↓
HTTP Request (查询昨日数据)
↓
Function (处理结果)
↓
Email/Slack (发送通知)
```

### 场景 2：实时数据监控
```yaml
触发器: Schedule (每 5 分钟)
↓
HTTP Request (查询当前状态)
↓
IF (检查异常)
↓
PagerDuty/SMS (发送告警)
```

### 场景 3：数据导出同步
```yaml
触发器: Webhook
↓
HTTP Request (查询数据)
↓
Function (转换格式)
↓
Google Sheets/Airtable (写入数据)
```

### 场景 4：飞书机器人集成
```yaml
触发器: Lark Webhook
↓
Function (提取查询文本)
↓
HTTP Request (自然语言查询)
↓
Function (格式化结果)
↓
Lark (回复消息)
```

## 🛠️ 故障排除

### 问题 1: 401 Unauthorized
**原因**: 未提供 API 密钥
**解决**: 在 Header 中添加 `X-API-Key`

### 问题 2: 403 Forbidden
**原因**: API 密钥无效
**解决**:
1. 检查 `.env` 文件中的 `API_KEYS`
2. 确认没有多余的空格
3. 重启后端服务

### 问题 3: Connection Refused
**原因**: 后端服务未运行
**解决**:
```bash
cd backend
npm start
```

### 问题 4: Query Timeout
**原因**: 查询时间过长
**解决**:
1. 增加 `timeout` 参数
2. 优化 SQL 查询
3. 添加 `LIMIT` 限制

## 📚 相关文件

```
项目根目录/
├── backend/
│   ├── middleware/
│   │   └── apiKeyAuth.js              # API 认证中间件
│   ├── routes/
│   │   └── webhook.js                 # Webhook API 路由
│   └── test-webhook-api.js            # 测试脚本
├── QUICK_START.md                     # 快速开始指南
├── N8N_INTEGRATION_GUIDE.md           # 完整集成文档
├── N8N_SETUP_SUMMARY.md               # 本文档
├── n8n-workflow-examples.json         # n8n 工作流示例
└── Athena-Webhook-API.postman_collection.json  # Postman 集合
```

## 🎉 总结

现在你已经拥有：

✅ **完整的 Webhook API**
- SQL 查询接口
- 自然语言查询接口
- 快速查询接口

✅ **安全认证机制**
- API Key 认证
- 多密钥支持
- 完整的日志记录

✅ **丰富的文档**
- 快速开始指南
- 完整集成文档
- API 参考文档

✅ **测试工具**
- 自动化测试脚本
- Postman 测试集合
- n8n 工作流示例

✅ **最佳实践**
- 安全建议
- 性能优化
- 故障排除

## 🚀 下一步

1. **立即测试**
   ```bash
   cd backend
   npm run test:webhook
   ```

2. **查看示例**
   - 导入 `Athena-Webhook-API.postman_collection.json` 到 Postman
   - 导入 `n8n-workflow-examples.json` 到 n8n

3. **开始使用**
   - 根据 `QUICK_START.md` 进行配置
   - 参考 `N8N_INTEGRATION_GUIDE.md` 了解更多

4. **扩展功能**
   - 添加更多自定义接口
   - 集成更多第三方服务
   - 优化查询性能

---

**需要帮助？** 
- 📖 查看完整文档：`N8N_INTEGRATION_GUIDE.md`
- 🐛 查看错误日志：`backend/logs/combined.log`
- 💬 提交 Issue 或联系技术支持

**祝你使用愉快！** 🎊

