# N8N工作流修改指南：发送到Lark外部群

## 🎯 修改目标
将现有的内部群报告发送工作流改为外部群发送，外部群成员可以通过下载链接获取PDF文件。

## 📋 修改步骤

### 步骤1：替换Code节点代码

**找到你工作流中最后的Code节点**，替换为以下代码：

```javascript
// 使用 n8n-lark-external-group-solution.js 中的代码
```

### 步骤2：获取外部群Webhook URL

1. **在Lark中创建机器人**：
   - 进入外部群
   - 群设置 → 机器人 → 添加机器人
   - 选择"自定义机器人"
   - 复制生成的Webhook URL

2. **修改Code节点中的URL**：
   ```javascript
   url: 'https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_WEBHOOK_URL_HERE'
   ```
   替换为你的实际Webhook URL

### 步骤3：修改HTTP Request节点

**删除或修改最后的Lark API节点**，改为HTTP Request节点：

#### HTTP Request节点配置：
```json
{
  "method": "POST",
  "url": "={{ $json.webhookRequest.url }}",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "msg_type",
        "value": "={{ $json.webhookRequest.body.msg_type }}"
      },
      {
        "name": "card",
        "value": "={{ JSON.stringify($json.webhookRequest.body.card) }}"
      }
    ]
  }
}
```

**或者更简单的配置**：
```json
{
  "method": "POST",
  "url": "={{ $json.webhookRequest.url }}",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type", 
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": "={{ JSON.stringify($json.webhookRequest.body) }}"
}
```

### 步骤4：确保后端服务运行

**检查后端下载服务**：
```bash
# 启动后端服务（如果还没启动）
cd backend
npm start

# 或使用批处理文件
start-server.bat
```

**测试下载端点**：
```bash
# 测试下载服务是否正常
curl http://localhost:8000/health
```

## 🔄 完整工作流结构

修改后的工作流应该是：

```
[数据获取] → [Merge1] → [数据处理] → [Merge2] → [PDF生成] → [文件上传] → [Code节点] → [HTTP Request]
                                                                        ↓
                                                              生成外部群卡片
                                                                        ↓
                                                              发送到外部群Webhook
```

## ⚠️ 重要注意事项

### 1. **Webhook URL安全**
- 不要在代码中硬编码敏感的Webhook URL
- 考虑使用环境变量或n8n的凭据管理

### 2. **文件访问权限**
- 外部群成员无法直接访问内部文件
- 必须通过后端服务提供下载链接
- 确保后端服务有足够的权限访问文件

### 3. **下载链接有效期**
- 后端生成的下载链接可能有时效性
- 建议在卡片中说明链接有效期

### 4. **错误处理**
- 如果文件上传失败，Code节点会生成备用访问方式
- 如果后端服务不可用，会显示联系管理员的提示

## 🧪 测试步骤

### 1. **测试Code节点输出**
运行工作流，检查Code节点输出是否包含：
- `webhookRequest.url`：正确的Webhook URL
- `webhookRequest.body.card`：完整的卡片结构
- `download_url`：有效的下载链接

### 2. **测试HTTP Request**
检查HTTP Request节点是否成功发送到外部群：
- 状态码应该是200
- 外部群应该收到卡片消息

### 3. **测试下载功能**
点击卡片中的下载按钮：
- 应该能够直接下载PDF文件
- 或者复制链接在浏览器中打开

## 🔧 故障排除

### 问题1：外部群收不到消息
- 检查Webhook URL是否正确
- 检查机器人是否已添加到群中
- 检查HTTP Request节点的配置

### 问题2：下载链接无效
- 检查后端服务是否运行（端口8000）
- 检查file_key是否正确传递
- 检查后端服务的文件访问权限

### 问题3：卡片格式错误
- 检查JSON格式是否正确
- 检查Lark卡片语法是否符合规范
- 使用Lark开发者工具验证卡片格式

## 📝 配置模板

### 环境变量配置（推荐）
```javascript
// 在Code节点中使用环境变量
const EXTERNAL_WEBHOOK_URL = process.env.LARK_EXTERNAL_WEBHOOK_URL || 'https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_DEFAULT_URL';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:8000';

const webhookRequest = {
  url: EXTERNAL_WEBHOOK_URL,
  // ... 其他配置
};
```

### 多群发送配置
```javascript
// 支持发送到多个外部群
const EXTERNAL_GROUPS = [
  'https://open.larksuite.com/open-apis/bot/v2/hook/group1_webhook',
  'https://open.larksuite.com/open-apis/bot/v2/hook/group2_webhook'
];

// 返回多个请求
return EXTERNAL_GROUPS.map(url => ({
  json: {
    ...baseData,
    webhookRequest: {
      url: url,
      body: webhookBody
    }
  }
}));
```

现在你可以按照这个指南修改你的工作流，将报告发送到外部群了！