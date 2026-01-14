# 智能数据拆分器使用指南

## 功能概述

这个数据拆分器能够根据字段特征智能识别4种数据类型，并添加相应的标记，方便后续的Switch节点进行数据分流。

## 识别的数据类型

### 1. 商户按日数据 (`merchant_daily`)
**特征字段**：
- `merchant`: 商户ID
- `daily_unique_users`: 每日唯一用户数
- `date_str`: 日期字符串
- **没有** `game_id` 字段

**示例数据**：
```json
{
  "date_str": "20251013",
  "merchant": "1698202251", 
  "daily_unique_users": "1525"
}
```

### 2. 游戏按日数据 (`game_daily`)
**特征字段**：
- `game_id`: 游戏ID
- `merchant`: 商户ID
- `daily_unique_users`: 每日唯一用户数
- `date_str`: 日期字符串

**示例数据**：
```json
{
  "date_str": "20251013",
  "merchant": "1698202251",
  "game_id": "1698217738259",
  "daily_unique_users": "222"
}
```

### 3. 商户汇总数据 (`merchant_weekly`)
**特征字段**：
- `merchant`: 商户ID
- `weekly_unique_users`: 周汇总唯一用户数
- `period_range`: 时间范围
- `active_days`: 活跃天数
- **没有** `game_id` 字段

**示例数据**：
```json
{
  "period_range": "20251013-20251019",
  "merchant": "1750662197",
  "weekly_unique_users": "1",
  "active_days": "1"
}
```

### 4. 游戏汇总数据 (`game_weekly`)
**特征字段**：
- `game_id`: 游戏ID
- `merchant`: 商户ID
- `weekly_unique_users`: 周汇总唯一用户数
- `period_range`: 时间范围
- `active_days`: 活跃天数

**示例数据**：
```json
{
  "period_range": "20251013-20251019",
  "merchant": "1756280066",
  "game_id": "1698217743605",
  "weekly_unique_users": "850",
  "active_days": "7"
}
```

## 识别逻辑

### 优先级判断
1. **精确匹配**：根据关键字段组合进行精确判断
2. **字段推断**：根据字段存在性进行推断
3. **stat_type**：如果有stat_type字段，直接使用

### 判断规则
```javascript
// 游戏按日数据
if (game_id && merchant && daily_unique_users && date_str) {
  dataType = 'game_daily';
}

// 商户按日数据  
if (merchant && daily_unique_users && date_str && !game_id) {
  dataType = 'merchant_daily';
}

// 游戏汇总数据
if (game_id && merchant && weekly_unique_users && period_range) {
  dataType = 'game_weekly';
}

// 商户汇总数据
if (merchant && weekly_unique_users && period_range && !game_id) {
  dataType = 'merchant_weekly';
}
```

## 输出格式

每条数据都会添加以下字段：
- `dataType`: 识别出的数据类型
- `originalIndex`: 原始数据索引

```json
{
  "date_str": "20251013",
  "merchant": "1698202251",
  "daily_unique_users": "1525",
  "dataType": "merchant_daily",
  "originalIndex": 0
}
```

## 统计信息

处理完成后会输出各类型数据的统计：
```
数据类型统计: {
  "merchant_daily": 150,
  "game_daily": 300, 
  "merchant_weekly": 25,
  "game_weekly": 75
}
```

## 配合Switch节点使用

在n8n工作流中，可以配合Switch节点进行数据分流：

1. **Switch节点配置**：根据 `dataType` 字段进行分流
2. **4个输出分支**：分别对应4种数据类型
3. **后续处理**：每个分支可以连接不同的处理逻辑

## 优势

1. **智能识别**：无需手动指定数据类型
2. **灵活适配**：支持各种数据格式
3. **性能优化**：高效的字段判断逻辑
4. **统计信息**：提供详细的数据类型统计

现在你可以使用这个智能数据拆分器来处理各种混合数据了！
