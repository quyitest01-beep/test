# Respond to Webhook 节点配置修复（Lark Challenge）

## 📋 问题说明

根据你提供的webhook触发数据，Lark发送的请求格式是：
```json
{
  "body": {
    "challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114",
    "token": "gwOf5CAHP3hyca01qb06SeJwn4z3g17P",
    "type": "url_verification"
  }
}
```

Lark期望的响应格式必须是：
```json
{
  "challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114"
}
```

## ✅ 正确的Respond节点配置

### 配置方法

在Respond to Webhook节点的`responseBody`字段中，使用以下配置：

**方法一：使用JSON.stringify（推荐）**
```
={{ JSON.stringify({ challenge: $json.challenge }) }}
```

**方法二：使用JSON对象表达式**
```
={{ { challenge: $json.challenge } }}
```

**方法三：如果节点支持直接JSON字符串**
```
{"challenge": "{{ $json.challenge }}"}
```

### 完整节点配置

**Parameters标签页**：
- **respondWith**: `json`
- **responseBody**: `={{ JSON.stringify({ challenge: $json.challenge }) }}`
- **Response Code**: `200`（在Options中）
- **Response Headers**: 
  - Name: `Content-Type`
  - Value: `application/json`

## 🔍 数据流验证

### 步骤1: 检查"提取消息内容"节点输出

从webhook数据来看，challenge在`body.challenge`中。

"提取消息内容"节点应该输出：
```json
{
  "isChallenge": true,
  "challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114",
  "type": "url_verification"
}
```

### 步骤2: 检查"构建Challenge响应"节点输出

Code节点应该输出：
```json
{
  "challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114"
}
```

### 步骤3: 检查Respond节点返回

Respond节点应该返回纯JSON字符串：
```json
{"challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114"}
```

## 🐛 常见错误格式

以下格式会导致"返回数据不是合法的JSON格式"错误：

❌ **错误1**: 返回数组
```json
[{"challenge": "xxx"}]
```

❌ **错误2**: 包装在其他字段中
```json
{"data": {"challenge": "xxx"}}
```

❌ **错误3**: 不是有效的JSON字符串
```
challenge: xxx
```

❌ **错误4**: 表达式语法错误
```
{{ $json.challenge }}  // 缺少 = 号
```

## ✅ 正确的响应格式

必须是纯JSON对象字符串：
```json
{"challenge": "83e02279-3c3c-40a0-9491-1c1fb2a5114"}
```

## 🔧 调试步骤

1. **查看"提取消息内容"节点输出**
   - 确认`isChallenge: true`
   - 确认`challenge`字段有值

2. **查看"构建Challenge响应"节点输出**
   - 确认输出了`{ challenge: "xxx" }`

3. **查看"返回Challenge响应"节点输出**
   - 确认返回的是有效的JSON字符串
   - 格式应该是：`{"challenge": "xxx"}`

4. **在Lark平台测试**
   - 配置Webhook URL
   - 点击"保存"
   - 应该显示"验证成功"

## 💡 如果仍然失败

### 方法A: 使用Code节点直接返回JSON字符串

在Respond节点前添加Code节点：

```javascript
// 直接返回JSON字符串
const challenge = $json.challenge;
const jsonString = JSON.stringify({ challenge: challenge });

console.log('📤 返回给Lark的JSON:', jsonString);

return {
  json: {
    responseBody: jsonString
  }
};
```

然后在Respond节点中：
- **respondWith**: `text` 或 `json`
- **responseBody**: `={{ $json.responseBody }}`

### 方法B: 检查n8n版本

不同版本的n8n可能配置方式不同。如果上述方法不行，尝试：

1. **respondWith**: `json`
2. **responseBody**: 直接输入JSON字符串（不使用表达式）
   ```
   {"challenge": "test"}
   ```
   先测试固定值是否能通过验证。

---

**更新时间**: 2025-11-19  
**版本**: V1.0



