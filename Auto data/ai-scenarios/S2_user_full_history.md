# S2 单用户全量记录查询

## 场景简介
检索某一用户在指定时间段内的所有游戏记录，可配合商户号进行过滤，常用于玩家申诉或客服排查。

## 字段要求
- **必填**：
  - `uid`
- **可选**：
  - `merchant_id`
  - `start_date`, `end_date`（`YYYYMMDD`，若缺失则默认使用最近 7 天）
  - `provider` / `game_code`
- **校验**：
  - 如未提供时间范围，应由 AI 给出默认范围并在 `reason` 中说明。

## 输入示例
```json
{
  "uid": "142106042958872595_1698217738060",
  "merchant_id": "1716179958",
  "start_date": "20251001",
  "end_date": "20251010"
}
```

## 模板 SQL
```sql
SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  provider,
  result,
  currency,
  ROUND(CAST(amount AS DOUBLE), 2) AS amount,
  ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out,
  multiplier,
  balance,
  detail,
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM gmp.game_records
WHERE uid = '{{ uid }}'
  {{ AND merchant_id = '{{ merchant_id }}' }}
  AND provider IN ('gp', 'popular')
  {{ AND provider = '{{ provider }}' }}
  {{ AND game_code = '{{ game_code }}' }}
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
ORDER BY created_at;
```

## 生成检查清单
1. 是否提供 `uid`，以及合法的时间范围。
2. 若缺少 `start_date/end_date`，是否在 SQL 中明确替换为约定默认值。
3. 是否包含 `hour BETWEEN ...` 以利用分区。
4. 若结果可能过大，提醒用户拆分或限制时间范围。

## 扩展提示
- 可在 SELECT 中加入 `JSON_EXTRACT(detail, '$.xxx')` 解析特定字段。
- 如仅需统计，可将查询改写为 `COUNT`/`SUM` 聚合，但需确保用户要求一致。***

