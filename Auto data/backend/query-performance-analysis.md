# Athena查询性能分析和优化

## 当前查询问题分析

### 1. 查询执行时间过长（10分49秒）
**原因分析：**
- 缺少时间范围限制，扫描整个表
- 大量数据类型转换操作
- 可能的分区策略不当

### 2. 当前查询语句
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
```

## 优化建议

### 1. 添加时间范围限制（最重要）
```sql
-- 优化版本1：添加时间范围
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
  AND created_at >= TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
  AND created_at <= TO_UNIXTIME(PARSE_DATETIME('2025-10-17 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 1000
```

### 2. 简化数据类型转换
```sql
-- 优化版本2：减少转换操作
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
  AND created_at >= TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
  AND created_at <= TO_UNIXTIME(PARSE_DATETIME('2025-10-17 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 1000
```

### 3. 使用分区裁剪
```sql
-- 优化版本3：利用分区
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
  provider = 'gp'  -- 分别查询，避免IN操作
  AND created_at >= TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
  AND created_at <= TO_UNIXTIME(PARSE_DATETIME('2025-10-17 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
LIMIT 1000
```

## 性能优化策略

### 1. 立即优化
- **添加时间范围**：这是最重要的优化，可以大幅减少扫描的数据量
- **使用LIMIT**：限制返回结果数量
- **避免复杂转换**：在应用层进行数据格式化

### 2. 长期优化
- **检查分区策略**：确保按时间或provider分区
- **创建索引**：在常用查询字段上创建索引
- **数据预处理**：将常用转换结果存储为计算列

### 3. 查询监控
```sql
-- 检查表分区信息
SHOW PARTITIONS game_records;

-- 检查表统计信息
DESCRIBE EXTENDED game_records;
```

## 建议的查询流程

1. **先测试小范围查询**：
```sql
SELECT COUNT(*) FROM game_records 
WHERE provider IN ('gp', 'popular') 
AND created_at >= TO_UNIXTIME(PARSE_DATETIME('2025-10-17 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000
AND created_at <= TO_UNIXTIME(PARSE_DATETIME('2025-10-17 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000;
```

2. **逐步扩大时间范围**：
   - 先查询1天数据
   - 再查询1周数据
   - 最后查询1个月数据

3. **监控查询统计**：
   - 数据扫描量
   - 执行时间
   - 成本

## 紧急处理建议

如果当前查询仍在运行：
1. **取消当前查询**：点击"取消"按钮
2. **使用优化版本**：添加时间范围限制
3. **分批查询**：将大查询拆分为多个小查询









