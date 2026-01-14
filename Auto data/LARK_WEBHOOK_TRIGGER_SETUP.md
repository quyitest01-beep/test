# Lark Webhook 触发配置详细指南

## 📋 配置概述

Lark Webhook触发有两种方式：
1. **方式一**：使用n8n的Lark Trigger节点（推荐，更简单）
2. **方式二**：使用n8n的Webhook节点 + Lark事件订阅（更灵活）

## 🔧 方式一：使用Lark Trigger节点（推荐）

### 步骤1: 在Lark开放平台创建应用

1. **登录Lark开放平台**
   - 访问：https://open.larksuite.com/
   - 使用企业管理员账号登录

2. **创建应用**
   - 点击"创建企业自建应用"
   - 填写应用名称（如：智能查数机器人）
   - 选择应用图标和描述
   - 点击"创建"

3. **获取凭证信息**
   - 在应用详情页，找到"凭证与基础信息"
   - 记录 **App ID** 和 **App Secret**
   - 这些信息将在n8n中配置

### 步骤2: 配置事件订阅

1. **进入事件订阅页面**
   - 在应用详情页，点击左侧菜单"事件订阅"
   - 点击"启用"按钮启用事件订阅

2. **配置请求地址（Webhook URL）**
   - 在n8n中，先激活工作流（点击右上角"Active"开关）
   - 打开"Lark Webhook 触发"节点
   - 复制节点显示的Webhook URL（格式类似：`https://n8n.flashflock.com/webhook/lark-smart-query`）
   - 回到Lark开放平台，在"请求地址"中输入这个URL
   - 点击"保存"

3. **订阅事件**
   - 在"订阅事件"部分，点击"添加事件"
   - 选择事件：`im.message.receive_v1`（接收消息事件）
   - 点击"确定"
   - 点击"保存"按钮

4. **验证请求地址**
   - Lark会自动发送验证请求到你的Webhook URL
   - 如果配置正确，会显示"验证成功"
   - 如果失败，检查：
     - n8n工作流是否已激活
     - Webhook URL是否正确
     - n8n服务器是否可被Lark访问（需要公网IP或域名）

### 步骤3: 配置应用权限

1. **进入权限管理**
   - 在应用详情页，点击左侧菜单"权限管理"

2. **添加所需权限**
   - 搜索并添加以下权限：
     - `im:message` - 获取与发送单聊、群组消息
     - `im:message.group_at_msg:readonly` - 接收群聊中@机器人消息事件
     - `im:message.group_at_msg:send` - 发送群聊中@机器人消息
     - `im:message:send` - 发送单聊、群组消息
     - `im:resource:readonly` - 获取用户或机器人所在群组信息

3. **申请权限**
   - 点击"申请权限"
   - 填写申请理由（如：用于智能查数机器人接收和回复群消息）
   - 提交申请
   - 等待管理员审批（如果是企业应用，可能需要管理员审批）

### 步骤4: 在n8n中配置Lark Trigger节点

1. **打开工作流**
   - 在n8n中打开 `4-lark-smart-query-with-knowledge-base.json` 工作流
   - 点击"Lark Webhook 触发"节点

2. **配置节点参数**
   - **Event（事件）**：选择 `im.message.receive_v1`
   - **Credentials（凭证）**：点击"Create New Credential"或选择已有凭证

3. **创建Lark API凭证**
   - 点击"Create New Credential"
   - 选择"Lark API"
   - 填写信息：
     - **Name（名称）**：`Lark Bot`（或自定义名称）
     - **App ID**：从Lark开放平台复制的App ID
     - **App Secret**：从Lark开放平台复制的App Secret
   - 点击"Save"保存凭证

4. **保存节点配置**
   - 确认凭证已选择
   - 点击节点右上角的"Save"按钮

### 步骤5: 激活工作流并测试

1. **激活工作流**
   - 点击工作流右上角的"Active"开关，激活工作流
   - 确认"Lark Webhook 触发"节点显示绿色（表示已激活）

2. **复制Webhook URL**
   - 在"Lark Webhook 触发"节点中，可以看到Webhook URL
   - 复制这个URL

3. **在Lark开放平台配置Webhook URL**
   - 回到Lark开放平台的"事件订阅"页面
   - 将复制的URL粘贴到"请求地址"中
   - 点击"保存"
   - Lark会自动验证URL（如果n8n工作流已激活，验证会成功）

4. **测试触发**
   - 在Lark群聊中发送一条消息
   - 回到n8n，查看工作流执行历史
   - 如果配置正确，应该能看到新的执行记录

## 🔧 方式二：使用Webhook节点（备选方案）

如果Lark Trigger节点不工作，可以使用标准的Webhook节点：

### 步骤1: 创建Webhook节点

1. **添加Webhook节点**
   - 在工作流中添加"Webhook"节点
   - 设置HTTP Method为"POST"
   - 设置Path（如：`lark-webhook`）

2. **获取Webhook URL**
   - 激活工作流后，复制Webhook URL
   - 格式：`https://your-n8n-server.com/webhook/lark-webhook`

### 步骤2: 在Lark开放平台配置

1. **配置请求地址**
   - 将Webhook URL配置到Lark开放平台的"请求地址"

2. **配置事件订阅**
   - 订阅 `im.message.receive_v1` 事件

### 步骤3: 处理Lark事件

在Webhook节点后添加Code节点，解析Lark事件格式：

```javascript
// Lark事件格式解析
const input = $input.first().json;

// Lark发送的事件格式
const event = input.event || {};
const message = event.message || {};
const sender = event.sender || {};

// 提取消息内容
let messageText = '';
if (message.message_type === 'text') {
  const content = JSON.parse(message.content || '{}');
  messageText = content.text || '';
}

return {
  json: {
    messageId: message.message_id,
    chatId: message.chat_id,
    senderId: sender.sender_id?.user_id,
    senderName: sender.sender_name,
    messageText: messageText.trim(),
    timestamp: message.create_time
  }
};
```

## 🐛 常见问题排查

### 问题0: Challenge code没有返回 ⚠️

**错误信息**：`Challenge code没有返回`

**问题原因**：Lark发送的challenge验证请求没有被正确处理

**解决方案**：
1. **使用Webhook节点替代Lark Trigger节点**（推荐）
   - 删除Lark Trigger节点
   - 添加Webhook节点（POST方法）
   - 添加Challenge处理Code节点
   - 详细步骤请参考：[LARK_CHALLENGE_FIX.md](./LARK_CHALLENGE_FIX.md)

2. **或者确保Lark Trigger节点正确配置**
   - 确认工作流已激活
   - 确认节点配置正确
   - 重新验证Webhook URL

**详细修复指南**：请查看 [LARK_CHALLENGE_FIX.md](./LARK_CHALLENGE_FIX.md)

### 问题1: Webhook URL验证失败

**可能原因**：
- n8n工作流未激活
- Webhook URL不正确
- n8n服务器无法被Lark访问

**解决方案**：
1. 确认工作流已激活（右上角"Active"开关为绿色）
2. 检查Webhook URL是否正确复制
3. 确认n8n服务器有公网IP或域名
4. 检查防火墙是否允许Lark访问

### 问题2: 收不到消息事件

**可能原因**：
- 事件订阅未配置
- 应用权限未申请
- 机器人未添加到群聊

**解决方案**：
1. 检查Lark开放平台的事件订阅配置
2. 确认已订阅 `im.message.receive_v1` 事件
3. 检查应用权限是否已申请并审批通过
4. 确认机器人已添加到目标群聊

### 问题3: 凭证配置错误

**可能原因**：
- App ID或App Secret输入错误
- 凭证未正确保存

**解决方案**：
1. 重新从Lark开放平台复制App ID和App Secret
2. 在n8n中重新创建凭证
3. 确认凭证已正确关联到节点

### 问题4: 权限不足

**可能原因**：
- 应用权限未申请
- 权限申请未审批

**解决方案**：
1. 在Lark开放平台申请所需权限
2. 联系企业管理员审批权限
3. 确认权限已生效

## 📝 配置检查清单

在开始使用前，请确认以下配置：

- [ ] Lark应用已创建
- [ ] App ID和App Secret已获取
- [ ] 事件订阅已启用
- [ ] `im.message.receive_v1` 事件已订阅
- [ ] Webhook URL已配置到Lark开放平台
- [ ] Webhook URL验证成功
- [ ] 应用权限已申请并审批
- [ ] n8n中Lark API凭证已创建
- [ ] n8n工作流已激活
- [ ] 机器人已添加到目标群聊

## 🔗 相关文档

- [Lark开放平台文档](https://open.larksuite.com/document/)
- [Lark事件订阅文档](https://open.larksuite.com/document/ukTMukTMukTM/uYjL24iN2EjL2YTN)
- [n8n Lark节点文档](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.lark/)

---

**更新时间**: 2025-11-19  
**版本**: V1.0

