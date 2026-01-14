# 灵活的SQL生成器使用指南

## 功能概述

这个SQL生成器支持灵活的时间查询，可以根据输入的时间数据动态生成相应的SQL查询。

## 支持的时间类型

### 1. 上周查询（4个SQL）
- `merchantDailyLastWeek`: 商户维度上周每日统计
- `gameDailyLastWeek`: 游戏维度上周每日统计  
- `merchantWeeklyTotal`: 商户维度上周合计
- `gameWeeklyTotal`: 游戏维度上周合计

### 2. 上月查询（4个SQL）
- `merchantDailyLastMonth`: 商户维度上月每日统计
- `gameDailyLastMonth`: 游戏维度上月每日统计
- `merchantMonthlyTotal`: 商户维度上月合计
- `gameMonthlyTotal`: 游戏维度上月合计

## 输入数据格式

### 上周数据字段
```javascript
{
  lastWeekStart: "2025-10-14",
  lastWeekEnd: "2025-10-20", 
  lastWeekRange: "2025-10-14-2025-10-20"
}
```

### 上月数据字段
```javascript
{
  lastMonthStart: "2025-10-01",
  lastMonthEnd: "2025-10-31",
  lastMonthRange: "2025-10-01-2025-10-31",
  lastMonthMonth: "202510"
}
```

## 使用场景

### 场景1：只有上周数据
```javascript
// 输入
{
  lastWeekStart: "2025-10-14",
  lastWeekEnd: "2025-10-20",
  lastWeekRange: "2025-10-14-2025-10-20"
}

// 输出：生成4个上周查询
```

### 场景2：只有上月数据
```javascript
// 输入
{
  lastMonthStart: "2025-10-01",
  lastMonthEnd: "2025-10-31", 
  lastMonthRange: "2025-10-01-2025-10-31"
}

// 输出：生成4个上月查询
```

### 场景3：同时有上周和上月数据
```javascript
// 输入
{
  lastWeekStart: "2025-10-14",
  lastWeekEnd: "2025-10-20",
  lastWeekRange: "2025-10-14-2025-10-20",
  lastMonthStart: "2025-10-01", 
  lastMonthEnd: "2025-10-31",
  lastMonthRange: "2025-10-01-2025-10-31"
}

// 输出：生成8个查询（4个上周 + 4个上月）
```

## 输出格式

```javascript
{
  success: true,
  timeData: {
    lastWeek: { start: "2025-10-14", end: "2025-10-20", range: "2025-10-14-2025-10-20" },
    lastMonth: { start: "2025-10-01", end: "2025-10-31", range: "2025-10-01-2025-10-31" }
  },
  queries: {
    merchantDailyLastWeek: "SELECT ...",
    gameDailyLastWeek: "SELECT ...",
    merchantWeeklyTotal: "SELECT ...",
    gameWeeklyTotal: "SELECT ...",
    merchantDailyLastMonth: "SELECT ...",
    gameDailyLastMonth: "SELECT ...",
    merchantMonthlyTotal: "SELECT ...",
    gameMonthlyTotal: "SELECT ..."
  },
  queryCount: 8,
  hasLastWeek: true,
  hasLastMonth: true
}
```

## 特性

1. **灵活适配**：自动检测输入的时间数据，只生成有数据的查询
2. **智能判断**：根据时间数据的完整性决定生成哪些查询
3. **清晰输出**：提供详细的查询信息和统计数据
4. **易于使用**：支持各种时间数据组合

## 注意事项

1. 确保时间字段名称正确
2. 时间格式为 YYYY-MM-DD
3. 如果没有相应的时间数据，对应的查询不会生成
4. 查询数量会根据输入数据动态变化

现在你可以根据实际需求灵活使用这个SQL生成器了！






