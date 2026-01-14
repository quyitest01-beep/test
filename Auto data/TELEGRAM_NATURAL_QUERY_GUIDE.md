# 🤖 Telegram 自然语言查询指南

## 📋 **功能概述**

这个工作流实现了从 Telegram 群聊发送自然语言查询，自动转换为 SQL 并执行 Athena 查询的完整流程：

```
Telegram 群聊 → 自然语言 → SQL 转换 → Athena 查询 → 返回结果
```

## 🚀 **工作流文件**

### **1. 完整版本** (`telegram-natural-query.json`)
- ✅ 包含智能结果格式化
- ✅ 错误处理和重试机制
- ✅ 支持复杂查询逻辑
- ⚠️ 需要 Code 节点（如果你的 n8n 不支持，使用简化版本）

### **2. 简化版本** (`simple-telegram-query.json`) - 推荐
- ✅ 完全无代码，只有基础节点
- ✅ 简单可靠，兼容性最好
- ✅ 基本查询功能完整

## 🔧 **设置步骤**

### **步骤 1: 配置 Telegram Bot**

1. 在 Telegram 中联系 [@BotFather](https://t.me/botfather)
2. 创建新 bot：`/newbot`
3. 获取 Bot Token
4. 将 bot 添加到你的群组
5. 获取群组 Chat ID

### **步骤 2: 导入工作流**

1. 在 n8n 中点击 **Import from File**
2. 选择 `simple-telegram-query.json`
3. 确认导入

### **步骤 3: 配置 Telegram 节点**

1. 打开 **Telegram Trigger** 节点
2. 配置以下参数：
   - **Access Token**: 你的 Telegram Bot Token
   - **Updates**: `message`

3. 打开 **Send Reply** 节点
4. 配置以下参数：
   - **Access Token**: 同样的 Telegram Bot Token
   - **Chat ID**: 你的群组 Chat ID

### **步骤 4: 测试工作流**

1. 激活工作流
2. 在 Telegram 群组中发送测试消息

## 💬 **使用示例**

### **自然语言查询示例**

```
查询用户ID为 li-57ebcc16aa1240a4bc9114578a4646ce 的游戏记录
```

```
显示最近7天的所有交易数据
```

```
查询 provider 为 gp 且 merchant 为 1737978166 的记录
```

```
统计今天的游戏记录数量
```

```
查询金额大于1000的所有记录
```

### **预期回复格式**

```
🎯 查询结果

📊 找到 3 条记录
⏱️ 执行时间: 2秒
💾 数据扫描: 58MB

📋 数据预览 (前3条):

1. ID: 1976422629802373120
   游戏: gp_crash_73
   金额: 1000.0
   结果: 1
   时间: 2025-10-09 23:00:50

2. ID: 1976423513265401856
   游戏: gp_crash_73
   金额: 1000.0
   结果: 1
   时间: 2025-10-09 23:04:20

3. ID: 1976437176340557824
   游戏: gp_crash_73
   金额: 1000.0
   结果: 1
   时间: 2025-10-09 23:58:38
```

## 🔄 **工作流程**

```
1. 用户在 Telegram 群组发送自然语言查询
   ↓
2. Telegram Trigger 接收消息
   ↓
3. Generate SQL 节点调用后端 API 转换自然语言为 SQL
   ↓
4. Start Query 节点启动异步 Athena 查询
   ↓
5. Wait 1 Minute 等待查询执行
   ↓
6. Check Status 节点检查查询状态
   ↓
7. Send Reply 节点将结果发送回 Telegram 群组
```

## 🛠 **技术细节**

### **API 端点**

- **SQL 生成**: `POST /api/query/generate-sql`
- **查询启动**: `POST /api/async/start`
- **状态检查**: `GET /api/async/status/{queryId}`

### **请求格式**

**SQL 生成请求**:
```json
{
  "naturalLanguage": "查询用户ID为123的游戏记录",
  "database": "gmp"
}
```

**查询启动请求**:
```json
{
  "sql": "SELECT * FROM game_records WHERE uid = '123'",
  "database": "gmp"
}
```

## ⚠️ **注意事项**

### **1. 后端服务必须运行**
确保你的后端服务在 `localhost:8000` 运行

### **2. Cloudflare Tunnel 配置**
确保 Cloudflare Tunnel 正确配置并运行

### **3. API Key 配置**
确保所有节点中的 API Key 都是完整的

### **4. 查询限制**
- 单次查询最多返回 1000 条记录
- 查询超时时间：5 分钟
- 复杂查询可能需要更长时间

## 🎯 **优化建议**

### **1. 查询优化**
- 使用具体的日期范围
- 指定具体的字段名
- 避免全表扫描

### **2. 自然语言提示**
- 使用具体的表名和字段名
- 包含时间范围限制
- 指定返回字段

### **3. 错误处理**
- 如果查询失败，会显示具体错误信息
- 建议用户使用更具体的查询条件

## 🚀 **扩展功能**

### **可以添加的功能**
1. **查询历史记录**
2. **常用查询模板**
3. **数据导出功能**
4. **查询结果缓存**
5. **多语言支持**

现在你可以导入 `simple-telegram-query.json` 工作流，配置 Telegram Bot，然后开始在群组中使用自然语言查询数据了！🎉












