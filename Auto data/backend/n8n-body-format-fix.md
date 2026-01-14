# n8n Body参数格式修复指南

## 🎯 问题分析

✅ **API完全正常**: 批量查询API工作完美  
✅ **URL配置正确**: `/api/batch/start` 端点正确  
❌ **Body参数格式问题**: n8n的Body参数配置可能有问题

## 🔍 可能的问题

### 问题1: Body Content Type配置
确保在n8n节点中：
- **Body Content Type**: 设置为 `JSON`
- **Specify Body**: 设置为 `Using Fields Below`

### 问题2: Body Parameters配置
当前配置：
```json
{
  "name": "queries",
  "value": "={{ $json.queries }}"
},
{
  "name": "database", 
  "value": "gmp"
}
```

## 🛠️ 修复方案

### 方案1: 使用JSON表达式（推荐）
将"Specify Body"改为"Using Expression"，然后使用：
```json
{
  "queries": {{ $json.queries }},
  "database": "gmp"
}
```

### 方案2: 修正Body Parameters格式
如果使用"Using Fields Below"，确保：
1. **Name**: `queries`（不是 `sql`）
2. **Value**: `{{ $json.queries }}`（注意没有等号）
3. **Name**: `database`
4. **Value**: `gmp`

## 📋 完整的正确配置

### 方法1: JSON表达式配置
```json
{
  "method": "POST",
  "url": "https://ebooks-life-point-interactions.trycloudflare.com/api/batch/start",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      },
      {
        "name": "X-API-Key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json",
  "specifyBody": "json",
  "jsonBody": "{\n  \"queries\": {{ $json.queries }},\n  \"database\": \"gmp\"\n}",
  "options": {
    "timeout": 300000
  }
}
```

### 方法2: Body Parameters配置
```json
{
  "method": "POST",
  "url": "https://ebooks-life-point-interactions.trycloudflare.com/api/batch/start",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      },
      {
        "name": "X-API-Key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json",
  "specifyBody": "fields",
  "bodyParameters": {
    "parameters": [
      {
        "name": "queries",
        "value": "{{ $json.queries }}"
      },
      {
        "name": "database",
        "value": "gmp"
      }
    ]
  },
  "options": {
    "timeout": 300000
  }
}
```

## 🎯 关键差异

### 当前配置可能的问题：
1. **Value格式**: `"={{ $json.queries }}"` 中的等号可能导致问题
2. **Body Content Type**: 可能不是 `json`
3. **Specify Body**: 可能不是 `Using Fields Below`

### 正确的配置：
1. **Value格式**: `"{{ $json.queries }}"`（没有等号）
2. **Body Content Type**: `json`
3. **Specify Body**: `Using Fields Below` 或 `Using Expression`

## 🚀 测试步骤

1. 更新n8n节点配置
2. 执行节点测试
3. 检查响应是否成功
4. 如果仍有问题，尝试使用JSON表达式方法

## ⚠️ 常见错误

❌ **错误**: `"={{ $json.queries }}"`  
✅ **正确**: `"{{ $json.queries }}"`

❌ **错误**: Body Content Type 不是 `json`  
✅ **正确**: Body Content Type 设置为 `json`

❌ **错误**: 使用 `sql` 作为参数名  
✅ **正确**: 使用 `queries` 作为参数名









