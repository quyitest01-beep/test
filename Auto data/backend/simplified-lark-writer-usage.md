# 简化版Lark子表创建器使用说明

## 主要改进

### 1. 精简输出结构
**之前的问题：** 输出包含大量重复数据，如 `status`、`message`、`timestamp`、`summary` 等冗余字段。

**现在的优化：** 只输出写入Lark表所需的核心数据：
- `table_name`: 子表名称
- `stat_type`: 统计类型
- `month_str`: 月份字符串
- `tenant_access_token`: 访问令牌
- `spreadsheet_token`: 表格令牌
- `lark_data`: 格式化后的Lark数据（headers + rows）
- `create_sheet_request`: 创建工作表的API请求配置
- `write_data_request`: 写入数据的API请求配置

### 2. 去除重复数据
**之前的问题：** 同一个月份的 `merchant_daily` 和 `merchant_monthly` 数据生成了两个相同名称的子表（`202510商户活跃用户数`），导致数据重复。

**现在的优化：** 通过 `stat_type` 和 `month_str` 的组合作为分组键（`groupKey`），确保每个唯一组合只生成一个输出项。

### 3. 输出示例

```json
[
  {
    "json": {
      "table_name": "202510商户活跃用户数",
      "stat_type": "merchant_daily",
      "month_str": "202510",
      "tenant_access_token": "t-g206al9TU7M7E7C44VADEXRJ5XJ7ME2XBFCMXABA",
      "spreadsheet_token": "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
      "lark_data": {
        "headers": ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
        "rows": [
          ["20251013", "betfiery", "1698202251", "RD1", "1525", "merchant", "已匹配", 13488],
          ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489]
        ],
        "total_rows": 433
      },
      "create_sheet_request": {
        "method": "POST",
        "url": "https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/CKMvwOH4GiUtHhkYTW9lkW3RgGh/sheets_batch_update",
        "headers": {
          "Authorization": "Bearer t-g206al9TU7M7E7C44VADEXRJ5XJ7ME2XBFCMXABA",
          "Content-Type": "application/json; charset=utf-8"
        },
        "body": {
          "requests": [
            {
              "addSheet": {
                "properties": {
                  "title": "202510商户活跃用户数",
                  "index": 0
                }
              }
            }
          ]
        }
      },
      "write_data_request": {
        "method": "POST",
        "url": "https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/CKMvwOH4GiUtHhkYTW9lkW3RgGh/values_batch_update",
        "headers": {
          "Authorization": "Bearer t-g206al9TU7M7E7C44VADEXRJ5XJ7ME2XBFCMXABA",
          "Content-Type": "application/json; charset=utf-8"
        },
        "body": {
          "valueRange": {
            "range": "202510商户活跃用户数!A1:H434",
            "values": [
              ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
              ["20251013", "betfiery", "1698202251", "RD1", "1525", "merchant", "已匹配", 13488],
              ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489]
            ]
          }
        }
      }
    }
  }
]
```

## n8n工作流配置

### 节点配置
1. **Code节点（简化版Lark子表创建器）**
   - 将 `backend/simplified-lark-writer.js` 的代码复制到节点中
   - 确保上游节点提供了 `tenant_access_token` 和商户数据

2. **后续节点**
   - 使用 `{{ $json.create_sheet_request }}` 调用创建工作表API
   - 使用 `{{ $json.write_data_request }}` 调用写入数据API

### 数据流
```
Lark Token获取 → 商户数据获取 → 商户匹配 → 简化版Lark子表创建器 → HTTP Request (创建子表) → HTTP Request (写入数据)
```

## 关键改进点

1. **去除冗余字段**：移除了 `status`、`message`、`timestamp`、`summary` 等字段
2. **避免重复数据**：通过分组键确保每个唯一组合只生成一个输出
3. **精简输出**：只保留API请求所需的核心数据
4. **清晰的数据结构**：便于下游HTTP Request节点直接使用

## 注意事项

- `spreadsheet_token` 目前硬编码为 `CKMvwOH4GiUtHhkYTW9lkW3RgGh`，如需修改请更新代码
- 表名生成规则：`{year}{month}{typeName}`，例如 `202510商户活跃用户数`
- 数据范围：`{tableName}!A1:H{total_rows + 1}`







