# n8n Lark Webhook HTTP节点配置指南

## 🎯 完整工作流配置

### 节点1: Code节点
**代码文件**: `n8n-xlsx-webhook-processor-fixed.js`

**功能**:
- 处理上游XLSX文件
- 计算周期信息
- 构建Lark卡片
- 准备webhook请求数据

### 节点2: HTTP Request节点

#### ⚙️ 基本设置
- **Method**: `POST`
- **URL**: `={{ $json.webhookRequest.url }}`

#### 📋 Headers配置
点击 "Add Header" 添加：
- **Name**: `Content-Type`
- **Value**: `application/json; charset=utf-8`

#### 📦 Body配置
- **Body Content Type**: `JSON`
- **JSON**: `={{ $json.webhookRequest.body }}`

---

## 🔧 详细配置步骤

### Step 1: 添加HTTP Request节点
1. 在工作流中添加 "HTTP Request" 节点
2. 连接到Code节点的输出

### Step 2: 配置Method和URL
```
Method: POST
URL: ={{ $json.webhookRequest.url }}
```

### Step 3: 配置Headers
点击 "Send Headers" 开关，然后添加：
```
Name: Content-Type
Value: application/json; charset=utf-8
```

### Step 4: 配置Body
1. 开启 "Send Body" 开关
2. 选择 "Body Content Type" 为 "JSON"
3. 在JSON字段中输入：
```
={{ $json.webhookRequest.body }}
```

---

## 📱 预期效果

### Lark群中显示的卡片：
```
┌─────────────────────────────────┐
│ 📊 数据报告                     │
├─────────────────────────────────┤
│ 报告周期： 20241110-20241116    │
│ 生成时间： 2024-11-17 15:30:25  │
│ ─────────────────────────────── │
│ 📄 报告文件： 商户数据.xlsx、   │
│              留存数据.xlsx      │
│                                 │
│ 📊 文件数量： 2 个              │
│                                 │
│ 💡 获取方式： 请联系管理员获取   │
│              文件下载链接       │
│                                 │
│ [💬 联系管理员]                 │
└─────────────────────────────────┘
```

---

## 🧪 测试步骤

### 1. 测试Code节点
运行Code节点后检查输出：
- `json.webhookRequest.url` 应该是webhook URL
- `json.webhookRequest.body` 应该包含卡片数据
- `binary` 应该包含文件数据

### 2. 测试HTTP节点
运行HTTP节点，成功响应应该是：
```json
{
  "StatusCode": "ok"
}
```

### 3. 检查Lark群
群里应该收到包含文件信息的卡片消息

---

## ⚠️ 故障排除

### 问题1: URL显示undefined
**原因**: Code节点输出结构不正确
**解决**: 检查Code节点是否正确返回 `webhookRequest.url`

### 问题2: Body显示undefined
**原因**: Code节点输出结构不正确
**解决**: 检查Code节点是否正确返回 `webhookRequest.body`

### 问题3: 发送失败
**原因**: Webhook URL无效或网络问题
**解决**: 
1. 确认webhook URL正确
2. 检查网络连接
3. 查看HTTP节点的错误信息

### 问题4: 卡片显示异常
**原因**: 卡片JSON格式不正确
**解决**: 检查Code节点中的card对象结构

---

## 🔍 调试技巧

### 1. 查看Code节点输出
在Code节点后添加一个临时的"Set"节点，查看完整输出结构：
```json
{
  "json": {
    "webhookRequest": {
      "url": "https://open.larksuite.com/...",
      "body": { "msg_type": "interactive", "card": {...} }
    },
    "file_count": 2,
    "file_names": ["file1.xlsx", "file2.xlsx"]
  },
  "binary": {
    "attachment_1": { "data": "...", "fileName": "file1.xlsx" },
    "attachment_2": { "data": "...", "fileName": "file2.xlsx" }
  }
}
```

### 2. 手动测试webhook
可以使用curl命令测试webhook：
```bash
curl -X POST \
  https://open.larksuite.com/open-apis/bot/v2/hook/51e34423-07f5-41f3-a484-cc2bdc6b3909 \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

---

## 📝 配置总结

**Code节点**: 使用 `n8n-xlsx-webhook-processor-fixed.js`
**HTTP节点配置**:
- Method: POST
- URL: `={{ $json.webhookRequest.url }}`
- Headers: Content-Type: application/json; charset=utf-8
- Body: JSON, `={{ $json.webhookRequest.body }}`

这样配置后，工作流会自动处理XLSX文件并发送包含文件信息的卡片到Lark外部群！