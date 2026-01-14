# 快速开始 - n8n 集成 Athena 查询

## 5 分钟快速配置指南

### 第一步：生成 API 密钥

在服务器上运行以下命令生成一个安全的 API 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

输出示例：
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### 第二步：配置后端

1. 进入后端目录：
```bash
cd backend
```

2. 编辑 `.env` 文件（如果不存在则创建）：
```bash
# 添加或修改这一行，使用你刚才生成的密钥
API_KEYS=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# 如果需要多个密钥（例如不同的服务），用逗号分隔
# API_KEYS=key1,key2,key3
```

3. 重启后端服务：
```bash
npm start
# 或者如果使用 PM2
pm2 restart backend
```

### 第三步：测试 API

#### 方法 1: 使用测试脚本

```bash
cd backend
API_KEY=你的API密钥 node test-webhook-api.js
```

#### 方法 2: 使用 curl

```bash
# 健康检查
curl -H "X-API-Key: 你的API密钥" \
  http://localhost:8000/api/webhook/health

# SQL 查询
curl -X POST http://localhost:8000/api/webhook/query/sql \
  -H "X-API-Key: 你的API密钥" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT 1 as test, NOW() as current_time",
    "maxRows": 10
  }'
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "rows": [...],
    "rowCount": 1,
    "executionTime": 1234
  }
}
```

### 第四步：在 n8n 中配置

#### 1. 创建凭证

在 n8n 中：
1. 点击右上角的用户图标 → **Settings** → **Credentials**
2. 点击 **+ New Credential**
3. 选择 **Header Auth**
4. 配置：
   - **Name**: Athena API Key
   - **Header Name**: X-API-Key
   - **Header Value**: 你的API密钥
5. 保存

#### 2. 创建第一个工作流

##### 示例：每天早上查询昨日数据

1. **添加 Schedule Trigger 节点**
   - Cron Expression: `0 9 * * *` (每天上午9点)

2. **添加 HTTP Request 节点**
   - Method: `POST`
   - URL: `http://your-server:8000/api/webhook/query/sql`
   - Authentication: 选择刚才创建的 "Athena API Key"
   - Body Content Type: `JSON`
   - JSON Body:
     ```json
     {
       "sql": "SELECT COUNT(*) as daily_orders FROM orders WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
       "database": "production_db",
       "maxRows": 100
     }
     ```

3. **添加 Code 节点处理结果**
   ```javascript
   const response = $input.item.json;
   
   if (response.success) {
     const orders = response.data.rows[0].daily_orders;
     return {
       json: {
         message: `昨日订单数: ${orders}`,
         date: new Date().toISOString().split('T')[0]
       }
     };
   }
   ```

4. **添加通知节点**（Slack / Email / Telegram 等）

5. **保存并激活工作流**

### 第五步：验证运行

1. 在 n8n 中点击 "Execute Workflow" 测试
2. 检查每个节点的输出
3. 确认最终通知发送成功

---

## 常见问题

### Q: 返回 401 Unauthorized
**A**: 检查 API 密钥是否正确配置在 Header 中

### Q: 返回 403 Forbidden
**A**: API 密钥无效，检查：
- `.env` 文件中的 `API_KEYS` 是否正确
- 后端服务是否已重启
- 密钥是否有多余的空格或换行

### Q: 连接被拒绝
**A**: 
- 确认后端服务正在运行：`curl http://localhost:8000/api/health`
- 检查端口是否正确
- 检查防火墙设置

### Q: SQL 查询超时
**A**: 
- 增加 `timeout` 参数（默认 60秒）
- 优化 SQL 查询
- 使用 `LIMIT` 限制结果集

---

## 下一步

- 📖 查看完整文档：[N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)
- 📋 导入示例工作流：[n8n-workflow-examples.json](./n8n-workflow-examples.json)
- 🧪 运行完整测试：`cd backend && node test-webhook-api.js`

---

## API 端点速查

| 端点 | 方法 | 用途 | 响应时间 |
|------|------|------|----------|
| `/api/webhook/query/sql` | POST | SQL查询 | < 60s |
| `/api/webhook/query/natural` | POST | 自然语言 | < 120s |
| `/api/webhook/query/quick` | GET | 快速查询 | < 30s |
| `/api/webhook/health` | GET | 健康检查 | < 1s |

---

**需要帮助？** 查看后端日志：`backend/logs/combined.log`








