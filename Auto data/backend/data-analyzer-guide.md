# 数据结构分析器使用指南

## 功能概述

这个分析器能够深度分析上游数据的完整结构，帮助你理解数据格式和字段关系。

## 分析器类型

### 1. 基础分析器 (`data-structure-analyzer.js`)
- 分析第一个输入项的基本结构
- 详细分析每个字段的类型和内容
- 生成结构化的分析报告

### 2. 详细分析器 (`detailed-data-analyzer.js`)
- 分析所有输入项
- 深度分析嵌套对象和数组
- 生成综合分析报告

## 分析内容

### 基础信息
- 数据类型（object、array、string等）
- 是否为数组
- 主要字段列表
- 字段数量

### 字段详细分析
- 每个字段的类型
- 数组长度（如果是数组）
- 对象字段（如果是对象）
- 实际值（如果是基本类型）

### 特殊字段分析
- `data` 字段的详细结构
- `replies` 字段的内容
- `sheets` 字段的内容
- `merchant_data` 字段的内容
- `table_name` 字段的值
- `tenant_access_token` 字段的值

## 输出格式

### 基础分析器输出
```javascript
{
  "input_count": 1,
  "data_type": "object",
  "is_array": false,
  "main_fields": ["code", "data", "msg", "table_name", "tenant_access_token", "merchant_data"],
  "has_data": true,
  "has_replies": true,
  "has_sheets": false,
  "has_spreadsheet_token": true,
  "has_merchant_data": true,
  "has_table_name": true,
  "has_tenant_access_token": true,
  "analysis_time": "2025-10-22T06:44:28.706Z"
}
```

### 详细分析器输出
```javascript
{
  "total_inputs": 1,
  "first_input_analysis": {
    "type": "object",
    "is_array": false,
    "fields": ["code", "data", "msg", "table_name", "tenant_access_token", "merchant_data"],
    "has_code": true,
    "has_data": true,
    "has_msg": true,
    "has_table_name": true,
    "has_tenant_access_token": true,
    "has_merchant_data": true
  },
  "data_structure": {
    "has_replies": true,
    "has_sheets": false,
    "has_spreadsheetToken": true,
    "replies_count": 1,
    "sheets_count": 0
  },
  "merchant_data_analysis": {
    "count": 10,
    "sample": {
      "商户名": "1UWIN",
      "日期": "合计",
      "投注用户数": 2
    }
  },
  "analysis_time": "2025-10-22T06:44:28.706Z"
}
```

## 使用场景

1. **数据结构理解**：快速了解上游数据的结构
2. **字段映射**：确定需要处理的字段
3. **错误调试**：找出数据结构问题
4. **代码优化**：根据数据结构优化处理逻辑

## 使用方法

1. 将分析器代码放入n8n的Code节点
2. 连接上游数据源
3. 查看控制台输出和返回的分析报告
4. 根据分析结果调整后续处理逻辑

## 注意事项

1. 分析器会输出大量调试信息到控制台
2. 建议先使用基础分析器，再使用详细分析器
3. 分析结果可以帮助你理解数据结构
4. 根据分析结果调整后续的数据处理代码

现在你可以使用这个分析器来深入了解你的数据结构了！





