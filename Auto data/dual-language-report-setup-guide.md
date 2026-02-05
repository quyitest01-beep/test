# 双语言报告发送完整配置指南

## 概述
这个解决方案可以处理包含中英文报告的上游数据，自动生成下载链接，并发送到Lark外部群。

## 系统架构
```
上游数据 → n8n Code节点 → HTTP Request → Lark群消息
         ↓
    文件上传结果 + HTML报告 → 解析处理 + 生成卡片 → 直接发送到Lark webhook
```

## 第一步：确保后端服务运行

### 1.1 启动后端服务
```bash
# 在项目根目录执行
start-server.bat
# 或者手动启动
cd backend && npm start
```

**注意：** 后端服务主要用于提供Lark文件下载代理，不需要调用后端的多报告发送API。

### 1.2 验证服务状态
- 后端服务：http://localhost:8000 (用于文件下载代理)
- 检查日志确保没有错误

### 1.3 配置环境变量
确保 `backend/.env` 包含：
```env
# Lark应用凭据 (用于文件下载)
LARK_APP_ID=cli_a9978e93ce389ed2
LARK_APP_SECRET=D3krx1JapAYPIeLjCdROi6OvF8hnV2wL

# 其他必要配置
NODE_ENV=production
PORT=8000
```

## 第二步：设置公网访问

### 2.1 启动ngrok隧道
```bash
# 使用现有脚本
start-tunnel.bat
# 或者手动启动
ngrok http 8000
```

### 2.2 获取公网URL
记录ngrok提供的HTTPS URL，例如：
```
https://abc123.ngrok.io
```

## 第三步：配置n8n工作流

### 3.1 创建Code节点
将 `n8n-dual-language-report-sender.js` 的内容复制到n8n的Code节点中。

### 3.2 修改配置参数
```javascript
// 🔴 必须修改这两个参数
let webhookUrl = 'https://open.larksuite.com/open-apis/bot/v2/hook/YOUR_ACTUAL_WEBHOOK_URL';
let publicBaseUrl = 'https://your-actual-ngrok-url.ngrok.io';
```

### 3.3 添加HTTP Request节点
在Code节点后添加HTTP Request节点：

**配置参数：**
- Method: `POST`
- URL: `{{ $json.webhookUrl }}`
- Body Type: `JSON`
- Body: `{{ $json.webhookPayload }}`
- Headers: 
  - `Content-Type`: `application/json`

**说明：**
- URL使用Code节点输出的webhookUrl变量
- Body使用Code节点生成的完整Lark消息卡片
- 直接发送到Lark群，无需经过后端API

## 第四步：数据结构说明

### 4.1 支持的上游数据格式
代码会自动识别以下类型的数据：

**文件上传结果：**
```json
{
  "code": 0,
  "data": {
    "file_key": "file_v3_00uj_xxxxx"
  },
  "msg": "success"
}
```

**HTML报告信息：**
```json
{
  "html": "<!DOCTYPE html>...",
  "title": "GMP日报_2026.02.03-02",
  "period": "2026.02.03-02",
  "timestamp": "2026-02-04T09:03:47.709Z",
  "language": "zh"  // 可选，会自动检测
}
```

**认证Token：**
```json
{
  "code": 0,
  "tenant_access_token": "t-xxxxx",
  "expire": 2742,
  "msg": "ok"
}
```

### 4.2 语言自动检测规则
- 如果有 `language` 字段，直接使用
- 如果标题包含 "Daily" 或 "Report"，判断为英文
- 如果标题只包含英文字符，判断为英文
- 其他情况判断为中文

### 4.3 文件匹配逻辑
1. **多个HTML报告 + 多个文件**：按顺序一一对应
2. **单个HTML报告 + 多个文件**：第一个文件用原标题，第二个文件生成对应语言标题
3. **只有文件，没有HTML**：生成默认的中英文标题

## 第五步：测试验证

### 5.1 运行测试脚本
```bash
node test-direct-webhook-processing.js
```

### 5.2 检查测试结果
确保看到：
- ✅ Webhook调用成功
- ✅ 链接有效
- 正确的Lark消息卡片生成
- 正确的下载链接生成

### 5.3 手动测试下载
访问生成的下载链接，确保：
- 文件可以正常下载
- 文件名正确显示
- 内容完整

## 第六步：Lark群配置

### 6.1 获取Webhook URL
1. 在Lark群中添加"自定义机器人"
2. 复制webhook URL
3. 更新n8n代码中的 `webhookUrl` 参数

### 6.2 测试消息发送
运行完整工作流，检查Lark群是否收到：
- 包含报告信息的卡片消息
- 可点击的下载链接
- 正确的文件名显示

## 故障排除

### 常见问题1：下载链接无效
**症状：** 点击下载链接返回错误
**解决：**
1. 检查ngrok是否正常运行
2. 确认后端服务在8000端口运行
3. 验证Lark应用凭据配置正确

### 常见问题2：webhook发送失败
**症状：** n8n工作流成功但Lark群没收到消息
**解决：**
1. 验证webhook URL格式正确
2. 检查Lark群机器人配置
3. 确认消息格式符合Lark API要求
4. 检查n8n HTTP Request节点配置

### 常见问题3：文件下载失败
**症状：** 消息发送成功但下载链接无效
**解决：**
1. 检查ngrok是否正常运行
2. 确认后端服务在8000端口运行
3. 验证Lark应用凭据配置正确
4. 检查file_key是否有效

### 常见问题4：语言识别错误
**症状：** 中英文报告识别错误
**解决：**
1. 在上游数据中明确设置 `language` 字段
2. 调整标题格式使其更容易识别
3. 修改代码中的语言检测逻辑

### 常见问题4：webhook发送失败
**症状：** 后端API成功但Lark群没收到消息
**解决：**
1. 验证webhook URL格式正确
2. 检查Lark群机器人配置
3. 确认消息格式符合Lark API要求

## 调试技巧

### 查看调试信息
n8n Code节点会输出详细的调试信息：
```json
{
  "debug": {
    "inputItemsCount": 4,
    "fileKeysFound": 2,
    "htmlReportsFound": 1,
    "reportsGenerated": 2,
    "hasWebhookUrl": true,
    "hasPublicBaseUrl": true,
    "rawInputSample": [...]
  }
}
```

### 后端日志
查看后端日志获取详细信息：
```bash
# 在backend目录下
tail -f logs/app.log
```

### 测试单个组件
可以单独测试各个组件：
- 测试Lark下载：`node test-lark-download.js`
- 测试API调用：`node test-unified-api.js`
- 测试数据处理：`node test-dual-language-processing.js`

## 性能优化

### 1. 缓存Token
后端会自动缓存Lark access token，避免频繁请求。

### 2. 并发处理
多个报告会并行处理，提高效率。

### 3. 错误重试
关键API调用包含重试机制。

## 安全考虑

### 1. 文件访问控制
- 只能下载由同一Lark应用上传的文件
- 下载链接包含文件验证

### 2. 环境变量保护
- 敏感信息存储在.env文件中
- 生产环境不暴露调试信息

### 3. 输入验证
- 所有API输入都经过验证
- 防止恶意文件名注入

## 扩展功能

### 1. 支持更多语言
可以扩展语言检测逻辑支持更多语言。

### 2. 自定义消息模板
可以修改Lark卡片模板适应不同需求。

### 3. 文件格式支持
目前主要支持PDF，可以扩展支持其他格式。

---

## 快速启动清单

- [ ] 后端服务运行在8000端口
- [ ] ngrok隧道已启动并获取公网URL
- [ ] Lark应用凭据已配置
- [ ] n8n Code节点已更新webhook和公网URL
- [ ] HTTP Request节点已正确配置
- [ ] 测试脚本运行成功
- [ ] Lark群已添加机器人并获取webhook URL
- [ ] 完整工作流测试通过

完成以上清单后，双语言报告发送功能即可正常使用。