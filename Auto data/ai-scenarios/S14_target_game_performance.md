# S14 指定游戏数据表现

## 场景简介
针对目标游戏（或游戏列表）在指定时间区间内统计核心指标：活跃用户、投注/派奖金额、留存等。可分平台（merchant）查看。

## 字段要求
- **必填**：`start_date`, `end_date`, `game_code`（单个或多个）
- **可选**：`merchant_id`, `currency`
- **校验**：
  - `game_code` 支持数组，生成 `IN ('gp_superace', 'gp_mines')`
  - 若 `merchant_id` 未指定，则默认统计全部（仍排除 `merchant = '10001'`）

## 输入示例
```json
{
  "start_date": "20251001",
  "end_date": "20251007",
  "game_code": ["gp_superace", "gp_mines"]
}
```

## 模板 SQL（活跃用户排行榜）
```sql
SELECT
  gr.merchant AS platform,
  gr.game_code,
  COUNT(DISTINCT gr.uid) AS unique_users
FROM gmp.game_records gr
WHERE gr.provider IN ('gp', 'popular')
  AND gr.merchant <> '10001'
  AND SUBSTR(gr.hour, 1, 8) BETWEEN '{{ start_date }}' AND '{{ end_date }}'
  AND gr.game_code IN ({{ game_code_list }})
  {{ AND gr.merchant = '{{ merchant_id }}' }}
GROUP BY gr.merchant, gr.game_code
ORDER BY unique_users DESC;
```

## 模板 SQL（投注 / 派奖金额）
```sql
SELECT
  gr.merchant AS platform,
  gr.currency,
  gr.game_code,
  CAST(SUM(CAST(gr.amount AS DOUBLE)) AS DECIMAL(18, 2)) AS total_amount,
  CAST(SUM(CAST(gr.pay_out AS DOUBLE)) AS DECIMAL(18, 2)) AS total_pay_out,
  CAST(SUM(CAST(gr.pay_out AS DOUBLE)) - SUM(CAST(gr.amount AS DOUBLE)) AS DECIMAL(18, 2)) AS net_win
FROM gmp.game_records gr
WHERE gr.provider IN ('gp', 'popular')
  AND gr.merchant <> '10001'
  AND SUBSTR(gr.hour, 1, 8) BETWEEN '{{ start_date }}' AND '{{ end_date }}'
  AND gr.game_code IN ({{ game_code_list }})
  {{ AND gr.merchant = '{{ merchant_id }}' }}
  {{ AND gr.currency = '{{ currency }}' }}
GROUP BY gr.merchant, gr.currency, gr.game_code
ORDER BY total_amount DESC;
```

## 模板 SQL（D0/D1/D7 留存，活跃 + 新用户合集）
参照 `S11_retention_analysis.md`，将 `WHERE` 条件替换为 `AND gr.game_code IN (...)`，并在输出中保留 `platform` 字段。

## 生成检查清单
1. `game_code` 是否提供，若为空需提示用户。
2. 若传多个 game_code，是否正确生成 `IN (...)`。
3. 对输出指标（unique_users、total_amount、retention）是否符合用户需求。

## 扩展提示
- 可同时输出“全平台汇总”与“各平台明细”，方法是在 SQL 中增加 `ROLLUP` 或追加一条 `GROUP BY` 更少维度的查询。
- 若用户只想看单一平台，可直接使用 `merchant_id` 过滤。***

