# Lark HTTP Request配置指南

## 问题分析

根据官方文档，你的HTTP Request节点配置有以下问题：

### 1. 请求体格式错误
**当前配置**：
```json
"jsonBody": "={{ $json.merchant_data }}"
```

**问题**：直接发送商户数据，不符合Lark API的格式要求

### 2. 缺少valueRanges结构
**Lark API要求**：
```json
{
  "valueRanges": [
    {
      "range": "sheetId!A1:C10",
      "values": [
        ["商户名", "日期", "投注用户数"],
        ["1UWIN", "合计", 2],
        ["1UWIN", "20251015", 1]
      ]
    }
  ]
}
```

## 修正方案

### 1. 修正后的HTTP Request配置
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
  "jsonBody": "={\n  \"valueRanges\": [\n    {\n      \"range\": \"{{ $json.sheet_id }}!A1:C{{ $json.data_count + 1 }}\",\n      \"values\": {{ $json.merchant_data }}\n    }\n  ]\n}"
}
```

### 2. 数据格式化器
使用 `lark-data-formatter.js` 将商户数据转换为正确的格式：

```javascript
// 输入格式
{
  "merchant_data": [
    {
      "商户名": "1UWIN",
      "日期": "合计",
      "投注用户数": 2
    }
  ],
  "sheet_id": "3An0Va",
  "spreadsheet_token": "P5xzwpnIxiwWmTkNph5louAoggf"
}

// 输出格式
{
  "lark_request_body": {
    "valueRanges": [
      {
        "range": "3An0Va!A1:C4",
        "values": [
          ["商户名", "日期", "投注用户数"],
          ["1UWIN", "合计", 2],
          ["1UWIN", "20251015", 1],
          ["1XPOKIES", "合计", 4]
        ]
      }
    ]
  }
}
```

## 配置步骤

### 1. 添加数据格式化器
1. 在HTTP Request节点前添加Code节点
2. 使用 `lark-data-formatter.js` 代码
3. 将商户数据转换为Lark API格式

### 2. 修正HTTP Request节点
1. **URL**：使用 `spreadsheet_token` 而不是硬编码
2. **请求体**：使用 `lark_request_body` 字段
3. **范围**：动态计算数据范围

### 3. 完整的工作流
```
上游数据 → 数据格式化器 → HTTP Request → Lark API
```

## 关键修正点

### 1. URL修正
```javascript
// 修正前
"url": "=https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/P5xzwpnIxiwWmTkNph5louAoggf/values_batch_update"

// 修正后
"url": "=https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/{{ $json.spreadsheet_token }}/values_batch_update"
```

### 2. 请求体修正
```javascript
// 修正前
"jsonBody": "={{ $json.merchant_data }}"

// 修正后
"jsonBody": "={{ $json.lark_request_body }}"
```

### 3. 范围计算
```javascript
// 动态计算范围
"range": "{{ $json.sheet_id }}!A1:C{{ $json.data_count + 1 }}"
```

## 注意事项

1. **数据格式**：确保商户数据是数组格式
2. **范围计算**：范围必须大于等于数据占用的范围
3. **表头**：第一行必须是表头
4. **数据类型**：数值类型会自动转换

现在你的HTTP Request节点应该能正确调用Lark API了！
