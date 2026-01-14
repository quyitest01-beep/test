# Respond to Webhook 节点简单配置（针对Lark Challenge）

## 🎯 目标

配置Respond to Webhook节点，返回Lark Challenge验证所需的JSON响应。

## ✅ 推荐方法：使用Code节点预处理

这是最可靠的方法，适用于所有n8n版本。

### 步骤1: 在IF节点True分支添加Code节点

在IF节点和Respond节点之间添加Code节点：

**节点名称**：`构建Challenge响应`

**代码**：
```javascript
// 构建Lark Challenge验证响应
return {
  json: {
    challenge: $json.challenge
  }
};
```

### 步骤2: 配置Respond to Webhook节点

**Parameters标签页配置**：

1. **Respond With**
   - 选择：`First Incoming Item`

2. **Response Code**
   - 输入：`200`

3. **Response Headers**
   - 点击"Add Response Header"
   - **Name**: `Content-Type`
   - **Value**: `application/json`
   - **Value类型**: 选择 `Fixed`（固定值）

4. **Put Response in Field**
   - 输入表达式：`={{ $json }}`
   - 这会直接使用Code节点输出的JSON对象

### 完整节点连接

```
IF节点（判断 isChallenge）
   ├─ True → Code节点（构建Challenge响应）→ Respond to Webhook
   └─ False → 写入Google表格 → 后续处理
```

## 🔄 备选方法：直接在Respond节点中配置

如果不想添加Code节点，可以直接在Respond节点中配置：

### 配置步骤

1. **Respond With**: `First Incoming Item`
2. **Response Code**: `200`
3. **Response Headers**: 
   - Name: `Content-Type`
   - Value: `application/json`
4. **Put Response in Field**: 
   ```
   ={{ { "challenge": $json.challenge } }}
   ```

**注意**：确保表达式语法正确，使用 `={{ }}` 格式。

## 🧪 测试配置

1. **激活工作流**
2. **在Lark开放平台配置Webhook URL**
3. **点击"保存"**
4. **查看n8n执行历史**：
   - 确认Code节点输出了正确的challenge值
   - 确认Respond节点成功执行
   - 在Lark平台应该显示"验证成功"

## 📋 配置检查清单

- [ ] Code节点已添加（推荐方法）
- [ ] Code节点代码正确：`return { json: { challenge: $json.challenge } };`
- [ ] Respond节点Respond With设置为 `First Incoming Item`
- [ ] Response Code设置为 `200`
- [ ] Response Headers包含 `Content-Type: application/json`
- [ ] Put Response in Field配置为 `={{ $json }}`（使用Code节点时）
- [ ] 节点连接正确：IF(True) → Code → Respond
- [ ] 工作流已激活

---

**更新时间**: 2025-11-19  
**版本**: V1.0


