# 🚀 n8n + Athena 快速配置指南

## 📋 概述

你已经有了 AWS Athena 配置，现在可以通过 n8n 工作流实现智能查询！

**架构流程**：
```
用户请求 → n8n Webhook → 后端API → Athena查询 → 返回结果
```

---

## 🔧 第一步：启动后端服务

你的后端服务已经在运行中！现在需要测试 API 连接：

### 测试后端 API

```bash
# 测试健康检查
curl -H "X-API-Key: your-api-key" \
  http://localhost:8000/api/webhook/health

# 测试查询API
curl -X POST http://localhost:8000/api/webhook/query/natural \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询game_records表的前10条记录",
    "maxRows": 10
  }'
```

---

## 🎯 第二步：配置 n8n 工作流

### 方案一：直接导入工作流（推荐）

1. **下载工作流文件**
   - 文件位置：`n8n-workflows/1-intelligent-query.json`
   - 这是完整的智能查询工作流

2. **在 n8n 中导入**
   - 打开 n8n（Cloud 或自建）
   - 点击 **Import** → **From File**
   - 选择 `1-intelligent-query.json`
   - 点击 **Import**

3. **配置 API 密钥**
   - 找到 "调用查询API" 节点
   - 设置 HTTP Request 的认证
   - 使用 Header Auth，添加 `X-API-Key`

### 方案二：手动配置（学习用）

参考详细教程：`N8N_WORKFLOW_1_SETUP.md`

---

## 🧪 第三步：测试工作流

### 1. 获取 Webhook URL

导入工作流后，你会得到两个 URL：
- **测试 URL**: `https://your-n8n/webhook-test/intelligent-query`
- **生产 URL**: `https://your-n8n/webhook/intelligent-query`

### 2. 测试查询

```bash
curl -X POST https://your-n8n/webhook-test/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询最近7天的游戏记录数量",
    "user_id": "test_user",
    "channel": "web",
    "maxRows": 100
  }'
```

### 3. 预期结果

```json
{
  "success": true,
  "message": "查询完成",
  "data": {
    "query": "查询最近7天的游戏记录数量",
    "generatedSQL": "SELECT COUNT(*) FROM game_records WHERE ...",
    "rowCount": 1250,
    "executionTime": 2500,
    "rows": [...]
  }
}
```

---

## 📊 支持的功能

### ✅ 已实现的功能

1. **智能查询**
   - 自然语言 → SQL 转换
   - Athena 查询执行
   - 结果导出（Excel/CSV）

2. **定时报表**
   - 定时查询场景
   - 自动发送到 Lark

3. **游戏评级报告**
   - 游戏名称输入
   - 自动生成评级报告

### 🔧 核心 API 端点

| 端点 | 功能 | 示例 |
|------|------|------|
| `/api/webhook/health` | 健康检查 | 测试连接 |
| `/api/webhook/query/natural` | 自然语言查询 | "查询用户数" |
| `/api/webhook/query/sql` | SQL 直接查询 | 原生 SQL |
| `/api/webhook/query/quick` | 快速查询 | 预设场景 |

---

## 🎨 n8n 工作流示例

### 工作流 1: 智能查询

```
┌─────────────┐
│ Webhook触发 │ ← 接收查询请求
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 调用查询API │ ← 发送到后端
└──────┬──────┘
       │
       ↓
┌─────────────┐
│处理查询结果 │ ← 格式化数据
└──────┬──────┘
       │
       ↓
┌─────────────┐
│判断来源渠道 │ ← 判断返回方式
└──┬───────┬──┘
   │       │
   ↓       ↓
┌──────┐ ┌──────┐
│生成  │ │Web   │
│Excel │ │响应  │
└──────┘ └──────┘
```

### 工作流 2: 定时报表

```
┌─────────────┐
│ 定时触发器 │ ← 每天9点执行
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 调用查询API │ ← 执行预设查询
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 生成Excel   │ ← 导出报表
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 发送Lark    │ ← 发送到群聊
└─────────────┘
```

---

## 🔑 API 密钥配置

### 1. 生成 API 密钥

```bash
# 在 backend 目录运行
node generate-api-key.js
```

### 2. 配置 n8n

在 n8n 的 HTTP Request 节点中：
- **Authentication**: Header Auth
- **Header Name**: `X-API-Key`
- **Header Value**: 生成的密钥

### 3. 配置后端

在 `backend/.env` 文件中：
```bash
API_KEYS=your-generated-api-key-here
```

---

## 🚨 常见问题

### 问题 1: 连接失败

**错误**: `The security token included in the request is invalid`

**解决**:
1. 检查 AWS 凭证是否正确
2. 确认区域设置：`us-west-2`
3. 验证 S3 存储桶权限

### 问题 2: n8n 调用失败

**错误**: HTTP 401 Unauthorized

**解决**:
1. 检查 API Key 配置
2. 确认后端服务运行中
3. 验证 Header 设置

### 问题 3: 查询超时

**错误**: Query timeout

**解决**:
1. 优化 SQL 查询
2. 增加 timeout 设置
3. 检查 Athena 服务状态

---

## 📈 下一步

### 立即可用

1. **测试基础连接**
   ```bash
   npm run test:athena
   npm run test:webhook
   ```

2. **配置第一个工作流**
   - 导入 `1-intelligent-query.json`
   - 设置 API Key
   - 测试查询

3. **开始使用**
   - 发送自然语言查询
   - 获取 SQL 和结果
   - 导出 Excel 文件

### 进阶功能

1. **配置 Lark 集成**
   - 设置 Lark Bot
   - 配置群聊通知

2. **设置定时任务**
   - 导入 `2-scheduled-reports.json`
   - 配置定时查询

3. **游戏评级系统**
   - 导入 `3-game-rating-report.json`
   - 设置评级规则

---

## 🎉 总结

你现在拥有：

✅ **完整的后端 API** - 支持 Athena 查询  
✅ **三个 n8n 工作流** - 智能查询、定时报表、游戏评级  
✅ **详细的配置文档** - 手把手教程  
✅ **测试工具** - 快速验证连接  

**开始时间**: 现在就可以开始配置！  
**预计完成时间**: 15-30 分钟  

需要我帮你测试连接或配置特定功能吗？😊
