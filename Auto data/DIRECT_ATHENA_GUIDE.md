# 直接在 n8n 中执行 Athena 查询指南

## 🎯 **为什么选择直接方式？**

### **优势**
- ✅ **无需外部 API** - 不依赖后端服务
- ✅ **完全自包含** - 所有逻辑在 n8n 中
- ✅ **更好的控制** - 直接控制查询流程
- ✅ **减少延迟** - 没有额外的网络调用
- ✅ **更安全** - AWS 凭证直接配置在 n8n 中

### **vs API 方式**
| 特性 | 直接方式 | API 方式 |
|------|----------|----------|
| 依赖 | 无外部依赖 | 需要后端服务 |
| 配置 | 简单 | 复杂 |
| 维护 | 低维护 | 高维护 |
| 性能 | 更快 | 较慢 |
| 扩展性 | 有限 | 更好 |

## 📋 **准备工作**

### **1. 确保 n8n 支持 AWS SDK**

在 n8n 的 Code 节点中，AWS SDK 通常是预装的。如果不支持，你需要：

1. 进入 n8n 设置
2. 检查 Node.js 模块
3. 确保 `aws-sdk` 可用

### **2. 准备 AWS 凭证**

你需要的 AWS 信息：
- **Region**: `us-west-2`
- **Access Key ID**: `AKIAQQJLCWBOOKC7J6ZI`
- **Secret Access Key**: `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`
- **Database**: `gmp`
- **S3 Output Location**: `s3://aws-athena-query-results-us-west-2-034986963036/`

## 🚀 **使用步骤**

### **步骤 1: 导入工作流**

选择以下工作流之一：

#### **选项 A: 简化版本** (`simple-direct-athena.json`) - 推荐
- 单节点执行
- 自动等待查询完成
- 简单易用

#### **选项 B: 完整版本** (`direct-athena-query.json`)
- 多节点流程
- 详细的状态监控
- 更好的错误处理

### **步骤 2: 配置工作流**

#### **简化版本配置**
1. 导入 `simple-direct-athena.json`
2. 点击 **Execute Athena Query** 节点
3. 检查代码中的 AWS 配置
4. 确认 SQL 查询正确

#### **完整版本配置**
1. 导入 `direct-athena-query.json`
2. 检查所有节点的配置
3. 确认连接关系正确

### **步骤 3: 执行查询**

1. 点击 **Execute Workflow** 按钮
2. 等待查询完成
3. 查看结果

## 🔧 **工作流详解**

### **简化版本流程**

```
Start → Execute Athena Query → Format Result
```

#### **Execute Athena Query 节点**
- 配置 AWS SDK
- 启动 Athena 查询
- 轮询查询状态
- 获取查询结果
- 处理错误和超时

#### **Format Result 节点**
- 格式化输出数据
- 添加数据预览
- 美化错误信息

### **完整版本流程**

```
Start → Setup Config → Start Athena Query → Initial Wait 
    ↓
Check Status → Status Check → [成功] → Get Results → Process Final Result
    ↓                    ↓
[未完成] → Retry Check → Wait and Retry → 重新检查
    ↓
[超时] → Timeout Handler → Process Final Result
```

## 📊 **输出格式**

### **成功结果**
```json
{
  "success": true,
  "message": "查询成功！返回 3 条记录",
  "queryId": "280e416c-6a02-4182-ac77-175815d0475e",
  "summary": {
    "rowCount": 3,
    "columns": ["id", "uid", "merchant_id", "game_id", ...],
    "executionTime": "45 秒"
  },
  "data": [
    {
      "id": "1976423513265401856",
      "uid": "12345",
      "merchant_id": "1737978166",
      ...
    }
  ],
  "preview": [
    // 前3行数据预览
  ],
  "timestamp": "2025-10-11T02:35:00.000Z"
}
```

### **失败结果**
```json
{
  "success": false,
  "message": "查询执行失败",
  "error": "具体错误信息",
  "queryId": "280e416c-6a02-4182-ac77-175815d0475e",
  "status": "failed",
  "timestamp": "2025-10-11T02:35:00.000Z"
}
```

## ⚙️ **自定义配置**

### **修改 SQL 查询**

在 **Execute Athena Query** 节点中修改：
```javascript
const sqlQuery = `你的新查询语句`;
```

### **调整等待时间**

修改轮询参数：
```javascript
const maxAttempts = 60; // 改为最多等待 10 分钟 (60 * 10秒)
```

### **修改结果限制**

调整返回结果数量：
```javascript
const resultParams = {
  QueryExecutionId: queryId,
  MaxResults: 5000 // 增加结果数量
};
```

## 🔍 **故障排除**

### **1. AWS SDK 不可用**
**错误**: `Cannot find module 'aws-sdk'`

**解决方案**:
- 检查 n8n 版本是否支持 AWS SDK
- 考虑使用 HTTP Request 节点调用 AWS API

### **2. 凭证错误**
**错误**: `InvalidAccessKeyId` 或 `SignatureDoesNotMatch`

**解决方案**:
- 检查 AWS 凭证是否正确
- 确认凭证有 Athena 权限

### **3. 查询超时**
**错误**: 查询一直显示 "running" 状态

**解决方案**:
- 增加等待时间
- 检查 SQL 查询是否过于复杂
- 考虑优化查询条件

### **4. 权限问题**
**错误**: `Access Denied` 或 `Insufficient permissions`

**解决方案**:
- 确认 AWS 用户有 Athena 权限
- 检查 S3 输出位置权限
- 验证数据库访问权限

## 🎁 **额外功能**

### **添加数据导出**

在 **Format Result** 节点后添加：
```javascript
// 导出为 CSV 格式
if (data.success && data.data) {
  const csvHeader = data.columns.join(',');
  const csvRows = data.data.map(row => 
    data.columns.map(col => `"${row[col] || ''}"`).join(',')
  );
  const csvContent = [csvHeader, ...csvRows].join('\n');
  
  return {
    json: {
      ...data,
      csvContent,
      exportReady: true
    }
  };
}
```

### **添加查询缓存**

```javascript
// 简单的查询结果缓存
const queryHash = require('crypto')
  .createHash('md5')
  .update(sqlQuery)
  .digest('hex');

// 检查缓存逻辑...
```

### **添加查询优化建议**

```javascript
// 分析查询并提供优化建议
if (data.executionTime && data.executionTime > '60 秒') {
  data.optimizationTips = [
    '考虑添加更多过滤条件',
    '检查是否需要分区查询',
    '考虑限制返回字段数量'
  ];
}
```

## 🎉 **总结**

直接在 n8n 中执行 Athena 查询的优势：

1. **简单直接** - 无需复杂的外部 API
2. **完全控制** - 可以自定义所有逻辑
3. **更好性能** - 减少网络延迟
4. **易于维护** - 所有代码在一个地方
5. **灵活扩展** - 可以轻松添加新功能

**推荐使用简化版本 (`simple-direct-athena.json`) 开始，它包含了所有必要的功能，并且易于理解和维护。**

这样你就可以完全摆脱外部 API 的依赖，直接在 n8n 中实现 Athena 查询功能了！












