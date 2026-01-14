# n8n 集成指南 - Athena 查询系统

本指南介绍如何在 n8n 中集成 Athena 查询系统，实现自动化数据查询工作流。

## 目录

1. [快速开始](#快速开始)
2. [API 认证](#api-认证)
3. [API 接口说明](#api-接口说明)
4. [n8n 配置示例](#n8n-配置示例)
5. [常见用例](#常见用例)
6. [故障排除](#故障排除)

---

## 快速开始

### 1. 生成 API 密钥

在服务器上生成一个安全的 API 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 配置环境变量

在 `backend/.env` 文件中添加：

```bash
API_KEYS=your-generated-api-key-here
```

如果需要多个密钥（例如不同的服务或团队），用逗号分隔：

```bash
API_KEYS=key1,key2,key3
```

### 3. 重启后端服务

```bash
cd backend
npm start
```

---

## API 认证

所有 webhook API 需要进行身份验证。有两种方式提供 API 密钥：

### 方式 1: HTTP Header（推荐）

```
X-API-Key: your-api-key-here
```

### 方式 2: Query Parameter

```
?apiKey=your-api-key-here
```

---

## API 接口说明

### 1. SQL 查询接口

**端点**: `POST /api/webhook/query/sql`

**请求示例**:

```json
{
  "sql": "SELECT user_id, name, created_at FROM users WHERE status = 'active' LIMIT 100",
  "database": "production_db",
  "timeout": 60000,
  "maxRows": 1000
}
```

**参数说明**:

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| sql | string | 是 | - | SQL 查询语句 |
| database | string | 否 | 环境变量 | 数据库名称 |
| timeout | number | 否 | 60000 | 超时时间（毫秒） |
| maxRows | number | 否 | 1000 | 最大返回行数 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "user_id": "123",
        "name": "张三",
        "created_at": "2025-01-01"
      }
    ],
    "columns": [
      {"name": "user_id", "type": "varchar"},
      {"name": "name", "type": "varchar"},
      {"name": "created_at", "type": "date"}
    ],
    "rowCount": 1,
    "totalRows": 1,
    "executionTime": 2350,
    "dataScanned": 15,
    "cost": 0.001
  },
  "meta": {
    "queryId": "abc-123-def",
    "requestId": "req_123",
    "timestamp": "2025-10-10T10:00:00.000Z"
  }
}
```

---

### 2. 自然语言查询接口

**端点**: `POST /api/webhook/query/natural`

**请求示例**:

```json
{
  "query": "查询最近7天的活跃用户数",
  "timeout": 120000,
  "maxRows": 1000
}
```

**参数说明**:

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | 是 | - | 自然语言查询 |
| timeout | number | 否 | 120000 | 超时时间（毫秒） |
| maxRows | number | 否 | 1000 | 最大返回行数 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "rows": [
      {"active_users": 1523}
    ],
    "columns": [
      {"name": "active_users", "type": "integer"}
    ],
    "rowCount": 1,
    "generatedSQL": "SELECT COUNT(DISTINCT user_id) as active_users FROM user_activity WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
  },
  "meta": {
    "requestId": "req_456",
    "timestamp": "2025-10-10T10:00:00.000Z",
    "intent": "count_active_users"
  }
}
```

---

### 3. 快速查询接口

**端点**: `GET /api/webhook/query/quick`

适合简单查询，直接通过 URL 参数传递。

**请求示例**:

```
GET /api/webhook/query/quick?sql=SELECT%20*%20FROM%20users%20LIMIT%2010&apiKey=your-api-key
```

**参数说明**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| sql | string | 是 | SQL 查询语句（URL编码） |
| database | string | 否 | 数据库名称 |
| apiKey | string | 是* | API密钥（如果没用Header） |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "rows": [...],
    "rowCount": 10
  }
}
```

---

## n8n 配置示例

### 示例 1: 定时查询并发送报告

创建一个每天上午 9 点查询昨日数据的工作流：

#### 步骤 1: Schedule Trigger

```
Cron Expression: 0 9 * * *
```

#### 步骤 2: HTTP Request - 查询数据

```yaml
Method: POST
URL: http://your-server:8000/api/webhook/query/sql
Authentication: None
Headers:
  - Name: X-API-Key
    Value: your-api-key-here
  - Name: Content-Type
    Value: application/json
Body:
  {
    "sql": "SELECT COUNT(*) as total_orders, SUM(amount) as total_revenue FROM orders WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
    "database": "production_db"
  }
```

#### 步骤 3: 处理数据

使用 **Function** 或 **Set** 节点处理返回的数据：

```javascript
// Function 节点代码
const response = $input.item.json;

if (response.success) {
  const data = response.data.rows[0];
  return {
    json: {
      date: new Date().toISOString().split('T')[0],
      totalOrders: data.total_orders,
      totalRevenue: data.total_revenue
    }
  };
}
```

#### 步骤 4: 发送通知

使用 **Email**、**Slack**、**Telegram** 等节点发送结果。

---

### 示例 2: 自然语言查询（飞书机器人）

#### 步骤 1: Webhook Trigger

接收飞书消息。

#### 步骤 2: 提取查询内容

从飞书消息中提取用户的查询文本。

#### 步骤 3: HTTP Request - 自然语言查询

```yaml
Method: POST
URL: http://your-server:8000/api/webhook/query/natural
Headers:
  - Name: X-API-Key
    Value: your-api-key-here
  - Name: Content-Type
    Value: application/json
Body:
  {
    "query": "{{ $json.text }}",
    "maxRows": 50
  }
```

#### 步骤 4: 格式化结果

```javascript
// Function 节点
const response = $input.item.json;

if (response.success) {
  const { rows, rowCount, generatedSQL } = response.data;
  
  // 格式化为表格
  let message = `查询结果（共 ${rowCount} 条）：\n\n`;
  
  rows.slice(0, 10).forEach((row, index) => {
    message += `${index + 1}. ${JSON.stringify(row)}\n`;
  });
  
  message += `\n生成的SQL: ${generatedSQL}`;
  
  return {
    json: {
      message: message
    }
  };
}
```

#### 步骤 5: 回复飞书

发送格式化的结果回飞书。

---

### 示例 3: 数据同步到 Google Sheets

#### 步骤 1: Schedule Trigger

每小时运行一次。

#### 步骤 2: HTTP Request - 查询数据

```yaml
Method: POST
URL: http://your-server:8000/api/webhook/query/sql
Headers:
  - Name: X-API-Key
    Value: your-api-key-here
Body:
  {
    "sql": "SELECT * FROM daily_metrics WHERE date = CURDATE()",
    "maxRows": 5000
  }
```

#### 步骤 3: Google Sheets - Clear Sheet

清除现有数据。

#### 步骤 4: Google Sheets - Append Rows

将查询结果追加到表格。

```javascript
// 在 Function 节点中转换数据格式
const response = $input.item.json;
const rows = response.data.rows;

// 转换为 Google Sheets 格式
return rows.map(row => ({ json: row }));
```

---

### 示例 4: API 集成（Webhook 触发）

当外部系统需要查询数据时：

#### 步骤 1: Webhook Trigger

```
Method: POST
Path: /athena-query
```

#### 步骤 2: HTTP Request

```yaml
Method: POST
URL: http://your-server:8000/api/webhook/query/sql
Headers:
  - Name: X-API-Key
    Value: your-api-key-here
Body:
  {
    "sql": "{{ $json.sql }}",
    "database": "{{ $json.database || 'default_db' }}"
  }
```

#### 步骤 3: Respond to Webhook

返回查询结果给调用方。

---

## 常见用例

### 1. 每日数据报告

- **触发器**: Schedule Trigger (每天 9:00)
- **查询**: 昨日的关键业务指标
- **输出**: Email / Slack / 钉钉

### 2. 实时数据监控

- **触发器**: Schedule Trigger (每5分钟)
- **查询**: 当前系统状态
- **条件**: 如果异常则发送告警
- **输出**: PagerDuty / SMS / 电话

### 3. 数据导出

- **触发器**: 手动触发 / Webhook
- **查询**: 大量历史数据
- **处理**: 转换为 CSV
- **输出**: 上传到 S3 / Google Drive

### 4. 跨系统数据同步

- **触发器**: Schedule Trigger
- **查询**: 从 Athena 获取数据
- **输出**: 写入到 MySQL / PostgreSQL / Airtable

### 5. 自动化报表生成

- **触发器**: 每周一上午
- **查询**: 上周的完整数据
- **处理**: 生成图表和统计
- **输出**: PDF 报告发送给管理层

---

## 高级配置

### 1. 错误处理

在 n8n 中添加错误处理节点：

```javascript
// Error Trigger 节点
const error = $input.item.json;

return {
  json: {
    error: true,
    message: error.message,
    timestamp: new Date().toISOString(),
    workflow: $workflow.name
  }
};
```

### 2. 重试机制

在 HTTP Request 节点中配置：

```yaml
Retry On Fail: true
Max Tries: 3
Wait Between Tries: 10000
```

### 3. 结果缓存

使用 n8n 的 **Redis** 节点缓存频繁查询的结果：

```javascript
// 检查缓存
const cacheKey = `query:${hash(sql)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// 执行查询...
// 存储到缓存
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

---

## 安全最佳实践

### 1. API 密钥管理

- ✅ 使用强随机密钥（至少 32 字节）
- ✅ 定期轮换密钥
- ✅ 不同环境使用不同密钥
- ✅ 不要在代码或日志中暴露密钥
- ✅ 使用 n8n 的 Credentials 功能存储密钥

### 2. 网络安全

- ✅ 使用 HTTPS（生产环境必需）
- ✅ 限制 IP 白名单（如果可能）
- ✅ 使用 VPN 或私有网络
- ✅ 配置防火墙规则

### 3. 查询限制

- ✅ 始终使用 `maxRows` 限制返回数据
- ✅ 设置合理的 `timeout`
- ✅ 避免 `SELECT *`
- ✅ 使用索引和优化的查询

---

## 故障排除

### 问题 1: 401 Authentication required

**原因**: 未提供 API 密钥

**解决方案**:
```yaml
Headers:
  - Name: X-API-Key
    Value: your-actual-api-key
```

### 问题 2: 403 Invalid API key

**原因**: API 密钥不正确或未配置

**解决方案**:
1. 检查 `.env` 文件中的 `API_KEYS`
2. 确认密钥没有多余的空格或换行
3. 重启后端服务

### 问题 3: 500 Query execution failed

**原因**: SQL 语法错误或数据库连接问题

**解决方案**:
1. 检查 SQL 语法
2. 确认数据库名称正确
3. 查看后端日志：`backend/logs/error.log`

### 问题 4: Timeout

**原因**: 查询执行时间过长

**解决方案**:
1. 增加 `timeout` 参数
2. 优化 SQL 查询（添加索引、减少扫描范围）
3. 使用 `LIMIT` 限制结果集

### 问题 5: 连接被拒绝

**原因**: 后端服务未运行或端口不正确

**解决方案**:
```bash
# 检查服务状态
pm2 list

# 重启服务
cd backend && npm start
```

---

## 性能优化建议

### 1. 查询优化

```sql
-- ❌ 避免
SELECT * FROM large_table;

-- ✅ 推荐
SELECT id, name, created_at 
FROM large_table 
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
LIMIT 1000;
```

### 2. 批量处理

对于大量数据，使用分页查询：

```javascript
// n8n Function 节点
const pageSize = 1000;
const totalPages = 10;

const results = [];

for (let page = 0; page < totalPages; page++) {
  const offset = page * pageSize;
  const sql = `SELECT * FROM table LIMIT ${pageSize} OFFSET ${offset}`;
  
  // 调用 API...
  results.push(...response.data.rows);
}

return results;
```

### 3. 并行查询

使用 n8n 的 **Split In Batches** 节点并行执行多个查询。

---

## 测试 API

使用 `curl` 测试：

```bash
# SQL 查询
curl -X POST http://localhost:8000/api/webhook/query/sql \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM users LIMIT 5",
    "database": "test_db"
  }'

# 自然语言查询
curl -X POST http://localhost:8000/api/webhook/query/natural \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询今天的订单数量"
  }'

# 快速查询
curl "http://localhost:8000/api/webhook/query/quick?sql=SELECT%20COUNT(*)%20FROM%20users&apiKey=your-api-key"
```

---

## 联系支持

如有问题，请查看：
- 后端日志: `backend/logs/combined.log`
- n8n 执行日志
- GitHub Issues

---

## 更新日志

- **2025-10-10**: 初始版本，支持 SQL 和自然语言查询
- 更多功能开发中...

---

**祝你使用愉快！** 🚀







