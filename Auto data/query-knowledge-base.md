# 📚 智能查数系统知识库

## 🎯 **系统架构说明**

### **工作流程**
```
Telegram Trigger → 消息预处理 → Vector Store Retriever → AI Agent → 场景分析 → 知识库格式化 → Insert Documents
```

### **知识库特点**
- **自动学习**：成功的查询案例自动添加到知识库
- **智能检索**：基于向量相似度检索相关案例
- **持续优化**：AI分析能力随使用逐步提升
- **场景识别**：自动识别查询类型和复杂度

### **数据持久化**
- **存储方式**：内存向量存储（注意：重启会丢失数据）
- **建议改进**：配置持久化向量数据库（如Qdrant）
- **备份策略**：定期导出知识库内容

## 🎯 **核心查询场景**

### **1. ID查询场景**
```
场景描述：用户提供具体的记录ID，需要查询详细信息
常见格式：
- 1976423513265401856
- PANDA-1976422629802373120
- 1976437176340557824

识别规则：
- 16位以上纯数字：^\d{16,}$
- PANDA前缀格式：^PANDA-\d+$
- 10位以上数字：^\d{10,}$

AI分析要点：
- 自动提取所有ID
- 验证ID格式正确性
- 应用默认过滤条件

SQL模板：
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE id IN ('ID1', 'ID2', 'ID3')
  AND provider IN ('gp', 'popular')
LIMIT 100;
```

### **2. 用户查询场景**
```
场景描述：根据用户ID查询该用户的所有游戏记录
常见格式：
- li-57ebcc16aa1240a4bc9114578a4646ce
- User9911684466
- 用户ID：li-xxxxx

识别规则：
- li-开头格式：^li-\w+$
- User开头格式：^User\d+$
- 中文用户格式：^用户\d+$

AI分析要点：
- 自动识别用户ID格式
- 默认查询最近7天数据
- 按时间倒序排列

SQL模板：
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE uid = 'USER_ID'
  AND provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('START_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('END_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000
ORDER BY updated_at DESC
LIMIT 100;
```

### **3. 时间范围查询场景**
```
场景描述：查询特定时间段内的游戏记录
常见格式：
- 查询最近7天的数据
- 查询昨天的交易
- 查询10月1日到10月30日的数据

SQL模板：
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('START_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('END_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000
ORDER BY updated_at DESC
LIMIT 100;
```

### **4. 统计查询场景**
```
场景描述：统计特定条件下的数据汇总
常见格式：
- 统计今天的交易数量
- 统计某个用户的投注总额
- 统计某个游戏的胜率

SQL模板：
SELECT 
    COUNT(*) as total_records,
    SUM(CAST(amount AS DOUBLE)) as total_amount,
    SUM(CAST(pay_out AS DOUBLE)) as total_pay_out,
    AVG(CAST(amount AS DOUBLE)) as avg_amount,
    COUNT(CASE WHEN result = 1 THEN 1 END) as win_count,
    COUNT(CASE WHEN result = 0 THEN 1 END) as lose_count,
    ROUND(COUNT(CASE WHEN result = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as win_rate
FROM game_records 
WHERE provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('START_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('END_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000;
```

### **5. 游戏查询场景**
```
场景描述：查询特定游戏的记录
常见格式：
- 查询gp_crash游戏记录
- 查询gp_mines游戏数据
- 查询某个游戏类型的记录

SQL模板：
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE game_code = 'GAME_CODE'
  AND provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('START_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('END_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000
ORDER BY updated_at DESC
LIMIT 100;
```

### **6. 商户查询场景**
```
场景描述：查询特定商户的数据
常见格式：
- 查询商户1737978166的记录
- 查询某个商户的交易数据

SQL模板：
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE merchant = 'MERCHANT_ID'
  AND provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('START_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('END_DATE', 'yyyy-MM-dd HH:mm:ss')) * 1000
ORDER BY updated_at DESC
LIMIT 100;
```

## 🔧 **数据库字段说明**

### **主要字段**
- **id**: 记录ID，通常为16位以上数字
- **uid**: 用户ID，格式如 'li-xxxxx' 或 'Userxxxxxxxx'
- **merchant_id**: 商户ID
- **game_id**: 游戏ID
- **game_code**: 游戏代码，如 'gp_crash', 'gp_mines'
- **result**: 游戏结果，1表示赢，0表示输
- **currency**: 货币类型，如 'USDT'
- **amount**: 投注金额
- **pay_out**: 支付金额
- **multiplier**: 倍数
- **balance**: 余额
- **detail**: 详细信息
- **created_at**: 创建时间戳（毫秒）
- **updated_at**: 更新时间戳（毫秒）
- **provider**: 提供商，常见值：'gp', 'popular'
- **merchant**: 商户标识

### **时间字段处理**
- 时间戳转换：FROM_UNIXTIME(timestamp / 1000)
- 日期格式：DATE_FORMAT(FROM_UNIXTIME(timestamp / 1000), '%Y-%m-%d %H:%i:%s')
- 时间范围：BETWEEN TO_UNIXTIME(PARSE_DATETIME('date', 'yyyy-MM-dd HH:mm:ss')) * 1000

### **金额字段处理**
- 四舍五入：ROUND(CAST(amount AS DOUBLE), 2)
- 类型转换：CAST(amount AS DOUBLE)

## 📋 **常用查询模式**

### **默认条件**
- provider IN ('gp', 'popular')
- 限制结果数量：LIMIT 100
- 按时间排序：ORDER BY updated_at DESC

### **时间范围默认**
- 如果未指定时间范围，默认查询最近7天
- 时间格式：'yyyy-MM-dd HH:mm:ss'

### **常见游戏代码**
- gp_crash: 崩溃游戏
- gp_mines: 扫雷游戏
- gp_plinko: 弹球游戏
- gp_roulette: 轮盘游戏

## 🎯 **查询优化建议**

### **性能优化**
- 使用适当的WHERE条件避免全表扫描
- 优先使用updated_at字段进行时间过滤
- 限制结果数量使用LIMIT

### **成本控制**
- 避免SELECT *，只选择需要的字段
- 使用适当的时间范围限制
- 避免复杂的JOIN操作

### **结果格式化**
- 金额字段保留2位小数
- 时间字段格式化为可读格式
- 限制显示记录数量

## 🔍 **错误处理**

### **常见错误**
- 无效的ID格式
- 时间格式错误
- 用户ID不存在
- 时间范围过大

### **默认值处理**
- 缺失字段使用默认值
- 无效数据使用NULL
- 错误查询返回空结果

## 📝 **示例查询**

### **完整示例1：ID查询**
```sql
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE id IN ('1976423513265401856', '1976422629802373120', '1976437176340557824')
  AND provider IN ('gp', 'popular')
LIMIT 100;
```

### **完整示例2：用户查询**
```sql
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at
FROM game_records 
WHERE uid = 'User9911684466'
  AND provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('2025-10-30 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000
ORDER BY updated_at DESC
LIMIT 100;
```

### **完整示例3：统计查询**
```sql
SELECT 
    COUNT(*) as total_records,
    SUM(CAST(amount AS DOUBLE)) as total_amount,
    SUM(CAST(pay_out AS DOUBLE)) as total_pay_out,
    AVG(CAST(amount AS DOUBLE)) as avg_amount,
    COUNT(CASE WHEN result = 1 THEN 1 END) as win_count,
    COUNT(CASE WHEN result = 0 THEN 1 END) as lose_count,
    ROUND(COUNT(CASE WHEN result = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as win_rate
FROM game_records 
WHERE provider IN ('gp', 'popular')
  AND updated_at BETWEEN TO_UNIXTIME(PARSE_DATETIME('2025-10-01 00:00:00', 'yyyy-MM-dd HH:mm:ss')) * 1000 
                     AND TO_UNIXTIME(PARSE_DATETIME('2025-10-30 23:59:59', 'yyyy-MM-dd HH:mm:ss')) * 1000;
```
