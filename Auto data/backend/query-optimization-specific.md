# 针对你的查询的性能优化分析

## 当前查询分析

你的查询已经包含了时间范围，但仍然可能慢的原因：

```sql
SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  result,
  currency,
  ROUND(CAST(amount AS DOUBLE), 2) AS amount,
  ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out,
  multiplier,
  balance,
  detail,
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records
WHERE
  provider IN ('gp', 'popular')
  AND merchant_id = '1737978166'
  AND id = '1976437176340557824'
  AND uid = 'li-57ebcc16aa1240a4bc9114578a4646ce'
  AND currency = 'MXN'
  AND created_at BETWEEN
    TO_UNIXTIME(PARSE_DATETIME('2025-10-09 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
    AND TO_UNIXTIME(PARSE_DATETIME('2025-10-09 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 100
```

## 性能问题分析

### 1. 数据类型转换开销
- `ROUND(CAST(amount AS DOUBLE), 2)` - 对每行执行
- `ROUND(CAST(pay_out AS DOUBLE), 2)` - 对每行执行
- `FROM_UNIXTIME(created_at / 1000)` - 对每行执行两次
- `DATE_FORMAT()` - 对每行执行两次

### 2. 多个精确匹配条件
- `merchant_id = '1737978166'`
- `id = '1976437176340557824'`
- `uid = 'li-57ebcc16aa1240a4bc9114578a4646ce'`
- `currency = 'MXN'`

这些条件组合可能没有合适的索引支持。

## 优化建议

### 方案1：简化查询（推荐）
```sql
-- 先获取原始数据，在应用层格式化
SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  result,
  currency,
  amount,
  pay_out,
  multiplier,
  balance,
  detail,
  created_at,
  updated_at
FROM game_records
WHERE
  provider IN ('gp', 'popular')
  AND merchant_id = '1737978166'
  AND id = '1976437176340557824'
  AND uid = 'li-57ebcc16aa1240a4bc9114578a4646ce'
  AND currency = 'MXN'
  AND created_at BETWEEN
    TO_UNIXTIME(PARSE_DATETIME('2025-10-09 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
    AND TO_UNIXTIME(PARSE_DATETIME('2025-10-09 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 100
```

### 方案2：分步查询
```sql
-- 第一步：只查询ID匹配的记录
SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  result,
  currency,
  amount,
  pay_out,
  multiplier,
  balance,
  detail,
  created_at,
  updated_at
FROM game_records
WHERE
  id = '1976437176340557824'
LIMIT 10
```

### 方案3：优化条件顺序
```sql
-- 将最具体的条件放在前面
SELECT
  id,
  uid,
  merchant_id,
  game_id,
  game_code,
  result,
  currency,
  amount,
  pay_out,
  multiplier,
  balance,
  detail,
  created_at,
  updated_at
FROM game_records
WHERE
  id = '1976437176340557824'  -- 最具体的条件
  AND merchant_id = '1737978166'
  AND uid = 'li-57ebcc16aa1240a4bc9114578a4646ce'
  AND currency = 'MXN'
  AND provider IN ('gp', 'popular')
  AND created_at BETWEEN
    TO_UNIXTIME(PARSE_DATETIME('2025-10-09 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
    AND TO_UNIXTIME(PARSE_DATETIME('2025-10-09 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 100
```

## 诊断查询

### 1. 检查数据分布
```sql
-- 检查该ID是否存在
SELECT COUNT(*) FROM game_records WHERE id = '1976437176340557824';

-- 检查该商户的数据量
SELECT COUNT(*) FROM game_records WHERE merchant_id = '1737978166';

-- 检查该用户的数据量
SELECT COUNT(*) FROM game_records WHERE uid = 'li-57ebcc16aa1240a4bc9114578a4646ce';
```

### 2. 检查时间范围数据量
```sql
-- 检查2025-10-09的数据量
SELECT COUNT(*) FROM game_records 
WHERE created_at BETWEEN
  TO_UNIXTIME(PARSE_DATETIME('2025-10-09 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
  AND TO_UNIXTIME(PARSE_DATETIME('2025-10-09 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000;
```

## 立即行动建议

1. **取消当前查询**（如果还在运行）
2. **使用方案1的简化查询**
3. **如果还是慢，使用方案2的分步查询**
4. **在应用层进行数据格式化**（金额四舍五入、时间格式化）

## 长期优化建议

1. **创建复合索引**：
   - `(id, merchant_id, uid)`
   - `(merchant_id, created_at)`
   - `(provider, created_at)`

2. **考虑数据预处理**：
   - 将常用转换结果存储为计算列
   - 使用物化视图

3. **分区优化**：
   - 确保按时间分区
   - 考虑按merchant_id分区









