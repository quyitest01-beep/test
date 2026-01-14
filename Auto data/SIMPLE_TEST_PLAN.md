# 🎯 简化测试方案 - 暂时不用 Webhook

## 📋 当前问题

1. **后端服务启动失败**
2. **n8n Webhook 连接失败**
3. **Cloudflare 隧道 URL 无法访问**

## 🚀 简化方案：直接测试后端 API

### 方案一：本地测试（推荐）

#### 1. 启动后端服务
```bash
# 在 backend 目录
cd backend
node server.js
```

#### 2. 直接测试 API
```bash
# 测试健康检查
curl -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d" \
  http://localhost:8000/api/webhook/health

# 测试查询 API
curl -X POST http://localhost:8000/api/webhook/query/natural \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d" \
  -H "Content-Type: application/json" \
  -d '{"query": "查询game_records表的前5条记录", "maxRows": 5}'
```

### 方案二：修改 n8n 工作流 URL

如果你想让 n8n 工作，需要修改 URL：

#### 在 n8n 中修改：
1. 打开 "调用查询API" 节点
2. 将 URL 从：
   ```
   https://stroke-geo-bee-bless.trycloudflare.com/api/webhook/query/natural
   ```
   改为：
   ```
   http://localhost:8000/api/webhook/query/natural
   ```

**注意**：这要求 n8n 和你的后端在同一台机器上运行。

### 方案三：使用 Postman 测试

如果命令行有问题，可以用 Postman：

1. **健康检查请求**：
   - Method: `GET`
   - URL: `http://localhost:8000/api/webhook/health`
   - Headers: `X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`

2. **查询请求**：
   - Method: `POST`
   - URL: `http://localhost:8000/api/webhook/query/natural`
   - Headers: 
     - `X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "query": "查询game_records表的前5条记录",
       "maxRows": 5
     }
     ```

## 🎯 测试步骤

### 第一步：确认后端启动
```bash
# 检查端口是否被占用
netstat -an | findstr :8000
```

### 第二步：测试基础连接
```bash
# 简单测试
curl http://localhost:8000/api/webhook/health
```

### 第三步：测试带认证的请求
```bash
# 使用 PowerShell 语法
Invoke-RestMethod -Uri "http://localhost:8000/api/webhook/health" -Headers @{"X-API-Key"="f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"}
```

## 🔧 Webhook 的作用说明

**Webhook 在这里的作用**：
1. **接收外部请求** - 用户或系统发送查询请求
2. **触发工作流** - 自动启动 n8n 工作流
3. **处理查询** - 调用后端 API 查询 Athena
4. **返回结果** - 将结果返回给请求者

**暂时不用的影响**：
- ✅ 可以直接测试后端 API 功能
- ✅ 可以验证 Athena 连接
- ❌ 无法实现自动化工作流
- ❌ 无法集成到 n8n 系统

## 🎉 成功标志

如果后端工作正常，你应该看到：
```json
{
  "status": "ok",
  "message": "Webhook API is healthy"
}
```

如果查询工作正常，你应该看到：
```json
{
  "success": true,
  "data": {
    "generatedSQL": "SELECT * FROM game_records LIMIT 5",
    "rows": [...],
    "rowCount": 5
  }
}
```

## 📞 下一步

1. **先测试后端 API** - 确认基础功能正常
2. **修复 n8n 连接** - 修改 URL 或解决网络问题
3. **配置完整工作流** - 实现自动化查询

需要我帮你执行哪个步骤？












