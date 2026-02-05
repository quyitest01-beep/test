const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')
const crypto = require('crypto')

class PythonExecutor {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp')
    this.pythonPath = 'python' // 可配置Python路径
    this.maxExecutionTime = 300000 // 5分钟超时
    this.maxMemoryUsage = 1024 * 1024 * 1024 // 1GB内存限制
    
    // 确保临时目录存在
    this.ensureTempDir()
  }

  /**
   * 确保临时目录存在
   */
  async ensureTempDir() {
    try {
      await fs.access(this.tempDir)
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true })
    }
  }

  /**
   * 执行Python代码
   */
  async executePythonCode(pythonCode, options = {}) {
    const {
      timeout = this.maxExecutionTime,
      memoryLimit = this.maxMemoryUsage,
      workingDir = this.tempDir,
      env = {}
    } = options

    const executionId = this.generateExecutionId()
    const scriptPath = path.join(this.tempDir, `query_${executionId}.py`)
    
    try {
      logger.info('开始执行Python代码', { 
        executionId,
        codeLength: pythonCode.length,
        timeout
      })

      // 1. 写入Python脚本文件
      await this.writeScriptFile(scriptPath, pythonCode)
      
      // 2. 准备执行环境
      const execEnv = this.prepareEnvironment(env)
      
      // 3. 执行Python脚本
      const result = await this.runPythonScript(scriptPath, {
        timeout,
        memoryLimit,
        workingDir,
        env: execEnv,
        executionId
      })
      
      // 4. 清理临时文件
      await this.cleanup(scriptPath)
      
      logger.info('Python代码执行完成', { 
        executionId,
        success: result.success,
        executionTime: result.execution_time
      })
      
      return {
        execution_id: executionId,
        ...result
      }
      
    } catch (error) {
      logger.error('Python代码执行失败', { 
        executionId,
        error: error.message
      })
      
      // 清理临时文件
      await this.cleanup(scriptPath)
      
      throw new Error(`Python执行失败: ${error.message}`)
    }
  }

  /**
   * 生成执行ID
   */
  generateExecutionId() {
    return crypto.randomBytes(8).toString('hex')
  }

  /**
   * 写入脚本文件
   */
  async writeScriptFile(scriptPath, pythonCode) {
    try {
      await fs.writeFile(scriptPath, pythonCode, 'utf8')
      logger.debug('Python脚本文件已创建', { scriptPath })
    } catch (error) {
      throw new Error(`无法创建Python脚本文件: ${error.message}`)
    }
  }

  /**
   * 准备执行环境
   */
  prepareEnvironment(customEnv = {}) {
    return {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH || '',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
      ...customEnv
    }
  }

  /**
   * 运行Python脚本
   */
  async runPythonScript(scriptPath, options) {
    const { timeout, memoryLimit, workingDir, env, executionId } = options
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      let stdout = ''
      let stderr = ''
      let isTimeout = false
      let isMemoryExceeded = false
      
      // 启动Python进程
      const pythonProcess = spawn(this.pythonPath, [scriptPath], {
        cwd: workingDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        isTimeout = true
        pythonProcess.kill('SIGKILL')
        reject(new Error(`执行超时 (${timeout}ms)`))
      }, timeout)
      
      // 监控内存使用
      const memoryMonitor = setInterval(() => {
        try {
          if (pythonProcess.pid) {
            // 这里可以添加内存监控逻辑
            // 由于跨平台兼容性，暂时简化处理
          }
        } catch (error) {
          // 忽略监控错误
        }
      }, 1000)
      
      // 收集输出
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      // 处理进程结束
      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutHandle)
        clearInterval(memoryMonitor)
        
        if (isTimeout) {
          return // 已经在超时处理中reject了
        }
        
        const endTime = Date.now()
        const executionTime = endTime - startTime
        
        logger.debug('Python进程结束', { 
          executionId,
          code,
          executionTime,
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        })
        
        if (code === 0) {
          // 成功执行，解析输出
          try {
            const result = this.parseExecutionResult(stdout, stderr, executionTime)
            resolve(result)
          } catch (parseError) {
            reject(new Error(`结果解析失败: ${parseError.message}`))
          }
        } else {
          // 执行失败
          const errorMessage = stderr || `Python进程退出码: ${code}`
          reject(new Error(errorMessage))
        }
      })
      
      // 处理进程错误
      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutHandle)
        clearInterval(memoryMonitor)
        reject(new Error(`Python进程启动失败: ${error.message}`))
      })
    })
  }

  /**
   * 解析执行结果
   */
  parseExecutionResult(stdout, stderr, executionTime) {
    try {
      // 尝试解析JSON输出
      const lines = stdout.trim().split('\n')
      const lastLine = lines[lines.length - 1]
      
      let result
      try {
        result = JSON.parse(lastLine)
      } catch {
        // 如果最后一行不是JSON，尝试查找JSON行
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            result = JSON.parse(lines[i])
            break
          } catch {
            continue
          }
        }
        
        if (!result) {
          throw new Error('未找到有效的JSON输出')
        }
      }
      
      // 添加执行信息
      result.execution_time = executionTime
      result.stdout_lines = lines.length
      
      if (stderr) {
        result.warnings = stderr.split('\n').filter(line => line.trim())
      }
      
      return result
      
    } catch (error) {
      // 解析失败，返回原始输出
      return {
        success: false,
        error: `输出解析失败: ${error.message}`,
        raw_stdout: stdout,
        raw_stderr: stderr,
        execution_time: executionTime,
        data: [],
        row_count: 0
      }
    }
  }

  /**
   * 执行数据拆分查询
   */
  async executeSplitQuery(pythonCode, splitConfig, options = {}) {
    const {
      maxChunkSize = 50000,
      maxConcurrent = 3,
      timeout = this.maxExecutionTime
    } = options
    
    try {
      logger.info('开始执行拆分查询', { 
        splitType: splitConfig.type,
        maxChunkSize,
        maxConcurrent
      })
      
      // 1. 生成拆分查询代码
      const splitQueries = this.generateSplitQueries(pythonCode, splitConfig, maxChunkSize)
      
      // 2. 并发执行查询
      const results = await this.executeConcurrentQueries(splitQueries, {
        maxConcurrent,
        timeout: timeout / splitQueries.length // 平分超时时间
      })
      
      // 3. 合并结果
      const mergedResult = this.mergeQueryResults(results)
      
      logger.info('拆分查询执行完成', { 
        totalParts: splitQueries.length,
        totalRows: mergedResult.row_count,
        successParts: results.filter(r => r.success).length
      })
      
      return mergedResult
      
    } catch (error) {
      logger.error('拆分查询执行失败', { error: error.message })
      throw new Error(`拆分查询失败: ${error.message}`)
    }
  }

  /**
   * 生成拆分查询代码
   */
  generateSplitQueries(originalCode, splitConfig, maxChunkSize) {
    const queries = []
    const { type, column, estimated_parts } = splitConfig
    
    switch (type) {
      case 'date_range':
        // 按日期范围拆分
        for (let i = 0; i < estimated_parts; i++) {
          const modifiedCode = this.modifyCodeForDateSplit(originalCode, column, i, estimated_parts)
          queries.push({
            id: `date_${i}`,
            code: modifiedCode,
            type: 'date_range',
            part: i + 1,
            total: estimated_parts
          })
        }
        break
        
      case 'id_range':
        // 按ID范围拆分
        for (let i = 0; i < estimated_parts; i++) {
          const modifiedCode = this.modifyCodeForIdSplit(originalCode, column, i, estimated_parts, maxChunkSize)
          queries.push({
            id: `id_${i}`,
            code: modifiedCode,
            type: 'id_range',
            part: i + 1,
            total: estimated_parts
          })
        }
        break
        
      default:
        // 默认按LIMIT拆分
        for (let i = 0; i < estimated_parts; i++) {
          const offset = i * maxChunkSize
          const modifiedCode = this.modifyCodeForLimitSplit(originalCode, maxChunkSize, offset)
          queries.push({
            id: `limit_${i}`,
            code: modifiedCode,
            type: 'limit',
            part: i + 1,
            total: estimated_parts
          })
        }
    }
    
    return queries
  }

  /**
   * 修改代码以支持日期拆分
   */
  modifyCodeForDateSplit(code, dateColumn, partIndex, totalParts) {
    // 这里需要根据具体的SQL结构来修改
    // 简化实现：在WHERE子句中添加日期范围条件
    const dateCondition = `
        # 日期拆分条件 - 第${partIndex + 1}部分，共${totalParts}部分
        date_part = ${partIndex}
        total_parts = ${totalParts}
        
        # 修改查询以包含日期范围
        # 这里需要根据实际的日期范围来调整
    `
    
    return code.replace('# 数据库连接配置', dateCondition + '\n        # 数据库连接配置')
  }

  /**
   * 修改代码以支持ID拆分
   */
  modifyCodeForIdSplit(code, idColumn, partIndex, totalParts, chunkSize) {
    const minId = partIndex * chunkSize
    const maxId = (partIndex + 1) * chunkSize - 1
    
    const idCondition = `
        # ID范围拆分条件 - 第${partIndex + 1}部分，共${totalParts}部分
        min_id = ${minId}
        max_id = ${maxId}
        
        # 在查询中添加ID范围条件
        query_params['min_id'] = min_id
        query_params['max_id'] = max_id
    `
    
    return code.replace('# 查询参数', idCondition + '\n        # 查询参数')
  }

  /**
   * 修改代码以支持LIMIT拆分
   */
  modifyCodeForLimitSplit(code, limit, offset) {
    const limitCondition = `
        # LIMIT拆分条件
        query_limit = ${limit}
        query_offset = ${offset}
        
        # 修改查询参数
        query_params['limit'] = query_limit
        query_params['offset'] = query_offset
    `
    
    return code.replace('# 查询参数', limitCondition + '\n        # 查询参数')
  }

  /**
   * 并发执行查询
   */
  async executeConcurrentQueries(queries, options) {
    const { maxConcurrent, timeout } = options
    const results = []
    
    // 分批执行
    for (let i = 0; i < queries.length; i += maxConcurrent) {
      const batch = queries.slice(i, i + maxConcurrent)
      
      const batchPromises = batch.map(async (query) => {
        try {
          const result = await this.executePythonCode(query.code, { timeout })
          return {
            ...result,
            query_id: query.id,
            part: query.part,
            total: query.total
          }
        } catch (error) {
          logger.error('查询分片执行失败', { 
            queryId: query.id,
            error: error.message
          })
          return {
            success: false,
            error: error.message,
            query_id: query.id,
            part: query.part,
            total: query.total,
            data: [],
            row_count: 0
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // 批次间短暂延迟，避免过载
      if (i + maxConcurrent < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }

  /**
   * 合并查询结果
   */
  mergeQueryResults(results) {
    const successResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    if (successResults.length === 0) {
      return {
        success: false,
        error: '所有查询分片都失败了',
        data: [],
        row_count: 0,
        failed_parts: failedResults.length,
        total_parts: results.length
      }
    }
    
    // 合并数据
    const mergedData = []
    let totalRows = 0
    let totalExecutionTime = 0
    const columns = successResults[0].columns || []
    
    for (const result of successResults) {
      if (result.data && Array.isArray(result.data)) {
        mergedData.push(...result.data)
        totalRows += result.row_count || result.data.length
      }
      totalExecutionTime += result.execution_time || 0
    }
    
    return {
      success: true,
      data: mergedData,
      row_count: totalRows,
      columns,
      execution_time: totalExecutionTime,
      successful_parts: successResults.length,
      failed_parts: failedResults.length,
      total_parts: results.length,
      split_info: {
        type: 'merged',
        parts_executed: results.length,
        parts_successful: successResults.length,
        average_execution_time: totalExecutionTime / successResults.length
      }
    }
  }

  /**
   * 清理临时文件
   */
  async cleanup(scriptPath) {
    try {
      await fs.unlink(scriptPath)
      logger.debug('临时文件已清理', { scriptPath })
    } catch (error) {
      logger.warn('清理临时文件失败', { 
        scriptPath,
        error: error.message
      })
    }
  }

  /**
   * 检查Python环境
   */
  async checkPythonEnvironment() {
    try {
      const result = await this.executePythonCode(`
import sys
import json

# 检查Python版本和依赖
result = {
    'python_version': sys.version,
    'python_executable': sys.executable,
    'available_modules': []
}

# 检查必需的模块
required_modules = ['pandas', 'sqlalchemy', 'pymysql', 'psycopg2']
for module in required_modules:
    try:
        __import__(module)
        result['available_modules'].append(module)
    except ImportError:
        pass

print(json.dumps(result, ensure_ascii=False))
      `, { timeout: 10000 })
      
      return result
    } catch (error) {
      throw new Error(`Python环境检查失败: ${error.message}`)
    }
  }
}

module.exports = new PythonExecutor()