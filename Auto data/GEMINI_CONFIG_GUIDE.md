# 🤖 Google Gemini 免费配置指南

## 📋 **概述**

Google Gemini 提供每天60次免费请求，完全无需信用卡，是测试和开发的最佳选择。

## 🔧 **配置步骤**

### **步骤1: 获取API Key**

1. **访问Google AI Studio**
   - 打开 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - 使用Google账户登录

2. **创建API Key**
   - 点击 "Create API Key"
   - 选择 "Create API key in new project"
   - 复制生成的API Key

### **步骤2: 在n8n中配置**

1. **创建Google AI凭证**
   ```
   Name: Google Gemini API
   API Key: your-gemini-api-key-here
   ```

2. **配置Chat Model节点**
   ```
   AI Provider: Google AI
   Model: gemini-1.5-flash
   Temperature: 0.1
   Max Tokens: 1000
   ```

### **步骤3: 修改Prompt**

由于Gemini对中文支持很好，可以直接使用中文Prompt：

```
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

## 💡 **优势**

- ✅ **完全免费** - 无需信用卡
- ✅ **中文支持好** - 对中文理解优秀
- ✅ **稳定性高** - Google基础设施
- ✅ **配置简单** - 只需API Key

## ⚠️ **限制**

- 每天60次请求限制
- 单次请求有token限制
- 需要Google账户

## 🚀 **立即开始**

1. 获取Gemini API Key
2. 在n8n中配置Google AI凭证
3. 修改Chat Model节点使用Gemini
4. 测试功能












