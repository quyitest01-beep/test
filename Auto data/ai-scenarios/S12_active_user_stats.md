# S12 日/月活跃用户统计

## 场景简介
统计指定时间区间内的日活（DAU）或月活（MAU），可按商户或游戏拆分，用于活跃趋势/对比分析。

## 字段要求
- **必填**：`start_date`, `end_date`
- **可选**：`merchant_id`, `game_id`, `granularity`（`daily` / `monthly`）
- **校验**：
  - 默认 `granularity = daily`，如用户要求月度则需转换查询逻辑

## 输入示例
```json
{
  "start_date": "20251001",
  "end_date": "20251007",
  "merchant_id": "1716179958",
  "granularity": "daily"
}
```

## 日活模板 SQL
```sql
SELECT
  SUBSTR(hour, 1, 8) AS date_str,
  merchant,
  COUNT(DISTINCT uid) AS daily_active_users
FROM gmp.game_records
WHERE provider IN ('gp', 'popular')
  AND merchant <> '10001'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  {{ AND merchant = '{{ merchant_id }}' }}
  {{ AND game_id = '{{ game_id }}' }}
GROUP BY SUBSTR(hour, 1, 8), merchant
ORDER BY date_str, merchant;
```

## 月活模板 SQL
```sql
SELECT
  SUBSTR(hour, 1, 6) AS month_str,
  merchant,
  COUNT(DISTINCT uid) AS monthly_active_users
FROM gmp.game_records
WHERE provider IN ('gp', 'popular')
  AND merchant <> '10001'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  {{ AND merchant = '{{ merchant_id }}' }}
  {{ AND game_id = '{{ game_id }}' }}
GROUP BY SUBSTR(hour, 1, 6), merchant
ORDER BY month_str, merchant;
```

## 生成检查清单
1. 确认 `granularity` 并输出对应 SQL。
2. 是否需要排除某些商户（如 `merchant <> '10001'` 已内置）。
3. 若时间跨度过长（>90 天），建议拆分或改为批量查询。

## 扩展提示
- 可在 SELECT 中加入 `game_id` 以得到“某游戏的活跃用户”。
- 如需周活，可将 `SUBSTR(hour, 1, 8)` 结合 `DATE_TRUNC('week', ...)`。***

