# N8N 拆分查数请求处理流程配置指南

## 概述

当查询结果文件过大（超过100MB）时，需要将查询拆分为多个小查询。本指南说明如何在现有workflow中新增拆分查数请求的处理流程。

## 流程设计

### 1. 识别需要拆分的请求

**节点类型**：Code 节点  
**节点名称**：`识别拆分请求`

**代码文件**：`n8n-workflows/split-query-request-processor.js`

**功能**：
- 识别 status 包含"文件大小"、"拆分处理"等关键词的请求
- 提取文件大小信息（MB/GB）
- 提取原始查询信息（商户号、时间范围等）
- 计算建议的拆分数量

**输出格式**：
```json
{
  "chatid": -1003129050838,
  "senderid": 6681153969,
  "messagid": 58,
  "text": "商户号: 1716179958\n查一下10月的游戏记录",
  "status": "文件大小 15297.60 MB，超过 100 MB 限制，必须拆分处理",
  "needsSplit": true,
  "splitReason": "文件大小 15297.60 MB，超过 100 MB 限制，必须拆分处理",
  "fileSizeMB": 15297.60,
  "fileSizeGB": 14.94,
  "estimatedFileSize": "15297.60 MB",
  "originalQuery": {
    "text": "商户号: 1716179958\n查一下10月的游戏记录",
    "merchant_id": "1716179958",
    "timeRange": "10月",
    "chatid": -1003129050838,
    "senderid": 6681153969,
    "messagid": 58
  },
  "splitStrategy": "date_range",
  "recommendedSplitCount": 153,
  "splitStatus": "pending"
}
```

### 2. 分析拆分查数请求（AI节点）

**节点类型**：Agent 节点（Google Gemini）  
**节点名称**：`分析拆分查数请求`（已存在）

**Prompt 配置**：

```
请根据以下信息分析拆分查数请求，生成拆分计划。

输入数据：
- 原始查询文本：{{ $json.text }}
- 商户号：{{ $json.originalQuery?.merchant_id || '' }}
- 时间范围：{{ $json.originalQuery?.timeRange || '' }}
- 文件大小：{{ $json.estimatedFileSize || '' }}
- 建议拆分数量：{{ $json.recommendedSplitCount || 5 }}
- 拆分策略：{{ $json.splitStrategy || 'date_range' }}
- 上下文消息：{{ JSON.stringify($json.contextMessages || []) }}
- 上一条AI回复：{{ $json.context?.lastAiReply || '' }}
- 上一条用户消息：{{ $json.context?.previousMessage || '' }}

请按照以下步骤分析：

1. **分析原始查询需求**：
   - 提取查询意图（查什么）
   - 提取查询条件（商户号、时间范围、其他条件）
   - 确定查询的三要素（who/when/what）

2. **确定拆分策略**：
   - 如果时间范围是"10月"（2025-10），按天拆分（每天一个查询）
   - 如果时间范围是"最近7天"，按天拆分
   - 如果时间范围是"上周"，按天拆分
   - 如果时间范围是具体日期，按小时拆分
   - 默认按天拆分

3. **生成拆分计划**：
   - 计算需要拆分的查询数量
   - 为每个拆分查询生成时间范围
   - 确保所有拆分查询覆盖完整的时间范围，不遗漏任何数据

4. **输出格式**（必须是纯 JSON，不要用 markdown 代码块）：

{
  "canSplit": true/false,
  "splitStrategy": "date_range",
  "splitCount": 31,
  "splitPlan": [
    {
      "part": 1,
      "startDate": "2025-10-01",
      "endDate": "2025-10-01",
      "startTime": "2025-10-01 00:00:00",
      "endTime": "2025-10-01 23:59:59",
      "description": "2025年10月1日的数据"
    },
    {
      "part": 2,
      "startDate": "2025-10-02",
      "endDate": "2025-10-02",
      "startTime": "2025-10-02 00:00:00",
      "endTime": "2025-10-02 23:59:59",
      "description": "2025年10月2日的数据"
    }
    // ... 更多拆分计划
  ],
  "originalQuery": {
    "text": "原样保留",
    "merchant_id": "原样保留",
    "timeRange": "原样保留"
  },
  "reason": "说明拆分策略和拆分计划",
  "chatid": "原样保留",
  "senderid": "原样保留",
  "messagid": "原样保留",
  "type": "原样保留"
}

如果无法拆分（信息不足），输出：
{
  "canSplit": false,
  "reason": "说明无法拆分的原因（缺少时间范围、商户号等）",
  "requiredFields": ["缺失的字段列表"],
  "suggestedQuestion": "建议用户补充的信息",
  "chatid": "原样保留",
  "senderid": "原样保留",
  "messagid": "原样保留",
  "type": "原样保留"
}
```

**System Message**：

```
你是一个查询拆分分析助手，熟悉 AWS Athena gmp.game_records 表。

你的任务是：
1. 分析需要拆分的查询请求
2. 确定最佳的拆分策略（通常按时间范围拆分）
3. 生成详细的拆分计划，确保所有拆分查询覆盖完整的时间范围

关键要求：
- 必须保留所有上游字段（chatid、senderid、messagid、type等）
- 输出必须是纯 JSON 格式，不要使用 markdown 代码块
- 拆分计划必须完整，不能遗漏任何时间范围
- 如果信息不足，必须明确说明缺少哪些字段
```

### 3. 生成拆分SQL查询（Code节点）

**节点类型**：Code 节点  
**节点名称**：`生成拆分SQL查询`

**代码文件**：`n8n-workflows/generate-split-sql-queries.js`

**功能**：
- 接收AI分析的拆分计划
- 为每个拆分计划生成一个SQL查询
- 确保每个SQL都有正确的时间范围条件
- 保留原始查询信息，用于后续合并结果

**输出格式**：
```json
{
  "chatid": -1003129050838,
  "senderid": 6681153969,
  "messagid": 58,
  "text": "商户号: 1716179958\n查一下10月的游戏记录",
  "splitPart": 1,
  "splitTotal": 31,
  "splitDescription": "2025年10月1日的数据",
  "startDate": "2025-10-01",
  "endDate": "2025-10-01",
  "startTime": "2025-10-01 00:00:00",
  "endTime": "2025-10-01 23:59:59",
  "startTimestamp": 1727740800000,
  "endTimestamp": 1727827199999,
  "sql": "SELECT ... FROM gmp.game_records WHERE ...",
  "database": "gmp",
  "originalQuery": {
    "text": "商户号: 1716179958\n查一下10月的游戏记录",
    "merchant_id": "1716179958",
    "timeRange": "10月"
  },
  "splitStatus": "pending",
  "status": "拆分查询 1/31"
}
```

### 4. 执行拆分查询（HTTP Request节点）

**节点类型**：HTTP Request 节点  
**节点名称**：`执行拆分查询`

**配置**：
- **Method**：POST
- **URL**：`https://advertisement-had-view-elevation.trycloudflare.com/api/async/start`
- **Headers**：
  - `Content-Type`: `application/json`
  - `X-API-Key`: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`
- **Body**：
  - `sql`: `={{ $json.sql }}`
  - `database`: `={{ $json.database || 'gmp' }}`

**说明**：这个节点会为每个拆分查询执行一次，生成多个查询任务。

### 5. 保存拆分查询记录（Data Table节点）

**节点类型**：Data Table 节点  
**节点名称**：`保存拆分查询记录`

**配置**：
- **Operation**：Insert row
- **Columns Mapping**：
  - `queryId`: `={{ $json.queryId }}`
  - `result`: `={{ $json.message }}`
  - `senderid`: `={{ $json.senderid }}`
  - `chatid`: `={{ $json.chatid }}`
  - `messageid`: `={{ $json.messagid }}`
  - `text`: `={{ $json.text }}`
  - `splitPart`: `={{ $json.splitPart }}`
  - `splitTotal`: `={{ $json.splitTotal }}`
  - `splitDescription`: `={{ $json.splitDescription }}`
  - `originalMessagid`: `={{ $json.originalQuery?.messagid || $json.messagid }}`

## Workflow 连接流程

```
处理上下文2
  ↓
识别拆分请求 (Code节点: split-query-request-processor.js)
  ↓
If节点 (判断 needsSplit === true)
  ├─ true → 分析拆分查数请求 (AI节点: 分析拆分查数请求)
  │          ↓
  │         解析拆分分析结果 (Code节点: parse-split-query-analysis.js)
  │          ↓
  │         If节点 (判断 canSplit === true)
  │         ├─ true → 生成拆分SQL查询 (Code节点: generate-split-sql-queries.js)
  │         │          ↓
  │         │         执行拆分查询 (HTTP Request节点: 执行拆分查询)
  │         │          ↓
  │         │         保存拆分查询记录 (Data Table节点: 保存拆分查询记录)
  │         │
  │         └─ false → 发送消息 (Telegram节点: 请求补充信息)
  │
  └─ false → 判断是否存在模板1 (原有流程)
```

## 详细节点配置

### 节点1：识别拆分请求

**节点类型**：Code 节点  
**节点名称**：`识别拆分请求`  
**代码文件**：`n8n-workflows/split-query-request-processor.js`

### 节点2：If节点（判断是否需要拆分）

**节点类型**：If 节点  
**节点名称**：`判断是否需要拆分`

**条件配置**：
- `={{ $json.needsSplit }}` equals `true`

### 节点3：分析拆分查数请求

**节点类型**：Agent 节点（Google Gemini）  
**节点名称**：`分析拆分查数请求`（已存在，需要更新Prompt）

参考上面的 Prompt 配置。

### 节点4：解析拆分分析结果

**节点类型**：Code 节点  
**节点名称**：`解析拆分分析结果`  
**代码文件**：`n8n-workflows/parse-split-query-analysis.js`

**功能**：
- 解析AI节点的输出
- 提取拆分计划
- 保留所有原始字段

### 节点5：If节点（判断是否可以拆分）

**节点类型**：If 节点  
**节点名称**：`判断是否可以拆分`

**条件配置**：
- `={{ $json.canSplit }}` equals `true`

**True分支**：生成拆分SQL查询  
**False分支**：发送消息（请求补充信息）

### 节点6：生成拆分SQL查询

**节点类型**：Code 节点  
**节点名称**：`生成拆分SQL查询`  
**代码文件**：`n8n-workflows/generate-split-sql-queries.js`

### 节点7：执行拆分查询

**节点类型**：HTTP Request 节点  
**节点名称**：`执行拆分查询`

**配置**：
- **Method**：POST
- **URL**：`https://advertisement-had-view-elevation.trycloudflare.com/api/async/start`
- **Headers**：
  - `Content-Type`: `application/json`
  - `X-API-Key`: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d`
- **Body**：
  - `sql`: `={{ $json.sql }}`
  - `database`: `={{ $json.database || 'gmp' }}`

**说明**：这个节点会为每个拆分查询执行一次，生成多个查询任务。

### 节点8：保存拆分查询记录

**节点类型**：Data Table 节点  
**节点名称**：`保存拆分查询记录`

**配置**：
- **Operation**：Insert row
- **Columns Mapping**：
  - `queryId`: `={{ $json.queryId }}`
  - `result`: `={{ $json.message }}`
  - `senderid`: `={{ $json.senderid }}`
  - `chatid`: `={{ $json.chatid }}`
  - `messageid`: `={{ $json.messagid }}`
  - `text`: `={{ $json.text }}`
  - `splitPart`: `={{ $json.splitPart }}`
  - `splitTotal`: `={{ $json.splitTotal }}`
  - `splitDescription`: `={{ $json.splitDescription }}`
  - `originalMessagid`: `={{ $json.originalQuery?.messagid || $json.messagid }}`
  - `status`: `={{ $json.status || '拆分查询已启动' }}`

## 完整配置示例

### If节点配置

**条件**：
- `={{ $json.needsSplit }}` equals `true`

### 分析拆分查数请求节点配置

参考上面的 Prompt 配置。

### 生成拆分SQL查询节点配置

参考上面的 Code 节点代码。

## 注意事项

1. **拆分策略**：默认按时间范围拆分，确保不遗漏任何数据
2. **查询数量**：根据文件大小计算建议的拆分数量，但实际拆分数量由AI分析决定
3. **原始查询信息**：必须保留原始查询的所有信息，用于后续合并结果
4. **错误处理**：如果拆分失败，应该返回错误信息并建议用户补充信息
5. **状态跟踪**：每个拆分查询都应该有状态跟踪，方便后续合并结果

## 相关文件

- `n8n-workflows/split-query-request-processor.js` - 识别拆分请求的Code节点
- `N8N_SPLIT_QUERY_REQUEST_SETUP.md` - 本配置指南

