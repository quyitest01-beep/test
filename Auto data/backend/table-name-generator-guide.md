# 商户表格名称生成器使用指南

## 功能概述

这个Code节点能够根据数据周期自动生成表名，并保留token值和上游数据。

## 输入数据格式

### Token数据
```javascript
{
  "code": 0,
  "expire": 7200,
  "msg": "ok",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S"
}
```

### 商户数据
```javascript
{
  "商户名": "1UWIN",
  "日期": "合计",
  "投注用户数": 2
}
```

```javascript
{
  "商户名": "1UWIN",
  "日期": "20251015",
  "投注用户数": 1
}
```

## 输出数据格式

```javascript
{
  "table_name": "20251013-19商户活跃用户数",
  "tenant_access_token": "t-g206am5yHSSQTFVMAY6LDGWVM5GR7QKTRXXFZS2S",
  "merchant_data": [
    {
      "商户名": "1UWIN",
      "日期": "合计",
      "投注用户数": 2
    },
    // ... 更多商户数据
  ],
  "data_count": 10,
  "date_range": "20251013-20251019",
  "generated_at": "2025-10-22T05:34:29.534Z"
}
```

## 处理逻辑

### 1. 数据识别和分离
- **Token识别**：检查 `tenant_access_token` 和 `code === 0`
- **商户数据识别**：检查 `商户名` 和 `日期` 字段
- **数据分离**：将token和商户数据分别处理

### 2. 日期分析
```javascript
// 收集所有日期
const dateSet = new Set();
merchantData.forEach(item => {
  if (item.日期 && item.日期.match(/^\d{8}$/)) {
    dateSet.add(item.日期);
  }
});

// 排序日期
const sortedDates = Array.from(dateSet).sort();
```

### 3. 表名生成
```javascript
// 生成表名：20251013-19商户活跃用户数
const startDate = sortedDates[0];
const endDate = sortedDates[sortedDates.length - 1];
const tableName = `${startDate}-${endDate.substring(6)}商户活跃用户数`;
```

## 表名生成规则

### 规则1：有具体日期数据
- **输入**：`20251013`, `20251014`, `20251015`, `20251016`, `20251017`, `20251018`, `20251019`
- **输出**：`20251013-19商户活跃用户数`

### 规则2：没有具体日期数据
- **输入**：只有合计数据，没有具体日期
- **输出**：`20251022商户活跃用户数`（使用当前日期）

## 输出字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `table_name` | String | 生成的表名 |
| `tenant_access_token` | String | 保留的token值 |
| `merchant_data` | Array | 保留的上游商户数据 |
| `data_count` | Number | 商户数据条数 |
| `date_range` | String | 日期范围（如：20251013-20251019） |
| `generated_at` | String | 生成时间戳 |

## 使用场景

1. **Lark表格创建**：为Lark表格生成动态表名
2. **数据周期管理**：根据数据周期自动命名表格
3. **Token传递**：保留token值用于后续API调用
4. **数据完整性**：保留原始商户数据

## 特性

1. **智能日期分析**：自动分析数据中的日期范围
2. **动态表名生成**：根据日期范围生成表名
3. **Token保留**：完整保留token值
4. **数据完整性**：保留所有上游数据
5. **错误处理**：处理各种异常情况

## 注意事项

1. 确保输入数据包含token和商户数据
2. 日期格式必须是YYYYMMDD
3. 表名生成基于实际数据中的日期
4. 如果没有具体日期，使用当前日期

现在你可以使用这个生成器来动态创建表名了！





