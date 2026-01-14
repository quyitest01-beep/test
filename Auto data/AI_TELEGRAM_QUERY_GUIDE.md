# 🤖 AI Telegram 自然语言查询指南

## 📋 **功能概述**

这个工作流使用 n8n 内置的 AI 节点实现智能的自然语言到 SQL 转换：

```
Telegram 群聊 → AI 生成 SQL → Athena 查询 → AI 格式化结果 → 返回群聊
```

## 🚀 **工作流文件**

### **1. 完整版本** (`ai-telegram-query.json`)
- ✅ 包含 SQL 验证和安全检查
- ✅ 智能错误处理和帮助生成
- ✅ 完整的错误处理流程
- ⚠️ 需要 Code 节点

### **2. 简化版本** (`ai-telegram-simple.json`) - 推荐
- ✅ 完全使用 n8n 内置 AI 节点
- ✅ 无代码依赖，兼容性最好
- ✅ 简洁高效的工作流

## 🔧 **设置步骤**

### **步骤 1: 配置 OpenAI 凭证**

1. 在 n8n 中点击 **"Credentials"**
2. 点击 **"Create New"**
3. 选择 **"OpenAI API"**
4. 输入你的 OpenAI API Key
5. 命名为 **"OpenAI - Query Assistant"**

### **步骤 2: 配置 Telegram Bot**

1. 联系 [@BotFather](https://t.me/botfather) 创建 bot
2. 获取 Bot Token
3. 创建 **"Telegram API"** 凭证
4. 将 bot 添加到群组

### **步骤 3: 导入工作流**

1. 在 n8n 中点击 **"Import from File"**
2. 选择 `ai-telegram-simple.json`
3. 确认导入

### **步骤 4: 配置 AI 节点**

1. 打开 **"Generate SQL (AI)"** 节点
2. 选择 **"OpenAI - Query Assistant"** 凭证
3. 确认模型设置为 `gpt-3.5-turbo`

4. 打开 **"Format Result (AI)"** 节点
5. 选择同样的 OpenAI 凭证

## 💬 **AI 智能功能**

### **1. 智能 SQL 生成**
AI 会根据你的自然语言描述生成准确的 SQL 语句：

**输入示例**：
```
查询用户ID为 li-57ebcc16aa1240a4bc9114578a4646ce 的游戏记录
```

**AI 生成的 SQL**：
```sql
SELECT id, uid, merchant_id, game_id, game_code, result, currency, 
       ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
       ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
       multiplier, balance, detail, 
       DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, 
       DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at 
FROM game_records 
WHERE uid = 'li-57ebcc16aa1240a4bc9114578a4646ce' 
LIMIT 100
```

### **2. 智能结果格式化**
AI 会将查询结果转换为美观的 Telegram 消息：

```
🎯 **查询结果**

📊 找到 3 条记录
⏱️ 执行时间: 2秒
💾 数据扫描: 58MB

📋 **数据预览** (前3条):

1. **记录 ID: 1976422629802373120**
   - 用户ID: li-57ebcc16aa1240a4bc9114578a4646ce
   - 游戏代码: gp_crash_73
   - 金额: 1000.0
   - 倍数: 53.82003
   - 时间: 2025-10-09 23:00:50

2. **记录 ID: 1976423513265401856**
   - 用户ID: li-57ebcc16aa1240a4bc9114578a4646ce
   - 游戏代码: gp_crash_73
   - 金额: 1000.0
   - 倍数: 53.82003
   - 时间: 2025-10-09 23:04:20

3. **记录 ID: 1976437176340557824**
   - 用户ID: li-57ebcc16aa1240a4bc9114578a4646ce
   - 游戏代码: gp_crash_73
   - 金额: 1000.0
   - 倍数: 15.29997
   - 时间: 2025-10-09 23:58:38
```

## 🎯 **AI 智能特性**

### **1. 上下文理解**
AI 理解你的数据库结构：
- 表名和字段名
- 数据类型和格式
- 时间戳转换规则
- 金额格式化要求

### **2. 安全防护**
AI 生成的 SQL 包含安全限制：
- 只生成 SELECT 语句
- 自动添加 LIMIT 限制
- 避免危险操作（DROP、DELETE 等）
- 使用适当的 WHERE 条件

### **3. 性能优化**
AI 会自动优化查询：
- 避免全表扫描
- 使用索引友好的条件
- 限制返回结果数量
- 选择必要的字段

## 💡 **使用示例**

### **简单查询**
```
查询所有游戏记录
```

### **条件查询**
```
查询 provider 为 gp 的记录
```

### **时间范围查询**
```
显示最近7天的数据
```

### **用户特定查询**
```
查询用户 li-57ebcc16aa1240a4bc9114578a4646ce 的记录
```

### **统计查询**
```
统计今天的交易数量
```

## 🔄 **工作流程**

```
1. 用户在 Telegram 群组发送自然语言查询
   ↓
2. Telegram Trigger 接收消息
   ↓
3. Generate SQL (AI) 节点使用 OpenAI 生成 SQL
   ↓
4. Start Query 节点启动 Athena 查询
   ↓
5. Wait 1 Minute 等待查询执行
   ↓
6. Check Status 节点获取查询结果
   ↓
7. Format Result (AI) 节点格式化结果
   ↓
8. Send Result 节点发送到 Telegram 群组
```

## ⚙️ **AI 配置参数**

### **SQL 生成 AI**
- **模型**: `gpt-3.5-turbo`
- **温度**: `0.1` (低随机性，更准确的 SQL)
- **最大 Token**: `500`

### **结果格式化 AI**
- **模型**: `gpt-3.5-turbo`
- **温度**: `0.3` (适中的创造性)
- **最大 Token**: `1000`

## 🎉 **优势对比**

### **AI 节点 vs 外部 API**

| 特性 | AI 节点 | 外部 API |
|------|---------|----------|
| **响应速度** | ⚡ 更快 | 🐌 较慢 |
| **依赖** | ✅ 无外部依赖 | ❌ 需要后端服务 |
| **成本** | 💰 OpenAI 费用 | 💰 服务器费用 |
| **可靠性** | ✅ 高可用性 | ⚠️ 依赖服务器 |
| **定制性** | ✅ 高度可定制 | ⚠️ 有限定制 |
| **维护** | ✅ 无需维护 | ❌ 需要维护 |

## 🚀 **立即开始**

1. **导入工作流**: `ai-telegram-simple.json`
2. **配置凭证**: OpenAI API + Telegram Bot
3. **激活工作流**
4. **在群组中测试**

现在你可以享受 AI 驱动的智能查询体验了！🎉

## 💡 **进阶提示**

### **优化 AI 提示词**
你可以根据需要修改 AI 的系统提示词，让它更好地理解你的特定需求。

### **添加更多 AI 功能**
- 查询建议
- 数据洞察
- 趋势分析
- 异常检测

这个 AI 驱动的工作流将为你提供最智能、最便捷的数据查询体验！🚀
