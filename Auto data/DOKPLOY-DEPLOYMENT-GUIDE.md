# Dokploy 部署指南

## ✅ 配置检查清单

### 1. Dokploy 设置（你已完成）
- ✅ Provider: GitHub
- ✅ Repository: Atuo-billing
- ✅ Branch: dokploy-root-deployment
- ✅ Compose Path: /docker-compose.yml
- ✅ Trigger Type: On Push

### 2. 需要在 Dokploy 中配置的环境变量

在 Dokploy 的 "Environment" 标签页中添加以下变量：

```bash
# AWS 配置
AWS_ACCESS_KEY_ID=你的AWS访问密钥
AWS_SECRET_ACCESS_KEY=你的AWS密钥
AWS_REGION=ap-southeast-1

# Athena 配置
ATHENA_DATABASE=你的数据库名
ATHENA_OUTPUT_LOCATION=s3://你的输出位置/
ATHENA_WORKGROUP=primary

# API 配置
API_KEY=你的API密钥
FRONTEND_URL=https://你的域名.com

# Lark 配置
LARK_APP_ID=你的Lark应用ID
LARK_APP_SECRET=你的Lark应用密钥
```

### 3. 域名配置（可选）

#### 选项 A: 不使用域名（最简单）
直接通过服务器 IP 访问：
```
http://你的服务器IP:8000/api/health
```
在 Dokploy 的 Domains 标签页可以不添加任何域名。

#### 选项 B: 使用 Dokploy 子域名
Dokploy 会自动提供子域名，在 Domains 配置：
- Host: `api.dokploy.com`（或 Dokploy 提供的域名）
- Container Port: `8000`
- 自动启用 SSL

#### 选项 C: 使用免费域名
可以使用 DuckDNS、FreeDNS 等免费服务：
1. 注册免费域名（如 `your-app.duckdns.org`）
2. 在 Dokploy Domains 中添加该域名
3. 将域名指向你的服务器 IP

## 📋 部署步骤

### 步骤 1: 推送代码到 GitHub
```bash
git add .
git commit -m "Update Docker configuration for Dokploy"
git push origin dokploy-root-deployment
```

### 步骤 2: 在 Dokploy 中部署
1. 点击 "Deploy" 按钮
2. 等待构建完成（首次构建可能需要 3-5 分钟）
3. 查看日志确认服务启动成功

### 步骤 3: 验证部署
访问以下端点测试：
```bash
# 健康检查
curl https://你的域名.com/api/health

# 应该返回
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...
}
```

## 🔍 故障排查

### 查看日志
在 Dokploy 的 "Logs" 标签页查看实时日志

### 常见问题

1. **构建失败**
   - 检查 Dockerfile 路径是否正确
   - 确认 backend/package.json 存在

2. **服务无法启动**
   - 检查环境变量是否都已配置
   - 查看日志中的错误信息

3. **健康检查失败**
   - 确认 /api/health 端点正常工作
   - 检查端口 8000 是否正确暴露

## 📊 监控

Dokploy 提供以下监控功能：
- CPU 使用率
- 内存使用率
- 网络流量
- 容器日志

## 🔄 更新部署

每次推送到 `dokploy-root-deployment` 分支，Dokploy 会自动：
1. 拉取最新代码
2. 重新构建镜像
3. 滚动更新服务（零停机）

## 📝 重要说明

1. **环境变量安全**：敏感信息（如 AWS 密钥）只在 Dokploy 中配置，不要提交到代码库
2. **日志持久化**：logs 和 exports 目录通过 volumes 持久化
3. **自动重启**：服务崩溃会自动重启（restart: unless-stopped）
