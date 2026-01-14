# 优化版Lark商户数据写入器使用指南

## 功能概述

基于参考代码的优化版Lark商户数据写入器，具有更强的错误处理、数据验证和统计功能。

## 主要改进

### 1. 异步函数结构
```javascript
async function execute() {
  try {
    // 主要逻辑
  } catch (error) {
    // 错误处理
  }
}
```

### 2. 模块化设计
- **数据获取函数**：`getApiResponse()`, `getMerchantData()`, `getTenantAccessToken()`, `getTableName()`
- **数据处理函数**：`buildOptimizedTableData()`, `groupByMerchant()`
- **HTTP请求构建**：`buildLarkSheetsWriteRequest()`
- **统计函数**：`getUniqueMerchants()`, `getTotalUsers()`

### 3. 智能数据分组
```javascript
// 按商户分组处理
const merchantGroups = groupByMerchant(sortedMerchants);

// 每个商户先添加合计行，再添加每日数据
Object.keys(merchantGroups).forEach(merchantName => {
  // 合计行
  tableData.push([merchantName, "合计", totalUsers]);
  
  // 每日数据
  dailyData.forEach(item => {
    tableData.push([merchantName, item.日期, item.投注用户数]);
  });
});
```

## 输出数据格式

### 成功输出
```javascript
{
  "status": "success",
  "message": "Lark表格数据构建完成 (优化版)",
  "timestamp": "2025-10-22T07:00:37.981Z",
  "table_name": "20251013-19商户活跃用户数",
  "sheet_id": "3An0Va",
  "sheet_title": "20251013-19商户活跃用户数",
  "spreadsheet_token": "P5xzwpnIxiwWmTkNph5louAoggf",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S",
  "merchant_data": [...],
  "data_count": 10,
  "lark_request_body": "{...}",
  "headers": ["商户名", "日期", "投注用户数"],
  "values": [...],
  "range": "3An0Va!A1:C11",
  "http_request": {...},
  "statistics": {
    "total_rows": 11,
    "total_merchants": 5,
    "total_users": 1500
  },
  "matched_at": "2025-10-22T07:00:37.981Z"
}
```

### 错误输出
```javascript
{
  "status": "error",
  "error": "错误信息",
  "timestamp": "2025-10-22T07:00:37.981Z",
  "debug_info": {
    "input_items_count": 2,
    "merchant_data_type": "object",
    "merchant_data_keys": ["code", "data", "msg"]
  }
}
```

## 数据处理逻辑

### 1. 数据排序
```javascript
// 按商户名A→Z排序
const sortedMerchants = [...merchantData].sort((a, b) => {
  const nameA = (a.商户名 || "").toUpperCase();
  const nameB = (b.商户名 || "").toUpperCase();
  return nameA.localeCompare(nameB);
});
```

### 2. 数据分组
```javascript
// 按商户分组
const merchantGroups = groupByMerchant(sortedMerchants);
```

### 3. 数据格式化
```javascript
// 每个商户的数据结构
merchantName -> {
  "合计": totalUsers,
  "20251013": dailyUsers1,
  "20251014": dailyUsers2,
  // ...
}
```

## 统计功能

### 1. 基础统计
- `total_rows`: 总行数（包含表头）
- `total_merchants`: 唯一商户数量
- `total_users`: 总用户数

### 2. 数据验证
- 检查必要字段是否存在
- 验证数据类型和格式
- 确保数据完整性

## 错误处理

### 1. 输入验证
```javascript
if (!apiResponse) {
  throw new Error("缺少API响应数据，无法获取sheet信息");
}
if (!merchantData || !Array.isArray(merchantData) || merchantData.length === 0) {
  throw new Error("商户数据无效或为空");
}
```

### 2. 错误信息
- 详细的错误消息
- 调试信息
- 错误堆栈跟踪

## 使用场景

1. **商户数据报告**：生成完整的商户活跃用户报告
2. **数据导出**：将处理后的数据导出到Lark表格
3. **数据分析**：为后续数据分析提供格式化数据
4. **自动化工作流**：集成到n8n工作流中

## 注意事项

1. **数据格式**：确保商户数据是数组格式
2. **字段名称**：使用正确的中文字段名
3. **错误处理**：检查错误输出并处理异常情况
4. **数据验证**：确保数据完整性和正确性

现在这个优化版应该能更好地处理你的商户数据了！





