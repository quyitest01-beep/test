# n8n Code节点的两种运行模式

## 问题：Binary数据没有输出

从截图看到：
- ✅ 上游Merge3节点有binary数据（INPUT标签页显示PDF）
- ❌ Code节点输出没有binary数据（没有Binary标签页）
- ❌ HTTP节点报错："The item has no binary field 'data'"

## 原因：Code节点的运行模式

n8n的Code节点有**两种运行模式**：

### 模式1：Run Once for Each Item（默认）

每个item单独运行一次代码。

**使用内置变量**：
```javascript
// 直接访问当前item的 $json 和 $binary
return {
  json: {
    ...$json,
    size: 123
  },
  binary: $binary  // 传递binary
};
```

### 模式2：Run Once for All Items

所有items一起运行一次代码。

**使用 $input.all()**：
```javascript
// 获取所有items
const items = $input.all();

// 处理并返回所有items
return items.map(item => ({
  json: {
    ...item.json,
    size: 123
  },
  binary: item.binary  // 必须传递！
}));
```

---

## 🎯 解决方案

### 检查Code节点的模式设置

1. 打开Code节点
2. 查看右上角的设置（齿轮图标）
3. 找到 "Mode" 或 "Run Once for All Items" 选项

### 方案A：使用 "Run Once for Each Item" 模式（推荐）

**设置**：
- Mode: Run Once for Each Item（或关闭 "Run Once for All Items"）

**代码**：
```javascript
console.log('=== 处理单个item ===');

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

// 返回单个item
return {
  json: {
    ...$json,
    size: size,
    fileName: fileName,
    binaryProperty: binaryKey
  },
  binary: $binary  // 关键：传递binary
};
```

### 方案B：使用 "Run Once for All Items" 模式

**设置**：
- Mode: Run Once for All Items（或勾选 "Run Once for All Items"）

**代码**：
```javascript
console.log('=== 处理所有items ===');

const items = $input.all();
console.log('Items数量:', items.length);

return items.map((item, index) => {
  console.log(`处理 Item ${index}`);
  
  let size = 0;
  let fileName = 'document.pdf';
  let binaryKey = 'data';
  
  if (item.binary && Object.keys(item.binary).length > 0) {
    const binaryKeys = Object.keys(item.binary);
    binaryKey = binaryKeys[0];
    const binary = item.binary[binaryKey];
    
    fileName = binary.fileName || fileName;
    
    if (binary.data) {
      size = Buffer.from(binary.data, 'base64').length;
    }
  }
  
  // 返回item - 关键：必须包含binary
  return {
    json: {
      ...item.json,
      size: size,
      fileName: fileName,
      binaryProperty: binaryKey
    },
    binary: item.binary  // 关键：传递binary
  };
});
```

---

## 🐛 调试：检查binary是否真的存在

```javascript
console.log('=== 调试信息 ===');

// 方法1：单item模式
if (typeof $binary !== 'undefined') {
  console.log('$binary 存在');
  console.log('$binary keys:', Object.keys($binary));
} else {
  console.log('❌ $binary 不存在');
}

// 方法2：多items模式
const items = $input.all();
if (items.length > 0) {
  const item = items[0];
  console.log('Item keys:', Object.keys(item));
  console.log('Has binary:', !!item.binary);
  if (item.binary) {
    console.log('Binary keys:', Object.keys(item.binary));
  }
}
```

---

## ⚠️ 常见错误

### 错误1：忘记返回binary

```javascript
// ❌ 错误
return {
  json: {
    size: 123
  }
  // 缺少 binary: ...
};
```

### 错误2：模式和代码不匹配

```javascript
// ❌ 错误：在 "Run Once for Each Item" 模式使用 $input.all()
const items = $input.all();  // 会返回空数组
```

```javascript
// ❌ 错误：在 "Run Once for All Items" 模式使用 $binary
return { binary: $binary };  // $binary 是 undefined
```

### 错误3：返回格式不对

```javascript
// ❌ 错误：在多items模式直接返回对象
return {
  json: { size: 123 },
  binary: $binary
};
// 应该返回数组：return [{ json: {...}, binary: {...} }]
```

---

## ✅ 推荐配置

**最简单的方式**：

1. **设置Code节点为 "Run Once for Each Item" 模式**
2. **使用这个代码**：

```javascript
/* ========== 飞书上传 - 计算size（单item模式）========== */

let size = 0;
let fileName = 'document.pdf';
let binaryKey = 'data';

if ($binary && Object.keys($binary).length > 0) {
  binaryKey = Object.keys($binary)[0];
  const binary = $binary[binaryKey];
  fileName = binary.fileName || fileName;
  
  if (binary.data) {
    size = Buffer.from(binary.data, 'base64').length;
  }
}

return {
  json: {
    ...$json,
    size: size,
    fileName: fileName,
    binaryProperty: binaryKey
  },
  binary: $binary
};
```

3. **验证输出**：
   - JSON标签页：应该有size、fileName等字段
   - Binary标签页：应该能看到PDF文件

---

## 🔍 如果还是没有binary

说明**上游Merge3节点没有正确传递binary**。

检查Merge3节点：
- Mode: "Merge By Position"
- Options: 勾选 "Include All Fields"
- 确保binary数据从Input 1进入

或者**完全不用Merge节点**，改用Set节点添加字段。
