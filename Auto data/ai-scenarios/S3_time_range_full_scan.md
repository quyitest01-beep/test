# S3 时间范围全量查询

## 场景简介
针对指定时间范围（可附带商户/游戏条件）的全量明细提取，常用于离线分析或导出。

## 字段要求
- **必填**：`start_date`, `end_date`（`YYYYMMDD`）
- **可选**：`merchant_id`, `game_code`, `provider`, `uid`
- **校验**：
  - `start_date <= end_date`
  - 时间跨度超过 7 天时，建议提醒用户拆分或说明导出体积。

## 输入示例
```json
{
  "start_date": "20251001",
  "end_date": "20251005",
  "merchant_id": "1716179958",
  "game_code": "gp_superace"
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
WHERE hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  AND provider IN ('gp', 'popular')
  {{ AND merchant_id = '{{ merchant_id }}' }}
  {{ AND game_code = '{{ game_code }}' }}
  {{ AND uid = '{{ uid }}' }}
ORDER BY created_at;
```

## 生成检查清单
1. 时间范围是否存在且合法。
2. 是否加入必要的过滤条件（如商户/游戏），以减少数据量。
3. 对用户说明记录数可能很大，必要时提示拆分。
4. 没有 `LIMIT`，保持全量输出。

## 扩展提示
- 若用户指定“10 月”，可解析为 `start_date = 20251001`, `end_date = 20251031`。
- 若数据确实庞大，可结合拆分流程（按日/周）生成多段 SQL。***

