# 商户匹配器和数据格式化器使用指南

## 功能概述

这个处理器能够同时完成商户匹配和输出最终的活跃用户数据，一步到位地生成Lark表格格式的数据。

## 处理流程

### 1. 数据识别和收集
- **商户映射数据**：从 `filtered_merchants` 字段收集商户ID到商户名的映射
- **活跃用户数据**：从 `merchantData` 字段收集需要匹配的活跃用户数据

### 2. 商户匹配
- 构建商户ID到商户名的映射表
- 将商户ID替换为商户名
- 标记匹配成功/失败状态

### 3. 数据格式化
- 按商户名分组收集活跃用户数据
- 计算每个商户的总用户数
- 按商户名A→Z排序
- 生成Lark表格格式数据

## 输入数据格式

### 商户映射数据
```javascript
{
  "filtered_merchants": [
    {
      "sub_merchant_name": "betfiery",
      "main_merchant_name": "RD1",
      "merchant_id": 1698202251
    }
    // ... 更多商户数据
  ]
}
```

### 活跃用户数据
```javascript
{
  "merchantData": [
    {
      "json": {
        "merchant": "1698202251",
        "stat_type": "merchant_daily",
        "daily_unique_users": "1525",
        "date_str": "20251013"
      }
    }
    // ... 更多数据
  ]
}
```

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

## 处理逻辑

### 1. 数据识别
```javascript
// 识别商户映射数据
if (data.filtered_merchants && Array.isArray(data.filtered_merchants)) {
  // 处理商户映射数据
}

// 识别活跃用户数据
if (data.merchantData && Array.isArray(data.merchantData)) {
  // 处理活跃用户数据
}
```

### 2. 商户匹配
```javascript
// 构建映射表
const merchantIdToNameMap = new Map();
merchantMappingEntries.forEach(merchant => {
  merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
});

// 执行匹配
const merchantName = merchantIdToNameMap.get(merchantId);
if (merchantName) {
  // 匹配成功，替换为商户名
  data.merchant = merchantName;
}
```

### 3. 数据格式化
```javascript
// 按商户名分组
const merchantDataMap = new Map();
matchedResults.forEach(item => {
  const merchantName = item.json.merchant;
  // 累计用户数和每日数据
});

// 生成Lark表格数据
sortedMerchantNames.forEach(merchantName => {
  // 添加合计行
  larkTableData.push({
    商户名: merchantName,
    日期: "合计",
    投注用户数: total
  });
  
  // 添加每日数据
  dailyData.forEach(dailyItem => {
    larkTableData.push({
      商户名: merchantName,
      日期: dailyItem.date,
      投注用户数: dailyItem.users
    });
  });
});
```

## 特性

1. **一步到位**：同时完成匹配和格式化
2. **智能识别**：自动识别各种数据结构
3. **数据聚合**：自动计算商户总用户数
4. **排序功能**：支持中英文混合排序
5. **格式统一**：输出标准的Lark表格格式

## 使用场景

1. **商户数据报告**：生成完整的商户活跃用户报告
2. **数据导出**：将处理后的数据导出到Lark表格
3. **数据分析**：为后续数据分析提供格式化数据

## 注意事项

1. 确保上游数据包含 `filtered_merchants` 和 `merchantData` 字段
2. 商户ID必须是数字类型
3. 用户数字段会自动转换为数字类型
4. 日期格式为 YYYYMMDD 字符串

## 调试信息

处理器会输出详细的调试信息：
- 数据识别结果
- 商户匹配统计
- 数据格式化结果
- 最终输出示例

现在你可以使用这个处理器来一步完成商户匹配和数据格式化了！





