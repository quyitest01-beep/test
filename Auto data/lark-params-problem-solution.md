# Lark参数问题解决方案

## 🔍 问题诊断结果

**问题确认：** 你的数据中缺少Lark消息事件参数（message_id, chat_id, sender等），所以larkParams输出为空。

### 你的当前数据结构：
```json
{
  "status": "success",
  "timestamp": "2026-02-05T04:08:05.286Z",
  "statistics": {...},
  "filtered_merchants": [...],
  "queryResult": {...},
  "queryText": "Fairy"
}
```

### 缺少的Lark参数：
- ❌ message_id
- ❌ chat_id  
- ❌ sender
- ❌ tenant_key
- ❌ open_chat_id

## 🎯 立即可用的解决方案

### 方案1：使用Webhook回复（推荐）

如果你的机器人是通过Webhook接收消息的，可以直接回复到同一个Webhook：

**HTTP Request节点配置：**
- Method: `POST`
- URL: `你的Lark Webhook URL`
- Body: `{{ $json.larkMessage }}`

**优点：** 不需要任何参数，直接发送消息内容即可

### 方案2：手动设置参数

如果你知道chat_id等参数，可以手动添加：

```javascript
// 在Code节点中手动设置（替换现有的larkParams部分）
larkParams = {
  chat_id: "oc_你的聊天ID",
  message_id: "om_原始消息ID"  // 如果需要回复特定消息
};
```

### 方案3：修改工作流结构

确保Lark Webhook节点直接连接到Code节点，避免中间节点丢失参数。

## 📋 具体实施步骤

### 步骤1：确认你的回复方式

**问题：** 你是通过什么方式回复Lark消息的？

1. **Webhook机器人** → 使用方案1
2. **应用机器人（需要Access Token）** → 使用方案2或修复工作流
3. **不确定** → 先尝试方案1

### 步骤2：选择对应的Code版本

我已经为你准备了3个版本：

1. **调试版本** (`n8n-lark-query-debug-params.js`) - 查看详细信息
2. **Webhook版本** - 专门用于Webhook回复
3. **手动参数版本** - 可以手动设置参数

### 步骤3：测试和验证

使用调试版本查看你的实际数据结构，确认解决方案是否有效。

## 🔧 代码修复版本

### 版本A：Webhook专用版本
- 移除larkParams相关逻辑
- 专注于larkMessage输出
- 适用于Webhook回复场景

### 版本B：手动参数版本  
- 允许手动设置chat_id等参数
- 保留完整的回复功能
- 适用于已知参数的场景

### 版本C：智能检测版本
- 自动检测是否有Lark参数
- 根据情况选择输出格式
- 通用解决方案

## 📞 下一步行动

**请告诉我：**

1. 你是通过Webhook还是API回复消息？
2. 你是否知道chat_id等参数？
3. 你希望使用哪个版本的解决方案？

我会根据你的回答提供对应的代码版本。

## 🎯 快速测试

如果你想立即测试，可以：

1. 使用 `n8n-lark-query-debug-params.js` 查看详细输出
2. 运行 `node test-lark-params-diagnosis.js` 查看完整诊断
3. 根据结果选择最适合的解决方案

---

**总结：** 问题已确认是数据结构中缺少Lark事件参数。根据你的具体使用场景，我可以提供对应的解决方案。