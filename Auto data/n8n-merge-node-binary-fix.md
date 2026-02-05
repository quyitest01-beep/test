# n8n Merge节点处理Binary数据的问题

## 问题现象

从工作流截图看到，有多个Merge节点合并不同的查询结果。当Merge节点合并包含binary数据的项时，可能会导致：

1. **Binary数据结构改变**
2. **Binary数据丢失**
3. **文件只有几个字节**

## Merge节点对Binary数据的影响

### 场景1: Append模式

```
输入1: { json: {...}, binary: { data: {...} } }
输入2: { json: {...}, binary: { data: {...} } }

Merge (Append模式) 输出:
[
  { json: {...}, binary: { data: {...} } },  // 输入1
  { json: {...}, binary: { data: {...} } }   // 输入2
]
```

**问题**: 输出变成了数组，每个元素都有自己的binary数据。

### 场景2: Merge By Key模式

```
输入1: { json: { id: 1, name: "A" }, binary: { file1: {...} } }
输入2: { json: { id: 1, value: 100 }, binary: { file2: {...} } }

Merge (By Key: id) 输出:
{
  json: { id: 1, name: "A", value: 100 },
  binary: { file1: {...}, file2: {...} }  // 两个binary合并了
}
```

**问题**: Binary数据被合并到一个对象中，key可能冲突。

### 场景3: Choose Branch模式

```
输入1: { json: {...}, binary: { data: {...} } }
输入2: { json: {...}, binary: { data: {...} } }

Merge (Choose Branch 1) 输出:
{ json: {...}, binary: { data: {...} } }  // 只保留分支1
```

**问题**: 其他分支的binary数据丢失。

## 你的工作流问题分析

从截图看，你的工作流是这样的：

```
[查询1] → [Convert to XLSX] → \
                                 [Merge] → [你的文件处理节点] → [邮件]
[查询2] → [Convert to XLSX] → /
[查询3] → [Convert to XLSX] → /
```

**问题**: 
1. 多个Convert to XLSX节点生成了多个文件
2. Merge节点将它们合并
3. 你的文件处理节点需要处理合并后的数据结构

## 解决方案

### 方案1: 修改文件处理节点以处理数组

```javascript
/* ========== 修复版：处理Merge后的数组数据 ========== */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

console.log(`📥 收到 ${inputItems.length} 个输入项`);

// 🔧 关键修复：处理Merge节点输出的数组
const fileData = [];
const fileNames = [];

inputItems.forEach((item, itemIndex) => {
  console.log(`\n🔍 处理输入项 [${itemIndex + 1}]:`);
  
  const json = item.json || {};
  const binary = item.binary || {};
  
  // 检查binary对象
  if (Object.keys(binary).length === 0) {
    console.warn(`⚠️ 输入项 [${itemIndex + 1}] 没有 binary 数据`);
    return;
  }
  
  console.log(`  Binary keys: ${Object.keys(binary).join(', ')}`);
  
  // 遍历所有binary字段
  Object.keys(binary).forEach(binaryKey => {
    const bin = binary[binaryKey];
    
    if (!bin || typeof bin !== 'object') {
      console.log(`  跳过 ${binaryKey}: 不是对象`);
      return;
    }
    
    console.log(`\n  检查 binary.${binaryKey}:`);
    console.log(`    fileName: ${bin.fileName || 'N/A'}`);
    console.log(`    mimeType: ${bin.mimeType || 'N/A'}`);
    console.log(`    has data: ${!!bin.data}`);
    
    // 检查是否是xlsx文件
    const isXlsx = 
      bin.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      bin.mimeType === 'application/vnd.ms-excel' ||
      (bin.fileName && (bin.fileName.endsWith('.xlsx') || bin.fileName.endsWith('.xls')));
    
    if (!isXlsx) {
      console.log(`    跳过: 不是xlsx文件`);
      return;
    }
    
    // 验证data字段
    if (!bin.data) {
      console.error(`    ❌ 错误: 没有data字段`);
      return;
    }
    
    // 检查data类型和大小
    let dataToStore = bin.data;
    let dataLength = 0;
    
    if (typeof dataToStore === 'string') {
      dataLength = dataToStore.length;
    } else if (Buffer.isBuffer(dataToStore)) {
      console.log(`    🔄 转换Buffer为base64`);
      dataToStore = dataToStore.toString('base64');
      dataLength = dataToStore.length;
    } else {
      console.error(`    ❌ 错误: data类型不正确 (${typeof dataToStore})`);
      return;
    }
    
    console.log(`    data长度: ${dataLength} 字符`);
    console.log(`    预估文件大小: ${Math.round(dataLength * 0.75)} 字节`);
    
    // 验证数据大小
    if (dataLength < 100) {
      console.error(`    ❌ 错误: data太小 (${dataLength})`);
      console.error(`    data内容: ${String(dataToStore).substring(0, 200)}`);
      return;
    }
    
    // 提取文件名
    let fileName = bin.fileName || json.fileName || `file_${fileData.length + 1}.xlsx`;
    
    // 确保文件名有扩展名
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      fileName = `${fileName}.xlsx`;
    }
    
    // 存储文件数据
    fileData.push({
      data: dataToStore,
      fileName: fileName,
      mimeType: bin.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileExtension: 'xlsx',
      originalKey: binaryKey,
      sourceItemIndex: itemIndex
    });
    
    fileNames.push(fileName);
    
    console.log(`    ✅ 成功添加文件: ${fileName}`);
  });
});

if (fileData.length === 0) {
  console.error(`\n❌ 未找到任何有效的xlsx文件`);
  console.error(`\n📋 调试信息:`);
  inputItems.forEach((item, index) => {
    console.error(`  输入项 [${index + 1}]:`);
    console.error(`    JSON keys: ${Object.keys(item.json || {}).join(', ')}`);
    console.error(`    Binary keys: ${Object.keys(item.binary || {}).join(', ')}`);
  });
  throw new Error("未找到任何有效的xlsx文件");
}

console.log(`\n✅ 共找到 ${fileData.length} 个有效文件:`);
fileNames.forEach((name, index) => {
  console.log(`  ${index + 1}. ${name}`);
});

/* ---------- 计算周期信息 ---------- */
function getYesterdayTodayRange() {
  const today1 = new Date();
  const yesterday = new Date(today1);
  yesterday.setDate(today1.getDate() - 2);
  const today = new Date(today1);
  today.setDate(today1.getDate() - 1);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  return {
    range: `${formatDate(yesterday)}-${formatDate(today)}`,
    yesterday: formatDate(yesterday),
    today: formatDate(today)
  };
}

function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

const { range: yesterdayTodayRange, yesterday, today } = getYesterdayTodayRange();
const lastMonth = getLastMonth();

console.log(`\n📅 周期信息:`);
console.log(`  统计周期: ${yesterdayTodayRange}`);
console.log(`  前日: ${yesterday}`);
console.log(`  昨日: ${today}`);
console.log(`  上月: ${lastMonth}`);

/* ---------- 构建输出 ---------- */
const output = {
  files: fileData.map((file, index) => ({
    fileName: file.fileName,
    fileSize: Math.round(file.data.length * 0.75),
    dataLength: file.data.length,
    mimeType: file.mimeType
  })),
  period: {
    yesterday_today: yesterdayTodayRange,
    yesterday: yesterday,
    today: today,
    last_month: lastMonth
  },
  period_text: {
    yesterday_today: `统计周期：${yesterdayTodayRange}`,
    yesterday: `前日日期：${yesterday}`,
    today: `昨日日期：${today}`,
    last_month: `统计周期：${lastMonth}`
  },
  meta: {
    file_count: fileData.length,
    file_names: fileNames,
    generated_at: new Date().toISOString()
  }
};

// 构建binary对象
const binaryOutput = {};
const attachmentKeys = [];

fileData.forEach((file, index) => {
  const key = `attachment_${index + 1}`;
  attachmentKeys.push(key);
  
  binaryOutput[key] = {
    data: file.data,
    mimeType: file.mimeType,
    fileName: file.fileName,
    fileExtension: 'xlsx'
  };
  
  // 同时添加以文件名为key的版本
  const fileKey = file.fileName
    .replace(/\s+/g, '_')
    .replace(/\.xlsx?$/i, '')
    .toLowerCase();
  binaryOutput[fileKey] = binaryOutput[key];
  
  console.log(`\n📎 Binary [${key}]:`);
  console.log(`  fileName: ${file.fileName}`);
  console.log(`  data length: ${file.data.length}`);
  console.log(`  预估大小: ${Math.round(file.data.length * 0.75)} 字节`);
});

// 如果只有一个文件，添加data字段
if (fileData.length === 1) {
  binaryOutput.data = binaryOutput.attachment_1;
  console.log(`\n📎 添加默认 binary.data 字段`);
}

output.attachment_keys = attachmentKeys;
output.attachment_count = fileData.length;

console.log(`\n✅ 输出构建完成`);
console.log(`  文件数量: ${output.attachment_count}`);
console.log(`  附件keys: ${attachmentKeys.join(', ')}`);

return [{
  json: output,
  binary: binaryOutput
}];
```

### 方案2: 在Merge之前就处理好文件

不要在Merge之后处理文件，而是在每个Convert to XLSX之后立即处理：

```
[查询1] → [Convert to XLSX] → [处理文件1] → \
                                               [Merge JSON] → [邮件]
[查询2] → [Convert to XLSX] → [处理文件2] → /
[查询3] → [Convert to XLSX] → [处理文件3] → /
```

这样每个文件都被单独处理，然后Merge只合并JSON数据（文件名、大小等），binary数据保持独立。

### 方案3: 不使用Merge，使用Loop

```
[查询数组] → [Loop] → [Convert to XLSX] → [处理文件] → [收集结果] → [邮件]
```

这样可以避免Merge节点对binary数据的影响。

## 调试Merge节点

在Merge节点后添加调试节点：

```javascript
const items = $input.all();

console.log('=== Merge节点输出 ===');
console.log(`Items数量: ${items.length}`);

items.forEach((item, index) => {
  console.log(`\nItem [${index + 1}]:`);
  console.log(`  JSON keys: ${Object.keys(item.json || {}).join(', ')}`);
  console.log(`  Binary keys: ${Object.keys(item.binary || {}).join(', ')}`);
  
  const binary = item.binary || {};
  Object.keys(binary).forEach(key => {
    const bin = binary[key];
    if (bin && typeof bin === 'object') {
      console.log(`  Binary.${key}:`);
      console.log(`    fileName: ${bin.fileName || 'N/A'}`);
      console.log(`    has data: ${!!bin.data}`);
      console.log(`    data length: ${bin.data ? bin.data.length : 0}`);
    }
  });
});

return items;
```

## 总结

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 文件只有9字节 | Merge改变了数据结构 | 修改代码处理数组 |
| 找不到binary数据 | Merge合并了多个binary | 遍历所有binary字段 |
| 代码报错 | 检查了错误的属性 | 检查bin.data而不是item.length |

**推荐**: 使用方案1的修复代码，它可以正确处理Merge后的数组数据。
