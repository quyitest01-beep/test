# Respond to Webhook 节点 Challenge 响应修复

## 🔍 问题分析

从你的截图可以看到：
- **INPUT**: `[{"isChallenge": true, "challenge": "bfe5eedb-...", "type": "url_verification"}]`
- **当前配置**: `Put Response in Field: {{ $json }}`
- **OUTPUT**: 返回整个数组 `[{...}]`
- **Lark错误**: "Challenge code没有返回"

## ❌ 问题原因

Lark 期望的响应格式是：
```json
{"challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8"}
```

但当前返回的是：
```json
[{"isChallenge": true, "challenge": "...", "type": "url_verification"}]
```

## ✅ 解决方案

### 方法1：修改 "Put Response in Field"（推荐）

在 Respond to Webhook 节点中：

1. **Put Response in Field** 字段改为：
   ```
   {{ { challenge: $json.challenge } }}
   ```
   或者：
   ```
   {{ JSON.stringify({ challenge: $json.challenge }) }}
   ```

2. **Response Code**: `200`
3. **Response Headers**: 
   - Name: `Content-Type`
   - Value: `application/json`

### 方法2：使用 "Respond With" 选项

如果节点支持，可以：

1. **Respond With**: 选择 `json`
2. **Put Response in Field**: `{{ { challenge: $json.challenge } }}`

### 方法3：确保数据来自 "构建Challenge响应" 节点

检查节点连接：
```
判断是否是Challenge验证 (True分支)
  ↓
构建Challenge响应
  ↓ { challenge: "xxx" }
返回Challenge响应
```

确保 "构建Challenge响应" 节点输出的是：
```json
{
  "challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8"
}
```

## 🔧 完整配置步骤

### 步骤1：检查 "构建Challenge响应" 节点输出

点击 "构建Challenge响应" 节点，查看 OUTPUT，应该看到：
```json
{
  "challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8"
}
```

### 步骤2：配置 "返回Challenge响应" 节点

**Parameters 标签页**：
- **Respond With**: `First Incoming Item` 或 `json`
- **Put Response in Field**: `{{ { challenge: $json.challenge } }}`
- **Response Code** (在 Options 中): `200`
- **Response Headers** (在 Options 中):
  - Name: `Content-Type`
  - Value: `application/json`

### 步骤3：验证输出

点击 "返回Challenge响应" 节点，查看 OUTPUT，应该看到：
```json
{
  "challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8"
}
```

**注意**：不应该是一个数组 `[{...}]`，而应该是一个对象 `{...}`。

## 📋 正确的响应格式

Lark 验证时发送：
```json
{
  "challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8",
  "token": "...",
  "type": "url_verification"
}
```

Lark 期望的响应：
```json
{
  "challenge": "bfe5eedb-ea12-4ce5-8ee7-f96bc19739d8"
}
```

## 🐛 常见错误

### 错误1：返回数组
```json
[{"challenge": "xxx"}]  ❌
```
**修复**：确保返回对象 `{"challenge": "xxx"}`

### 错误2：返回完整输入
```json
{"isChallenge": true, "challenge": "xxx", "type": "url_verification"}  ❌
```
**修复**：只返回 `{"challenge": "xxx"}`

### 错误3：Put Response in Field 配置错误
```
{{ $json }}  ❌  // 返回整个对象
```
**修复**：使用 `{{ { challenge: $json.challenge } }}`

## ✅ 验证步骤

1. **测试节点输出**：
   - 点击 "构建Challenge响应" → 查看 OUTPUT
   - 点击 "返回Challenge响应" → 查看 OUTPUT
   - 确认格式是 `{"challenge": "xxx"}`

2. **在Lark平台测试**：
   - 保存配置
   - 应该显示 "验证成功"，不再显示 "Challenge code没有返回"

---

**更新时间**: 2025-11-19  
**版本**: V1.0



