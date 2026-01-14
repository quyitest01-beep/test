# S5 游戏维度全量分析

## 场景简介
对特定游戏（或游戏 + 商户组合）在时间区间内的运营指标进行日度统计，用于评估某款游戏表现。

## 字段要求
- **必填**：`game_code`, `start_date`, `end_date`
- **可选**：`merchant_id`, `provider`
- **校验**：
  - 若用户提供的是“游戏名称”，需先映射到 `game_code`
  - 时间跨度过长应提醒拆分

## 输入示例
```json
{
  "game_code": "gp_superace",
  "merchant_id": "1716179958",
  "start_date": "20251001",
  "end_date": "20251007"
}
```

## 模板 SQL
```sql
SELECT
  game_code,
  merchant_id,
  DATE_FORMAT(PARSE_DATETIME(hour, 'yyyyMMddHH'), '%Y-%m-%d') AS stat_date,
  COUNT(*) AS total_rounds,
  SUM(CAST(amount AS DOUBLE)) AS total_bet,
  SUM(CAST(pay_out AS DOUBLE)) AS total_payout,
  SUM(CAST(pay_out AS DOUBLE)) - SUM(CAST(amount AS DOUBLE)) AS net_win
FROM gmp.game_records
WHERE game_code = '{{ game_code }}'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND merchant_id = '{{ merchant_id }}' }}
  {{ AND provider = '{{ provider }}' }}
GROUP BY game_code, merchant_id, stat_date
ORDER BY stat_date, merchant_id;
```

## 生成检查清单
1. `game_code` 是否存在并格式正确。
2. 时间范围是否合法，是否提示用户确认跨度。
3. 是否告知用户如果需要“所有商户汇总”可取消 `merchant_id` 条件。

## 扩展提示
- 可加 `COUNT(DISTINCT uid)` 统计去重玩家。
- 可通过 `SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END)` 统计胜局数。***

