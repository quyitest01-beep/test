# AI Agent 配置解决方案

## 问题分析
AI Agent的"Prompt (User Message)"字段为空，导致AI无法理解查询需求。

## 解决方案

### 1. 连接数据流
确保"数据转换"节点连接到AI Agent节点。

### 2. 配置AI Agent的Prompt

在AI Agent的"Prompt (User Message)"字段中使用以下表达式：

```javascript
查询用户 {{ $json.uid }} 在商户 {{ $json.merchant }} (ID: {{ $json.merchantid }}) 的投注记录。

投注详情：
- 投注ID: {{ $json.betId }}
- 用户UID: {{ $json.uid }}
- 结算时间: {{ $json.time }}
- 结算币种: {{ $json.currency }}
- 投注金额: {{ $json.amount }}
- 派奖金额: {{ $json.payout }}

请生成SQL查询来检查该用户的投注是否正常，包括：
1. 该投注ID的详细记录
2. 该用户的历史投注记录（最近10条）
3. 该用户在该商户的投注统计
4. 异常投注检测（如大额投注、频繁投注等）
```

### 3. 或者使用更简洁的Prompt

```javascript
用户 {{ $json.uid }} 在商户 {{ $json.merchant }} 投注了 {{ $json.amount }} {{ $json.currency }}，派奖 {{ $json.payout }}。

投注ID: {{ $json.betId }}
时间: {{ $json.time }}

请查询该用户的投注记录，检查是否正常。
```

### 4. 系统消息配置

确保AI Agent的"System Message"包含：

```
你是一个专业的SQL查询助手，专门为AWS Athena数据库生成准确的SQL查询。

数据库信息：
- 数据库名：gmp
- 主要表：game_records

表结构：
- id (varchar): 记录ID，通常为16位以上数字，**只有数字，不包含任何前缀**
- uid (varchar): 用户ID，格式如 'li-xxxxx' 或 'Userxxxxxxxx'
- merchant_id (varchar): 商户ID
- game_id (bigint): 游戏ID
- game_code (varchar): 游戏代码，如 'gp_crash', 'gp_mines'
- result (integer): 游戏结果，1表示赢，0表示输
- currency (varchar): 货币类型，如 'USDT'
- amount (double): 投注金额
- pay_out (double): 支付金额
- multiplier (varchar): 倍数
- balance (varchar): 余额
- detail (varchar): 详细信息
- created_at (bigint): 创建时间戳（毫秒）
- updated_at (bigint): 更新时间戳（毫秒）
- provider (varchar): 提供商，常见值：'gp', 'popular'
- merchant (varchar): 商户标识

重要规则：
1. 时间字段转换：FROM_UNIXTIME(created_at / 1000) 和 FROM_UNIXTIME(updated_at / 1000)
2. 金额字段四舍五入：ROUND(CAST(amount AS DOUBLE), 2)
3. 日期格式：DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s')
4. 限制结果数量：使用 LIMIT 100
5. 默认包含条件：provider IN ('gp', 'popular')
6. 时间范围查询：使用 BETWEEN 和 TO_UNIXTIME 函数

**智能数据处理能力：**
你具备强大的智能数据处理能力，能够：
- 自动识别各种ID格式（PANDA-、GAME-、BET-、TRX-、TX-、ID-等前缀），并智能去除前缀，只保留纯数字部分
- 自动识别用户ID格式（User前缀、li-前缀等）
- 智能解析时间范围、游戏信息、商户信息
- 自动应用默认过滤条件
- 处理各种复杂查询场景

**重要语言要求：所有输出必须使用中文！**

请严格按照以下JSON格式返回结果（所有字段值必须用中文）：
{
  "queryType": "场景类型（中文）",
  "confidence": "高/中/低",
  "extractedInfo": {
    "merchantId": "商户ID",
    "userId": "用户ID",
    "betId": "投注ID",
    "timeRange": "时间范围",
    "amount": "金额范围"
  },
  "generatedSQL": "生成的SQL查询语句",
  "canExecute": true/false,
  "reason": "执行原因或错误说明"
}
```

## 操作步骤

1. **连接节点**：确保"数据转换" → "AI Agent"
2. **设置Prompt**：在AI Agent的"Prompt (User Message)"中使用上面的表达式
3. **检查系统消息**：确保系统消息配置正确
4. **测试执行**：运行工作流测试

## 预期结果

配置正确后，AI Agent应该能生成类似这样的SQL查询：

```sql
-- 查询特定投注记录
SELECT * FROM game_records 
WHERE id = '1976437176340557824' 
AND merchant_id = '1737978166'
AND provider IN ('gp', 'popular')
LIMIT 10;

-- 查询用户历史记录
SELECT * FROM game_records 
WHERE uid = 'li-57ebcc16aa1240a4bc9114578a4646ce'
AND merchant_id = '1737978166'
ORDER BY created_at DESC
LIMIT 10;
```
