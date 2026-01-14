# n8n Athena 查询工作流使用指南

## 🎯 **概述**

你可以通过 n8n 节点完全替代直接调用 API，这样可以：
- ✅ 避免 JSON 格式问题
- ✅ 自动处理超时和重试
- ✅ 提供更好的错误处理
- ✅ 支持可视化工作流管理

## 📋 **准备工作**

### 1. **创建 API Key 认证**

在 n8n 中创建 HTTP Header 认证：

1. 进入 n8n → **Settings** → **Credentials**
2. 点击 **Add Credential** → 选择 **HTTP Header Auth**
3. 配置如下：
   - **Name**: `Athena API Key`
   - **Header Name**: `X-API-Key`
   - **Header Value**: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`

### 2. **导入工作流**

选择以下两个工作流之一：

#### **选项 A: 完整工作流** (`athena-query-workflow.json`)
- 支持同步和异步查询
- 完整的错误处理和重试机制
- 适合复杂查询场景

#### **选项 B: 简化工作流** (`simple-athena-query.json`)
- 专门针对你的具体查询
- 简化的流程，更容易理解
- 推荐用于你的场景

## 🚀 **使用步骤**

### **步骤 1: 导入工作流**

1. 在 n8n 中点击 **Import from File**
2. 选择 `simple-athena-query.json` 文件
3. 确认导入

### **步骤 2: 配置认证**

1. 点击 **Start Query** 节点
2. 在 **Authentication** 部分选择 **Athena API Key**
3. 保存配置

### **步骤 3: 执行查询**

1. 点击 **Execute Workflow** 按钮
2. 工作流将自动：
   - 设置你的 SQL 查询
   - 启动异步查询
   - 等待 15 秒
   - 检查查询状态
   - 如果未完成，每 30 秒重试一次
   - 最多等待 5 分钟

### **步骤 4: 查看结果**

在 **Process Result** 节点的输出中查看：
- `success`: 查询是否成功
- `rowCount`: 返回的记录数
- `data`: 查询结果数据
- `message`: 状态消息

## 🔧 **工作流节点说明**

### **1. Start**
- 工作流入口点

### **2. Setup Query**
- 设置你的具体 SQL 查询
- 自动配置数据库为 "gmp"
- 使用异步查询类型

### **3. Start Query**
- 调用 `/api/async/start` 启动查询
- 使用你的 API Key 认证
- 5 分钟超时设置

### **4. Initial Wait**
- 等待 15 秒让查询开始执行

### **5. Check Status**
- 调用 `/api/async/status/{queryId}` 检查状态
- 获取查询进度信息

### **6. Status Check**
- 判断查询是否完成
- 如果完成 → 处理结果
- 如果未完成 → 继续等待

### **7. Wait and Retry**
- 等待 30 秒后重新检查状态
- 避免频繁轮询

### **8. Process Result**
- 处理最终查询结果
- 格式化输出数据

### **9. Timeout Handler**
- 处理 5 分钟超时情况
- 返回超时错误信息

## 📊 **输出格式**

成功时：
```json
{
  "success": true,
  "queryId": "uuid-string",
  "status": "completed",
  "rowCount": 3,
  "totalRows": 3,
  "executionTime": 125000,
  "data": {
    "rows": [...],
    "columns": [...]
  },
  "message": "查询成功！返回 3 条记录",
  "timestamp": "2025-10-10T10:30:00.000Z"
}
```

失败时：
```json
{
  "success": false,
  "queryId": "uuid-string",
  "status": "failed",
  "error": "具体错误信息",
  "message": "查询执行失败",
  "timestamp": "2025-10-10T10:30:00.000Z"
}
```

## 🎛️ **自定义配置**

### **修改查询参数**

在 **Setup Query** 节点中修改：
- SQL 查询语句
- 数据库名称
- 查询类型（async/direct）

### **调整等待时间**

- **Initial Wait**: 初始等待时间（默认 15 秒）
- **Wait and Retry**: 重试间隔（默认 30 秒）
- **Timeout Wait**: 总超时时间（默认 5 分钟）

### **修改 API 端点**

在 HTTP Request 节点中修改 URL：
- 异步查询：`/api/async/start`
- 状态检查：`/api/async/status/{queryId}`
- 直接查询：`/api/webhook/query/sql`

## 🔍 **故障排除**

### **1. 认证失败**
- 检查 API Key 是否正确
- 确认认证类型为 HTTP Header Auth

### **2. 连接失败**
- 检查 Cloudflare Tunnel 是否运行
- 确认后端服务是否启动

### **3. 查询超时**
- 检查查询是否过于复杂
- 考虑优化 SQL 查询
- 增加超时时间设置

### **4. 空结果**
- 检查 SQL 查询语法
- 确认数据是否存在
- 验证日期范围是否正确

## 🎉 **优势**

使用 n8n 工作流相比直接调用 API：

1. **可视化管理**: 直观的图形界面
2. **自动重试**: 智能的错误处理和重试
3. **状态监控**: 实时查看查询进度
4. **易于维护**: 模块化的节点设计
5. **扩展性强**: 可以轻松添加新的处理步骤

## 📝 **下一步**

1. 导入并测试简化工作流
2. 根据结果调整配置
3. 考虑添加数据导出功能
4. 集成到你的自动化流程中

这样你就可以通过 n8n 的图形界面来管理 Athena 查询，而不需要手动处理 JSON 格式和 API 调用了！












