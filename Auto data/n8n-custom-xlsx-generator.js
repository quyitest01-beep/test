/**
 * n8n自定义Code节点 - 生成XLSX文件
 * 
 * 使用方法：
 * 1. 在n8n中添加一个"Code"节点
 * 2. 将此代码复制到Code节点中
 * 3. 确保输入数据是数组格式
 * 4. 输出会包含二进制的xlsx文件
 * 
 * 输入格式：
 * [
 *   { "列1": "值1", "列2": "值2" },
 *   { "列1": "值3", "列2": "值4" }
 * ]
 */

// 导入ExcelJS库（n8n内置）
const ExcelJS = require('exceljs');

// 获取输入数据
const items = $input.all();
let dataArray = [];

// 提取数据数组
for (const item of items) {
  const json = item.json;
  
  if (Array.isArray(json)) {
    dataArray = dataArray.concat(json);
  } else if (json.data && Array.isArray(json.data)) {
    dataArray = dataArray.concat(json.data);
  } else if (typeof json === 'object' && json !== null) {
    dataArray.push(json);
  }
}

// 验证数据
if (dataArray.length === 0) {
  throw new Error('没有数据可以导出');
}

console.log(`准备导出 ${dataArray.length} 行数据`);

// 创建工作簿
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('查询结果');

// 获取列名（从第一行数据）
const headers = Object.keys(dataArray[0]);
console.log('列名:', headers);

// 添加表头
worksheet.addRow(headers);

// 设置表头样式
const headerRow = worksheet.getRow(1);
headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
headerRow.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' }
};
headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

// 添加数据行
dataArray.forEach((row, index) => {
  const values = headers.map(header => {
    const value = row[header];
    // 处理null和undefined
    if (value === null || value === undefined) {
      return '';
    }
    // 处理日期
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    // 处理对象和数组
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  });
  
  const dataRow = worksheet.addRow(values);
  
  // 交替行颜色
  if (index % 2 === 1) {
    dataRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' }
    };
  }
});

// 自动调整列宽
worksheet.columns.forEach((column, index) => {
  let maxLength = headers[index]?.length || 10;
  
  // 检查数据中的最大长度
  dataArray.forEach(row => {
    const value = row[headers[index]];
    if (value) {
      const length = String(value).length;
      if (length > maxLength) {
        maxLength = length;
      }
    }
  });
  
  // 设置列宽（最小10，最大50）
  column.width = Math.min(Math.max(maxLength + 2, 10), 50);
});

// 添加筛选器
worksheet.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: headers.length }
};

// 冻结首行
worksheet.views = [
  { state: 'frozen', xSplit: 0, ySplit: 1 }
];

// 生成xlsx文件
const buffer = await workbook.xlsx.writeBuffer();

// 生成文件名（使用时间戳）
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const filename = `查询结果_${timestamp}.xlsx`;

console.log(`文件生成成功: ${filename}, 大小: ${buffer.length} bytes`);

// 返回二进制数据
return [
  {
    json: {
      success: true,
      filename: filename,
      rows: dataArray.length,
      columns: headers.length,
      size: buffer.length
    },
    binary: {
      data: {
        data: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: filename,
        fileExtension: 'xlsx'
      }
    }
  }
];
