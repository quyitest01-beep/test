# S9 时间趋势全量分析

## 场景简介
分析指定时间区间内的整体趋势（例如每日投注/派奖），可按商户或提供商过滤，用于观测曲线变化。

## 字段要求
- **必填**：`start_date`, `end_date`
- **可选**：`merchant_id`, `provider`, `game_code`
- **校验**：
  - 时间范围通常 ≤ 31 天，超出需提醒拆分

## 输入示例
```json
{
  "start_date": "20250920",
  "end_date": "20251010",
  "merchant_id": "1716179958"
}
```

## 模板 SQL
```sql
SELECT
  DATE_FORMAT(PARSE_DATETIME(hour, 'yyyyMMddHH'), '%Y-%m-%d') AS stat_date,
  COUNT(*) AS total_rounds,
  SUM(CAST(amount AS DOUBLE)) AS total_bet,
  SUM(CAST(pay_out AS DOUBLE)) AS total_payout,
  SUM(CAST(pay_out AS DOUBLE)) - SUM(CAST(amount AS DOUBLE)) AS net_win
FROM gmp.game_records
WHERE hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND merchant_id = '{{ merchant_id }}' }}
  {{ AND provider = '{{ provider }}' }}
  {{ AND game_code = '{{ game_code }}' }}
GROUP BY stat_date
ORDER BY stat_date;
```

## 生成检查清单
1. 是否提供合法的日期范围。
2. 若需要按周/月聚合，可在 SQL 中改用 `DATE_TRUNC` 等函数。
3. 若用户要求图表数据，需说明输出字段含义。

## 扩展提示
- 可增加 `COUNT(DISTINCT uid)` 反映活跃玩家趋势（注意资源消耗）。
- 如需比较多个 merchant，可提示使用批量 API，一次提交多条 SQL。***

