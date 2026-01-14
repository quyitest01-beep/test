# API Key 获取和配置完整指南

## 🔑 什么是 Athena API Key？

**重要说明**：这个 "Athena API Key" 不是 AWS Athena 的密钥，而是**你自己系统的 API 密钥**，用于保护你的 Webhook API 接口。

### 作用

```
用户/n8n → [API Key 认证] → Webhook API → Athena Service → AWS Athena
```

- 🔒 保护你的 Webhook API 不被未授权访问
- 🎫 识别和管理不同的调用方（可配置多个密钥）
- 📊 追踪和审计 API 使用情况

---

## 🚀 获取方法（3步）

### 步骤 1: 生成 API 密钥

#### 方法 A: 使用 Node.js 命令（推荐）

在命令行中运行：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**输出示例**：
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

复制这个字符串，这就是你的 API Key！

#### 方法 B: 使用 Python 命令

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

#### 方法 C: 在线生成

访问 https://www.random.org/strings/ 生成随机字符串（至少 32 字符）

#### 方法 D: 使用 OpenSSL

```bash
openssl rand -hex 32
```

---

### 步骤 2: 配置到后端

#### 2.1 找到 `.env` 文件

```bash
cd backend
ls -la
# 查找 .env 文件
```

如果没有 `.env` 文件，创建一个：

```bash
cd backend
touch .env
```

#### 2.2 添加 API Key 到 `.env`

打开 `backend/.env` 文件，添加或修改以下行：

```bash
# API 密钥配置
API_KEYS=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**多密钥配置**（可选）：

如果需要给不同的服务或团队分配不同的密钥：

```bash
# 多个密钥用逗号分隔
API_KEYS=key1_for_n8n,key2_for_team_a,key3_for_team_b
```

#### 2.3 完整的 `.env` 示例

```bash
# 服务器配置
PORT=8000
NODE_ENV=production

# AWS Athena 配置（这些是 AWS 的凭证，不是 API Key）
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
ATHENA_DATABASE=my_database
ATHENA_OUTPUT_LOCATION=s3://my-bucket/query-results/
ATHENA_WORKGROUP=primary

# API 密钥（这个才是 Athena API Key）
API_KEYS=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# 查询限制
MAX_QUERY_TIMEOUT=300000
MAX_RESULT_SIZE=1000000
```

---

### 步骤 3: 重启后端服务

配置完成后，需要重启后端服务使配置生效：

#### 方法 A: 直接启动

```bash
cd backend

# 停止现有进程（如果有）
# Ctrl + C

# 重新启动
npm start
```

#### 方法 B: 使用 PM2

```bash
# 如果已经用 PM2 启动过
pm2 restart athena-query-backend

# 或者重新启动
pm2 delete athena-query-backend
pm2 start server.js --name athena-query-backend

# 查看日志确认启动成功
pm2 logs athena-query-backend
```

---

## ✅ 验证配置

### 测试 1: 使用正确的 API Key

```bash
curl -H "X-API-Key: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456" \
  http://localhost:8000/api/webhook/health
```

**期望输出**（成功）：
```json
{
  "success": true,
  "status": "healthy",
  "service": "webhook-api",
  "timestamp": "2025-10-10T10:00:00.000Z"
}
```

### 测试 2: 不提供 API Key（应该失败）

```bash
curl http://localhost:8000/api/webhook/health
```

**期望输出**（401 错误）：
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid API key in X-API-Key header or apiKey query parameter"
}
```

### 测试 3: 使用错误的 API Key（应该失败）

```bash
curl -H "X-API-Key: wrong-key-123" \
  http://localhost:8000/api/webhook/health
```

**期望输出**（403 错误）：
```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Invalid API key"
}
```

---

## 🔧 在 n8n 中配置

### 方法 A: 配置 Header Auth 凭证（推荐）

#### 第 1 步：创建凭证

1. 在 n8n 中，点击右上角头像
2. 选择 **Settings**
3. 点击 **Credentials**
4. 点击 **+ New Credential**
5. 搜索 `Header Auth`
6. 选择 **Header Auth**

#### 第 2 步：填写信息

```yaml
Credential Name: Athena API Key
  （这个名字可以自定义，建议用有意义的名称）

Name: X-API-Key
  （必须是这个，这是 Header 名称）

Value: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
  （粘贴你在 backend/.env 中配置的 API_KEYS）
```

#### 第 3 步：保存

点击 **Save** 按钮

#### 第 4 步：在 HTTP Request 节点中使用

1. 打开你的工作流
2. 选择 HTTP Request 节点
3. 在 **Authentication** 下拉框选择 **Predefined Credential Type**
4. 在 **Credential Type** 选择 **Header Auth**
5. 在 **Credential** 下拉框选择刚才创建的 **Athena API Key**

---

### 方法 B: 直接在 URL 中使用（不推荐）

也可以通过 Query Parameter 传递：

```
http://localhost:8000/api/webhook/query/sql?apiKey=你的API密钥
```

但这种方式不够安全，不建议在生产环境使用。

---

## 📋 完整配置清单

### ✅ 后端配置检查

- [ ] 已生成随机 API Key（至少 32 字符）
- [ ] 已在 `backend/.env` 文件中配置 `API_KEYS`
- [ ] 已重启后端服务
- [ ] 使用正确的 API Key 测试成功（返回 200）
- [ ] 不使用 API Key 测试失败（返回 401）
- [ ] 使用错误的 API Key 测试失败（返回 403）

### ✅ n8n 配置检查

- [ ] 已在 n8n 中创建 Header Auth 凭证
- [ ] Header Name 设置为 `X-API-Key`
- [ ] Header Value 填入正确的 API Key
- [ ] 已在 HTTP Request 节点中选择该凭证
- [ ] 测试工作流成功执行

---

## 🔐 安全最佳实践

### 1. 密钥强度

✅ **好的密钥**:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```
- 至少 32 字符
- 随机生成
- 包含数字和字母

❌ **差的密钥**:
```
123456
password
my-api-key
```
- 太短
- 容易猜测
- 没有随机性

### 2. 密钥管理

✅ **应该做的**:
- 使用环境变量存储（`.env` 文件）
- 不同环境使用不同密钥（开发/测试/生产）
- 定期轮换密钥（每 3-6 个月）
- 使用版本控制时排除 `.env` 文件（添加到 `.gitignore`）

❌ **不应该做的**:
- 直接写在代码中
- 提交到 Git 仓库
- 在公开场合分享
- 所有环境使用同一密钥

### 3. 密钥轮换

当需要更换密钥时：

```bash
# 1. 生成新密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 添加到 .env（保留旧密钥一段时间）
API_KEYS=新密钥,旧密钥

# 3. 重启服务
pm2 restart athena-query-backend

# 4. 更新所有客户端使用新密钥

# 5. 一段时间后，从 .env 移除旧密钥
API_KEYS=新密钥

# 6. 再次重启服务
pm2 restart athena-query-backend
```

### 4. 多密钥管理

为不同用途分配不同密钥：

```bash
# .env 配置
API_KEYS=n8n_key_abc123,team_a_key_def456,team_b_key_ghi789

# 使用场景
# n8n 工作流使用: n8n_key_abc123
# A 团队使用: team_a_key_def456
# B 团队使用: team_b_key_ghi789
```

好处：
- 可以单独撤销某个密钥
- 可以追踪不同来源的请求
- 更细粒度的访问控制

---

## 🐛 常见问题

### Q1: 我忘记了 API Key，怎么办？

**A**: API Key 存储在 `backend/.env` 文件中

```bash
cd backend
cat .env | grep API_KEYS
```

输出：
```
API_KEYS=你的密钥在这里
```

### Q2: 我的 API Key 不工作，返回 403

**原因检查**:

1. **密钥不匹配**
   ```bash
   # 检查后端配置
   cd backend
   cat .env | grep API_KEYS
   
   # 检查 n8n 中的密钥是否一致
   ```

2. **有多余的空格**
   ```bash
   # 错误示例（有空格）
   API_KEYS= your-key-here
   
   # 正确示例
   API_KEYS=your-key-here
   ```

3. **服务未重启**
   ```bash
   pm2 restart athena-query-backend
   ```

### Q3: 可以不使用 API Key 吗？

**A**: 不建议，但可以修改代码：

在 `backend/server.js` 中注释掉 webhook 路由的认证：

```javascript
// 不推荐！仅用于开发测试
// app.use('/api/webhook', webhookRoutes)

// 改为：
const webhookRoutesNoAuth = require('./routes/webhook-no-auth')
app.use('/api/webhook', webhookRoutesNoAuth)
```

⚠️ **警告**: 这会使你的 API 完全公开，任何人都可以访问！

### Q4: 如何查看哪些请求使用了我的 API Key？

**A**: 查看日志文件

```bash
cd backend
tail -f logs/combined.log | grep "API key authentication"
```

输出示例：
```
[2025-10-10 10:00:00] API key authentication successful - path: /api/webhook/query/sql
[2025-10-10 10:05:00] API key authentication successful - path: /api/webhook/health
```

### Q5: 我的 .env 文件不存在

**A**: 创建一个

```bash
cd backend
touch .env
nano .env
```

然后粘贴配置：

```bash
PORT=8000
API_KEYS=你的密钥
# ... 其他配置
```

保存退出：`Ctrl + X` → `Y` → `Enter`

---

## 📊 配置对比表

| 配置项 | 位置 | 用途 | 示例 |
|--------|------|------|------|
| **API_KEYS** | `backend/.env` | Webhook API 认证 | `abc123...` |
| **AWS_ACCESS_KEY_ID** | `backend/.env` | AWS Athena 认证 | `AKIAIOSFODNN...` |
| **AWS_SECRET_ACCESS_KEY** | `backend/.env` | AWS Athena 认证 | `wJalrXUtn...` |

**重点**：
- `API_KEYS` 是你自己定义的，用于保护你的 API
- `AWS_ACCESS_KEY_ID` 和 `AWS_SECRET_ACCESS_KEY` 是从 AWS 获取的

---

## 🎓 理解认证流程

```
┌─────────────┐
│   n8n 工作流 │
└──────┬──────┘
       │ 发送请求
       │ Header: X-API-Key: abc123...
       ↓
┌──────────────────────┐
│ apiKeyAuth 中间件    │
│ (检查 API Key)       │
└──────┬───────────────┘
       │ ✓ 密钥正确
       ↓
┌──────────────────────┐
│ webhook.js 路由      │
│ (处理请求)           │
└──────┬───────────────┘
       │ 调用 Athena
       │ 使用 AWS 凭证
       ↓
┌──────────────────────┐
│ athenaService.js     │
│ (连接 AWS Athena)    │
└──────┬───────────────┘
       │ 使用 AWS_ACCESS_KEY_ID
       │ 和 AWS_SECRET_ACCESS_KEY
       ↓
┌──────────────────────┐
│   AWS Athena         │
└──────────────────────┘
```

**两层认证**：
1. **你的 API** 认证：使用 `API_KEYS`（你自己定义）
2. **AWS Athena** 认证：使用 AWS 凭证（从 AWS 获取）

---

## ✅ 快速配置命令

完整的配置流程（复制粘贴执行）：

```bash
# 1. 生成 API Key
echo "你的 API Key 是："
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 配置到 .env
cd backend
echo "" >> .env
echo "# API 密钥" >> .env
echo "API_KEYS=粘贴上面生成的密钥" >> .env

# 3. 重启服务
pm2 restart athena-query-backend

# 4. 测试
curl -H "X-API-Key: 你的密钥" http://localhost:8000/api/webhook/health
```

---

## 🎉 完成！

现在你知道了：
- ✅ 什么是 Athena API Key（你自己的 API 密钥）
- ✅ 如何生成和配置
- ✅ 如何在 n8n 中使用
- ✅ 安全最佳实践

**下一步**：
1. 在 n8n 中配置 Header Auth 凭证
2. 在 HTTP Request 节点中使用该凭证
3. 测试工作流

---

**需要帮助？**
- 查看后端日志: `backend/logs/combined.log`
- 运行测试脚本: `cd backend && npm run test:webhook`
- 查看完整文档: [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)

