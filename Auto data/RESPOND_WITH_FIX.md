# Respond to Webhook 节点 "Respond With" 参数修复

## 🔍 问题发现

从你的截图可以看到关键问题：

**Respond to Webhook 节点配置**：
- ✅ `Put Response in Field`: `{{ JSON.stringify({ challenge: $json.challenge }) }}`
- ✅ 预览显示正确：`{"challenge":"8bb0ec2e-..."}`
- ❌ **`Respond With`: `First Incoming Item`** ← 这是问题所在！

## ❌ 问题原因

当 `Respond With` 设置为 `First Incoming Item` 时：
- n8n 会使用**整个输入项**作为 HTTP 响应体
- **忽略** `Put Response in Field` 的设置
- 所以 Lark 收到的是：`{"isChallenge": true, "challenge": "...", "type": "url_verification"}`
- 而不是期望的：`{"challenge": "..."}`

## ✅ 解决方案

### 方法1：改为 `json`（推荐）

1. **打开 "返回Challenge响应" 节点**
2. **找到 "Respond With" 下拉框**
3. **改为**：`json`（不是 `First Incoming Item`）
4. **保持 `Put Response in Field`**：`{{ JSON.stringify({ challenge: $json.challenge }) }}`

这样 n8n 会使用 `Put Response in Field` 的值作为响应体。

### 方法2：使用 Code 节点预处理（如果方法1不行）

如果改为 `json` 后还是不行，可以在 Respond 节点前添加 Code 节点：

**Code 节点代码**：
```javascript
// 确保返回正确的格式
const challenge = $json.challenge;

return {
  json: {
    challenge: challenge
  }
};
```

然后在 Respond 节点：
- **Respond With**: `First Incoming Item`
- **Put Response in Field**: `{{ $json }}`

## 📋 完整配置

**"返回Challenge响应" 节点配置**：

1. **Respond With**: `json` ✅
2. **Put Response in Field**: `{{ JSON.stringify({ challenge: $json.challenge }) }}`
3. **Response Code**: `200`
4. **Response Headers**:
   - Name: `Content-Type`
   - Value: `application/json`

## 🔍 验证

修改后，OUTPUT 面板应该显示：
```json
{
  "challenge": "8bb0ec2e-cadc-440b-97ac-403111b1b9fc"
}
```

而不是：
```json
{
  "isChallenge": true,
  "challenge": "8bb0ec2e-...",
  "type": "url_verification"
}
```

## 🎯 关键区别

| 设置 | 行为 | 结果 |
|------|------|------|
| `First Incoming Item` | 使用整个输入项作为响应 | ❌ 返回完整对象 |
| `json` | 使用 `Put Response in Field` 的值 | ✅ 返回自定义 JSON |

---

**更新时间**: 2025-11-19  
**版本**: V1.0

