// n8n Code节点：Excel多工作表数据提取器
// 从Excel文件中提取所有工作表的数据
// 每个工作表作为一个独立的数据项输出，包含工作表名称和所有行数据

// ⚠️ 重要提示：n8n的Code节点不支持require外部模块！
// 如果你遇到 "Cannot find module 'xlsx'" 错误，请使用以下替代方案：
//
// 替代方案1：使用n8n内置的"Extract From XLSX"节点配合循环
//   1. 使用"Extract From XLSX"节点，Operation选择"List Sheets"获取所有工作表名称
//   2. 使用"Loop Over Items"节点循环每个工作表
//   3. 在循环内使用"Extract From XLSX"节点提取每个工作表数据
//
// 替代方案2：手动指定工作表名称（如果你知道工作表名称）
//   创建多个"Extract From XLSX"节点，每个节点指定不同的Sheet Name
//
// 替代方案3：使用外部API服务（见excel-multi-sheet-n8n-workflow-guide.md）
//
// 如果你使用的是自托管n8n，可以在服务器上安装xlsx模块：
//   cd /path/to/n8n
//   npm install xlsx
//
// 但n8n Cloud或某些版本可能不支持此方法。

// 尝试使用xlsx库（如果环境支持）
let XLSX;
try {
  XLSX = require('xlsx');
} catch (error) {
  throw new Error(
    '❌ 无法加载xlsx模块。n8n的Code节点不支持外部模块。\n' +
    '请使用替代方案：\n' +
    '1. 使用n8n内置的"Extract From XLSX"节点配合循环\n' +
    '2. 创建多个"Extract From XLSX"节点手动指定工作表\n' +
    '3. 使用外部API服务处理Excel文件\n' +
    '详细说明请参考：excel-multi-sheet-n8n-workflow-guide.md'
  );
}

// 获取上游输入数据
const items = $input.all();

if (items.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const results = [];

for (const item of items) {
  try {
    // 获取Excel文件的二进制数据
    // 支持从binary data字段或json.data字段获取
    let binaryData = null;
    let fileName = null;
    
    // 方式1: 从binary data字段获取（n8n默认格式）
    if (item.binary && item.binary.data) {
      binaryData = Buffer.from(item.binary.data.data, 'base64');
      fileName = item.binary.data.fileName || 'excel_file.xlsx';
    }
    // 方式2: 从json.data字段获取（如果上游节点已经处理过）
    else if (item.json && item.json.data) {
      // 检查data是否是base64字符串
      if (typeof item.json.data === 'string') {
        binaryData = Buffer.from(item.json.data, 'base64');
      } else if (Buffer.isBuffer(item.json.data)) {
        binaryData = item.json.data;
      }
      fileName = item.json.fileName || 'excel_file.xlsx';
    }
    else {
      console.warn("⚠️ 无法从输入数据中提取Excel二进制数据，跳过此项");
      console.log("可用的字段:", Object.keys(item));
      continue;
    }
    
    if (!binaryData) {
      console.warn("⚠️ 无法获取二进制数据，跳过此项");
      continue;
    }
    
    // 读取Excel文件
    const workbook = XLSX.read(binaryData, { type: 'buffer' });
    
    // 获取所有工作表名称
    const sheetNames = workbook.SheetNames;
    console.log(`📊 Excel文件包含 ${sheetNames.length} 个工作表: ${sheetNames.join(', ')}`);
    
    // 遍历每个工作表
    for (const sheet of sheetNames) {
      try {
        // 读取工作表数据
        const worksheet = workbook.Sheets[sheet];
        
        // 将工作表转换为JSON数组（第一行为表头）
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // 将公式结果转换为值
          defval: '', // 空单元格的默认值
          dateNF: 'yyyy-mm-dd' // 日期格式
        });
        
        console.log(`✅ 工作表 "${sheet}": 提取到 ${jsonData.length} 行数据`);
        
        // 为每个工作表创建一个输出项
        results.push({
          json: {
            sheetName: sheet, // 工作表名称
            sheetIndex: sheetNames.indexOf(sheet), // 工作表索引（从0开始）
            totalSheets: sheetNames.length, // 总工作表数
            rowCount: jsonData.length, // 行数
            data: jsonData, // 工作表的所有数据（数组格式）
            fileName: fileName, // 原始文件名
            // 保留原始输入的其他字段（如果有）
            ...(item.json || {}),
            // 如果原始数据有subject等字段，也保留
            subject: item.json?.subject || item.subject || null
          }
        });
      } catch (sheetError) {
        console.error(`❌ 处理工作表 "${sheet}" 时出错:`, sheetError.message);
        // 即使某个工作表出错，也继续处理其他工作表
      }
    }
  } catch (error) {
    console.error(`❌ 处理Excel文件时出错:`, error.message);
    console.error(error.stack);
    // 如果出错，至少返回一个错误信息项
    results.push({
      json: {
        error: true,
        errorMessage: error.message,
        originalData: item.json || {}
      }
    });
  }
}

console.log(`✅ 总共提取了 ${results.length} 个工作表的数据`);

return results;

