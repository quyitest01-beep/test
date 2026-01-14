# 修正版Sheet匹配器使用指南

## 问题分析

根据数据结构分析结果，发现了以下问题：

### 数据结构问题
1. **输入项数量**：有2个输入项，不是1个
2. **数据分离**：API响应和业务数据分别在不同的输入项中
3. **字段缺失**：第一个输入项缺少 `table_name`、`tenant_access_token`、`merchant_data` 字段

### 分析结果解读
```javascript
{
  "total_inputs": 2,  // 有2个输入项
  "first_input_analysis": {
    "has_data": true,           // 第一个输入项有data字段
    "has_table_name": false,    // 第一个输入项没有table_name
    "has_tenant_access_token": false,  // 第一个输入项没有token
    "has_merchant_data": false  // 第一个输入项没有商户数据
  },
  "data_structure": {
    "has_replies": true,        // 第一个输入项有replies字段
    "has_sheets": false,        // 第一个输入项没有sheets字段
    "replies_count": 1          // 有1个reply
  }
}
```

## 修正方案

### 1. 多输入项处理
```javascript
// 处理第一个输入项（API响应）
if (inputs[0].json.code === 0 && inputs[0].json.data) {
  apiResponse = inputs[0].json;
}

// 处理第二个输入项（业务数据）
if (inputs.length > 1 && inputs[1].json) {
  const secondInput = inputs[1].json;
  // 获取table_name, tenant_access_token, merchant_data
}
```

### 2. 数据合并
- 从第一个输入项获取API响应和sheet信息
- 从第二个输入项获取业务数据
- 合并所有必要信息

### 3. Sheet匹配逻辑
```javascript
// 优先从replies中获取sheet信息
if (apiResponse.data.replies && apiResponse.data.replies[0].addSheet) {
  matchedSheet = apiResponse.data.replies[0].addSheet;
}

// 如果没有replies，从sheets中查找
if (!matchedSheet && apiResponse.data.sheets) {
  // 查找匹配的sheet
}
```

## 输出格式

```javascript
{
  "table_name": "20251013-19商户活跃用户数",
  "sheet_id": "3An0Va",
  "sheet_title": "20251013-19商户活跃用户数",
  "spreadsheet_token": "P5xzwpnIxiwWmTkNph5louAoggf",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S",
  "merchant_data": [
    {
      "商户名": "1UWIN",
      "日期": "合计",
      "投注用户数": 2
    }
    // ... 更多商户数据
  ],
  "data_count": 10,
  "matched_at": "2025-10-22T07:00:37.981Z"
}
```

## 主要改进

1. **多输入项支持**：正确处理2个输入项
2. **数据分离处理**：分别处理API响应和业务数据
3. **智能匹配**：优先使用replies，备选sheets
4. **完整输出**：包含所有必要字段

## 使用建议

1. 确保上游节点输出2个数据项
2. 第一个数据项包含API响应
3. 第二个数据项包含业务数据
4. 检查输出是否包含所有必要字段

现在这个修正版应该能正确处理你的数据结构了！





