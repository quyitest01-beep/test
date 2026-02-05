const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * 导出服务类
 * 处理查询结果的各种导出格式
 */
class ExportService {
  constructor() {
    this.maxRowsPerSheet = 1048576; // Excel最大行数
    this.maxRowsPerFile = 1000000; // 单文件建议最大行数
    this.exportDir = path.join(__dirname, '../exports');
    this.ensureExportDir();
  }

  /**
   * 确保导出目录存在
   */
  async ensureExportDir() {
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  /**
   * 导出数据到Excel
   * @param {Array} data - 查询结果数据
   * @param {Object} options - 导出选项
   * @returns {Object} 导出结果信息
   */
  async exportToExcel(data, options = {}) {
    const requestId = options.requestId || `export_${Date.now()}`;
    logger.logQuery(requestId, 'Starting Excel export', { 
      dataLength: data.length,
      options 
    });

    try {
      const {
        filename = `query_result_${Date.now()}`,
        sheetName = 'Query Results',
        strategy = 'auto', // auto, single, multi-sheet, multi-file
        maxRowsPerSheet = this.maxRowsPerSheet,
        maxRowsPerFile = this.maxRowsPerFile,
        includeMetadata = true
      } = options;

      // 分析数据规模并选择导出策略
      const exportStrategy = this.determineExportStrategy(data.length, strategy);
      
      let result;
      switch (exportStrategy) {
        case 'single':
          result = await this.exportSingleFile(data, { filename, sheetName, includeMetadata, requestId });
          break;
        case 'multi-sheet':
          result = await this.exportMultiSheet(data, { filename, sheetName, maxRowsPerSheet, includeMetadata, requestId });
          break;
        case 'multi-file':
          result = await this.exportMultiFile(data, { filename, sheetName, maxRowsPerFile, includeMetadata, requestId });
          break;
        default:
          throw new Error(`Unknown export strategy: ${exportStrategy}`);
      }

      logger.logQuery(requestId, 'Excel export completed', result);
      return result;

    } catch (error) {
      logger.error('Excel export failed', { requestId, error: error.message });
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * 确定导出策略
   * @param {number} dataLength - 数据行数
   * @param {string} userStrategy - 用户指定策略
   * @returns {string} 最终策略
   */
  determineExportStrategy(dataLength, userStrategy) {
    if (userStrategy !== 'auto') {
      return userStrategy;
    }

    if (dataLength <= 100000) {
      return 'single';
    } else if (dataLength <= 1000000) {
      return 'multi-sheet';
    } else {
      return 'multi-file';
    }
  }

  /**
   * 单文件导出
   */
  async exportSingleFile(data, options) {
    const { filename, sheetName, includeMetadata, requestId } = options;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // 添加数据
    if (data.length > 0) {
      // 设置表头
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);
      
      // 设置表头样式
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // 添加数据行
      data.forEach(row => {
        const values = headers.map(header => row[header]);
        worksheet.addRow(values);
      });

      // 自动调整列宽
      worksheet.columns.forEach(column => {
        column.width = Math.min(Math.max(column.header?.length || 10, 10), 50);
      });
    }

    // 添加元数据工作表
    if (includeMetadata) {
      this.addMetadataSheet(workbook, {
        totalRows: data.length,
        exportTime: new Date().toISOString(),
        requestId,
        strategy: 'single'
      });
    }

    // 保存文件
    const filepath = path.join(this.exportDir, `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filepath);

    return {
      success: true,
      strategy: 'single',
      files: [{
        filename: `${filename}.xlsx`,
        path: filepath,
        size: (await fs.stat(filepath)).size,
        rows: data.length
      }],
      totalRows: data.length,
      totalFiles: 1
    };
  }

  /**
   * 多工作表导出
   */
  async exportMultiSheet(data, options) {
    const { filename, sheetName, maxRowsPerSheet, includeMetadata, requestId } = options;
    
    const workbook = new ExcelJS.Workbook();
    const totalSheets = Math.ceil(data.length / maxRowsPerSheet);

    for (let i = 0; i < totalSheets; i++) {
      const startIndex = i * maxRowsPerSheet;
      const endIndex = Math.min(startIndex + maxRowsPerSheet, data.length);
      const sheetData = data.slice(startIndex, endIndex);
      
      const worksheet = workbook.addWorksheet(`${sheetName}_${i + 1}`);
      
      if (sheetData.length > 0) {
        // 设置表头
        const headers = Object.keys(sheetData[0]);
        worksheet.addRow(headers);
        
        // 设置表头样式
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        // 添加数据行
        sheetData.forEach(row => {
          const values = headers.map(header => row[header]);
          worksheet.addRow(values);
        });

        // 自动调整列宽
        worksheet.columns.forEach(column => {
          column.width = Math.min(Math.max(column.header?.length || 10, 10), 50);
        });
      }
    }

    // 添加元数据工作表
    if (includeMetadata) {
      this.addMetadataSheet(workbook, {
        totalRows: data.length,
        totalSheets,
        exportTime: new Date().toISOString(),
        requestId,
        strategy: 'multi-sheet'
      });
    }

    // 保存文件
    const filepath = path.join(this.exportDir, `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filepath);

    return {
      success: true,
      strategy: 'multi-sheet',
      files: [{
        filename: `${filename}.xlsx`,
        path: filepath,
        size: (await fs.stat(filepath)).size,
        rows: data.length,
        sheets: totalSheets
      }],
      totalRows: data.length,
      totalFiles: 1,
      totalSheets
    };
  }

  /**
   * 多文件导出
   */
  async exportMultiFile(data, options) {
    const { filename, sheetName, maxRowsPerFile, includeMetadata, requestId } = options;
    
    const totalFiles = Math.ceil(data.length / maxRowsPerFile);
    const files = [];

    for (let i = 0; i < totalFiles; i++) {
      const startIndex = i * maxRowsPerFile;
      const endIndex = Math.min(startIndex + maxRowsPerFile, data.length);
      const fileData = data.slice(startIndex, endIndex);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);
      
      if (fileData.length > 0) {
        // 设置表头
        const headers = Object.keys(fileData[0]);
        worksheet.addRow(headers);
        
        // 设置表头样式
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        // 添加数据行
        fileData.forEach(row => {
          const values = headers.map(header => row[header]);
          worksheet.addRow(values);
        });

        // 自动调整列宽
        worksheet.columns.forEach(column => {
          column.width = Math.min(Math.max(column.header?.length || 10, 10), 50);
        });
      }

      // 添加元数据工作表
      if (includeMetadata) {
        this.addMetadataSheet(workbook, {
          totalRows: fileData.length,
          fileIndex: i + 1,
          totalFiles,
          exportTime: new Date().toISOString(),
          requestId,
          strategy: 'multi-file'
        });
      }

      // 保存文件
      const currentFilename = `${filename}_part${i + 1}.xlsx`;
      const filepath = path.join(this.exportDir, currentFilename);
      await workbook.xlsx.writeFile(filepath);

      files.push({
        filename: currentFilename,
        path: filepath,
        size: (await fs.stat(filepath)).size,
        rows: fileData.length,
        partIndex: i + 1
      });
    }

    return {
      success: true,
      strategy: 'multi-file',
      files,
      totalRows: data.length,
      totalFiles
    };
  }

  /**
   * 添加元数据工作表
   */
  addMetadataSheet(workbook, metadata) {
    const metaSheet = workbook.addWorksheet('Export Metadata');
    
    // 添加元数据信息
    const metaData = [
      ['Export Time', metadata.exportTime],
      ['Request ID', metadata.requestId],
      ['Export Strategy', metadata.strategy],
      ['Total Rows', metadata.totalRows],
      ['Total Files', metadata.totalFiles || 1],
      ['Total Sheets', metadata.totalSheets || 1],
      ['File Index', metadata.fileIndex || 1]
    ];

    metaData.forEach(([key, value]) => {
      metaSheet.addRow([key, value]);
    });

    // 设置样式
    metaSheet.getColumn(1).width = 20;
    metaSheet.getColumn(2).width = 30;
    metaSheet.getColumn(1).font = { bold: true };
  }

  /**
   * 导出为CSV格式
   */
  async exportToCSV(data, options = {}) {
    const requestId = options.requestId || `export_${Date.now()}`;
    const filename = options.filename || `query_result_${Date.now()}`;
    
    try {
      if (data.length === 0) {
        throw new Error('No data to export');
      }

      const headers = Object.keys(data[0]);
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // 处理包含逗号或引号的值
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(',') + '\n';
      });

      const filepath = path.join(this.exportDir, `${filename}.csv`);
      await fs.writeFile(filepath, csvContent, 'utf8');

      return {
        success: true,
        format: 'csv',
        files: [{
          filename: `${filename}.csv`,
          path: filepath,
          size: (await fs.stat(filepath)).size,
          rows: data.length
        }],
        totalRows: data.length
      };

    } catch (error) {
      logger.error('CSV export failed', { requestId, error: error.message });
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * 获取导出文件信息
   */
  async getExportFiles() {
    try {
      const files = await fs.readdir(this.exportDir);
      const fileInfos = [];

      for (const file of files) {
        const filepath = path.join(this.exportDir, file);
        const stats = await fs.stat(filepath);
        
        fileInfos.push({
          filename: file,
          path: filepath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }

      return fileInfos.sort((a, b) => b.created - a.created);
    } catch (error) {
      logger.error('Failed to get export files', { error: error.message });
      throw new Error(`Failed to get export files: ${error.message}`);
    }
  }

  /**
   * 清理过期的导出文件
   */
  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.exportDir, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.birthtime.getTime() > maxAge) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} old export files`);
      return { deletedCount };
    } catch (error) {
      logger.error('Failed to cleanup old files', { error: error.message });
      throw new Error(`Failed to cleanup old files: ${error.message}`);
    }
  }
}

module.exports = new ExportService();