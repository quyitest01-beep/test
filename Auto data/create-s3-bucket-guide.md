# 创建 S3 存储桶解决 Athena 查询问题

## 🎯 问题
```
The S3 location provided to save your query results is invalid.
```

## 🚀 解决方案

### 步骤 1：创建 S3 存储桶

1. **登录 AWS 控制台**
   - 访问：https://console.aws.amazon.com/s3/

2. **创建新存储桶**
   - 点击 "创建存储桶"
   - **存储桶名称**：`athena-query-results-us-west-2`
   - **AWS 区域**：`us-west-2 (美国西部-俄勒冈)`
   - **阻止公有访问设置**：保持默认（勾选所有选项）
   - 点击 "创建存储桶"

### 步骤 2：更新 .env 配置

编辑 `D:\cursor\Auto data\backend\.env` 文件：

**原来的配置**：
```
ATHENA_OUTPUT_LOCATION=s3://gmp-asia-gamehistory-athena-results/query-results/
```

**新的配置**：
```
ATHENA_OUTPUT_LOCATION=s3://athena-query-results-us-west-2/
```

### 步骤 3：重启后端服务

1. **停止当前服务**：
   ```bash
   taskkill /F /IM node.exe
   ```

2. **重新启动**：
   ```bash
   cd "D:\cursor\Auto data"
   .\start-server.bat
   ```

### 步骤 4：测试查询

在 n8n 中测试：
```json
{"sql": "SELECT 1 as test"}
```

## 📋 完整的 n8n 配置

**URL**：
```
https://andrews-tobago-jean-employ.trycloudflare.com/api/webhook/query/sql
```

**Headers**：
```
Content-Type: application/json
X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d
```

**JSON Body**：
```json
{"sql": "SELECT 1 as test"}
```

## ⚠️ 重要提醒

- 存储桶名称必须唯一（全球唯一）
- 必须与 AWS 区域匹配（us-west-2）
- 确保 AWS 凭证有 S3 访问权限

## 🎯 预期结果

修复后，查询应该返回：
```json
{
  "success": true,
  "data": {
    "rows": [{"test": 1}],
    "columns": ["test"],
    "rowCount": 1
  }
}
```












