# AI意图识别输出格式说明

## 📋 更新内容

已更新AI意图识别节点，使其输出你需要的格式。

## ✅ 输出格式

AI现在会直接输出纯JSON数组格式（不包含markdown代码块）：

```json
[
  {
    "isQueryRequest": "true" 或 "false",
    "type": "telegram" 或 "lark",
    "senderid": 6681153969,
    "messagid": 40,
    "chatid": -1003129050838,
    "text": "1",
    "reason": "判断理由"
  }
]
```

## 🔧 修改内容

### 1. AI System Prompt

已更新为：
- 明确要求输出纯JSON格式，不要markdown代码块
- 要求返回JSON数组格式
- 指定所有字段的格式要求

### 2. AI User Content

现在会传递完整的消息上下文：
```
消息来源：telegram
发送者ID：6681153969
消息ID：40
聊天ID：-1003129050838
消息内容：1
```

这样AI可以正确填充所有字段。

### 3. 解析节点

已更新"解析意图识别结果"节点：
- 优先提取JSON数组格式
- 如果AI返回不完整，使用原始消息数据填充
- 确保所有字段都有值
- 输出格式为数组：`[{...}]`

### 4. IF节点条件

已更新为检查字符串格式的`isQueryRequest`：
- `leftValue`: `{{ $json.isQueryRequest }}`
- `rightValue`: `"true"`
- `operator`: `equals` (字符串比较)

## 📊 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `isQueryRequest` | 字符串 | "true" 或 "false" | "false" |
| `type` | 字符串 | 消息来源 | "telegram" 或 "lark" |
| `senderid` | 数字 | 发送者ID | 6681153969 |
| `messagid` | 数字 | 消息ID | 40 |
| `chatid` | 数字/字符串 | 聊天ID | -1003129050838 |
| `text` | 字符串/数字 | 消息文本 | "1" |
| `reason` | 字符串 | 判断理由 | "消息内容仅为数字..." |

## 🔍 数据流

```
提取消息内容
  ↓ { source: "telegram", senderId: "6681153969", ... }
AI识别查数意图
  ↓ AI返回: [{ isQueryRequest: "false", type: "telegram", ... }]
解析意图识别结果
  ↓ [{ isQueryRequest: "false", type: "telegram", senderid: 6681153969, ... }]
判断是否查数请求
  ├─ True → 处理查数请求
  └─ False → 写入Google表格 → 发送非查数回复
```

## 🐛 如果AI仍然返回markdown格式

解析节点会自动提取JSON部分：
- 优先匹配JSON数组：`[...]`
- 如果没有数组，匹配JSON对象：`{...}`
- 如果解析失败，使用原始消息数据作为fallback

---

**更新时间**: 2025-11-19  
**版本**: V1.0



