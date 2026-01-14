# S7 异常数据全量排查

## 场景简介
在指定商户与时间范围内查找异常投注（如金额为负、倍数异常、重复记录），常用于风控与稽核。

## 字段要求
- **必填**：`merchant_id`, `start_date`, `end_date`
- **可选**：`game_code`, `currency`, `provider`
- **校验**：
  - 时间跨度不宜过大（默认 ≤ 15 天），否则需提示拆分

## 输入示例
```json
{
  "merchant_id": "1716179958",
  "start_date": "20251001",
  "end_date": "20251007"
}
```

## 模板 SQL
```sql
SELECT
  id,
  uid,
  merchant_id,
  game_code,
  provider,
  currency,
  CAST(amount AS DOUBLE) AS amount,
  CAST(pay_out AS DOUBLE) AS pay_out,
  multiplier,
  detail,
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at
FROM gmp.game_records
WHERE merchant_id = '{{ merchant_id }}'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND game_code = '{{ game_code }}' }}
  {{ AND currency = '{{ currency }}' }}
  AND (
    CAST(amount AS DOUBLE) < 0
    OR CAST(pay_out AS DOUBLE) < 0
    OR multiplier NOT BETWEEN 0 AND 1000
    OR amount IS NULL
    OR pay_out IS NULL
  )
ORDER BY created_at;
```

## 生成检查清单
1. 是否提供了商户与时间范围。
2. 异常条件是否满足用户要求（可根据需求调整）。
3. 如需更多规则（重复 ID、超大倍数）可在 `AND (...)` 内追加。
4. 告知用户该查询可能返回大量结果，必要时配合拆分。

## 扩展提示
- 可使用 `HAVING` 检查重复，如 `GROUP BY uid, game_code, created_at HAVING COUNT(*) > 1`。
- 若关心具体 detail，可 `JSON_EXTRACT(detail, '$.xxx')` 做额外判断。***

