# S4 商户维度全量统计

## 场景简介
对单个商户在指定日期范围内的投注/派奖等指标进行日度汇总，支撑 KPI 统计或运营分析。

## 字段要求
- **必填**：`merchant_id`, `start_date`, `end_date`
- **可选**：`game_code`, `provider`
- **校验**：
  - 日期格式必须为 `YYYYMMDD`
  - 范围过长（>31 天）需提醒拆分或说明处理方式

## 输入示例
```json
{
  "merchant_id": "1716179958",
  "start_date": "20251001",
  "end_date": "20251010"
}
```

## 模板 SQL
```sql
SELECT
  merchant_id,
  DATE_FORMAT(PARSE_DATETIME(hour, 'yyyyMMddHH'), '%Y-%m-%d') AS stat_date,
  COUNT(*) AS total_rounds,
  SUM(CAST(amount AS DOUBLE)) AS total_bet,
  SUM(CAST(pay_out AS DOUBLE)) AS total_payout,
  SUM(CAST(pay_out AS DOUBLE)) - SUM(CAST(amount AS DOUBLE)) AS net_win
FROM gmp.game_records
WHERE merchant_id = '{{ merchant_id }}'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND game_code = '{{ game_code }}' }}
  {{ AND provider = '{{ provider }}' }}
GROUP BY merchant_id, stat_date
ORDER BY stat_date;
```

## 生成检查清单
1. 是否提供了 `merchant_id` 和时间范围。
2. 是否使用 `hour BETWEEN ...` 来限制分区扫描。
3. 计算指标是否满足需求（可扩展 `SUM(multiplier)` 等）。
4. 若需要导出 CSV，应告知输出字段含义。

## 扩展提示
- 可增加 `COUNT(DISTINCT uid)` 计算唯一玩家数（注意成本，建议限定时间范围）。
- 如要对比多个商户，可引导使用批量场景或拆分多个 SQL。***

