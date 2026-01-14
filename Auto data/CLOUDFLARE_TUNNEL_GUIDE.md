# Cloudflare Tunnel 设置指南

## 🎯 目标

将本地 Athena 查询后端（端口 8000）暴露到公网，让线上 n8n 能够访问。

## 📋 当前情况

- ✅ 你已有 Cloudflare Tunnel：`https://stroke-geo-bee-bless.trycloudflare.com`
- ❌ 但这个隧道指向的是另一个项目（Auto Billing 客户管理系统）
- ✅ 本地 Athena 后端运行在：`http://localhost:8000`

## 🚀 解决方案

### 选项 A：启动新的隧道（推荐）

**优点**：两个项目互不影响

1. **下载 cloudflared**（如果还没有）：
   ```
   https://github.com/cloudflare/cloudflared/releases/latest
   ```
   下载 `cloudflared-windows-amd64.exe`，重命名为 `cloudflared.exe`

2. **启动 Athena 隧道**：
   ```batch
   .\start-athena-tunnel.bat
   ```
   
   或直接运行：
   ```batch
   cloudflared tunnel --url http://localhost:8000
   ```

3. **获取新的 URL**：
   运行后会显示类似：
   ```
   Your quick Tunnel has been created! Visit it at:
   https://abc-def-ghi-jkl.trycloudflare.com
   ```

4. **在 n8n 中配置新 URL**：
   将 `http://localhost:8000` 替换为新的隧道 URL

### 选项 B：重用现有隧道

**缺点**：会影响另一个项目的访问

1. **找到并停止旧隧道**：
   ```powershell
   # 查找 cloudflared 进程
   tasklist | findstr cloudflared
   
   # 停止进程（替换 PID）
   taskkill /PID <进程ID> /F
   ```

2. **重新启动隧道到端口 8000**：
   ```batch
   cloudflared tunnel --url http://localhost:8000
   ```

3. **确认 URL 不变**：
   URL 可能会变化，需要更新 n8n 配置

## 📝 完整操作步骤

### 第一步：确保后端服务运行

```batch
# 在第一个终端窗口
.\start-server.bat
```

确认看到：
```
🚀 Query Backend Server running on port 8000
```

### 第二步：启动 Cloudflare 隧道

```batch
# 在第二个终端窗口
.\start-athena-tunnel.bat
```

记录显示的 URL，例如：
```
https://new-tunnel-url.trycloudflare.com
```

### 第三步：测试隧道连接

```powershell
# 测试健康检查
Invoke-RestMethod -Uri "https://new-tunnel-url.trycloudflare.com/api/webhook/health" -Headers @{"X-API-Key"="f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"}
```

应该返回：
```json
{
  "success": true,
  "status": "healthy",
  "service": "webhook-api"
}
```

### 第四步：更新 n8n 工作流

在 n8n 工作流中的 HTTP Request 节点：

**原来的配置**：
```
URL: http://localhost:8000/api/webhook/query/natural
```

**新的配置**：
```
URL: https://new-tunnel-url.trycloudflare.com/api/webhook/query/natural
Headers:
  X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d
```

### 第五步：测试 n8n 工作流

在 n8n 中执行工作流，测试查询功能。

## ⚠️ 重要提醒

### 1. 保持两个服务同时运行

你需要两个终端窗口：

**终端 1：后端服务**
```batch
cd D:\cursor\Auto data
.\start-server.bat
```

**终端 2：Cloudflare 隧道**
```batch
cd D:\cursor\Auto data
.\start-athena-tunnel.bat
```

### 2. URL 会变化

- 免费的 Cloudflare Tunnel 每次重启 URL 可能变化
- 如果 URL 变了，需要更新 n8n 配置

### 3. 生产环境建议

如果要长期使用，建议：
- 使用 Cloudflare 命名隧道（需要 Cloudflare 账号）
- 或者使用云服务器部署后端

## 🔧 故障排查

### 问题 1：隧道启动失败

```
Error: failed to request quick Tunnel
```

**解决**：
- 检查网络连接
- 重试几次
- 或使用 ngrok 作为替代方案

### 问题 2：n8n 无法连接隧道

```
The service refused the connection
```

**检查清单**：
1. ✅ 后端服务是否运行？（访问 `http://localhost:8000/api/webhook/health`）
2. ✅ 隧道是否运行？（查看终端是否有输出）
3. ✅ 隧道 URL 是否正确配置到 n8n？
4. ✅ API Key 是否正确？

### 问题 3：API Key 认证失败

```
Authentication failed: Invalid API key
```

**解决**：
确认 n8n 中的 API Key 是：
```
f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d
```

## 📚 相关文档

- [N8N_WORKFLOW_1_SETUP.md](./N8N_WORKFLOW_1_SETUP.md) - n8n 工作流配置详细步骤
- [API_KEY_GUIDE.md](./API_KEY_GUIDE.md) - API Key 使用说明
- [QUICK_START.md](./QUICK_START.md) - 快速开始指南

## 🎓 Cloudflare Tunnel 官方文档

- 快速隧道：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- 命名隧道：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/













