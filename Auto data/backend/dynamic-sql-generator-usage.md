# 动态SQL生成器使用指南

## 📋 概述

动态SQL生成器根据时间计算器的输出自动生成相应的查询SQL，用于n8n工作流中的商户游戏分析查询。

## 🎯 功能特点

- **自动参数替换**: 根据时间计算器输出自动替换SQL中的日期参数
- **多种查询类型**: 支持商户维度、游戏维度、每日统计、月度统计等
- **对比分析**: 支持上周和本周的对比查询
- **汇总统计**: 提供汇总统计查询
- **n8n集成**: 专为n8n工作流设计

## 🔧 使用方法

### 1. 在n8n工作流中使用

1. 添加一个 **Code** 节点
2. 将 `dynamic_sql_generator.js` 的代码复制到Code节点中
3. 确保上游节点是时间计算器
4. 运行节点

### 2. 输入数据格式

```javascript
// 时间计算器的输出格式
{
  "lastWeekRange": "20251013-20251019",
  "lastWeekStart": "20251013",
  "lastWeekEnd": "20251019",
  "thisWeekRange": "20251020-20251026",
  "thisWeekStart": "20251020",
  "thisWeekEnd": "20251026",
  "lastWeekMonth": 202510,
  "thisWeekMonth": 202510,
  "today": "2025-10-21",
  "todayDayOfWeek": 2,
  "todayDayOfWeekName": "周二"
}
```

### 3. 输出结果

```javascript
{
  "success": true,
  "timeData": { /* 时间计算器输出 */ },
  "queryParams": { /* 查询参数 */ },
  "queries": { /* 所有生成的SQL查询 */ },
  "recommendedQueries": { /* 推荐的查询 */ },
  "queryDescriptions": { /* 查询说明 */ }
}
```

## 📊 生成的查询类型

### 1. 商户维度查询

#### 上周每日统计
```sql
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251013'
    AND date_str <= '20251019'
ORDER BY date_str, merchant;
```

#### 本周每日统计
```sql
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251020'
    AND date_str <= '20251026'
ORDER BY date_str, merchant;
```

#### 上周月度统计
```sql
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '202510'
ORDER BY merchant;
```

### 2. 游戏维度查询

#### 上周每日统计
```sql
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20251013'
    AND date_str <= '20251019'
ORDER BY date_str, merchant, game_id;
```

#### 本周每日统计
```sql
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20251020'
    AND date_str <= '20251026'
ORDER BY date_str, merchant, game_id;
```

### 3. 对比分析查询

#### 上周和本周对比
```sql
SELECT 
    CASE 
        WHEN date_str >= '20251013' AND date_str <= '20251019' THEN 'last_week'
        WHEN date_str >= '20251020' AND date_str <= '20251026' THEN 'this_week'
    END AS week_type,
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND (
        (date_str >= '20251013' AND date_str <= '20251019')
        OR 
        (date_str >= '20251020' AND date_str <= '20251026')
    )
ORDER BY week_type, date_str, merchant;
```

### 4. 汇总统计查询

#### 上周和本周汇总
```sql
SELECT 
    'last_week' AS period_type,
    '20251013-20251019' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251013'
    AND date_str <= '20251019'

UNION ALL

SELECT 
    'this_week' AS period_type,
    '20251020-20251026' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251020'
    AND date_str <= '20251026'

ORDER BY period_type;
```

## 🚀 实际应用场景

### 1. 在n8n工作流中使用

```javascript
// 获取生成的SQL查询
const { queries, recommendedQueries } = $json;

// 使用推荐的查询
const weeklyComparisonSQL = recommendedQueries.weeklyComparison;
const weeklySummarySQL = recommendedQueries.weeklySummary;

// 发送到Athena执行
// 在HTTP Request节点中使用
```

### 2. 动态查询执行

```javascript
// 根据需求选择不同的查询
const queryType = 'merchantDailyLastWeek'; // 或 'weeklyComparison', 'weeklySummary'
const selectedSQL = queries[queryType];

// 构建Athena查询请求
const athenaRequest = {
  sql: selectedSQL,
  database: 'gmp'
};
```

### 3. 多查询并行执行

```javascript
// 并行执行多个查询
const parallelQueries = [
  queries.merchantDailyLastWeek,
  queries.merchantDailyThisWeek,
  queries.weeklySummary
];

// 在n8n中使用Split In Batches节点并行执行
```

## 🔍 查询参数说明

### 时间参数

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `lastWeekStart` | 上周开始日期 | 20251013 |
| `lastWeekEnd` | 上周结束日期 | 20251019 |
| `thisWeekStart` | 本周开始日期 | 20251020 |
| `thisWeekEnd` | 本周结束日期 | 20251026 |
| `lastWeekMonth` | 上周月份 | 202510 |
| `thisWeekMonth` | 本周月份 | 202510 |

### 查询类型

| 查询类型 | 说明 | 适用场景 |
|----------|------|----------|
| `merchantDailyLastWeek` | 商户维度上周每日统计 | 周报分析 |
| `merchantDailyThisWeek` | 商户维度本周每日统计 | 本周监控 |
| `merchantMonthlyLastWeek` | 商户维度上周月度统计 | 月度分析 |
| `gameDailyLastWeek` | 游戏维度上周每日统计 | 游戏周报 |
| `gameDailyThisWeek` | 游戏维度本周每日统计 | 游戏监控 |
| `gameMonthlyLastWeek` | 游戏维度上周月度统计 | 游戏月报 |
| `weeklyComparison` | 上周和本周对比 | 趋势分析 |
| `weeklySummary` | 上周和本周汇总 | 总体统计 |

## 📝 注意事项

1. **时间格式**: 所有日期参数都是YYYYMMDD格式
2. **月份格式**: 月份参数是YYYYMM格式
3. **SQL语法**: 生成的SQL符合Athena语法要求
4. **参数替换**: 所有参数都会自动替换，无需手动修改
5. **查询优化**: 生成的查询已经过优化，包含适当的索引提示

## 🔧 故障排除

### 1. 参数替换失败

```javascript
// 错误: SQL中的参数没有被替换
// 解决: 检查时间计算器的输出格式是否正确
// 确保包含必要的字段: lastWeekStart, lastWeekEnd, thisWeekStart, thisWeekEnd
```

### 2. SQL语法错误

```javascript
// 错误: 生成的SQL语法错误
// 解决: 检查Athena语法要求，确保表名和字段名正确
```

### 3. 查询结果为空

```javascript
// 错误: 查询返回空结果
// 解决: 检查时间范围是否正确，确认数据表中存在对应时间的数据
```

## 🚀 扩展功能

### 1. 添加更多查询类型

```javascript
// 可以扩展支持：
// - 季度查询
// - 年度查询
// - 自定义时间范围查询
```

### 2. 添加过滤条件

```javascript
// 可以添加：
// - 商户ID过滤
// - 游戏ID过滤
// - 其他业务条件过滤
```

### 3. 添加聚合函数

```javascript
// 可以添加：
// - 平均值计算
// - 中位数计算
// - 百分位数计算
```

## 📚 相关文件

- `dynamic_sql_generator.js` - 动态SQL生成器
- `dynamic_merchant_analytics_queries.sql` - 静态SQL查询示例
- `test-sql-generator.js` - 测试脚本
- `dynamic-sql-generator-usage.md` - 使用说明文档

## 🎯 最佳实践

### 1. 查询选择

- **日常监控**: 使用 `merchantDailyThisWeek`
- **周报分析**: 使用 `merchantDailyLastWeek`
- **趋势分析**: 使用 `weeklyComparison`
- **总体统计**: 使用 `weeklySummary`

### 2. 性能优化

- **并行执行**: 使用Split In Batches节点并行执行多个查询
- **结果缓存**: 对频繁查询的结果进行缓存
- **索引优化**: 确保Athena表有适当的索引

### 3. 错误处理

- **参数验证**: 在使用前验证时间参数的有效性
- **异常捕获**: 在n8n工作流中添加错误处理节点
- **日志记录**: 记录查询执行情况和结果

## 🔄 版本更新

### v1.0 (当前版本)
- 基础SQL生成功能
- 支持上周和本周查询
- 通过所有测试用例
- n8n集成优化

### 计划功能
- 季度和年度查询支持
- 自定义时间范围查询
- 更多聚合函数支持
- 查询结果缓存功能
