# n8n XLSX导出问题修复指南

## 问题现象
使用n8n的"Convert to XLSX"节点生成的文件无法被Excel正常打开。

## 常见原因和解决方案

### 原因1: 输入数据格式不正确

**问题**: Convert to XLSX节点需要接收**数组格式**的数据，但可能接收到了单个对象或嵌套结构。

**检查方法**:
1. 在Convert to XLSX节点之前添加一个"Code"节点
2. 使用以下代码检查数据结构：
```javascript
// 检查输入数据
console.log('Input items:', $input.all());
console.log('First item:', JSON.stringify($input.first(), null, 2));

// 确保返回数组格式
return $input.all().map(item => {
  // 如果item.json是数组，展开它
  if (Array.isArray(item.json)) {
    return item.json;
  }
  // 如果item.json.data是数组，使用它
  if (item.json.data && Array.isArray(item.json.data)) {
    return item.json.data;
  }
  // 否则返回原始数据
  return [item.json];
}).flat();
```

**解决方案**:
在Convert to XLSX节点之前添加一个"Code"节点，确保数据格式正确：

```javascript
// n8n Code节点 - 数据格式化
const items = $input.all();

// 提取实际的数据数组
let dataArray = [];

for (const item of items) {
  const json = item.json;
  
  // 情况1: json本身就是数组
  if (Array.isArray(json)) {
    dataArray = dataArray.concat(json);
  }
  // 情况2: json.data是数组
  else if (json.data && Array.isArray(json.data)) {
    dataArray = dataArray.concat(json.data);
  }
  // 情况3: json是单个对象
  else if (typeof json === 'object') {
    dataArray.push(json);
  }
}

// 返回格式化后的数据
return dataArray.map(row => ({ json: row }));
```

### 原因2: 文件名包含特殊字符

**问题**: 文件名"查询生成的xlsx"可能导致编码问题。

**解决方案**:
1. 使用英文文件名或拼音：`query_result.xlsx`
2. 或者使用时间戳：`result_${new Date().getTime()}.xlsx`

### 原因3: MIME类型设置不正确

**问题**: n8n可能没有正确设置xlsx文件的MIME类型。

**解决方案**:
在Convert to XLSX节点之后添加"Set"节点，设置正确的MIME类型：

```javascript
// 在Set节点中设置
{
  "binary.data.mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "binary.data.fileName": "result.xlsx"
}
```

### 原因4: 使用了错误的下载方式

**问题**: 直接点击n8n界面的"Download"可能不会正确处理二进制数据。

**解决方案**:
添加"Respond to Webhook"节点或"Write Binary File"节点：

**方案A - 通过Webhook下载**:
```
Webhook Trigger → 你的查询节点 → 格式化数据 → Convert to XLSX → Respond to Webhook
```

在Respond to Webhook节点中设置：
- Respond With: Binary
- Binary Property: data
- Response Headers: 
  ```json
  {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=\"result.xlsx\""
  }
  ```

**方案B - 写入文件**:
使用"Write Binary File"节点将文件保存到服务器，然后通过HTTP访问。

## 推荐的完整工作流

```
1. [查询数据节点]
   ↓
2. [Code节点 - 格式化数据]
   代码：确保输出数组格式
   ↓
3. [Code节点 - 验证数据]
   代码：console.log检查数据结构
   ↓
4. [Convert to XLSX节点]
   - Operation: Convert to XLSX
   - Put Output File in Field: data
   - File Name: result.xlsx
   - Options: 
     * Sheet Name: Sheet1
     * Header Row: true
   ↓
5. [Respond to Webhook] 或 [Write Binary File]
```

## 使用后端API的替代方案（推荐）

如果n8n节点持续有问题，可以使用后端的导出API：

```javascript
// n8n HTTP Request节点
{
  "method": "POST",
  "url": "http://localhost:8000/api/export",
  "headers": {
    "Content-Type": "application/json",
    "x-api-key": "your-api-key"
  },
  "body": {
    "data": {{ $json.data }},  // 你的查询结果
    "format": "excel",
    "options": {
      "filename": "query_result",
      "sheetName": "Results"
    }
  },
  "responseFormat": "file"
}
```

这个方案的优势：
- ✅ 使用经过测试的ExcelJS库
- ✅ 支持大数据量（自动分片）
- ✅ 支持中文文件名
- ✅ 更可靠的错误处理

## 调试步骤

1. **检查输入数据**:
   ```javascript
   // 在Convert to XLSX之前添加Code节点
   console.log('Data type:', typeof $json);
   console.log('Is array:', Array.isArray($json));
   console.log('Data sample:', JSON.stringify($json).substring(0, 200));
   return $input.all();
   ```

2. **检查输出数据**:
   ```javascript
   // 在Convert to XLSX之后添加Code节点
   console.log('Binary data exists:', !!$binary.data);
   console.log('Binary data type:', typeof $binary.data);
   console.log('MIME type:', $binary.data?.mimeType);
   return $input.all();
   ```

3. **测试文件内容**:
   - 使用"Write Binary File"节点保存文件到本地
   - 用文本编辑器打开，检查文件头是否为`PK`（zip格式）
   - 如果文件头不是`PK`，说明生成的不是有效的xlsx文件

## 需要更多帮助？

如果以上方案都不能解决问题，请提供：
1. 完整的n8n工作流JSON配置
2. 输入数据的完整样本
3. 错误信息的截图
4. 下载的文件用十六进制编辑器查看的前几个字节

我可以帮你创建一个自定义的Code节点来生成xlsx文件。
