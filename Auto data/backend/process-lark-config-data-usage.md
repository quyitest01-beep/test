# 处理Lark配置数据使用说明

## 问题分析

根据调试结果，你的输入数据包含：

### 1. **Lark配置数据**（输入项 4-5）
```json
{
  "status": "success",
  "message": "子表创建配置完成",
  "timestamp": "2025-10-21T08:45:43.139Z",
  "stat_type": "merchant_daily",
  "month_str": "202510",
  "table_name": "202510商户活跃用户数",
  "data_count": 433,
  "tenant_access_token": "t-g206al9TU7M7E7C44VADEXRJ5XJ7ME2XBFCMXABA",
  "spreadsheet_token": "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
  "lark_data": {
    "headers": ["日期", "商户名称", "商户ID", "主商户名称", "唯一用户数", "数据类型", "匹配状态", "原始索引"],
    "rows": [["20251013", "betfiery", "1698202251", "RD1", "1525", "merchant", "已匹配", 13488]],
    "total_rows": 433
  },
  "create_sheet_request": { /* API请求配置 */ },
  "write_data_request": { /* API请求配置 */ }
}
```

### 2. **API响应数据**（输入项 0-3）
- 输入项 0-1：错误响应（`code: 90210`，`msg: "sheetTitle already exist in snapshot"`）
- 输入项 2-3：成功响应（包含sheets和spreadsheetToken）

## 解决方案

### 1. **使用新的处理代码**
将 `backend/process-lark-config-data.js` 的代码复制到你的"创建Lark子表"节点中。

### 2. **代码功能**
- ✅ 识别Lark配置数据
- ✅ 检查是否需要创建子表
- ✅ 处理API响应数据
- ✅ 生成完整的输出配置

### 3. **输出格式**
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
  "lark_data": { /* 格式化后的数据 */ },
  "needs_create_sheet": true,
  "create_sheet_request": { /* API请求配置 */ },
  "write_data_request": { /* API请求配置 */ },
  "summary": {
    "total_rows": 433,
    "matched_count": 433,
    "unmatched_count": 0,
    "match_rate": "100.0%"
  }
}
```

## 关键改进

### 1. **智能识别**
- 自动识别Lark配置数据
- 区分API响应和配置数据
- 处理错误和成功响应

### 2. **子表创建检查**
- 检查是否已存在同名子表
- 避免重复创建
- 智能判断创建需求

### 3. **完整配置**
- 包含所有必要的API请求配置
- 提供详细的统计信息
- 支持后续的HTTP Request节点

## 使用方法

### 1. **替换代码**
将 `backend/process-lark-config-data.js` 的代码复制到你的"创建Lark子表"节点中。

### 2. **运行测试**
执行工作流，查看输出结果。

### 3. **后续处理**
使用输出数据配置HTTP Request节点：
- 使用 `create_sheet_request` 创建子表
- 使用 `write_data_request` 写入数据

## 注意事项

1. **数据完整性**：确保Lark配置数据包含所有必要字段
2. **API响应**：正确处理成功和错误的API响应
3. **子表检查**：避免重复创建已存在的子表
4. **错误处理**：妥善处理各种异常情况

## 预期结果

使用新代码后，你应该看到：
- ✅ 成功识别Lark配置数据
- ✅ 正确处理API响应
- ✅ 生成完整的输出配置
- ✅ 支持后续的HTTP Request节点






