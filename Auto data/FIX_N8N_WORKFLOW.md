# 🔧 修复 n8n 工作流错误

## 问题分析

你遇到的错误：`Unrecognized node type: n8n-` 通常是因为：

1. **节点类型不兼容** - 导入的工作流包含当前 n8n 版本不支持的节点
2. **版本差异** - 工作流是用不同版本的 n8n 创建的

## 🚀 解决方案

### 方案一：使用简化版工作流（推荐）

我已经为你创建了一个简化版的工作流文件：
`n8n-workflows/simple-intelligent-query.json`

**特点**：
- 只包含核心节点
- 兼容性更好
- 功能完整

**导入步骤**：
1. 删除当前出错的工作流
2. 导入新文件：`simple-intelligent-query.json`
3. 配置 API Key

### 方案二：手动创建（如果导入还有问题）

如果导入仍然有问题，手动创建：

#### 1. 创建新工作流
- 点击 "Add workflow"
- 命名为 "智能查询"

#### 2. 添加 Webhook 节点
- 搜索 "Webhook"
- 配置：
  - **HTTP Method**: `POST`
  - **Path**: `intelligent-query`

#### 3. 添加 HTTP Request 节点
- 搜索 "HTTP Request"
- 配置：
  - **Method**: `POST`
  - **URL**: `https://stroke-geo-bee-bless.trycloudflare.com/api/webhook/query/natural`
  - **Authentication**: `Header Auth`
  - **Headers**: `Content-Type: application/json`
  - **Body**: 
    ```json
    {
      "query": "{{ $json.body.query }}",
      "maxRows": 10000,
      "timeout": 120000
    }
    ```

#### 4. 添加 Respond to Webhook 节点
- 搜索 "Respond to Webhook"
- 配置：
  - **Respond With**: `JSON`
  - **Response Body**: `{{ $json }}`

## 🔑 API Key 配置

在你的 Header Auth 凭证中：
- **Name**: `X-API-Key`
- **Value**: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`

## ✅ 测试工作流

配置完成后测试：

```bash
curl -X POST https://your-n8n-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询game_records表的前5条记录",
    "maxRows": 5
  }'
```

## 🔍 故障排除

### 如果仍然报错：
1. 检查 n8n 版本
2. 尝试更新 n8n 到最新版本
3. 使用手动创建方案

### 如果 API 调用失败：
1. 确认后端服务运行中
2. 检查 API Key 配置
3. 验证 Cloudflare 隧道 URL

需要我帮你手动创建工作流吗？
