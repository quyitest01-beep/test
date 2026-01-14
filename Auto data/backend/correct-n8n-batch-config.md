# n8n 批量查询节点正确配置

## 节点配置步骤

### 1. 基本设置
- **Method**: POST
- **URL**: `https://ebooks-life-point-interactions.trycloudflare.com/api/batch/start`
- **Authentication**: None

### 2. Headers 配置
- **Send Headers**: ON
- **Header Parameters**:
  - Name: `Content-Type`, Value: `application/json`
  - Name: `X-API-Key`, Value: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2`

### 3. Body 配置
- **Send Body**: ON
- **Body Content Type**: JSON
- **Specify Body**: Using Fields Below
- **Body Parameters**:
  - Name: `queries`, Value: `{{ $json.queries }}`
  - Name: `database`, Value: `gmp`

### 4. 选项配置
- **Timeout**: 300000 (5分钟)

## 预期请求体格式

```json
{
  "queries": {
    "merchantDailyLastWeek": "SELECT date_str, merchant, unique_users AS daily_unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251013' AND date_str <= '20251019' ORDER BY date_str, merchant;",
    "merchantDailyThisWeek": "SELECT date_str, merchant, unique_users AS daily_unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251020' AND date_str <= '20251026' ORDER BY date_str, merchant;",
    "merchantMonthlyLastWeek": "SELECT month_str, merchant, unique_users AS monthly_unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_monthly' AND month_str = '202510' ORDER BY merchant;",
    "gameDailyLastWeek": "SELECT date_str, merchant, game_id, unique_users AS daily_unique_users FROM merchant_game_analytics WHERE stat_type = 'game_daily' AND date_str >= '20251013' AND date_str <= '20251019' ORDER BY date_str, merchant, game_id;",
    "gameDailyThisWeek": "SELECT date_str, merchant, game_id, unique_users AS daily_unique_users FROM merchant_game_analytics WHERE stat_type = 'game_daily' AND date_str >= '20251020' AND date_str <= '20251026' ORDER BY date_str, merchant, game_id;",
    "gameMonthlyLastWeek": "SELECT month_str, merchant, game_id, unique_users AS monthly_unique_users FROM merchant_game_analytics WHERE stat_type = 'game_monthly' AND month_str = '202510' ORDER BY merchant, game_id;",
    "weeklyComparison": "SELECT CASE WHEN date_str >= '20251013' AND date_str <= '20251019' THEN 'last_week' WHEN date_str >= '20251020' AND date_str <= '20251026' THEN 'this_week' END AS week_type, date_str, merchant, unique_users AS daily_unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND ((date_str >= '20251013' AND date_str <= '20251019') OR (date_str >= '20251020' AND date_str <= '20251026')) ORDER BY week_type, date_str, merchant;",
    "weeklySummary": "SELECT 'last_week' AS period_type, '20251013-20251019' AS period_range, SUM(unique_users) AS total_unique_users, COUNT(DISTINCT merchant) AS merchant_count FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251013' AND date_str <= '20251019' UNION ALL SELECT 'this_week' AS period_type, '20251020-20251026' AS period_range, SUM(unique_users) AS total_unique_users, COUNT(DISTINCT merchant) AS merchant_count FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251020' AND date_str <= '20251026' ORDER BY period_type;"
  },
  "database": "gmp"
}
```

## 预期响应格式

```json
{
  "success": true,
  "batchId": "batch_xxx",
  "queryResults": {
    "merchantDailyLastWeek": {
      "queryId": "query_xxx",
      "status": "pending",
      "message": "查询已启动"
    },
    "merchantDailyThisWeek": {
      "queryId": "query_xxx",
      "status": "pending", 
      "message": "查询已启动"
    }
    // ... 其他查询结果
  },
  "totalQueries": 8,
  "successfulQueries": 8,
  "failedQueries": 0,
  "message": "批量查询已启动: 8/8 成功"
}
```

## 常见错误

❌ **错误配置**:
- Name: `sql`, Value: `{{ $json.queries }}` (这是单个查询API的格式)

✅ **正确配置**:
- Name: `queries`, Value: `{{ $json.queries }}`
- Name: `database`, Value: `gmp`









