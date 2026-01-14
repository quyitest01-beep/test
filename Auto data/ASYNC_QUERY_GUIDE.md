# 🚀 异步查询系统使用指南

## 📋 概述

异步查询系统实现了你要求的查询流程：
**收到查询请求 → 执行查询 → 查询成功 → 输出结果；查询失败 → 继续执行查询 → 查询超过5分钟，告知查询超时**

## 🎯 核心特性

### ✅ **智能查询流程**
- **立即响应**：收到请求后立即返回查询ID
- **后台执行**：查询在后台异步执行
- **状态跟踪**：实时监控查询进度
- **自动重试**：失败后自动重试（最多3次）
- **超时保护**：5分钟超时保护

### ✅ **查询状态**
- `pending` - 查询已启动，准备执行
- `running` - 查询正在执行中
- `retrying` - 查询失败，正在重试
- `completed` - 查询执行成功
- `failed` - 查询执行失败
- `timeout` - 查询超时（5分钟）
- `cancelled` - 查询被取消

## 🔧 API 接口

### 1. 启动异步查询

```http
POST /api/async/start
Content-Type: application/json
X-API-Key: your-api-key

{
  "sql": "SELECT * FROM game_records WHERE id = '123'",
  "database": "gmp",
  "maxRetries": 3
}
```

**响应：**
```json
{
  "success": true,
  "queryId": "uuid-query-id",
  "status": "pending",
  "message": "查询已启动，正在执行中...",
  "estimatedTime": "2-5分钟"
}
```

### 2. 查询状态

```http
GET /api/async/status/{queryId}
X-API-Key: your-api-key
```

**响应：**
```json
{
  "success": true,
  "queryId": "uuid-query-id",
  "status": "completed",
  "elapsed": 125,
  "progress": 100,
  "message": "查询执行成功！",
  "result": {
    "rows": [...],
    "columns": [...],
    "rowCount": 3,
    "executionTime": 125000
  }
}
```

### 3. 取消查询

```http
POST /api/async/cancel/{queryId}
X-API-Key: your-api-key
```

## 🎮 n8n 工作流使用

### 1. 导入工作流

1. 在 n8n 中点击 "Import from file"
2. 选择 `n8n-workflows/async-intelligent-query.json`
3. 配置 Cloudflare Tunnel URL（如果不同）

### 2. 触发查询

**发送 POST 请求到 Webhook：**
```json
{
  "sql": "SELECT id, uid, merchant_id, game_id, game_code, result, currency, ROUND(CAST(amount AS DOUBLE), 2) AS amount, ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, multiplier, balance, detail, DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at FROM game_records WHERE provider = 'gp' AND merchant = '1737978166' AND id in ('1976423513265401856','1976422629802373120','1976437176340557824') AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000 AND TO_UNIXTIME(PARSE_DATETIME('2025-10-30 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000"
}
```

### 3. 工作流执行流程

1. **Webhook触发** - 接收查询请求
2. **启动异步查询** - 发送到后端启动查询
3. **检查启动状态** - 验证查询是否成功启动
4. **轮询查询状态** - 每10秒检查一次状态
5. **处理结果** - 根据状态处理结果
6. **返回响应** - 返回最终结果

## 📊 优势对比

### 传统同步查询
- ❌ 容易超时（60秒限制）
- ❌ 阻塞式等待
- ❌ 网络不稳定时失败率高
- ❌ 用户体验差

### 异步查询系统
- ✅ 支持长时间查询（5分钟）
- ✅ 非阻塞式执行
- ✅ 自动重试机制
- ✅ 实时状态反馈
- ✅ 优雅的错误处理

## 🚀 快速开始

### 1. 启动后端服务

```bash
cd backend
node server.js
```

### 2. 测试异步查询

```bash
# 启动查询
curl -X POST http://localhost:8000/api/async/start \
  -H "Content-Type: application/json" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d" \
  -d '{"sql": "SELECT 1 as test"}'

# 检查状态（替换 queryId）
curl -X GET http://localhost:8000/api/async/status/your-query-id \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
```

### 3. 在 n8n 中使用

1. 导入异步查询工作流
2. 激活工作流
3. 发送 POST 请求到 Webhook URL
4. 等待查询完成

## 📈 监控和日志

### 查询状态监控
- 实时进度跟踪
- 执行时间统计
- 重试次数记录
- 错误日志记录

### 系统清理
- 自动清理过期查询（30分钟）
- 内存使用优化
- 查询结果缓存

## 🔧 配置选项

### 环境变量
```bash
# 查询超时时间（毫秒）
MAX_QUERY_TIMEOUT=300000  # 5分钟

# 重试间隔（毫秒）
RETRY_INTERVAL=10000      # 10秒

# 最大重试次数
MAX_RETRIES=3

# 清理间隔（毫秒）
CLEANUP_INTERVAL=600000   # 10分钟
```

## 🎯 使用场景

### 1. 大数据查询
- 复杂的 JOIN 查询
- 大量数据扫描
- 聚合计算查询

### 2. 定时报告
- 每日/每周数据报告
- 游戏评级报告
- 用户行为分析

### 3. 实时监控
- 系统状态检查
- 数据质量验证
- 性能监控

## 🚨 注意事项

### 1. JSON 格式
- SQL 查询必须在一行内
- 不能包含换行符
- 正确转义特殊字符

### 2. 查询优化
- 使用分区查询
- 添加适当的索引
- 限制返回行数

### 3. 错误处理
- 监控查询失败率
- 设置合理的重试次数
- 记录详细的错误日志

---

## 🎉 总结

异步查询系统完美解决了你的需求：
- ✅ **立即响应**：不会因为长时间查询而超时
- ✅ **智能重试**：自动处理临时失败
- ✅ **超时保护**：5分钟超时保护
- ✅ **状态跟踪**：实时了解查询进度
- ✅ **优雅降级**：失败时提供详细错误信息

现在你可以放心执行复杂的 Athena 查询了！🚀












