# 商户游戏分析视图使用指南

## 📋 概述

本指南介绍如何使用 `merchant_game_analytics` 视图来统计非10001商户的每日和合计唯一投注用户数，包括商户维度和游戏维度。

## 🗄️ 视图结构

### 视图字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `stat_type` | STRING | 统计类型：'merchant_daily', 'merchant_monthly', 'game_daily', 'game_monthly' |
| `date_str` | STRING | 日期字符串 (YYYYMMDD格式) |
| `month_str` | STRING | 月份字符串 (YYYYMM格式) |
| `merchant` | STRING | 商户ID |
| `game_id` | STRING | 游戏ID (仅游戏维度统计有值) |
| `unique_users` | BIGINT | 唯一用户数 |

### 统计类型说明

- **merchant_daily**: 商户维度每日统计
- **merchant_monthly**: 商户维度月度合计统计
- **game_daily**: 游戏维度每日统计
- **game_monthly**: 游戏维度月度合计统计

## 🔧 创建视图

### 1. 在Athena中创建视图

```sql
-- 执行 merchant_game_analytics_view.sql 中的SQL语句
-- 这将创建一个名为 merchant_game_analytics 的视图
```

### 2. 验证视图创建

```sql
-- 检查视图是否创建成功
DESCRIBE merchant_game_analytics;

-- 测试查询
SELECT * FROM merchant_game_analytics LIMIT 10;
```

## 📊 常用查询示例

### 1. 商户维度每日统计

```sql
-- 查询2025年9月所有非10001商户的每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20250901'
    AND date_str <= '20250930'
ORDER BY date_str, merchant;
```

### 2. 商户维度月度合计统计

```sql
-- 查询2025年9-10月所有非10001商户的月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str >= '202509'
    AND month_str <= '202510'
ORDER BY month_str, merchant;
```

### 3. 游戏维度每日统计

```sql
-- 查询2025年9月所有非10001商户的游戏每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20250901'
    AND date_str <= '20250930'
ORDER BY date_str, merchant, game_id;
```

### 4. 游戏维度月度合计统计

```sql
-- 查询2025年9-10月所有非10001商户的游戏月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    game_id,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str >= '202509'
    AND month_str <= '202510'
ORDER BY month_str, merchant, game_id;
```

### 5. 综合查询（所有统计类型）

```sql
-- 查询指定时间范围内的所有统计类型
SELECT 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id,
    unique_users
FROM merchant_game_analytics
WHERE (
    (stat_type IN ('merchant_daily', 'game_daily') 
     AND date_str >= '20250901' 
     AND date_str <= '20250930')
    OR 
    (stat_type IN ('merchant_monthly', 'game_monthly') 
     AND month_str >= '202509' 
     AND month_str <= '202510')
)
ORDER BY stat_type, month_str, date_str, merchant, game_id;
```

## 🤖 n8n工作流集成

### 1. 导入工作流

1. 在n8n中导入 `n8n_merchant_analytics_workflow.json`
2. 确保后端服务运行在 `http://localhost:3000`
3. 激活工作流

### 2. 使用Webhook触发

#### 请求示例

```bash
curl -X POST http://your-n8n-instance/webhook/merchant-analytics \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "20250901",
    "endDate": "20250930",
    "startMonth": "202509",
    "endMonth": "202510",
    "merchantId": "10002",
    "gameId": "game001",
    "statType": "all"
  }'
```

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | STRING | 否 | 开始日期 (YYYYMMDD格式，默认: 20250901) |
| `endDate` | STRING | 否 | 结束日期 (YYYYMMDD格式，默认: 20250930) |
| `startMonth` | STRING | 否 | 开始月份 (YYYYMM格式，默认: 202509) |
| `endMonth` | STRING | 否 | 结束月份 (YYYYMM格式，默认: 202510) |
| `merchantId` | STRING | 否 | 商户ID (不指定则查询所有非10001商户) |
| `gameId` | STRING | 否 | 游戏ID (不指定则查询所有游戏) |
| `statType` | STRING | 否 | 统计类型 (all/merchant_daily/merchant_monthly/game_daily/game_monthly，默认: all) |

### 3. 响应格式

```json
{
  "success": true,
  "message": "📊 **商户游戏分析查询结果**\n\n📈 **汇总统计**\n• 总记录数: 150\n• 总唯一用户数: 12,345\n...",
  "summary": {
    "total_records": 150,
    "total_unique_users": 12345,
    "merchant_daily_count": 45,
    "merchant_monthly_count": 15,
    "game_daily_count": 60,
    "game_monthly_count": 30
  },
  "merchantSummary": [
    {
      "merchant": "10002",
      "total_unique_users": 5000,
      "daily_records": 15,
      "monthly_records": 5
    }
  ],
  "queryInfo": {
    "rowCount": 150,
    "executionTime": 2500,
    "queryId": "abc123-def456"
  },
  "hasData": true,
  "dataCount": 150
}
```

## 📈 性能优化建议

### 1. 索引优化

```sql
-- 在game_records表上创建复合索引
CREATE INDEX idx_game_records_analytics 
ON game_records (provider, merchant, hour, uid, game_id);
```

### 2. 分区优化

```sql
-- 确保game_records表按hour字段分区
-- 这样可以提高查询性能
```

### 3. 查询优化

- 尽量指定具体的日期范围，避免全表扫描
- 使用 `LIMIT` 限制返回结果数量
- 优先使用 `stat_type` 过滤条件

## 🔍 故障排除

### 1. 视图创建失败

```sql
-- 检查表是否存在
SHOW TABLES LIKE 'game_records';

-- 检查表结构
DESCRIBE game_records;

-- 检查数据
SELECT COUNT(*) FROM game_records WHERE provider IN ('gp', 'popular');
```

### 2. 查询结果为空

```sql
-- 检查数据是否存在
SELECT COUNT(*) FROM game_records 
WHERE provider IN ('gp', 'popular') 
  AND merchant != '10001'
  AND hour >= '2025010100';

-- 检查日期格式
SELECT DISTINCT SUBSTR(hour, 1, 8) as date_str 
FROM game_records 
WHERE hour >= '2025010100' 
ORDER BY date_str 
LIMIT 10;
```

### 3. 性能问题

```sql
-- 检查查询执行计划
EXPLAIN SELECT * FROM merchant_game_analytics 
WHERE stat_type = 'merchant_daily' 
  AND date_str >= '20250901' 
  AND date_str <= '20250930';

-- 检查数据分布
SELECT 
    stat_type,
    COUNT(*) as record_count
FROM merchant_game_analytics 
GROUP BY stat_type;
```

## 📝 注意事项

1. **数据更新**: 视图数据会随着 `game_records` 表的数据更新而自动更新
2. **权限控制**: 确保查询用户有访问 `game_records` 表的权限
3. **时区处理**: 所有时间字段都基于UTC时间
4. **数据一致性**: 视图统计的是唯一用户数，可能存在跨日期的重复计算
5. **性能监控**: 定期监控查询性能，必要时优化索引或分区策略

## 🚀 扩展功能

### 1. 添加更多统计维度

```sql
-- 可以扩展视图添加更多统计维度，如：
-- - 按小时统计
-- - 按地区统计
-- - 按设备类型统计
```

### 2. 集成到BI工具

```sql
-- 视图可以直接用于Tableau、Power BI等BI工具
-- 提供标准化的数据接口
```

### 3. 自动化报告

```sql
-- 结合n8n工作流，可以创建自动化报告
-- 定期生成商户游戏分析报告
```









