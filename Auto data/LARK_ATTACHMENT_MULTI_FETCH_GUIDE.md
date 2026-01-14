# Lark邮件附件批量下载指南

## 📋 概述

当需要批量下载Lark邮件的附件时，使用多附件聚合器自动处理多个邮件及其附件。

## 🎯 应用场景

### 场景1：多封邮件，每封只有一个附件
- 月度报表邮件：每封邮件只有一个目标附件
- 附件筛选器已经选择好目标附件

### 场景2：单封邮件，多个附件
- 周度报表邮件：一封邮件包含多个附件
- 需要下载所有附件

### 场景3：混合场景
- 多封邮件，每封有不同的附件需求
- 月度邮件下载单个目标附件
- 周度邮件下载所有附件

## 🔧 工作流配置

### 基础流程

```
[邮件筛选器] -> [附件聚合器] -> [HTTP下载] -> [处理结果]
```

### 详细步骤

#### 第一步：邮件筛选（上游）

**使用邮件筛选器节点**（从之前的4个筛选器中选择）：
- `lark-email-filter-last-week.js` - 上周周度
- `lark-email-filter-2weeks-ago.js` - 上上周周度
- `lark-email-filter-last-month.js` - 上月月度
- `lark-email-filter-2months-ago.js` - 上上月月度

**上游需要同时提供 tenant_access_token**

#### 第二步：附件聚合器（新增Code节点）

**节点类型**: Code

**代码内容**: 使用 `backend/lark-attachment-multi-fetcher.js`

**功能**:
- 自动查找 `tenant_access_token`
- 遍历所有筛选出的邮件
- 为每封邮件生成附件下载请求
- 月度邮件：使用 `target_attachment`（单个）
- 周度邮件：使用所有附件

**输出示例**：
```json
{
  "method": "GET",
  "url": "https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/poon@gaming-panda.com/messages/aHNTR1VWMDlIeTlsb1YwUk8yVXJwSnJLS2NjPQ==/attachments/download_url",
  "headers": {
    "Authorization": "Bearer t-g206b36o2YZCXUGVOQZMGO62NJP7QER7JSAPW3J3",
    "Content-Type": "application/json"
  },
  "message_id": "aHNTR1VWMDlIeTlsb1YwUk8yVXJwSnJLS2NjPQ==",
  "message_index": 0,
  "attachment_id": "Wvg8bKugFo7Hrkx7StXlnaG5gHc",
  "attachment_filename": "weekly_summary_20251020_20251026.xlsx",
  "attachment_type": 1,
  "attachment_index": 0,
  "subject": "【即时】周度详细汇总报表 - 2025-10-20 至 2025-10-26",
  "sender": "billing@gaming-panda.com",
  "mode": "weekly_2weeks_ago",
  "target_week_range": "2025-10-20 至 2025-10-26",
  "target_week_start": "2025-10-20",
  "target_week_end": "2025-10-26"
}
```

#### 第三步：HTTP下载请求

**HTTP Request节点配置**：

```json
{
  "url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}",
  "method": "GET",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "={{ $json.headers.Authorization }}"
      },
      {
        "name": "Content-Type",
        "value": "={{ $json.headers['Content-Type'] }}"
      }
    ]
  }
}
```

**重要**：URL需要添加 `attachment_id` 查询参数！

## 📊 输入数据格式

### 月度邮件示例

```json
{
  "message_id": "LzExRUJoa3JtMGRUTk5jRzlpQVArcENSZjEwPQ==",
  "subject": "【即时】月度详细汇总报表 - 2025年10月",
  "sender": "billing@gaming-panda.com",
  "target_attachment": {
    "attachment_type": 1,
    "filename": "202510_merchant_provider_currency.xlsx",
    "id": "POXxbWtMwohUoExulbCltBY1gig"
  },
  "attachment_download_url": "https://open.larksuite.com/open-apis/mail/v1/user_mailboxes/poon@gaming-panda.com/messages/LzExRUJoa3JtMGRUTk5jRzlpQVArcENSZjEwPQ==/attachments/download_url",
  "mode": "monthly_last_month",
  "target_month": "2025年10月",
  "target_year_month": "202510",
  "target_attachment_name": "202510_merchant_provider_currency.xlsx",
  "email_data": { ... }
}
```

### 周度邮件示例

```json
{
  "message_id": "aHNTR1VWMDlIeTlsb1YwUk8yVXJwSnJLS2NjPQ==",
  "subject": "【即时】周度详细汇总报表 - 2025-10-20 至 2025-10-26",
  "sender": "billing@gaming-panda.com",
  "mode": "weekly_2weeks_ago",
  "target_week_range": "2025-10-20 至 2025-10-26",
  "target_week_start": "2025-10-20",
  "target_week_end": "2025-10-26",
  "email_data": {
    "code": 0,
    "data": {
      "message": {
        "attachments": [
          {
            "attachment_type": 1,
            "filename": "weekly_summary_20251020_20251026.xlsx",
            "id": "Wvg8bKugFo7Hrkx7StXlnaG5gHc"
          }
        ]
      }
    }
  }
}
```

### tenant_access_token（单独提供）

可以是独立的输入项：
```json
{
  "tenant_access_token": "t-g206b36o2YZCXUGVOQZMGO62NJP7QER7JSAPW3J3"
}
```

## 🔍 处理逻辑详解

### 附件选择策略

| 邮件类型 | 附件来源 | 数量 | 说明 |
|---------|---------|------|------|
| 月度 | `target_attachment` | 1个 | 筛选器已选择目标附件 |
| 周度 | `email_data.data.message.attachments` | 多个 | 下载所有附件 |

### 遍历逻辑

1. **查找token**：从所有输入项中查找 `tenant_access_token`
2. **遍历邮件**：处理所有包含 `message_id` 的输入项
3. **确定附件**：
   - 月度：使用 `target_attachment`
   - 周度：遍历 `email_data.data.message.attachments`
4. **生成请求**：为每个附件生成独立的HTTP请求对象
5. **返回数组**：返回所有下载请求

### 输出字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `url` | 附件下载URL | `https://open.larksuite.com/open-apis/mail/v1/...` |
| `headers` | HTTP请求头 | 包含 Authorization 和 Content-Type |
| `message_id` | 邮件ID | `aHNTR1VWMDlIeTlsb1YwUk8yVXJwSnJLS2NjPQ==` |
| `message_index` | 邮件序号 | `0, 1, 2...` |
| `attachment_id` | 附件ID | `Wvg8bKugFo7Hrkx7StXlnaG5gHc` |
| `attachment_filename` | 附件文件名 | `weekly_summary_20251020_20251026.xlsx` |
| `attachment_index` | 附件序号 | `0, 1, 2...` |
| `mode` | 筛选模式 | `weekly_2weeks_ago` |
| `target_*` | 目标时间信息 | 根据模式不同而不同 |

## ⚠️ 注意事项

### 1. Token必须提供

- `tenant_access_token` 必须在上游提供
- 可以单独作为输入项，也可以和其他数据一起
- 聚合器会从所有输入项中查找

### 2. HTTP请求配置

**重要**：URL必须包含 `attachment_id` 查询参数！

```json
"url": "={{ $json.url }}?attachment_id={{ $json.attachment_id }}"
```

### 3. 错误处理

聚合器会在以下情况返回错误：
- 未找到 `tenant_access_token`
- 邮件数据格式不正确

### 4. 空结果

如果没有可下载的附件，返回：
```json
{
  "status": "empty",
  "message": "没有可下载的附件",
  "timestamp": "2025-11-03T15:00:00.000Z"
}
```

## 📝 完整工作流示例

```
┌─────────────────────────┐
│  获取tenant_access_token │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│   Lark邮件筛选器       │  <-- 选择一个筛选器
│   (last-week / last-   │     或合并多个筛选器结果
│    month / etc.)       │
└────────────┬────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌────────────┐ ┌────────────┐
│ 邮件数据1  │ │ 邮件数据2  │
└────────────┘ └────────────┘
      │             │
      └──────┬──────┘
             │
┌────────────▼────────────┐
│ 附件下载聚合器          │  <-- Code节点：lark-attachment-multi-fetcher.js
└────────────┬────────────┘     输出：N个下载请求
             │
┌────────────▼────────────┐
│  HTTP Request           │  <-- 下载每个附件
│  (Loop自动处理)         │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  处理下载结果           │
└─────────────────────────┘
```

## 🔗 相关文件

- `backend/lark-attachment-multi-fetcher.js` - 附件聚合器代码
- `backend/lark-email-filter-*.js` - 邮件筛选器（4个）
- `backend/fixed-lark-merchant-writer.js` - Lark数据写入器（参考）

## 📚 相关文档

- [Lark开放平台 - 邮件附件API](https://open.larksuite.com/document/server-docs/docs/email/docs/mail-v1/attachment/download)
- [n8n HTTP Request文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Lark Sheets批量拉取指南](./LARK_SHEET_BATCH_FETCH_GUIDE.md)









