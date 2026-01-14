# file-size/batch API 文件大小判断与拆分逻辑说明

## API 概述

`POST /api/query/file-size/batch` 用于批量获取多个查询结果文件的大小，并根据文件大小给出处理建议。

## 文件大小判断逻辑

### 1. 文件大小获取方式

API 通过以下方式获取文件大小：

1. **优先使用 HeadObject 方法**（推荐，不需要 ListObjects 权限）
   - 尝试多个可能的文件路径格式：
     - `${queryId}/${queryId}.csv` - 最常见格式
     - `${queryId}.csv` - 直接在根目录
     - `${queryId}/000000_0` - Parquet 格式
     - `${queryId}/000000_0.csv` - CSV 格式
     - `${queryId}/part-00000.csv` - Spark 格式
     - `${queryId}/data.csv` - 通用名称

2. **备用方法：ListObjects**（需要额外权限）
   - 如果 HeadObject 方法失败，尝试使用 ListObjects 列出所有文件并计算总大小

### 2. 文件大小阈值与处理建议

根据 `athenaService.js` 中的 `getProcessingRecommendation` 方法，文件大小判断逻辑如下：

#### 小文件：< 10 MB
- **Action**: `direct_process`
- **建议**: 文件较小，建议直接处理
- **说明**: 可以直接下载并处理，无需拆分

#### 中等文件：10-500 MB
- **Action**: `export_or_batch`
- **建议**: 文件中等，建议导出文件或分批处理
- **说明**: 可以导出为文件或分批处理

#### 大文件：> 1000 MB
- **Action**: `split_process`
- **建议**: 文件超大，必须拆分处理
- **说明**: 超过 1000 MB 限制，必须拆分处理

### 3. 代码中的拆分阈值

在 `n8n-workflows/process-query-results-with-file-size.js` 中，还有一个额外的阈值：

```javascript
const LIMIT_MB = 5;  // 5 MB 限制
```

如果文件大小超过 5 MB，会建议拆分处理。

## 拆分处理判断

### 判断条件

系统会在以下情况下建议拆分处理：

1. **文件大小 > 1000 MB**（服务端判断）
   - 返回 `action: 'split_process'`
   - 消息：`文件超大，必须拆分处理`

2. **文件大小 > 5 MB**（n8n 工作流判断）
   - 返回 `recommendation.action: 'split_process'`
   - 消息：`文件大小 X MB，超过 5 MB 限制，建议拆分`

### 拆分策略

根据 `athenaService.js` 中的 `splitQuery` 方法：

- **默认批次大小**: 50,000 条记录
- **拆分策略**:
  - `date_range`: 按日期范围拆分（默认）
  - `id_range`: 按 ID 范围拆分
  - `hash_partition`: 按哈希分区拆分

## API 使用示例

### 请求格式

```json
POST /api/query/file-size/batch
{
  "queryIds": [
    "query-id-1",
    "query-id-2",
    "query-id-3"
  ]
}
```

### 响应格式

```json
{
  "success": true,
  "data": [
    {
      "queryId": "query-id-1",
      "fileSize": {
        "totalSizeBytes": 52428800,
        "totalSizeMB": 50.0,
        "totalSizeGB": 0.0488,
        "fileCount": 1,
        "formattedSize": "50.0 MB",
        "contentType": "text/csv",
        "lastModified": "2025-11-27T10:00:00Z"
      },
      "recommendation": {
        "action": "export_or_batch",
        "message": "文件中等，建议导出文件或分批处理",
        "reason": "文件大小 50.00 MB，可以导出为文件或分批处理",
        "threshold": "medium",
        "minSize": 10,
        "maxSize": 500
      },
      "bucket": "aws-athena-query-results-us-west-2-xxx",
      "fileKey": "query-id-1/query-id-1.csv"
    }
  ]
}
```

## 处理流程建议

### 1. 小文件（< 10 MB）
- 直接下载并处理
- 无需拆分

### 2. 中等文件（10-500 MB）
- 可以导出为文件
- 或分批处理
- 根据实际需求选择

### 3. 大文件（> 1000 MB）
- **必须拆分处理**
- 使用拆分查询 API (`/api/query/split`)
- 按日期范围、ID 范围或哈希分区拆分

## 注意事项

1. **文件路径查找**: API 会尝试多个可能的文件路径，如果都找不到，会返回 `null`
2. **权限要求**: 优先使用 HeadObject（只需要读取权限），如果失败才尝试 ListObjects（需要列出权限）
3. **批量限制**: 建议一次查询不超过 50 个 queryId（参考 `/api/query/count/batch` 的限制）
4. **文件大小计算**: 如果查询结果包含多个文件，会计算所有文件的总大小

## 相关代码位置

- **文件大小获取**: `backend/services/athenaService.js`
  - `getResultFileSizeByQueryId()` - 根据 queryId 获取文件大小
  - `getResultFileSizeByHeadObject()` - 使用 HeadObject 获取单个文件大小
  - `getProcessingRecommendation()` - 根据文件大小给出处理建议

- **工作流处理**: `n8n-workflows/process-query-results-with-file-size.js`
  - 整合文件大小信息与查询结果
  - 应用 5 MB 的额外阈值判断

