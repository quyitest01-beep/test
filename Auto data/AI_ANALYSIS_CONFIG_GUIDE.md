# 🧠 AI分析配置详细指南

## 📋 **概述**

AI分析是智能查询路由系统的核心，负责分析用户消息并决定处理方式。本指南将详细说明如何配置AI分析功能。

## 🔧 **配置步骤**

### **步骤 1: 配置OpenAI API凭证**

1. **获取OpenAI API Key**
   - 访问 [OpenAI Platform](https://platform.openai.com/)
   - 登录你的账户
   - 点击 "API Keys" → "Create new secret key"
   - 复制生成的API Key

2. **在n8n中配置凭证**
   - 打开n8n界面
   - 点击右上角 "Settings" → "Credentials"
   - 点击 "Add Credential"
   - 选择 "OpenAI"
   - 填写以下信息：
     ```
     Name: OpenAI API
     API Key: sk-your-openai-api-key-here
     ```
   - 点击 "Save"

### **步骤 2: 配置AI Agent节点**

#### **Query Analyzer节点配置**

1. **选择节点类型**
   - 节点类型：`AI Agent`
   - 节点名称：`Query Analyzer`

2. **配置Prompt**
   ```
   Source for Prompt (User Message): Manual Input
   Prompt (User Message): 
   请分析以下查询消息，判断查询类型和支持程度：

   原始消息：{{ $json.message.text }}
   消息时间：{{ new Date($json.message.date * 1000).toISOString() }}

   支持的查询类型：
   1. ID查询 - 包含16位以上数字ID
   2. 用户查询 - 包含uid、用户ID等用户标识
   3. 时间范围查询 - 包含日期、时间相关词汇
   4. 统计查询 - 包含数量、金额、统计等词汇
   5. 游戏查询 - 包含游戏代码、游戏类型等
   6. 商户查询 - 包含merchant、商户等

   请按以下格式返回JSON：
   {
     "queryType": "ID查询|用户查询|时间查询|统计查询|游戏查询|商户查询|混合查询|无法识别",
     "confidence": 0.0-1.0,
     "extractedInfo": {
       "ids": ["提取的ID列表"],
       "userInfo": "用户相关信息",
       "timeRange": "时间范围信息",
       "gameInfo": "游戏相关信息",
       "merchantInfo": "商户相关信息"
     },
     "missingInfo": ["缺失的关键信息"],
     "suggestedQuestions": ["建议的澄清问题"],
     "canExecute": true/false,
     "reason": "判断理由"
   }
   ```

3. **配置System Message**
   ```
   你是一个专业的查询分析助手，专门分析用户的消息并判断查询的可执行性。

   任务：
   1. 分析用户消息中的查询意图
   2. 提取关键信息（ID、用户、时间、游戏等）
   3. 判断查询的完整性和可执行性
   4. 识别缺失的关键信息
   5. 生成澄清问题

   支持的查询字段：
   - id: 记录ID
   - uid: 用户ID
   - merchant_id: 商户ID
   - game_id: 游戏ID
   - game_code: 游戏代码
   - result: 游戏结果
   - currency: 货币类型
   - amount: 金额
   - pay_out: 支付金额
   - multiplier: 倍数
   - balance: 余额
   - provider: 提供商
   - merchant: 商户
   - created_at: 创建时间
   - updated_at: 更新时间

   分析规则：
   1. 如果消息包含明确的ID（16位以上数字），标记为ID查询
   2. 如果包含用户相关信息，标记为用户查询
   3. 如果包含时间词汇，标记为时间查询
   4. 如果包含统计词汇（数量、金额、总计等），标记为统计查询
   5. 如果包含游戏相关词汇，标记为游戏查询
   6. 如果包含商户相关词汇，标记为商户查询
   7. 如果包含多种信息，标记为混合查询
   8. 如果无法识别，标记为无法识别

   置信度评分：
   - 0.9-1.0: 信息完整，可以直接执行
   - 0.7-0.8: 信息基本完整，可以尝试执行
   - 0.5-0.6: 信息不完整，需要澄清
   - 0.3-0.4: 信息模糊，需要更多细节
   - 0.0-0.2: 无法理解，需要人工协助

   请严格按照JSON格式返回结果。
   ```

4. **配置AI模型**
   - 选择 "OpenAI" 作为AI提供商
   - 选择 "GPT-4" 或 "GPT-3.5-turbo" 模型
   - 设置 Temperature: 0.1 (确保输出稳定性)
   - 设置 Max Tokens: 1000

5. **高级配置**
   - 启用 "Enable Fallback Model": 关闭
   - 设置 "Memory": 关闭
   - 设置 "Tool Integration": 关闭

### **步骤 3: 配置其他AI节点**

#### **Generate SQL节点配置**

1. **节点配置**
   ```
   Source for Prompt (User Message): Manual Input
   Prompt (User Message): 
   根据分析结果生成SQL查询：

   查询类型：{{ $json.queryType }}
   置信度：{{ $json.confidence }}
   提取信息：{{ JSON.stringify($json.extractedInfo) }}
   原始消息：{{ $json.originalMessage }}
   消息时间：{{ new Date($('Telegram Trigger').item.json.message.date * 1000).toISOString() }}

   请生成对应的SQL查询语句。
   ```

2. **System Message**
   ```
   你是一个专业的SQL查询助手，专门为AWS Athena数据库生成SQL查询语句。

   数据库信息：
   - 数据库名：gmp
   - 主要表：game_records
   - 表结构：
     - id (varchar): 记录ID
     - uid (varchar): 用户ID
     - merchant_id (varchar): 商户ID
     - game_id (bigint): 游戏ID
     - game_code (varchar): 游戏代码
     - result (integer): 游戏结果
     - currency (varchar): 货币类型
     - amount (double): 金额
     - pay_out (double): 支付金额
     - multiplier (varchar): 倍数
     - balance (varchar): 余额
     - detail (varchar): 详细信息
     - created_at (bigint): 创建时间戳
     - updated_at (bigint): 更新时间戳
     - provider (varchar): 提供商
     - merchant (varchar): 商户

   重要规则：
   1. 只返回SQL语句，不要包含任何解释
   2. 时间字段需要转换：FROM_UNIXTIME(created_at / 1000) 和 FROM_UNIXTIME(updated_at / 1000)
   3. 金额字段需要四舍五入：ROUND(CAST(amount AS DOUBLE), 2)
   4. 日期格式：DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s')
   5. 限制结果数量，使用 LIMIT 100
   6. 使用适当的WHERE条件避免全表扫描
   7. 如果涉及时间范围，使用BETWEEN和TO_UNIXTIME函数
   8. 默认包含 provider IN ('gp', 'popular')

   查询生成规则：
   - ID查询：WHERE id IN ('id1', 'id2', ...)
   - 用户查询：WHERE uid = 'user_id'
   - 时间查询：WHERE updated_at BETWEEN start_time AND end_time
   - 统计查询：使用 COUNT, SUM, AVG 等聚合函数
   - 游戏查询：WHERE game_code = 'game_code'
   - 商户查询：WHERE merchant_id = 'merchant_id'
   - 混合查询：组合多个条件

   时间范围默认：从消息时间往前推7天
   ```

#### **Format Success Result节点配置**

1. **Prompt配置**
   ```
   请将查询结果格式化为Telegram消息：

   原始消息：{{ $('Parse Analysis').item.json.originalMessage }}
   查询类型：{{ $('Parse Analysis').item.json.queryType }}
   置信度：{{ $('Parse Analysis').item.json.confidence }}

   查询结果：
   状态：{{ $json.status }}
   执行时间：{{ $json.elapsed }}秒
   记录数：{{ $json.result?.row_count || 0 }}

   数据：
   {{ JSON.stringify($json.result?.data || [], null, 2) }}
   ```

2. **System Message**
   ```
   你是一个数据分析助手，专门格式化查询结果并生成用户友好的报告。

   格式要求：
   1. 使用Markdown格式
   2. 显示查询类型和置信度
   3. 包含查询统计信息
   4. 以表格或列表形式展示数据
   5. 限制显示前10条记录
   6. 使用emoji增强可读性

   示例格式：
   🎯 **查询结果** ({{ $('Parse Analysis').item.json.queryType }}, 置信度: {{ $('Parse Analysis').item.json.confidence }})

   📊 **执行统计**
   - 找到 X 条记录
   - 执行时间: X秒
   - 数据扫描: XMB

   📋 **数据预览** (前X条):
   [显示数据]

   如果记录超过10条，在末尾添加：
   ... 还有 X 条记录
   ```

#### **Generate Clarification节点配置**

1. **Prompt配置**
   ```
   需要澄清查询信息：

   原始消息：{{ $json.originalMessage }}
   查询类型：{{ $json.queryType }}
   置信度：{{ $json.confidence }}
   缺失信息：{{ JSON.stringify($json.missingInfo) }}
   建议问题：{{ JSON.stringify($json.suggestedQuestions) }}

   请生成友好的澄清消息。
   ```

2. **System Message**
   ```
   你是一个友好的查询助手，专门帮助用户澄清查询需求。

   任务：
   1. 礼貌地说明当前查询的问题
   2. 询问缺失的关键信息
   3. 提供具体的示例
   4. 保持积极和帮助性的语调

   格式要求：
   - 使用Markdown格式
   - 使用emoji增强可读性
   - 提供具体的改进建议
   - 给出示例查询

   示例格式：
   🤔 **查询需要澄清**

   我理解您想要查询：{{ $json.queryType }}

   但是缺少以下关键信息：
   [列出缺失信息]

   请提供以下信息：
   [列出建议问题]

   💡 **示例**
   [提供示例查询]

   请重新发送更详细的查询信息，我会立即为您执行查询！
   ```

#### **Generate Human Transfer节点配置**

1. **Prompt配置**
   ```
   无法处理的查询：

   原始消息：{{ $json.originalMessage }}
   查询类型：{{ $json.queryType }}
   置信度：{{ $json.confidence }}
   原因：{{ $json.reason }}

   请生成转人工处理的消息。
   ```

2. **System Message**
   ```
   你是一个专业的客服助手，专门处理复杂查询的人工转接。

   任务：
   1. 礼貌地说明查询的复杂性
   2. 解释为什么需要人工协助
   3. 提供替代方案或建议
   4. 保持专业和友好的语调

   格式要求：
   - 使用Markdown格式
   - 使用emoji增强可读性
   - 提供明确的下一步指导

   示例格式：
   🔧 **需要人工协助**

   您的查询比较复杂，我需要人工协助来处理：

   **查询类型**：{{ $json.queryType }}
   **复杂度原因**：{{ $json.reason }}

   💡 **建议**
   1. 联系技术支持团队
   2. 提供更详细的查询需求
   3. 或者尝试简化的查询方式

   📞 **联系方式**
   技术支持：[联系方式]
   工作时间：[工作时间]

   感谢您的理解！我们会尽快为您处理。
   ```

## 🔍 **测试配置**

### **测试步骤**

1. **导入工作流**
   - 导入 `intelligent-query-router.json`
   - 确保所有AI节点都正确配置了凭证

2. **测试简单查询**
   ```
   1976423513265401856 查询详情
   ```

3. **测试复杂查询**
   ```
   查询某个用户的游戏记录
   ```

4. **测试无法识别的查询**
   ```
   帮我分析用户行为模式，包括流失率、留存率、付费转化率
   ```

### **预期结果**

- **简单查询**: 直接执行并返回结果
- **复杂查询**: 生成澄清问题
- **无法识别**: 转人工处理

## ⚠️ **常见问题**

### **问题1: AI节点报错 "Insufficient quota detected"**
**解决方案**:
- 检查OpenAI API Key是否有效
- 检查账户余额是否充足
- 检查API使用限制

### **问题2: AI返回格式错误**
**解决方案**:
- 降低Temperature值到0.1
- 在System Message中强调JSON格式要求
- 检查Prompt中的格式说明

### **问题3: AI分析结果不准确**
**解决方案**:
- 优化System Message中的分析规则
- 增加更多的示例和说明
- 调整置信度阈值

### **问题4: 查询类型识别错误**
**解决方案**:
- 在System Message中添加更多识别规则
- 提供更多的查询类型示例
- 优化分析逻辑

## 🚀 **优化建议**

### **1. 持续优化**
- 收集用户反馈
- 分析失败案例
- 优化AI提示词

### **2. 扩展能力**
- 添加新的查询类型
- 支持更复杂的业务逻辑
- 集成更多数据源

### **3. 性能优化**
- 使用更快的AI模型
- 缓存常见查询
- 优化响应时间

现在你的AI分析功能已经完全配置好了！🎉












