# S1 单/多记录 ID 查询

## 场景简介
用于根据 **一个或多个记录 ID** 精确检索 `game_records` 表中的完整明细，可辅助验证单笔投注或批量核查特定 ID 列表。

## 字段要求
- **必填**：
  - `id`：数组或单值，**仅数字**，长度 ≥ 16。支持多 ID 批量查询。
- **可选**：
  - `uid`：如已知用户，可限制结果。
  - `merchant_id`：限定商户范围。
  - `hour`：若知道具体分区（`YYYYMMDDHH`），可以极大缩小扫描范围。
- **校验**：
  - `id` 仅允许 `[0-9]`，若传入超过 50 个 ID，应提示拆分。

## 输入示例
```json
{
  "id": ["1990823099625480192", "1990823099625480193"],
  "merchant_id": "1716179958"
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
WHERE id IN ({{ id_list }})
  {{ AND uid = '{{ uid }}' }}
  {{ AND merchant_id = '{{ merchant_id }}' }}
  AND provider IN ('gp', 'popular')
  {{ AND hour = '{{ hour }}' }};
```

## 生成检查清单
1. `id` 是否存在且格式正确（纯数字/长度要求）。
2. 多 ID 时是否构建 `IN (...)`，并处理参数安全。
3. 是否在有条件时自动增加 `merchant_id`、`uid`、`hour` 过滤以减少扫描。
4. 输出 SQL 不应添加 `LIMIT`。

## 扩展提示
- 如果用户同时给出日期，可将其转换为 `hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'` 进一步减少数据量。
- 若需要只返回部分字段，可在 SELECT 中裁剪，但默认提供全量明细，方便后续排查。***

