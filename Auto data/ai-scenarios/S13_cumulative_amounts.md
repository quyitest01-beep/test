# S13 累计投注额 / 累计派奖额（分币种）

## 场景简介
统计在指定时间区间内的累计投注额与派奖额，并按货币/商户/游戏等维度细分，用于财务或对账报表。

**重要说明**：
- 默认使用 `game_code` 作为游戏维度；**仅当用户在需求或原始消息中明确指定“使用 game_id”“按 game_id 维度”等时，才将模板中的 `game_code` 系统一致替换为 `game_id`（SELECT / GROUP BY / WHERE 同步替换）**。
- 检测来源包括：`text`、`intent`、`extractedParams.otherParams`、`keywords` 等；如果这些字段没有出现“game_id”字样，就保持 `game_code`。
- 支持查询"所有商户"的累计投注/派奖（不指定`merchant_id`时，SQL模板中的`{{ AND merchant = '{{ merchant_id }}' }}`条件会被忽略）
- 支持查询"全币种"的累计投注/派奖（不指定`currency`时，结果按所有币种分组）
- 关键词："累计投注"、"累计派奖"、"投注额"、"派奖额"、"所有商户"、"全币种"、"对账"、"财务统计"

## 字段要求
- **必填**：`start_date`, `end_date`
- **可选**：`merchant_id`（**不提供时表示查询所有商户**）, `game_id`, `currency`（**不提供时表示查询全币种**）
- **校验**：
  - 若未指定币种，结果按所有币种分组
  - 若未指定商户，结果按所有商户分组（需注意数据量，可提醒用户限制商户以避免扫描量过大）

## 输入示例
```json
{
  "start_date": "20251001",
  "end_date": "20251031",
  "merchant_id": "1716179958",
  "currency": "PHP"
}
```

## 分组规则（重要）

### 游戏维度分组规则
- **如果需求明确说"按游戏维度区分"、"按游戏、币种维度区分"、"按游戏分组"等**（检查 `text`、`otherParams`、`keywords`）：
  - **必须**在 SELECT 中包含 `game_code` 字段
  - **必须**在 GROUP BY 中包含 `game_code` 字段
  - **绝对不要使用 `'ALL' AS game_code`**，即使没有指定具体游戏
- **如果需求只说"所有游戏的累计投注额"但**没有说"按游戏维度区分"**：
  - 可以使用 `'ALL' AS game_code`
  - **不在 GROUP BY 中包含 game_code**

### 商户维度分组规则
- **仅在需求明确提到商户维度时才在 GROUP BY 中包含 merchant**：
  - 如果需求说"按商户、游戏、币种维度区分"、"按商户分组"等，才需要在 GROUP BY 中包含 merchant
  - 如果需求只说"按游戏、币种维度区分"，**不应该在 GROUP BY 中包含 merchant**
  - 如果需求中没有提到商户维度，不应该在 GROUP BY 中包含 merchant

### 示例
- 需求："按游戏、币种维度区分的累计投注额"
  - 正确：`SELECT game_code, currency, SUM(amount) AS total_amount FROM ... GROUP BY game_code, currency`
  - 错误：`SELECT 'ALL' AS game_code, currency, SUM(amount) AS total_amount FROM ... GROUP BY currency`
  - 错误：`SELECT merchant, game_code, currency, SUM(amount) AS total_amount FROM ... GROUP BY merchant, game_code, currency`（不应该包含merchant）

## 模板 SQL

### 模板1：按游戏、币种维度区分
```sql
SELECT
  game_code,
  currency,
  CAST(SUM(CAST(amount AS DOUBLE)) AS DECIMAL(18, 2)) AS total_amount,
  CAST(SUM(CAST(pay_out AS DOUBLE)) AS DECIMAL(18, 2)) AS total_pay_out
FROM gmp.game_records
WHERE provider IN ('gp', 'popular')
  AND merchant <> '10001'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  {{ AND merchant = '{{ merchant_id }}' }}
GROUP BY game_code, currency
ORDER BY total_amount DESC;
```

### 模板2：按商户、游戏、币种维度区分
```sql
SELECT
  merchant,
  game_code,
  currency,
  CAST(SUM(CAST(amount AS DOUBLE)) AS DECIMAL(18, 2)) AS total_amount,
  CAST(SUM(CAST(pay_out AS DOUBLE)) AS DECIMAL(18, 2)) AS total_pay_out
FROM gmp.game_records
WHERE provider IN ('gp', 'popular')
  AND merchant <> '10001'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  {{ AND merchant = '{{ merchant_id }}' }}
GROUP BY merchant, game_code, currency
ORDER BY total_amount DESC;
```

### 模板3：不按游戏维度（聚合所有游戏）
```sql
SELECT
  'ALL' AS game_code,
  currency,
  CAST(SUM(CAST(amount AS DOUBLE)) AS DECIMAL(18, 2)) AS total_amount,
  CAST(SUM(CAST(pay_out AS DOUBLE)) AS DECIMAL(18, 2)) AS total_pay_out
FROM gmp.game_records
WHERE provider IN ('gp', 'popular')
  AND merchant <> '10001'
  AND hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'
  {{ AND merchant = '{{ merchant_id }}' }}
GROUP BY currency
ORDER BY total_amount DESC;
```

## 变量替换规则
- `{{ start_date }}`：格式 YYYYMMDD，如果是 "YYYYMM" 格式（如 "202511"），转换为 "YYYYMM01"
- `{{ end_date }}`：格式 YYYYMMDD，如果是 "YYYYMM" 格式（如 "202511"），转换为 "YYYYMM30"（注意不同月份天数不同）
- `{{ merchant_id }}`：如果为 null，移除该条件
- `hour` 分区：`hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'`

> 若需要同时查看“所有商户的总额”，可在 SQL 外层增加 UNION 或另写一条（减少 GROUP BY 维度）。

## 生成检查清单
1. 是否限定了时间范围和必要商户（避免扫描整库）。
2. 是否确认币种大小写；若 `currency` 为空，输出所有币种。
3. 若用户需要净输赢，可追加 `total_pay_out - total_amount AS net_win`。

## 扩展提示
- 对于多币种结果，可提醒用户后续做汇率换算。
- 若要输出每日累计，可结合 `DATE_FORMAT` 和 GROUP BY 日期完成。***

