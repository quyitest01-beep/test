# 处理Lark配置数据（已更新）使用说明

## 关键修改

### 1. **数据结构优化**
**之前的结构**：
```javascript
lark_data: {
  headers: ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
  rows: [
    ["20251013", "betfiery", "1698202662", "RD1", "1525", "merchant", "已匹配", 13488],
    ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489]
  ],
  total_rows: 2
}
```

**修改后的结构**：
```javascript
lark_data: [
  ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
  ["20251013", "betfiery", "1698202662", "RD1", "1525", "merchant", "已匹配", 13488],
  ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489]
]
```

### 2. **代码修改**
```javascript
// 修改前
lark_data: config.larkData,

// 修改后
lark_data: [config.larkData.headers, ...config.larkData.rows],
```

## 修改的好处

### 1. **简化HTTP Request配置**
**修改前**（复杂配置）：
```json
{
  "valueRanges": [
    {
      "range": "{{ $json.sheet_id }}!A1:H{{ $json.data_count + 1 }}",
      "values": [
        {{ $json.lark_data.headers }},
        {{ $json.lark_data.rows }}
      ]
    }
  ]
}
```

**修改后**（简化配置）：
```json
{
  "valueRanges": [
    {
      "range": "{{ $json.sheet_id }}!A1:H{{ $json.data_count + 1 }}",
      "values": {{ $json.lark_data }}
    }
  ]
}
```

### 2. **数据结构一致性**
- 直接符合Lark API的要求
- 不需要在HTTP Request中进行复杂的数据处理
- 减少了JSON配置的复杂性

## 使用方法

### 1. **更新代码**
将更新后的 `backend/process-lark-config-data.js` 代码复制到你的"创建Lark子表"节点中。

### 2. **简化HTTP Request配置**
使用简化后的Body配置：
```json
{
  "valueRanges": [
    {
      "range": "{{ $json.sheet_id }}!A1:H{{ $json.data_count + 1 }}",
      "values": {{ $json.lark_data }}
    }
  ]
}
```

### 3. **测试验证**
执行工作流，确认数据正确写入到Lark表格。

## 输出格式

### 修改后的输出结构
```json
{
  "status": "success",
  "message": "Lark配置数据处理完成",
  "table_name": "202510商户活跃用户数",
  "stat_type": "merchant_daily",
  "month_str": "202510",
  "data_count": 433,
  "tenant_access_token": "t-xxx",
  "spreadsheet_token": "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
  "lark_data": [
    ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
    ["20251013", "betfiery", "1698202662", "RD1", "1525", "merchant", "已匹配", 13488],
    ["20251013", "aajogo", "1698202662", "RD1", "1420", "merchant", "已匹配", 13489]
  ],
  "needs_create_sheet": true,
  "sheet_exists": false,
  "sheet_id": null,
  "create_sheet_request": { /* API请求配置 */ },
  "write_data_request": { /* API请求配置 */ },
  "summary": { /* 统计信息 */ }
}
```

## 注意事项

1. **数据完整性**：确保 `lark_data` 包含标题行和数据行
2. **列数计算**：使用 `A1:H` 表示8列
3. **行数计算**：使用 `$json.data_count + 1`（包含标题行）
4. **错误处理**：如果数据格式不正确，会抛出错误

## 优势

1. **简化配置**：HTTP Request的Body配置更简单
2. **减少错误**：避免了复杂的数据处理逻辑
3. **提高效率**：减少了数据转换步骤
4. **易于维护**：代码结构更清晰

现在试试这个更新版本，应该能够正确写入数据到Lark表格了！






