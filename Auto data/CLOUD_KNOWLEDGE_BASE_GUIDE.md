# 🌐 云端知识库配置指南

## 📋 **方案对比**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Google Docs** | ✅ 在线编辑<br>✅ 协作方便<br>✅ 版本历史 | ❌ 需要公开链接<br>❌ 依赖网络 | 团队协作 |
| **N8N原生** | ✅ 完全集成<br>✅ 无需外部依赖<br>✅ 版本控制 | ❌ 编辑复杂<br>❌ 无在线编辑 | 个人使用 |
| **本地文件** | ✅ 简单直接<br>✅ 版本控制 | ❌ 需要同步<br>❌ 协作困难 | 开发测试 |

## 🚀 **推荐方案：Google Docs**

### **步骤1: 创建Google Docs文档**

1. **访问Google Drive**
   - 打开 [drive.google.com](https://drive.google.com)
   - 点击"新建" → "Google文档"

2. **创建知识库文档**
   - 文档名称：`查数场景知识库`
   - 复制以下内容到文档中：

```markdown
# 📚 查数场景知识库

## 🎯 **核心查询场景**

### **1. ID查询场景**
场景描述：用户提供具体的记录ID，需要查询详细信息
常见格式：
- 1976423513265401856
- PANDA-1976422629802373120
- 1976437176340557824

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

### **2. 用户查询场景**
场景描述：根据用户ID查询该用户的所有游戏记录
常见格式：
- li-57ebcc16aa1240a4bc9114578a4646ce
- User9911684466
- 用户ID：li-xxxxx

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

### **3. 时间范围查询场景**
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

### **4. 统计查询场景**
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

### **5. 游戏查询场景**
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

### **6. 商户查询场景**
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
```

3. **设置文档权限**
   - 点击右上角"共享"按钮
   - 选择"知道链接的任何人都可查看"
   - 复制文档链接

### **步骤2: 获取文档ID**

从Google Docs链接中提取文档ID：
```
原链接：https://docs.google.com/document/d/1ABC123DEF456GHI789JKL/edit
文档ID：1ABC123DEF456GHI789JKL
```

### **步骤3: 配置n8n工作流**

1. **导入Google Docs工作流**
   - 导入 `google-docs-knowledge-base.json`
   - 修改HTTP Request节点的URL：
   ```
   https://docs.google.com/document/d/YOUR_DOCUMENT_ID/export?format=txt
   ```

2. **配置OpenAI凭证**
   - 设置OpenAI API Key
   - 配置Embedding Model

3. **执行工作流**
   - 点击"Execute workflow"
   - 验证知识库设置成功

## 🔄 **更新知识库**

### **方法1: 更新Google Docs**
1. 直接编辑Google Docs文档
2. 重新执行n8n工作流
3. 知识库自动更新

### **方法2: 使用n8n原生配置**
1. 编辑 `n8n-native-knowledge-base.json`
2. 修改Code节点中的文档内容
3. 重新执行工作流

## 💡 **最佳实践**

### **1. 文档结构**
- 使用清晰的标题层级
- 包含完整的SQL模板
- 提供常见格式示例

### **2. 版本控制**
- 定期备份知识库
- 记录重要更新
- 使用Git管理n8n工作流

### **3. 测试验证**
- 定期测试知识库检索
- 验证SQL生成准确性
- 监控AI响应质量

## 🚀 **立即开始**

1. **创建Google Docs文档** - 复制上述内容
2. **获取文档ID** - 从链接中提取
3. **导入n8n工作流** - 使用 `google-docs-knowledge-base.json`
4. **配置并执行** - 设置文档ID和API凭证
5. **测试知识库** - 验证检索功能

这样你就能在云端管理和维护知识库了！🎉
