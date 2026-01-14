# 🔧 简化JSON Schema配置

## 📋 **问题分析**

当前错误："Model output doesn't fit required format" 表明Gemini的输出格式与JSON Schema不匹配。

## 🚀 **解决方案1: 使用简化JSON Schema**

### **步骤1: 修改Structured Output Parser配置**

1. **选择Schema Type**
   ```
   Schema Type: Generate From JSON Example
   ```

2. **使用简化的JSON示例**
   ```json
   {
     "queryType": "ID查询",
     "confidence": 0.9,
     "extractedInfo": {
       "ids": ["1976423513265401856"],
       "userInfo": "用户ID信息",
       "timeRange": "最近7天",
       "gameInfo": "游戏相关信息",
       "merchantInfo": "商户信息"
     },
     "missingInfo": [],
     "suggestedQuestions": [],
     "canExecute": true,
     "reason": "信息完整，可以直接执行"
   }
   ```

3. **启用Auto-Fix Format**
   ```
   Auto-Fix Format: 开启
   ```

## 🚀 **解决方案2: 修改AI Prompt**

### **步骤1: 优化AI Agent的Prompt**

修改AI Agent节点的Prompt，使其更明确地要求JSON格式：

```
请分析以下查询消息，判断查询类型和支持程度：

原始消息：{{ $json.message.text }}
消息时间：{{ new Date($json.message.date * 1000).toISOString() }}

重要：请严格按照以下JSON格式返回，不要包含任何其他文字或解释。

{
  "queryType": "ID查询|用户查询|时间查询|统计查询|游戏查询|商户查询|混合查询|无法识别",
  "confidence": 0.0-1.0之间的数字,
  "extractedInfo": {
    "ids": ["提取的ID列表"],
    "userInfo": "用户相关信息",
    "timeRange": "时间范围信息",
    "gameInfo": "游戏相关信息",
    "merchantInfo": "商户相关信息"
  },
  "missingInfo": ["缺失的关键信息"],
  "suggestedQuestions": ["建议的澄清问题"],
  "canExecute": true或false,
  "reason": "判断理由"
}

注意：
1. 只返回JSON，不要包含任何解释文字
2. 所有字段都必须存在
3. 数组字段可以为空数组[]
4. 字符串字段可以为空字符串""
5. confidence必须是0.0-1.0之间的数字
```

### **步骤2: 优化System Message**

```
你是一个专业的查询分析助手。你的任务是分析用户消息并返回标准JSON格式的结果。

重要规则：
1. 必须严格按照指定的JSON格式返回结果
2. 不要包含任何解释文字、markdown格式或其他内容
3. 只返回纯净的JSON对象
4. 所有字段都必须存在，即使值为空

支持的查询类型：
- ID查询：包含16位以上数字ID
- 用户查询：包含uid、用户ID等
- 时间查询：包含日期、时间相关词汇
- 统计查询：包含数量、金额、统计等
- 游戏查询：包含游戏代码、游戏类型等
- 商户查询：包含merchant、商户等
- 混合查询：包含多种信息
- 无法识别：超出理解范围

置信度评分：
- 0.9-1.0: 信息完整，可直接执行
- 0.7-0.8: 信息基本完整，可尝试执行
- 0.5-0.6: 信息不完整，需要澄清
- 0.3-0.4: 信息模糊，需要更多细节
- 0.0-0.2: 无法理解，需要人工协助

请严格按照JSON格式返回结果。
```

## 🚀 **解决方案3: 使用Code节点处理输出**

### **步骤1: 添加Code节点**

在AI Agent和后续节点之间添加一个Code节点来处理输出：

```javascript
// 处理AI输出，确保格式正确
const aiOutput = $json.output || $json.text || $json.message;

let analysis;
try {
  // 尝试解析JSON
  if (typeof aiOutput === 'string') {
    // 提取JSON部分（去除可能的markdown格式）
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in output');
    }
  } else {
    analysis = aiOutput;
  }
} catch (error) {
  // 如果解析失败，使用默认分析
  analysis = {
    queryType: "无法识别",
    confidence: 0.0,
    extractedInfo: {
      ids: [],
      userInfo: "",
      timeRange: "",
      gameInfo: "",
      merchantInfo: ""
    },
    missingInfo: ["AI输出格式错误"],
    suggestedQuestions: ["请重新发送查询"],
    canExecute: false,
    reason: "AI输出格式无法解析"
  };
}

// 添加原始消息信息
analysis.originalMessage = $('Telegram Trigger').item.json.message.text;
analysis.chatId = $('Telegram Trigger').item.json.message.chat.id;
analysis.messageId = $('Telegram Trigger').item.json.message.message_id;
analysis.timestamp = new Date().toISOString();

return {
  json: analysis
};
```

## 🚀 **推荐解决步骤**

### **立即操作**

1. **先尝试解决方案1** - 简化JSON Schema
2. **如果仍有问题** - 使用解决方案2优化Prompt
3. **最后选择** - 使用解决方案3添加Code节点

### **测试流程**

1. 修改Structured Output Parser配置
2. 保存并测试AI Agent节点
3. 检查输出是否符合预期格式
4. 如果仍有问题，逐步应用其他解决方案

## 💡 **调试技巧**

### **查看实际输出**

1. 点击AI Agent节点的"Output"标签
2. 查看Google Gemini Chat Model的实际输出
3. 检查输出格式是否符合JSON Schema要求

### **常见问题**

- **输出包含markdown格式** - 修改Prompt明确要求纯净JSON
- **字段缺失** - 使用Code节点补充默认值
- **数据类型错误** - 检查JSON Schema的类型定义

现在请按照解决方案1先简化JSON Schema，然后测试是否解决问题！












