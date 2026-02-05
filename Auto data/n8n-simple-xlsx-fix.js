/**
 * n8n简化版XLSX生成器
 * 
 * 这个版本专门用于修复"Convert to XLSX"节点的问题
 * 
 * 使用步骤：
 * 1. 删除或禁用原来的"Convert to XLSX"节点
 * 2. 添加一个新的"Code"节点
 * 3. 将下面的代码复制进去
 * 4. 在Code节点后面添加"Respond to Webhook"节点来下载文件
 */

// ============ 第一步：数据提取和验证 ============

const items = $input.all();
console.log('收到的items数量:', items.length);

// 提取数据
let data = [];

// 尝试多种数据格式
for (const item of items) {
  const json = item.json;
  
  // 格式1: 直接是数组
  if (Array.isArray(json)) {
    console.log('检测到数组格式，长度:', json.length);
    data = json;
    break;
  }
  
  // 格式2: json.data是数组
  if (json.data && Array.isArray(json.data)) {
    console.log('检测到json.data数组格式，长度:', json.data.length);
    data = json.data;
    break;
  }
  
  // 格式3: 单个对象
  if (typeof json === 'object' && json !== null) {
    console.log('检测到单个对象格式');
    data.push(json);
  }
}

// 验证数据
if (!data || data.length === 0) {
  throw new Error('没有找到可导出的数据。请检查输入数据格式。');
}

console.log('准备导出数据行数:', data.length);
console.log('第一行数据示例:', JSON.stringify(data[0]).substring(0, 100));

// ============ 第二步：使用ExcelJS生成文件 ============

const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Sheet1');

// 获取列名
const columns = Object.keys(data[0]);
console.log('列名:', columns.join(', '));

// 添加表头
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
  const values = columns.map(col => {
    const value = row[col];
    // 处理null/undefined
    if (value == null) return '';
    // 处理对象/数组
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  });
  worksheet.addRow(values);
});

// 自动调整列宽
worksheet.columns.forEach((column, i) => {
  const header = columns[i];
  let maxLen = header.length;
  
  data.forEach(row => {
    const val = String(row[header] || '');
    if (val.length > maxLen) maxLen = val.length;
  });
  
  column.width = Math.min(Math.max(maxLen + 2, 10), 50);
});

// ============ 第三步：生成二进制数据 ============

const buffer = await workbook.xlsx.writeBuffer();
const base64Data = buffer.toString('base64');

// 生成文件名
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
const filename = `query_result_${dateStr}_${timeStr}.xlsx`;

console.log('✅ 文件生成成功!');
console.log('文件名:', filename);
console.log('文件大小:', buffer.length, 'bytes');
console.log('数据行数:', data.length);

// ============ 第四步：返回结果 ============

return [{
  json: {
    success: true,
    filename: filename,
    rows: data.length,
    columns: columns.length,
    fileSize: buffer.length
  },
  binary: {
    data: {
      data: base64Data,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: filename,
      fileExtension: 'xlsx'
    }
  }
}];

/**
 * 使用说明：
 * 
 * 1. 将此代码复制到n8n的Code节点中
 * 
 * 2. 在Code节点后添加"Respond to Webhook"节点：
 *    - Respond With: Binary
 *    - Binary Property: data
 *    - Response Code: 200
 *    - Response Headers:
 *      {
 *        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 *        "Content-Disposition": "attachment; filename=\"{{ $json.filename }}\""
 *      }
 * 
 * 3. 或者使用"Write Binary File"节点保存到服务器：
 *    - File Name: {{ $json.filename }}
 *    - Binary Property: data
 *    - Destination Path: /path/to/save/
 * 
 * 4. 测试工作流，下载文件并用Excel打开验证
 */
