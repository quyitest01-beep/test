# 数组格式商户数据处理器使用指南

## 功能概述

这个处理器专门处理数组格式的上游数据，能够同时完成商户匹配和输出最终的活跃用户数据。

## 上游数据结构

### 数组格式数据
```javascript
[
  {
    "status": "success",
    "timestamp": "2025-10-22T05:34:29.534Z",
    "statistics": {
      "total_rows": 1998,
      "processed_rows": 201,
      "skipped_rows": 1797,
      "production_merchants": 201,
      "success_rate": "10.1%"
    },
    "filtered_merchants": [
      {
        "sub_merchant_name": "betfiery",
        "main_merchant_name": "RD1",
        "merchant_id": 1698202251
      }
      // ... 更多商户映射数据
    ]
  },
  // 商户映射数据
  {
    "sub_merchant_name": "betfiery",
    "main_merchant_name": "RD1",
    "merchant_id": 1698202251
  },
  // 活跃用户数据
  {
    "date_str": "20251013",
    "merchant": "1752222840",
    "daily_unique_users": "3",
    "dataType": "merchant_daily",
    "originalIndex": 31
  },
  {
    "period_range": "20251013-20251019",
    "merchant": "1751256462",
    "weekly_unique_users": "1",
    "active_days": "1",
    "dataType": "merchant_weekly",
    "originalIndex": 6810
  }
]
```

## 数据识别逻辑

### 1. 商户映射数据识别
```javascript
// 检查是否有商户映射字段
if (item.sub_merchant_name && item.merchant_id && item.main_merchant_name) {
  // 识别为商户映射数据
}
```

### 2. 活跃用户数据识别
```javascript
// 检查是否有活跃用户字段
if (item.merchant && (item.daily_unique_users || item.weekly_unique_users)) {
  // 识别为活跃用户数据
}
```

### 3. 嵌套对象识别
```javascript
// 检查是否包含 filtered_merchants 字段
if (item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
  // 处理嵌套的商户映射数据
}
```

## 处理流程

### 1. 数据收集
- 遍历数组中的每个元素
- 根据字段特征识别数据类型
- 分别收集商户映射数据和活跃用户数据

### 2. 商户匹配
- 构建商户ID到商户名的映射表
- 将商户ID替换为商户名
- 标记匹配成功/失败状态

### 3. 数据格式化
- 按商户名分组收集活跃用户数据
- 计算每个商户的总用户数
- 按商户名A→Z排序
- 生成Lark表格格式数据

## 输出数据格式

### Lark表格格式
```javascript
{
  "商户名": "betfiery",
  "日期": "合计",
  "投注用户数": 1525
}
```

```javascript
{
  "商户名": "betfiery",
  "日期": "20251013",
  "投注用户数": 1525
}
```

## 特性

1. **数组处理**：专门处理数组格式的上游数据
2. **智能识别**：根据字段特征自动识别数据类型
3. **商户匹配**：自动完成商户ID到商户名的映射
4. **数据聚合**：自动计算商户总用户数
5. **排序功能**：支持中英文混合排序
6. **格式统一**：输出标准的Lark表格格式

## 使用场景

1. **商户数据报告**：生成完整的商户活跃用户报告
2. **数据导出**：将处理后的数据导出到Lark表格
3. **数据分析**：为后续数据分析提供格式化数据

## 注意事项

1. 确保上游数据是数组格式
2. 商户ID必须是数字类型
3. 用户数字段会自动转换为数字类型
4. 日期格式为 YYYYMMDD 字符串

## 调试信息

处理器会输出详细的调试信息：
- 数据结构分析
- 数据识别结果
- 商户匹配统计
- 数据格式化结果
- 最终输出示例

现在你可以使用这个处理器来处理数组格式的商户数据了！





