# Lark集成最终指南

## 功能概述

基于修正版Sheet匹配器，现在代码能够直接输出Lark API需要的数据格式，无需额外的数据格式化步骤。

## 主要改进

### 1. 数据格式转换
```javascript
// 输入格式（商户数据）
{
  "merchant_data": [
    {
      "商户名": "1UWIN",
      "日期": "合计",
      "投注用户数": 2
    }
  ]
}

// 输出格式（Lark API格式）
{
  "lark_request_body": {
    "valueRanges": [
      {
        "range": "3An0Va!A1:C4",
        "values": [
          ["商户名", "日期", "投注用户数"],
          ["1UWIN", "合计", 2],
          ["1UWIN", "20251015", 1]
        ]
      }
    ]
  }
}
```

### 2. 新增字段
- `lark_request_body`: Lark API请求体
- `headers`: 表头数组
- `values`: 二维数组数据
- `range`: 数据范围

## 输出数据格式

```javascript
{
  "table_name": "20251013-19商户活跃用户数",
  "sheet_id": "3An0Va",
  "sheet_title": "20251013-19商户活跃用户数",
  "spreadsheet_token": "P5xzwpnIxiwWmTkNph5louAoggf",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S",
  "merchant_data": [...],
  "data_count": 10,
  // Lark API需要的字段
  "lark_request_body": {
    "valueRanges": [
      {
        "range": "3An0Va!A1:C11",
        "values": [
          ["商户名", "日期", "投注用户数"],
          ["1UWIN", "合计", 2],
          ["1UWIN", "20251015", 1]
        ]
      }
    ]
  },
  "headers": ["商户名", "日期", "投注用户数"],
  "values": [
    ["商户名", "日期", "投注用户数"],
    ["1UWIN", "合计", 2],
    ["1UWIN", "20251015", 1]
  ],
  "range": "3An0Va!A1:C11",
  "matched_at": "2025-10-22T07:00:37.981Z"
}
```

## HTTP Request配置

### 修正后的配置
```json
{
  "method": "POST",
  "url": "=https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/{{ $json.spreadsheet_token }}/values_batch_update",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $json.tenant_access_token }}"
      },
      {
        "name": "Content-Type",
        "value": "=application/json; charset=utf-8"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ $json.lark_request_body }}"
}
```

## 工作流程

```
上游数据 → 修正版Sheet匹配器 → HTTP Request → Lark API
```

### 1. 数据输入
- 第一个输入项：API响应数据
- 第二个输入项：业务数据（表名、token、商户数据）

### 2. 数据处理
- 匹配sheet信息
- 转换数据格式
- 生成Lark API请求体

### 3. 数据输出
- 直接输出Lark API需要的格式
- 包含所有必要字段

## 关键特性

### 1. 自动格式转换
- 将商户数据转换为二维数组
- 自动添加表头
- 生成正确的数据范围

### 2. 智能范围计算
```javascript
// 动态计算范围
range: `${sheetId}!A1:C${values.length}`
```

### 3. 完整数据保留
- 保留原始商户数据
- 添加Lark API格式
- 包含所有必要字段

## 使用步骤

1. **配置Code节点**：使用修正版Sheet匹配器代码
2. **配置HTTP Request节点**：使用提供的配置
3. **连接节点**：确保数据流正确
4. **测试运行**：检查输出结果

## 注意事项

1. **数据格式**：确保商户数据是数组格式
2. **字段名称**：使用正确的中文字段名
3. **范围计算**：范围必须大于等于数据占用的范围
4. **表头**：第一行必须是表头

现在你的工作流应该能够直接调用Lark API了！





