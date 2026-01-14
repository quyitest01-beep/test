# Lark Challenge 验证问题排查指南

## 🔍 当前状态

从你的截图可以看到：
- ✅ Respond 节点配置：`{{ JSON.stringify({ challenge: $json.challenge }) }}`
- ✅ 预览显示正确：`{"challenge":"8bb0ec2e-..."}`
- ❌ Lark 仍然报错："Challenge code没有返回"

## 🎯 关键检查点

### 1. 检查 Lark Trigger 节点的 "Respond" 参数 ⚠️ 最重要

**这是最常见的问题！**

1. **打开 "Lark Webhook 触发" 节点**
2. **找到 "Respond" 或 "Response Mode" 下拉框**
3. **必须选择**：`Using 'Respond to Webhook' Node`（使用 Respond to Webhook 节点）
4. **不能选择**：`Immediately`（立即响应）或 `Last Node`（最后节点）

**如果这个参数设置错误，Respond 节点不会执行！**

### 2. 检查工作流激活状态

1. **工作流右上角**应该显示 **"Active"（激活）** 状态
2. **如果显示 "Inactive"（未激活）**，点击开关激活

### 3. 检查使用的 URL

在 Lark 平台配置的 URL 应该是：
- ✅ **Production URL**: `https://n8n.flashflock.com/webhook/lark-smart-query`
- ❌ **Test URL**: `https://n8n.flashflock.com/webhook-test/lark-smart-query`

**必须使用 Production URL！**

### 4. 检查节点连接顺序

确保连接正确：
```
Lark Webhook 触发
  ↓
提取消息内容
  ↓
判断是否是Challenge验证
  ├─ True分支 → 构建Challenge响应 → 返回Challenge响应 ✅
  └─ False分支 → 写入Google表格 → ...
```

**重要**：
- "返回Challenge响应" 节点必须是 True 分支的最后一个节点
- 后面不能再有其他节点连接

### 5. 查看执行历史

1. **点击工作流右上角的执行历史图标**
2. **找到最近的执行记录**（应该是 Lark 验证时触发的）
3. **检查每个节点**：
   - "提取消息内容" → 应该有 `isChallenge: true`
   - "判断是否是Challenge验证" → 应该显示 "True Branch"
   - "构建Challenge响应" → 应该输出 `{ challenge: "xxx" }`
   - "返回Challenge响应" → 查看实际返回内容

**如果某个节点没有执行或报错，说明问题在那里。**

## ✅ 快速修复方案

### 方案1：修改 Respond 节点配置（推荐）

如果当前配置不行，尝试以下方式：

#### 方法A：直接使用 $json（最简单）

1. **Put Response in Field** 改为：
   ```
   {{ $json }}
   ```
2. **确保 "构建Challenge响应" 节点输出**：
   ```json
   {
     "challenge": "xxx"
   }
   ```

#### 方法B：使用对象表达式（不使用 stringify）

1. **Put Response in Field** 改为：
   ```
   ={{ { challenge: $json.challenge } }}
   ```
   （注意：不要用 JSON.stringify）

### 方案2：简化流程（如果还是不行）

直接在 "提取消息内容" 节点后添加 Respond 节点：

1. **删除 IF 节点和 "构建Challenge响应" 节点**
2. **"提取消息内容" 节点直接连接 Respond 节点**
3. **在 Respond 节点中**：
   - **Put Response in Field**: `={{ { challenge: $json.challenge } }}`
   - 添加条件判断：只在 `isChallenge === true` 时返回

但这样会丢失消息处理功能，不推荐。

### 方案3：使用 Webhook 节点替代（最可靠）

如果 Lark Trigger 节点一直有问题：

1. **删除 "Lark Webhook 触发" 节点**
2. **添加 "Webhook" 节点**（标准 Webhook）
3. **配置**：
   - **HTTP Method**: `POST`
   - **Path**: `lark-smart-query`
   - **Response Mode**: `Using 'Respond to Webhook' Node`
4. **其他节点保持不变**

## 🧪 测试步骤

### 步骤1：测试固定值

在 "构建Challenge响应" 节点中：
```javascript
// 测试固定值
return {
  json: {
    challenge: "test-fixed-challenge-12345"
  }
};
```

在 Lark 平台保存配置，如果固定值能通过，说明问题在于 challenge 值的传递。

### 步骤2：使用 curl 测试

```bash
curl -X POST https://n8n.flashflock.com/webhook/lark-smart-query \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test123"}'
```

应该返回：`{"challenge":"test123"}`

### 步骤3：查看 n8n 日志

在 n8n 执行历史中，查看 "返回Challenge响应" 节点的实际输出。

## 📋 完整检查清单

- [ ] **Lark Trigger 节点的 "Respond" 参数** = `Using 'Respond to Webhook' Node`
- [ ] **工作流已激活**（右上角显示 Active）
- [ ] **使用 Production URL**（不是 Test URL）
- [ ] **节点连接正确**：IF True → 构建Challenge响应 → 返回Challenge响应
- [ ] **"返回Challenge响应" 节点后面没有其他节点**
- [ ] **"构建Challenge响应" 节点输出** `{ challenge: "xxx" }`
- [ ] **Respond 节点配置正确**
- [ ] **查看执行历史**，确认每个节点都有输出且正确

## 🆘 如果仍然失败

请提供以下信息：

1. **Lark Trigger 节点的 "Respond" 参数设置**（截图）
2. **工作流执行历史**（截图，显示每个节点的输出）
3. **n8n 版本号**
4. **错误日志**（如果有）

---

**更新时间**: 2025-11-19  
**版本**: V1.0



