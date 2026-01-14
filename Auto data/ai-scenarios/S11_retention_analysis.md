# S11 新/活跃用户留存分析

## 场景简介
统计指定时间窗口内的 **新用户或活跃用户** 的 D0/D1/D3/D7（可扩展 D14/D30）留存情况，可按商户 / 游戏拆分。常用于周/月报的留存指标。

> 💡 **与 S10 的关系**
> - `matchedScenarioId = S10` / `S11` 均可复用本知识库中的留存 SQL 模板。
> - 若用户在自然语言中提到“新用户留存”“活跃用户留存”，但没有显式指定 S10/S11，可统一按本场景（留存分析）规则生成 SQL。

## 通用分组与币种维度规则

> 这一节是对 S10 / S11 场景的**通用补充说明**，用于约束“按商户-游戏-货币维度分组”一类需求下的分组字段。

- **默认分组维度（未提币种时）**
  - 若用户需求中 **没有** 提到币种 / 货币维度，则按模板当前定义的维度分组即可：
    - `merchant`（商户）
    - `game_id`（游戏）
    - `cohort_date` 或统计日期

- **命中币种维度关键字时，必须按商户-游戏-货币分组**
  - 若 `queryRequirement.keywords` 或原始 `text` 中包含以下任意关键词：
    - “按商户-游戏-货币维度分组”
    - “按商户-游戏-币种维度分组”
    - “按商户、游戏、货币维度分组”
    - “币种维度”“货币维度”
  - 则在生成 SQL 时必须执行以下规则（适用于 S10 / S11 的新用户留存和活跃用户留存）：
    1. **在原始明细表中引入币种字段**
       - 从 `gmp.game_records` 中选择币种字段，例如：`gr.currency`（或实际字段名，如 `gr.bet_currency`）。
    2. **在所有中间 CTE 中携带并按币种分组**
       - 在 `cohort` / `first_seen` / `events_window` 等 CTE 的 `SELECT` 中增加币种字段：
         - `gr.currency AS currency`
       - 对应的 `GROUP BY` 中增加：`gr.currency`。
    3. **在最终结果中输出币种字段**
       - `SELECT` 至少包含：`c.merchant, c.game_id, c.currency, cohort_date, ...`。
    4. **在最终 `GROUP BY` / `ORDER BY` 中按币种分组 / 排序**
       - 例如：`GROUP BY c.merchant, c.game_id, c.currency, c.cohort_date`。
    5. **JOIN 时按币种对齐**
       - 若 `events_window` 中也有币种字段，JOIN 条件需包含币种：  
         `ON e.merchant = c.merchant AND e.game_id = c.game_id AND e.currency = c.currency AND ...`。

> **提示给 LLM：**
> - 只要关键词里出现“商户-游戏-货币维度分组”，就必须在 SQL 中贯穿 `currency` 字段（或当前库实际的币种字段名），并在所有相关的 `SELECT` / `GROUP BY` / `JOIN` 中体现。

## 字段要求
- **必填**：`start_date`, `end_date`
- **可选**：`merchant_id`, `game_id`, `cohort_type`（`active` or `new`），`lookback_days`（默认 D1/D3/D7）
- **校验**：
  - `start_date` `end_date` 使用 `YYYYMMDD`
  - `cohort_type` 仅允许 `active`（按当日活跃）或 `new`（按首日）
  - 若未指定商户或游戏，默认统计所有（仍限定 `provider IN ('gp','popular')`、`merchant <> '10001'`）

## 输入示例
```json
{
  "start_date": "20251001",
  "end_date": "20251007",
  "merchant_id": "1716179958",
  "game_id": "gp_superace",
  "cohort_type": "active"
}
```

## 模板 SQL（以游戏活跃留存 D0/D1/D7 为例）
```sql
WITH cohort AS (
  SELECT
    gr.merchant,
    gr.game_id,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
    gr.uid
  FROM gmp.game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND gr.merchant <> '10001'
    {{ AND gr.merchant = '{{ merchant_id }}' }}
    {{ AND gr.game_id = '{{ game_id }}' }}
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '{{ start_date }}' AND '{{ end_date }}'
  GROUP BY gr.merchant, gr.game_id, DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'), gr.uid
),
events_window AS (
  SELECT
    gr.merchant,
    gr.game_id,
    gr.uid,
    DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
  FROM gmp.game_records gr
  WHERE gr.provider IN ('gp', 'popular')
    AND gr.merchant <> '10001'
    {{ AND gr.merchant = '{{ merchant_id }}' }}
    {{ AND gr.game_id = '{{ game_id }}' }}
    AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '{{ start_date }}' AND '{{ end_date }}'
)
SELECT
  c.merchant,
  c.game_id,
  '活跃用户留存' AS type,
  DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
  COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) AS d0_users,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS d1_users,
  CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0
       THEN 0
       ELSE ROUND(
         CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE)
         / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
  END AS d1_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS d3_users,
  CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0
       THEN 0
       ELSE ROUND(
         CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE)
         / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
  END AS d3_retention_rate,
  COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS d7_users,
  CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) = 0
       THEN 0
       ELSE ROUND(
         CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE)
         / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
  END AS d7_retention_rate
FROM cohort c
LEFT JOIN events_window e
  ON e.merchant = c.merchant
 AND e.game_id  = c.game_id
 AND e.uid      = c.uid
 AND e.event_date IN (
   c.cohort_date,
   DATE_ADD('day', 1, c.cohort_date),
   DATE_ADD('day', 3, c.cohort_date),
   DATE_ADD('day', 7, c.cohort_date)
 )
GROUP BY c.merchant, c.game_id, c.cohort_date
ORDER BY c.merchant, c.game_id, c.cohort_date;
```

> **新用户留存SQL模板**：若要统计新用户留存，将 `cohort` 换成 `first_seen` 逻辑，关键区别是：
> - `cohort`：按 `merchant, game_id, DATE_PARSE(...), uid` 分组（包含日期），统计用户在任意活跃日期的留存
> - `first_seen`：按 `merchant, game_id, uid` 分组（**不包含日期**），使用 `MIN(DATE_PARSE(...))` 获取每个用户的首次出现日期
> 
> ```sql
> WITH first_seen AS (
>   SELECT
>     gr.merchant,
>     gr.game_id,
>     gr.uid,
>     MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
>   FROM gmp.game_records gr
>   WHERE gr.provider IN ('gp', 'popular')
>     AND gr.merchant <> '10001'
>     {{ AND gr.merchant = '{{ merchant_id }}' }}
>     {{ AND gr.game_id = '{{ game_id }}' }}
>     AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '{{ start_date }}' AND '{{ end_date }}'
>   GROUP BY gr.merchant, gr.game_id, gr.uid
> ),
> events_window AS (
>   -- 与原模板相同
> )
> SELECT
>   fs.merchant,
>   fs.game_id,
>   '新用户留存' AS type,
>   DATE_FORMAT(fs.first_event_date, '%Y-%m-%d') AS cohort_date,
>   COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) AS d0_users,
>   COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, fs.first_event_date) THEN fs.uid END) AS d1_users,
>   CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) = 0
>        THEN 0
>        ELSE ROUND(
>          CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, fs.first_event_date) THEN fs.uid END) AS DOUBLE)
>          / COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) * 100, 2)
>   END AS d1_retention_rate,
>   COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, fs.first_event_date) THEN fs.uid END) AS d3_users,
>   CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) = 0
>        THEN 0
>        ELSE ROUND(
>          CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, fs.first_event_date) THEN fs.uid END) AS DOUBLE)
>          / COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) * 100, 2)
>   END AS d3_retention_rate,
>   COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, fs.first_event_date) THEN fs.uid END) AS d7_users,
>   CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) = 0
>        THEN 0
>        ELSE ROUND(
>          CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, fs.first_event_date) THEN fs.uid END) AS DOUBLE)
>          / COUNT(DISTINCT CASE WHEN e.event_date = fs.first_event_date THEN fs.uid END) * 100, 2)
>   END AS d7_retention_rate
> FROM first_seen fs
> LEFT JOIN events_window e
>   ON e.merchant = fs.merchant
>  AND e.game_id  = fs.game_id
>  AND e.uid      = fs.uid
>  AND e.event_date IN (
>    fs.first_event_date,
>    DATE_ADD('day', 1, fs.first_event_date),
>    DATE_ADD('day', 3, fs.first_event_date),
>    DATE_ADD('day', 7, fs.first_event_date)
>  )
> GROUP BY fs.merchant, fs.game_id, fs.first_event_date
> ORDER BY fs.merchant, fs.game_id, fs.first_event_date;
> ```
> 
> 关键点：
> - `type` 字段：新用户留存使用 `'新用户留存'`，活跃用户留存使用 `'活跃用户留存'`
> - 添加了 `d3_retention_rate` 和 `d7_retention_rate` 字段（计算D3和D7的留存率）
> - 其余逻辑与原模板一致；留存日可扩展到 D14/D30。

## 生成检查清单
1. 确认 `start_date/end_date` 合法，并限制跨度（如 ≤31 天）。
2. 确认 `cohort_type` 的选择：活跃 vs 新用户，SQL 使用正确的 CTE。
3. 若用户需要 D14/D30，是否在 `event_date IN (...)` 中追加并添加对应列。
4. `provider`、`merchant <> '10001'` 条件是否保留。

## 扩展提示
- 可将结果转置输出（列为 D0/D1/D7），方便报表渲染。
- 若只需要商户层级留存，可去掉 `game_id` 并按 `merchant` 分组。***

