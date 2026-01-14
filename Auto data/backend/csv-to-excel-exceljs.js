const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// 配置
const inputFile = 'D:\\cursor\\Auto data\\backend\\exports\\query_result_1760522985199.csv';
const outputDir = './downloads/';
const maxRowsPerSheet = 10000; // 每个Excel文件最多1万条

async function csvToExcel() {
  try {
    console.log('开始处理CSV文件...');
    
    // 读取CSV文件
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    const lines = csvContent.split('\n');
    
    if (lines.length === 0) {
      console.log('CSV文件为空');
      return;
    }
    
    // 解析CSV
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });
        rows.push(row);
      }
    }
    
    console.log(`总共读取到 ${rows.length} 条记录`);
    
    // 分页处理
    const totalFiles = Math.ceil(rows.length / maxRowsPerSheet);
    console.log(`将分成 ${totalFiles} 个Excel文件`);
    
    for (let i = 0; i < totalFiles; i++) {
      const startIndex = i * maxRowsPerSheet;
      const endIndex = Math.min(startIndex + maxRowsPerSheet, rows.length);
      const pageRows = rows.slice(startIndex, endIndex);
      
      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('查询结果');
      
      // 添加表头
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: 15
      }));
      
      // 添加数据
      pageRows.forEach(row => {
        worksheet.addRow(row);
      });
      
      // 设置样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // 生成文件名
      const filename = `query_result_page_${i + 1}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const outputPath = path.join(outputDir, filename);
      
      // 写入文件
      await workbook.xlsx.writeFile(outputPath);
      
      console.log(`已生成: ${filename} (${pageRows.length} 条记录)`);
    }
    
    console.log('CSV转Excel完成！');
    
  } catch (error) {
    console.error('处理过程中出错:', error);
  }
}

// 运行
csvToExcel();
