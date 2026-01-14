# S8 货币类型全量统计

## 场景简介
对指定商户和货币的投注 / 派奖在日期范围内进行汇总，用于多币种对账或财务分析。

## 字段要求
- **必填**：`merchant_id`, `currency`, `start_date`, `end_date`
- **可选**：`provider`, `game_code`
- **校验**：
  - `currency` 应使用标准货币代码（如 `PHP`、`USD`）

## 输入示例
```json
{
  "merchant_id": "1716179958",
  "currency": "PHP",
  "start_date": "20251001",
  "end_date": "20251015"
}
```

## 模板 SQL
```sql
SELECT
  currency,
  DATE_FORMAT(PARSE_DATETIME(hour, 'yyyyMMddHH'), '%Y-%m-%d') AS stat_date,
  SUM(CAST(amount AS DOUBLE)) AS total_bet,
  SUM(CAST(pay_out AS DOUBLE)) AS total_payout,
  SUM(CAST(pay_out AS DOUBLE)) - SUM(CAST(amount AS DOUBLE)) AS net_win
FROM gmp.game_records
WHERE merchant_id = '{{ merchant_id }}'
  AND currency = '{{ currency }}'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND provider = '{{ provider }}' }}
  {{ AND game_code = '{{ game_code }}' }}
GROUP BY currency, stat_date
ORDER BY stat_date;
```

## 生成检查清单
1. `currency` 是否存在且大小写统一。
2. 是否提醒用户结果只包含单一币种，总体对账需累加多次查询。
3. 是否需要输出净盈利/亏损指标。

## 扩展提示
- 若需要跨币种对比，可引导使用批量场景（一次提交多个 `queries`）。
- 可结合 S4/S5 模板生成更多维度的货币统计。***

