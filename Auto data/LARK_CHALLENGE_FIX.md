# Lark Challenge验证问题修复指南

## ❌ 错误信息

```
Challenge code没有返回
```

## ⚡ 快速修复（推荐）

**最简单的方法**：使用Webhook节点替代Lark Trigger节点

详细步骤请查看：[LARK_CHALLENGE_QUICK_FIX.md](./LARK_CHALLENGE_QUICK_FIX.md)

---

## 详细说明

## 🔍 问题原因

Lark在配置Webhook URL时会发送一个验证请求（challenge），服务器需要正确响应这个challenge才能验证成功。

验证流程：
1. Lark发送POST请求，包含 `{"type": "url_verification", "challenge": "随机字符串"}`
2. 服务器需要返回 `{"challenge": "相同的随机字符串"}`
3. 如果返回正确，验证成功

## ✅ 解决方案

### 方案一：使用Webhook节点 + Challenge处理（推荐）

如果Lark Trigger节点无法自动处理challenge，可以使用标准的Webhook节点并手动处理：

#### 步骤1: 替换Lark Trigger节点为Webhook节点

1. **删除Lark Trigger节点**
   - 删除工作流中的"Lark Webhook 触发"节点

2. **添加Webhook节点**
   - 添加"Webhook"节点
   - 配置：
     - **HTTP Method**: `POST`
     - **Path**: `lark-smart-query`（或自定义）
     - **Response Mode**: `Using 'Respond to Webhook' Node`
     - **Authentication**: `None`

3. **添加Challenge处理节点**

在Webhook节点后添加Code节点，处理challenge验证：

```javascript
// Lark Challenge验证处理
const input = $input.first().json;
const body = input.body || input;

// 检查是否是challenge验证请求
if (body.type === 'url_verification' && body.challenge) {
  console.log('🔐 收到Lark Challenge验证请求');
  
  // 返回challenge值，完成验证
  return {
    json: {
      challenge: body.challenge
    }
  };
}

// 如果是正常的事件请求，继续处理
const event = body.event || {};
const message = event.message || {};
const sender = event.sender || {};

// 提取消息内容
let messageText = '';
if (message.message_type === 'text') {
  messageText = message.content || '';
  try {
    const contentObj = JSON.parse(messageText);
    messageText = contentObj.text || messageText;
  } catch (e) {
    // 如果不是JSON，直接使用
  }
}

// 提取关键信息
const chatId = message.chat_id || '';
const messageId = message.message_id || '';
const senderId = sender.sender_id?.user_id || sender.sender_id || '';
const senderName = sender.sender_name || '未知用户';
const timestamp = message.create_time || Date.now();
const messageTime = new Date(parseInt(timestamp) * 1000).toISOString();

console.log('📨 收到Lark消息:', {
  messageId,
  chatId,
  senderId,
  senderName,
  messageText,
  messageTime
});

return {
  json: {
    messageId,
    chatId,
    senderId,
    senderName,
    messageText: messageText.trim(),
    messageTime,
    timestamp: parseInt(timestamp),
    rawEvent: body
  }
};
```

4. **添加Respond to Webhook节点**

在Challenge处理节点后添加"Respond to Webhook"节点，用于返回challenge响应：

- 在Challenge处理节点的输出中，如果是challenge验证，直接返回challenge值
- 如果是正常消息，继续后续处理

#### 步骤2: 更新工作流连接

```
Webhook节点 → Challenge处理节点 → IF节点（判断是否是challenge）
                                    ├─ 是 → Respond to Webhook（返回challenge）
                                    └─ 否 → 提取消息内容节点（继续处理）
```

### 方案二：修复Lark Trigger节点配置

如果仍想使用Lark Trigger节点：

1. **确认工作流已激活**
   - 点击工作流右上角的"Active"开关
   - 确认节点显示为绿色（已激活）

2. **检查节点配置**
   - 确认Event设置为 `im.message.receive_v1`
   - 确认Lark API凭证已正确配置

3. **重新验证Webhook URL**
   - 在Lark开放平台，删除旧的请求地址
   - 重新输入Webhook URL
   - 点击"保存"重新验证

### 方案三：使用IF节点分离处理

在现有工作流中添加IF节点，判断请求类型：

1. **在"提取消息内容"节点前添加IF节点**

```javascript
// IF节点条件
{{ $json.type }} === 'url_verification'
```

2. **True分支：处理Challenge**

添加Code节点返回challenge：

```javascript
return {
  json: {
    challenge: $json.challenge
  }
};
```

然后添加Respond to Webhook节点返回响应。

3. **False分支：正常处理消息**

继续原有的消息处理流程。

## 🔧 完整工作流结构（推荐）

```
1. Webhook节点（POST，path: lark-smart-query）
   ↓
2. Challenge处理Code节点
   - 判断是否是challenge验证
   - 如果是，返回challenge值
   - 如果不是，继续处理消息
   ↓
3. IF节点（判断是否是challenge）
   ├─ True → Respond to Webhook（返回challenge）
   └─ False → 提取消息内容 → 后续处理
```

## 📝 测试步骤

1. **激活工作流**
   - 确保工作流已激活
   - 复制Webhook URL

2. **配置Lark Webhook URL**
   - 在Lark开放平台输入Webhook URL
   - 点击"保存"
   - 应该显示"验证成功"

3. **测试消息接收**
   - 在Lark群聊中发送测试消息
   - 查看n8n执行历史，确认收到消息

## 🐛 故障排查

### 问题1: 仍然显示"Challenge code没有返回"

**检查项**：
- [ ] 工作流是否已激活
- [ ] Webhook节点是否正确配置
- [ ] Challenge处理代码是否正确
- [ ] Respond to Webhook节点是否正确连接

### 问题2: 验证成功但收不到消息

**检查项**：
- [ ] 事件订阅是否已配置（`im.message.receive_v1`）
- [ ] 应用权限是否已申请并审批
- [ ] 机器人是否已添加到群聊

### 问题3: n8n服务器无法访问

**检查项**：
- [ ] n8n服务器是否有公网IP或域名
- [ ] 防火墙是否允许Lark访问
- [ ] Webhook URL是否正确

---

**更新时间**: 2025-11-19  
**版本**: V1.0

