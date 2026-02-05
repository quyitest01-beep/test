const logger = require('../utils/logger')
const ExcelJS = require('exceljs')
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')

class ResultProcessor {
  constructor() {
    this.maxRowsPerFile = 1000000 // Excel最大行数限制
    this.maxRowsPerSheet = 100000 // 每个工作表最大行数
    this.exportDir = path.join(__dirname, '../exports')
    this.tempDir = path.join(__dirname, '../temp')
    
    // 确保目录存在
    this.ensureDirectories()
  }

  /**
   * 确保必要目录存在
   */
  async ensureDirectories() {
    try {
      await fs.access(this.exportDir)
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true })
    }
    
    try {
      await fs.access(this.tempDir)
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true })
    }
  }

  /**
   * 处理查询结果
   */
  async processQueryResult(result, options = {}) {
    const {
      format = 'json',
      splitThreshold = 100000,
      enableSplit = true,
      includeMetadata = true,
      sanitizeData = true
    } = options

    try {
      logger.info('开始处理查询结果', { 
        rowCount: result.row_count,
        format,
        enableSplit
      })

      // 1. 数据清理和格式化
      let processedData = result.data
      if (sanitizeData) {
        processedData = this.sanitizeData(processedData)
      }

      // 2. 格式化数据类型
      processedData = this.formatDataTypes(processedData, result.columns)

      // 3. 检查是否需要拆分
      const needsSplit = enableSplit && result.row_count > splitThreshold
      
      let processedResult = {
        ...result,
        data: processedData,
        processed_at: new Date().toISOString(),
        processing_info: {
          sanitized: sanitizeData,
          formatted: true,
          split_required: needsSplit,
          split_threshold: splitThreshold
        }
      }

      // 4. 如果需要拆分，执行拆分处理
      if (needsSplit) {
        processedResult = await this.splitLargeResult(processedResult, {
          threshold: splitThreshold,
          format
        })
      }

      // 5. 添加元数据
      if (includeMetadata) {
        processedResult.metadata = this.generateMetadata(processedResult)
      }

      logger.info('查询结果处理完成', { 
        originalRows: result.row_count,
        processedRows: processedResult.row_count,
        split: needsSplit,
        parts: processedResult.parts?.length || 1
      })

      return processedResult

    } catch (error) {
      logger.error('查询结果处理失败', { error: error.message })
      throw new Error(`结果处理失败: ${error.message}`)
    }
  }

  /**
   * 数据清理
   */
  sanitizeData(data) {
    if (!Array.isArray(data)) {
      return data
    }

    return data.map(row => {
      if (typeof row !== 'object' || row === null) {
        return row
      }

      const sanitizedRow = {}
      for (const [key, value] of Object.entries(row)) {
        // 清理键名
        const cleanKey = key.replace(/[^\w\u4e00-\u9fa5]/g, '_')
        
        // 清理值
        let cleanValue = value
        if (typeof value === 'string') {
          // 移除控制字符
          cleanValue = value.replace(/[\x00-\x1F\x7F]/g, '')
          // 处理过长的字符串
          if (cleanValue.length > 32767) { // Excel单元格限制
            cleanValue = cleanValue.substring(0, 32767) + '...'
          }
        } else if (value === null || value === undefined) {
          cleanValue = ''
        }
        
        sanitizedRow[cleanKey] = cleanValue
      }
      
      return sanitizedRow
    })
  }

  /**
   * 格式化数据类型
   */
  formatDataTypes(data, columns = []) {
    if (!Array.isArray(data) || data.length === 0) {
      return data
    }

    // 创建列类型映射
    const columnTypes = {}
    columns.forEach(col => {
      columnTypes[col.name] = col.type
    })

    return data.map(row => {
      const formattedRow = {}
      
      for (const [key, value] of Object.entries(row)) {
        const columnType = columnTypes[key]
        formattedRow[key] = this.formatValue(value, columnType)
      }
      
      return formattedRow
    })
  }

  /**
   * 格式化单个值
   */
  formatValue(value, type) {
    if (value === null || value === undefined) {
      return ''
    }

    switch (type) {
      case 'decimal':
      case 'float':
        if (typeof value === 'number') {
          return Math.round(value * 100) / 100 // 保留2位小数
        }
        return value
        
      case 'integer':
        if (typeof value === 'number') {
          return Math.round(value)
        }
        return value
        
      case 'date':
      case 'datetime':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0]
        }
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          return value.split('T')[0]
        }
        return value
        
      case 'boolean':
        if (typeof value === 'boolean') {
          return value ? '是' : '否'
        }
        return value
        
      default:
        return value
    }
  }

  /**
   * 拆分大结果集
   */
  async splitLargeResult(result, options = {}) {
    const {
      threshold = 100000,
      format = 'json'
    } = options

    const { data, row_count } = result
    const totalParts = Math.ceil(row_count / threshold)
    
    logger.info('开始拆分大结果集', { 
      totalRows: row_count,
      threshold,
      totalParts
    })

    const parts = []
    
    for (let i = 0; i < totalParts; i++) {
      const startIndex = i * threshold
      const endIndex = Math.min(startIndex + threshold, row_count)
      const partData = data.slice(startIndex, endIndex)
      
      const part = {
        part_number: i + 1,
        total_parts: totalParts,
        start_row: startIndex + 1,
        end_row: endIndex,
        row_count: partData.length,
        data: partData,
        created_at: new Date().toISOString()
      }
      
      // 如果是导出格式，生成文件
      if (format !== 'json') {
        part.file_info = await this.generatePartFile(part, format, result.columns)
      }
      
      parts.push(part)
    }

    return {
      ...result,
      data: [], // 清空原始数据以节省内存
      is_split: true,
      parts,
      split_info: {
        total_parts: totalParts,
        threshold,
        split_at: new Date().toISOString(),
        total_rows: row_count
      }
    }
  }

  /**
   * 生成分片文件
   */
  async generatePartFile(part, format, columns = []) {
    const fileId = crypto.randomBytes(8).toString('hex')
    const fileName = `part_${part.part_number}_of_${part.total_parts}_${fileId}.${format}`
    const filePath = path.join(this.exportDir, fileName)
    
    try {
      switch (format) {
        case 'xlsx':
          await this.generateExcelFile(filePath, part.data, columns, {
            sheetName: `Part ${part.part_number}`
          })
          break
          
        case 'csv':
          await this.generateCSVFile(filePath, part.data, columns)
          break
          
        case 'json':
          await this.generateJSONFile(filePath, part.data)
          break
          
        default:
          throw new Error(`不支持的文件格式: ${format}`)
      }
      
      const stats = await fs.stat(filePath)
      
      return {
        file_id: fileId,
        file_name: fileName,
        file_path: filePath,
        file_size: stats.size,
        format,
        created_at: new Date().toISOString()
      }
      
    } catch (error) {
      logger.error('生成分片文件失败', { 
        part: part.part_number,
        format,
        error: error.message
      })
      throw error
    }
  }

  /**
   * 生成Excel文件
   */
  async generateExcelFile(filePath, data, columns = [], options = {}) {
    const {
      sheetName = 'Data',
      includeHeader = true,
      autoWidth = true
    } = options

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName)

    if (data.length === 0) {
      await workbook.xlsx.writeFile(filePath)
      return
    }

    // 设置列
    const columnHeaders = columns.length > 0 
      ? columns.map(col => col.name)
      : Object.keys(data[0])
    
    if (includeHeader) {
      worksheet.columns = columnHeaders.map(header => ({
        header,
        key: header,
        width: autoWidth ? Math.min(Math.max(header.length, 10), 50) : 15
      }))
    }

    // 添加数据
    data.forEach(row => {
      worksheet.addRow(row)
    })

    // 格式化表头
    if (includeHeader) {
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
    }

    await workbook.xlsx.writeFile(filePath)
  }

  /**
   * 生成CSV文件
   */
  async generateCSVFile(filePath, data, columns = []) {
    if (data.length === 0) {
      await fs.writeFile(filePath, '', 'utf8')
      return
    }

    const columnHeaders = columns.length > 0 
      ? columns.map(col => col.name)
      : Object.keys(data[0])
    
    let csvContent = columnHeaders.join(',') + '\n'
    
    data.forEach(row => {
      const values = columnHeaders.map(header => {
        let value = row[header] || ''
        // 处理包含逗号或引号的值
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvContent += values.join(',') + '\n'
    })
    
    await fs.writeFile(filePath, csvContent, 'utf8')
  }

  /**
   * 生成JSON文件
   */
  async generateJSONFile(filePath, data) {
    const jsonContent = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonContent, 'utf8')
  }

  /**
   * 生成元数据
   */
  generateMetadata(result) {
    const metadata = {
      generated_at: new Date().toISOString(),
      row_count: result.row_count,
      column_count: result.columns?.length || 0,
      data_size_kb: this.estimateDataSize(result.data),
      execution_time: result.execution_time,
      is_split: result.is_split || false
    }

    if (result.is_split) {
      metadata.split_info = {
        total_parts: result.parts?.length || 0,
        split_threshold: result.split_info?.threshold,
        parts_summary: result.parts?.map(part => ({
          part_number: part.part_number,
          row_count: part.row_count,
          file_name: part.file_info?.file_name
        }))
      }
    }

    // 列统计
    if (result.columns && result.columns.length > 0) {
      metadata.columns = result.columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: this.checkColumnNullable(result.data, col.name)
      }))
    }

    return metadata
  }

  /**
   * 检查列是否可为空
   */
  checkColumnNullable(data, columnName) {
    if (!Array.isArray(data) || data.length === 0) {
      return true
    }

    return data.some(row => {
      const value = row[columnName]
      return value === null || value === undefined || value === ''
    })
  }

  /**
   * 估算数据大小
   */
  estimateDataSize(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return 0
    }

    const sampleSize = Math.min(100, data.length)
    const sampleData = data.slice(0, sampleSize)
    const sampleSizeBytes = JSON.stringify(sampleData).length
    const estimatedTotalBytes = (sampleSizeBytes / sampleSize) * data.length
    
    return Math.round(estimatedTotalBytes / 1024) // 返回KB
  }

  /**
   * 分页处理
   */
  paginateResult(result, page = 1, pageSize = 100) {
    const { data, row_count } = result
    const totalPages = Math.ceil(row_count / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, row_count)
    
    const paginatedData = data.slice(startIndex, endIndex)
    
    return {
      ...result,
      data: paginatedData,
      pagination: {
        current_page: page,
        page_size: pageSize,
        total_pages: totalPages,
        total_rows: row_count,
        start_row: startIndex + 1,
        end_row: endIndex,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles(maxAge = 24 * 60 * 60 * 1000) { // 24小时
    try {
      const files = await fs.readdir(this.exportDir)
      const now = Date.now()
      let cleanedCount = 0
      
      for (const file of files) {
        const filePath = path.join(this.exportDir, file)
        const stats = await fs.stat(filePath)
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
          cleanedCount++
        }
      }
      
      logger.info('清理过期文件完成', { 
        cleanedCount,
        totalFiles: files.length
      })
      
      return cleanedCount
      
    } catch (error) {
      logger.error('清理过期文件失败', { error: error.message })
      throw error
    }
  }

  /**
   * 获取处理统计信息
   */
  getProcessingStats() {
    return {
      export_directory: this.exportDir,
      temp_directory: this.tempDir,
      max_rows_per_file: this.maxRowsPerFile,
      max_rows_per_sheet: this.maxRowsPerSheet,
      supported_formats: ['json', 'xlsx', 'csv'],
      memory_usage: process.memoryUsage()
    }
  }
}

module.exports = new ResultProcessor()