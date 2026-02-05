# n8n Code节点的三种数据访问方式

## 问题：参数都是undefined

这说明Code节点没有正确获取到上游数据。n8n的Code节点有**三种不同的数据访问方式**。

## 方法1：使用 `$input.all()` （处理多个items）

```javascript
const items = $input.all();

return items.map(item => ({
  json: {
    ...item.json,
    size: 123
  },
  binary: item.binary
}));
```

**适用场景**：上游节点返回多个items
**问题**：如果上游节点配置不对，可能返回空数组

---

## 方法2：使用内置变量 `$json` 和 `$binary` （推荐）⭐

```javascript
// 直接使用 $json 和 $binary，不需要 $input.all()
let size = 0;

if ($binary && Object.keys($binary).length > 0) {
  const binaryKey = Object.keys($binary)[0];
  const binary = $binary[binaryKey];
  
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
  }
}

// 返回单个item
return {
  json: {
    ...$json,  // 保留所有原有字段
    size: size
  },
  binary: $binary
};
```

**适用场景**：处理当前item
**优点**：最简单，最可靠

---

## 方法3：使用 `$items()` 函数

```javascript
const items = $items();

return items.map(item => ({
  json: {
    ...item.json,
    size: 123
  },
  binary: item.binary
}));
```

**适用场景**：某些n8n版本
**问题**：不是所有版本都支持

---

## 🎯 推荐解决方案

**使用方法2（内置变量）**，这是最可靠的方式：

```javascript
console.log('=== 输入数据 ===');
console.log('$json keys:', Object.keys($json));
console.log('$binary keys:', Object.keys($binary));

// 计算size
let size = 0;
let fileName = 'document.pdf';
let binaryKey = 'data';

if ($binary && Object.keys($binary).length > 0) {
  const binaryKeys = Object.keys($binary);
  binaryKey = binaryKeys[0];
  const binary = $binary[binaryKey];
  
  fileName = binary.fileName || fileName;
  
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
    console.log(`文件: ${fileName}, 大小: ${size} bytes`);
  }
}

// 返回
return {
  json: {
    ...$json,           // 保留所有原有字段（tenant_access_token等）
    size: size,         // 添加size
    fileName: fileName, // 添加fileName
    binaryProperty: binaryKey
  },
  binary: $binary       // 传递binary
};
```

---

## 🐛 如果还是undefined

### 检查1：上游节点是否有输出

在Code节点之前添加一个"Stop and Error"节点，查看上游输出。

### 检查2：Merge节点配置

如果使用了Merge节点，确保：
- Mode: "Merge By Position"
- Options: 勾选 "Include All Fields"

### 检查3：使用诊断代码

```javascript
console.log('=== 诊断 ===');
console.log('typeof $json:', typeof $json);
console.log('typeof $binary:', typeof $binary);
console.log('typeof $input:', typeof $input);

if (typeof $json !== 'undefined') {
  console.log('$json:', JSON.stringify($json, null, 2));
}

if (typeof $binary !== 'undefined') {
  console.log('$binary keys:', Object.keys($binary));
}

// 返回诊断信息
return {
  json: {
    debug: 'check console',
    has_json: typeof $json !== 'undefined',
    has_binary: typeof $binary !== 'undefined',
    json_keys: typeof $json !== 'undefined' ? Object.keys($json).join(',') : 'none'
  }
};
```

运行后查看Console输出。

---

## 📋 完整工作代码（复制使用）

```javascript
/* ========== 飞书上传 - 计算size ========== */

console.log('=== 处理数据 ===');

// 使用内置变量（最可靠）
let size = 0;
let fileName = 'document.pdf';
let binaryKey = 'data';

// 检查并处理binary数据
if ($binary && Object.keys($binary).length > 0) {
  const binaryKeys = Object.keys($binary);
  binaryKey = binaryKeys[0];
  const binary = $binary[binaryKey];
  
  console.log(`Binary key: ${binaryKey}`);
  console.log(`File name: ${binary.fileName}`);
  
  fileName = binary.fileName || fileName;
  
  // 计算文件大小
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
    console.log(`文件大小: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } else if (binary.fileSize) {
    size = binary.fileSize;
    console.log(`使用fileSize: ${size} bytes`);
  }
} else {
  console.log('⚠️ 没有binary数据');
}

// 输出结果
console.log('=== 输出 ===');
console.log('保留的json字段:', Object.keys($json).join(', '));
console.log('添加的字段: size, fileName, binaryProperty');

// 返回完整数据
return {
  json: {
    ...$json,              // 保留所有原有字段
    size: size,            // 添加size
    fileName: fileName,    // 添加fileName
    binaryProperty: binaryKey  // 添加binaryProperty
  },
  binary: $binary          // 传递binary数据
};
```

---

## ✅ 验证

运行后，在Code节点的输出中：

1. **JSON标签页**应该显示：
   - 所有原有字段（tenant_access_token等）
   - 新增的size字段（数字）
   - 新增的fileName字段（字符串）

2. **Binary标签页**应该显示：
   - PDF文件数据

如果还是undefined，说明**上游节点没有输出数据**，需要检查上游节点配置。
