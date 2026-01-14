# Sheet匹配器使用指南

## 功能概述

这个Code节点能够匹配sheet title并获取对应的sheetId，同时保留商户数据和token值。

## 输入数据格式

### API响应数据
```javascript
{
  "code": 0,
  "data": {
    "properties": {
      "ownerUser": 7477875620156998000,
      "revision": 8,
      "sheetCount": 3,
      "title": "【GMP】活跃用户数"
    },
    "sheets": [
      {
        "columnCount": 20,
        "frozenColCount": 0,
        "frozenRowCount": 0,
        "index": 0,
        "rowCount": 200,
        "sheetId": "3An0Va",
        "title": "20251013-19商户活跃用户数"
      },
      {
        "columnCount": 16,
        "frozenRowCount": 0,
        "index": 1,
        "rowCount": 434,
        "sheetId": "DJYJy",
        "title": "202510商户活跃用户数"
      }
    ],
    "spreadsheetToken": "P5xzwpnIxiwWmTkNph5louAoggf"
  },
  "msg": "success"
}
```

### 商户数据
```javascript
{
  "商户名": "7COME",
  "日期": "合计",
  "投注用户数": 238
}
```

### 表名数据
```javascript
{
  "table_name": "20251013-19商户活跃用户数"
}
```

### Token数据
```javascript
{
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S"
}
```

## 输出数据格式

```javascript
{
  "table_name": "20251013-19商户活跃用户数",
  "sheet_id": "3An0Va",
  "sheet_title": "20251013-19商户活跃用户数",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S",
  "merchant_data": [
    {
      "商户名": "7COME",
      "日期": "合计",
      "投注用户数": 238
    },
    // ... 更多商户数据
  ],
  "data_count": 10,
  "spreadsheet_token": "P5xzwpnIxiwWmTkNph5louAoggf",
  "matched_at": "2025-10-22T05:34:29.534Z"
}
```

## 处理逻辑

### 1. 数据识别和分离
- **API响应识别**：检查 `code === 0` 和 `data.sheets` 数组
- **商户数据识别**：检查 `商户名` 和 `日期` 字段
- **表名识别**：检查 `table_name` 字段
- **Token识别**：检查 `tenant_access_token` 字段

### 2. Sheet匹配
```javascript
// 遍历所有sheet，查找匹配的title
for (let i = 0; i < sheets.length; i++) {
  const sheet = sheets[i];
  if (sheet.title === tableName) {
    matchedSheet = sheet;
    break;
  }
}
```

### 3. 数据整合
- 保留所有商户数据
- 保留token值
- 添加匹配的sheet信息
- 生成完整的输出数据

## 输出字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `table_name` | String | 表名 |
| `sheet_id` | String | 匹配的sheet ID |
| `sheet_title` | String | 匹配的sheet标题 |
| `tenant_access_token` | String | 保留的token值 |
| `merchant_data` | Array | 保留的商户数据 |
| `data_count` | Number | 商户数据条数 |
| `spreadsheet_token` | String | 表格token |
| `matched_at` | String | 匹配时间戳 |

## 匹配规则

### 精确匹配
- 表名必须与sheet title完全一致
- 区分大小写
- 支持中文字符

### 匹配示例
- **表名**：`20251013-19商户活跃用户数`
- **Sheet标题**：`20251013-19商户活跃用户数`
- **结果**：匹配成功，返回sheetId

## 使用场景

1. **Lark表格操作**：为Lark表格操作提供sheetId
2. **数据写入**：将商户数据写入指定的sheet
3. **表格管理**：动态管理多个sheet
4. **API调用**：为后续API调用提供必要参数

## 特性

1. **智能匹配**：自动匹配sheet title
2. **数据保留**：完整保留商户数据和token
3. **错误处理**：处理匹配失败的情况
4. **调试信息**：提供详细的匹配过程日志

## 注意事项

1. 确保输入数据包含API响应和表名
2. 表名必须与sheet title完全一致
3. 支持多个sheet的匹配
4. 保留所有必要的token值

现在你可以使用这个匹配器来获取对应的sheetId了！





