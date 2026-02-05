# n8n工作流错误诊断和修复指南

## 错误现象

从截图中看到两个错误提示：
1. ❌ **Problems executing workflow** - 工作流执行问题
2. ❌ **Problems running workflow** - 工作流运行问题

## 常见原因分析

### 原因1：节点之间的数据格式不匹配

**问题描述**：
- 上游节点输出的数据格式与下游节点期望的格式不一致
- 例如：Convert to XLSX节点期望数组，但收到了对象

**诊断方法**：
1. 点击每个节点查看输出数据
2. 检查数据结构是否符合下一个节点的要求

**解决方案**：
在问题节点之前添加"Code"节点进行数据转换：

```javascript
// 数据格式化节点
const items = $input.all();
let formattedData = [];

for (const item of items) {
  const json = item.json;
  
  // 情况1: json是数组
  if (Array.isArray(json)) {
    formattedData = formattedData.concat(json);
  }
  // 情况2: json.data是数组
  else if (json.data && Array.isArray(json.data)) {
    formattedData = formattedData.concat(json.data);
  }
  // 情况3: json是单个对象
  else if (typeof json === 'object' && json !== null) {
    formattedData.push(json);
  }
}

// 返回标准格式
return formattedData.map(row => ({ json: row }));
```

### 原因2：API端点配置错误

**问题描述**：
- HTTP Request节点的URL不正确
- API Key缺失或错误
- 请求方法不正确

**诊断方法**：
检查HTTP Request节点的配置：
```
✓ URL: http://localhost:8000/api/export/data
✓ Method: POST
✓ Headers: x-api-key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d
✓ Content-Type: application/json
```

**解决方案**：

#### 正确的HTTP Request配置

```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/export/data",
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": {
    "data": "={{ $json.data || [$json] }}",
    "format": "excel",
    "options": {
      "filename": "query_result",
      "sheetName": "查询结果",
      "includeMetadata": true
    }
  },
  "options": {}
}
```

### 原因3：后端服务未运行或端口错误

**问题描述**：
- 后端服务器没有启动
- 端口号不正确（应该是8000）
- 防火墙阻止连接

**诊断方法**：
```bash
# 检查后端服务是否运行
curl http://localhost:8000/api/health

# 或者在浏览器中访问
http://localhost:8000/api/health
```

**解决方案**：
```bash
# 启动后端服务
cd backend
node server.js

# 或使用启动脚本
start-server.bat
```

### 原因4：Convert to XLSX节点的已知问题

**问题描述**：
- n8n的Convert to XLSX节点在某些版本中有bug
- 无法正确处理某些数据格式
- 生成的文件格式不正确

**解决方案A - 使用自定义Code节点**：

替换Convert to XLSX节点，使用以下代码：

```javascript
// 完整的XLSX生成代码
const ExcelJS = require('exceljs');

// 获取输入数据
const items = $input.all();
let data = [];

// 提取数据
for (const item of items) {
  const json = item.json;
  if (Array.isArray(json)) {
    data = json;
    break;
  } else if (json.data && Array.isArray(json.data)) {
    data = json.data;
    break;
  } else if (typeof json === 'object' && json !== null) {
    data.push(json);
  }
}

if (data.length === 0) {
  throw new Error('没有数据可以导出');
}

// 创建工作簿
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Sheet1');

// 添加表头
const columns = Object.keys(data[0]);
worksheet.addRow(columns);

// 设置表头样式
const headerRow = worksheet.getRow(1);
headerRow.font = { bold: true };
headerRow.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD3D3D3' }
};

// 添加数据
data.forEach(row => {
  const values = columns.map(col => row[col] == null ? '' : row[col]);
  worksheet.addRow(values);
});

// 自动调整列宽
worksheet.columns.forEach((column, i) => {
  let maxLen = columns[i].length;
  data.forEach(row => {
    const val = String(row[columns[i]] || '');
    if (val.length > maxLen) maxLen = val.length;
  });
  column.width = Math.min(Math.max(maxLen + 2, 10), 50);
});

// 生成文件
const buffer = await workbook.xlsx.writeBuffer();
const filename = `result_${new Date().toISOString().split('T')[0]}.xlsx`;

return [{
  json: {
    success: true,
    filename: filename,
    rows: data.length
  },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: filename,
      fileExtension: 'xlsx'
    }
  }
}];
```

**解决方案B - 使用后端API（推荐）**：

完全跳过Convert to XLSX节点，直接调用后端API：

```
[查询节点] → [HTTP Request: /api/export/data] → [Respond to Webhook]
```

### 原因5：Merge节点配置问题

**问题描述**：
- 从截图看到有多个Merge节点
- Merge节点的模式设置不正确
- 输入数据不匹配

**诊断方法**：
检查Merge节点的配置：
- Mode: 应该选择正确的合并模式（Append, Merge by Key等）
- 确保两个输入都有数据

**解决方案**：

#### Merge节点配置建议

```json
{
  "mode": "append",  // 或 "mergeByKey" 根据需求
  "options": {}
}
```

如果要合并查询结果，使用"append"模式：
```javascript
// 在Merge之前的Code节点中预处理
const input1 = $input.first();
const input2 = $input.last();

// 确保两个输入都是数组
let data1 = Array.isArray(input1.json) ? input1.json : [input1.json];
let data2 = Array.isArray(input2.json) ? input2.json : [input2.json];

// 合并数据
const merged = [...data1, ...data2];

return [{ json: merged }];
```

## 完整的调试流程

### 步骤1：检查每个节点的输出

1. 点击工作流中的第一个节点
2. 查看"Output"标签页
3. 确认数据格式正确
4. 逐个检查后续节点

### 步骤2：添加调试节点

在问题节点之前添加Code节点进行调试：

```javascript
// 调试节点
const items = $input.all();

console.log('=== 调试信息 ===');
console.log('Items数量:', items.length);
console.log('第一个item:', JSON.stringify(items[0], null, 2));

if (items[0].json) {
  console.log('JSON类型:', typeof items[0].json);
  console.log('是否为数组:', Array.isArray(items[0].json));
  if (Array.isArray(items[0].json)) {
    console.log('数组长度:', items[0].json.length);
    console.log('第一个元素:', JSON.stringify(items[0].json[0], null, 2));
  }
}

// 原样返回数据
return items;
```

### 步骤3：简化工作流测试

创建一个最简单的测试工作流：

```
[Manual Trigger] → [Code: 生成测试数据] → [HTTP Request: 导出API] → [Respond to Webhook]
```

#### Code节点 - 生成测试数据

```javascript
// 生成简单的测试数据
const testData = [
  { "姓名": "张三", "年龄": 25, "城市": "北京" },
  { "姓名": "李四", "年龄": 30, "城市": "上海" },
  { "姓名": "王五", "年龄": 28, "城市": "广州" }
];

return [{ json: { data: testData } }];
```

#### HTTP Request节点配置

```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/export/data",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": {
    "data": "={{ $json.data }}",
    "format": "excel",
    "options": {
      "filename": "test_export",
      "sheetName": "测试数据"
    }
  }
}
```

### 步骤4：检查后端日志

查看后端服务器的日志输出：

```bash
# 查看实时日志
tail -f backend/logs/app.log

# 或者查看控制台输出
# 后端服务器应该在运行start-server.bat的窗口中显示日志
```

## 快速修复方案

### 方案1：使用简化的工作流

```
[Webhook Trigger]
  ↓
[Code: 提取和格式化数据]
  ↓
[HTTP Request: POST /api/export/data]
  ↓
[Code: 处理响应]
  ↓
[HTTP Request: GET 下载文件]
  ↓
[Respond to Webhook: 返回文件]
```

### 方案2：完全使用后端API

删除所有Convert to XLSX节点，改用：

```javascript
// 单个Code节点完成所有操作
const axios = require('axios');

// 1. 获取数据
const data = $json.data || [$json];

// 2. 调用导出API
const exportResponse = await axios.post('http://localhost:8000/api/export/data', {
  data: data,
  format: 'excel',
  options: {
    filename: `export_${Date.now()}`,
    sheetName: '查询结果'
  }
}, {
  headers: {
    'x-api-key': 'f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d',
    'Content-Type': 'application/json'
  }
});

// 3. 获取下载URL
const downloadUrl = exportResponse.data.data.downloadUrls[0].url;

// 4. 下载文件
const fileResponse = await axios.get(`http://localhost:8000${downloadUrl}`, {
  responseType: 'arraybuffer',
  headers: {
    'x-api-key': 'f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'
  }
});

// 5. 返回文件
return [{
  json: {
    success: true,
    filename: exportResponse.data.data.downloadUrls[0].filename
  },
  binary: {
    data: {
      data: Buffer.from(fileResponse.data).toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: exportResponse.data.data.downloadUrls[0].filename
    }
  }
}];
```

## 需要更多帮助？

如果以上方案都无法解决问题，请提供：

1. **完整的错误信息**：
   - 点击错误节点
   - 查看"Error"标签页
   - 复制完整的错误堆栈

2. **工作流JSON**：
   - 点击右上角的"..."菜单
   - 选择"Download"
   - 分享工作流JSON文件

3. **节点输出数据**：
   - 每个节点的输入和输出数据示例

4. **后端日志**：
   - backend/logs/app.log的最后100行
   - 或控制台的错误输出

我可以帮你进一步诊断和修复问题。
