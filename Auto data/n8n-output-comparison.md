# n8n输出对比 - 精简版 vs 完整版

## 🔄 输出对比

### 原始输出（包含大量无用数据）
```json
{
  "status": "success",
  "timestamp": "2026-02-05T04:08:05.286Z",
  "statistics": {
    "total_rows": 1998,
    "processed_rows": 219,
    "skipped_rows": 1779,
    "production_merchants": 219,
    "success_rate": "11.0%"
  },
  "filtered_merchants": [...],
  "queryResult": {...},
  "queryText": "",
  "replyMessage": "...",
  "larkMessage": {...},
  "reply": "...",
  "debug": {...}
}
```

### 精简输出（只保留必要字段）✅
```json
{
  "replyMessage": "✅ 找到商户信息：\n📋 商户名称：Fairy\n🏢 主商户：Fairy\n🆔 商户ID：1766396139",
  "larkMessage": {
    "msg_type": "text",
    "content": {
      "text": "✅ 找到商户信息：\n📋 商户名称：Fairy\n🏢 主商户：Fairy\n🆔 商户ID：1766396139"
    }
  }
}
```

## 📊 数据量对比

| 版本 | 字段数量 | 数据大小 | 可读性 |
|------|---------|---------|--------|
| 原始版本 | 10+ | 大 | 差 |
| 精简版本 | 2 | 小 | 优 |

## 🎯 精简版本优势

### 1. **数据清洁**
- ❌ 去掉 `status`, `timestamp`, `statistics` 等无用字段
- ❌ 去掉 `filtered_merchants` 原始数据
- ❌ 去掉 `queryResult`, `debug` 调试信息
- ✅ 只保留 `replyMessage` 和 `larkMessage`

### 2. **后续节点简化**
```javascript
// 精简版本 - 直接使用
{{ $json.larkMessage }}

// 原始版本 - 需要从复杂结构中提取
{{ $json.result.larkMessage }}
```

### 3. **网络传输优化**
- 数据量减少 80%+
- 传输速度更快
- 存储空间更小

## 🔧 使用方法

### 替换Code节点
1. 使用 `n8n-lark-query-clean-output.js` 替换现有代码
2. 后续节点使用 `{{ $json.larkMessage }}` 发送回复
3. 或使用 `{{ $json.replyMessage }}` 获取纯文本

### HTTP Request节点配置
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK",
  "body": "{{ $json.larkMessage }}"
}
```

## 📱 回复消息格式

### 成功查询
```
✅ 找到商户信息：
📋 商户名称：Fairy
🏢 主商户：Fairy
🆔 商户ID：1766396139
```

### ID反向查询
```
✅ 通过ID找到商户信息：
📋 商户名称：Fairy
🏢 主商户：Fairy
🆔 商户ID：1766396139
```

### 模糊匹配
```
✅ 找到相似商户：
📋 商户名称：supergaming
🏢 主商户：supergaming
🆔 商户ID：1767603071
```

### 多个结果
```
🔍 找到 3 个相似商户：
1. betfiery (ID: 1698202251)
2. BetWinner (ID: 1698203001)
3. betgame (ID: 1698203002)
```

### 未找到
```
❌ 未找到商户："nonexistent"

💡 建议：
• 检查商户名称拼写
• 尝试使用商户ID查询
• 使用部分关键词搜索
```

## ✅ 功能保持完整

精简版本保持了所有核心功能：
- ✅ 双向查询（商户名↔ID）
- ✅ 中文查询格式支持
- ✅ 模糊匹配
- ✅ 错误处理
- ✅ 友好的用户提示

## 🚀 立即使用

1. 复制 `n8n-lark-query-clean-output.js` 代码
2. 替换现有Code节点
3. 后续节点使用 `{{ $json.larkMessage }}`
4. 享受清洁的数据输出！

---

**总结：** 精简版本去掉了所有无用数据，只保留回复消息的核心字段，让后续节点使用更简单，数据传输更高效。