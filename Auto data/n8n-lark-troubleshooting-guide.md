# n8n飞书上传问题排查指南

## 当前问题

HTTP节点报错：`Cannot read properties of undefined (reading 'value')`

这说明**Code节点返回的数据结构不正确**，导致HTTP节点无法读取参数。

## 问题原因

Code节点必须返回**正确的数据结构**：

```javascript
{
  json: { /* JSON数据 */ },
  binary: { /* Binary数据 */ }
}
```

如果只返回 `{ json: {...} }` 而没有 `binary`，下游节点就无法访问binary数据。

## ✅ 正确的Code节点写法

### 版本1：最简单（推荐）

```javascript
const items = $input.all();

return items.map(item => {
  // 计算size
  let size = 0;
  
  if (item.binary) {
    const binaryKeys = Object.keys(item.binary);
    if (binaryKeys.length > 0) {
      const binaryKey = binaryKeys[0];
      const binary = item.binary[binaryKey];
      
      if (binary.data) {
        size = Buffer.from(binary.data, 'base64').length;
      }
    }
  }
  
  // 关键：必须同时返回json和binary
  return {
    json: {
      ...item.json,  // 保留原有字段
      size: size     // 添加新字段
    },
    binary: item.binary  // 必须传递binary！
  };
});
```

### 版本2：带详细日志

```javascript
const items = $input.all();

return items.map((item, index) => {
  console.log(`处理 Item ${index}`);
  
  // 保留原有json
  const outputJson = { ...item.json };
  
  // 计算size
  let size = 0;
  if (item.binary) {
    const binaryKeys = Object.keys(item.binary);
    console.log('Binary keys:', binaryKeys);
    
    if (binaryKeys.length > 0) {
      const binaryKey = binaryKeys[0];
      const binary = item.binary[binaryKey];
      
      if (binary.data) {
        size = Buffer.from(binary.data, 'base64').length;
        console.log(`文件: ${binary.fileName}, 大小: ${size} bytes`);
      }
      
      // 添加字段
      outputJson.size = size;
      outputJson.fileName = binary.fileName;
      outputJson.binaryProperty = binaryKey;
    }
  }
  
  // 返回完整结构
  return {
    json: outputJson,
    binary: item.binary  // 关键！
  };
});
```

## ❌ 错误的写法

### 错误1：没有返回binary

```javascript
// ❌ 错误
return {
  json: {
    size: 123,
    fileName: 'test.pdf'
  }
  // 缺少 binary: item.binary
};
```

### 错误2：返回格式不对

```javascript
// ❌ 错误
return {
  size: 123,
  fileName: 'test.pdf'
};
```

### 错误3：直接返回数组

```javascript
// ❌ 错误
return [
  { size: 123 }
];
```

## 🔧 HTTP Request节点配置

确保HTTP节点的参数引用正确：

```
Body Parameters:
- file_name: ={{ $json.fileName }}
- file: (binary) =data  或 ={{ $json.binaryProperty }}
- parent_type: bitable_file
- parent_node: BzfvbqKmXaTXotsyrMmlycZUg9g
- size: ={{ $json.size }}
```

**注意**：
- `$json.xxx` 引用Code节点返回的json字段
- binary的 `inputDataFieldName` 应该是binary的key名称（通常是"data"）

## 🐛 调试步骤

### 1. 检查Code节点输出

在Code节点后面添加一个临时的"Stop and Error"节点，查看输出：

```javascript
const items = $input.all();

// 打印第一个item的结构
if (items.length > 0) {
  const item = items[0];
  console.log('Item keys:', Object.keys(item));
  console.log('JSON keys:', Object.keys(item.json));
  console.log('Has binary:', !!item.binary);
  if (item.binary) {
    console.log('Binary keys:', Object.keys(item.binary));
  }
}

return items;
```

### 2. 验证binary传递

在Code节点的输出中，点击"Binary"标签，应该能看到binary数据。

如果看不到，说明Code节点没有正确返回binary。

### 3. 检查HTTP节点的参数表达式

确保所有表达式都能正确解析：

- `={{ $json.fileName }}` - 应该显示文件名
- `={{ $json.size }}` - 应该显示数字
- `={{ $json.tenant_access_token }}` - 应该显示token

如果显示 `undefined` 或报错，说明Code节点的json字段不对。

## 📋 完整工作流示例

```
[Merge3节点]
    ↓
[Code节点：计算size]
    ↓
[HTTP Request：上传到飞书]
```

**Code节点代码**：
```javascript
const items = $input.all();

return items.map(item => ({
  json: {
    ...item.json,
    size: item.binary && item.binary.data 
      ? Buffer.from(item.binary.data.data, 'base64').length 
      : 0
  },
  binary: item.binary
}));
```

**HTTP Request配置**：
```json
{
  "method": "POST",
  "url": "https://open.larksuite.com/open-apis/drive/v1/medias/upload_all",
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $json.tenant_access_token }}"
      }
    ]
  },
  "bodyParameters": {
    "parameters": [
      {
        "name": "file_name",
        "value": "={{ $json.fileName }}"
      },
      {
        "parameterType": "formBinaryData",
        "name": "file",
        "inputDataFieldName": "=data"
      },
      {
        "name": "parent_type",
        "value": "bitable_file"
      },
      {
        "name": "parent_node",
        "value": "BzfvbqKmXaTXotsyrMmlycZUg9g"
      },
      {
        "name": "size",
        "value": "={{ $json.size }}"
      }
    ]
  }
}
```

## 🎯 关键要点

1. **Code节点必须返回 `{ json: {...}, binary: {...} }` 结构**
2. **必须传递 `binary: item.binary`，否则下游节点访问不到**
3. **使用 `...item.json` 保留原有字段**
4. **HTTP节点用 `$json.xxx` 引用Code节点的json字段**
5. **binary的key通常是"data"，但要检查实际的key名称**

## 💡 如果还是不行

尝试**完全不用Code节点**，直接在HTTP Request节点使用表达式：

```
size参数值: ={{ Buffer.from($binary.data.data, 'base64').length }}
```

这样可以绕过Code节点的问题。
