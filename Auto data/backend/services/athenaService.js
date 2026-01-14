const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, StopQueryExecutionCommand, GetQueryResultsCommand } = require('@aws-sdk/client-athena')
const { S3Client, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const memoryManager = require('./memoryManager')

// 构建 AWS 凭证配置（支持临时凭证）
const buildCredentials = () => {
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
  
  // 如果提供了 SESSION_TOKEN（临时凭证），则添加它
  if (process.env.AWS_SESSION_TOKEN) {
    credentials.sessionToken = process.env.AWS_SESSION_TOKEN
  }
  
  return credentials
}

// 初始化AWS客户端
const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: buildCredentials()
})

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: buildCredentials()
})

class AthenaService {
  constructor() {
    this.outputLocation = process.env.ATHENA_OUTPUT_LOCATION
    this.workgroup = process.env.ATHENA_WORKGROUP || 'primary'
    this.maxQueryTimeout = parseInt(process.env.MAX_QUERY_TIMEOUT) || 300000
    this.maxResultSize = parseInt(process.env.MAX_RESULT_SIZE) || 1000000
  }

  /**
   * 执行查询（带内存检查）
   */
  async executeQuery(sql, options = {}) {
    const requestId = options.requestId || uuidv4();
    const startTime = Date.now();
    
    try {
      logger.logQuery(requestId, 'Starting query execution', { sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : '') });
      
      // 估算内存需求
      const estimatedMemory = memoryManager.estimateQueryMemory(sql, options.expectedRows || 10000);
      
      // 检查内存是否足够
      if (!memoryManager.canExecuteQuery(estimatedMemory)) {
        throw new Error(`内存不足，无法执行查询。预估需要${estimatedMemory}MB内存，当前可用内存不足`);
      }
      
      // 注册查询到内存管理器
      memoryManager.registerQuery(requestId, estimatedMemory);
      
      const {
        database,
        timeout = 300000,
        maxCost = 10
      } = options

      // 启动查询执行
      const queryId = await this.startQueryExecution(sql, database, requestId)
      
      // 等待查询完成
      const queryExecution = await this.waitForQueryCompletion(queryId, timeout)
      
      // 获取查询结果
      const results = await this.getQueryResults(queryId)
      
      // 计算查询统计信息
      const stats = this.calculateQueryStats(queryExecution)
      
      // 更新实际内存使用
      const actualMemory = Math.max(estimatedMemory, Math.round(results.recordCount / 1000)); // 每千行约1MB
      memoryManager.updateQueryMemory(requestId, actualMemory);
      
      // 检查成本限制
      if (stats.cost > maxCost) {
        logger.warn('Query cost exceeds limit', { 
          requestId, 
          queryId, 
          cost: stats.cost, 
          maxCost 
        })
      }

      const executionTime = Date.now() - startTime;
      
      logger.logQuery(requestId, 'Query execution completed', {
        executionTime,
        rowCount: results.recordCount,
        estimatedMemory,
        actualMemory,
        ...stats
      });

      return {
        success: true,
        requestId,
        queryId,
        executionTime,
        row_count: results.recordCount,
        data: results.data,
        columns: results.columns,
        memoryUsage: actualMemory,
        dataScanned: stats.dataScanned,
        cost: stats.cost,
        status: 'SUCCEEDED'
      }

    } catch (error) {
      logger.error('Query execution failed', { 
        requestId, 
        sql: sql.substring(0, 200), 
        error: error.message,
        stack: error.stack
      })
      
      // 从内存管理器中移除查询
      memoryManager.removeQuery(requestId);
      
      return {
        success: false,
        requestId,
        error: error.message,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * 启动查询执行
   */
  async startQueryExecution(sql, database, requestId) {
    const params = {
      QueryString: sql,
      QueryExecutionContext: {
        Database: database
      },
      ResultConfiguration: {
        OutputLocation: this.outputLocation
      },
      WorkGroup: this.workgroup,
      ClientRequestToken: uuidv4()
    }

    try {
      const command = new StartQueryExecutionCommand(params)
      const response = await athenaClient.send(command)
      
      logger.info('Query execution started', { 
        requestId, 
        queryId: response.QueryExecutionId 
      })
      
      return response.QueryExecutionId
    } catch (error) {
      throw new Error(`Failed to start query execution: ${error.message}`)
    }
  }

  /**
   * 等待查询完成
   */
  async waitForQueryCompletion(queryId, timeout = 300000) {
    const startTime = Date.now()
    const pollInterval = 1000 // 1秒轮询间隔

    while (Date.now() - startTime < timeout) {
      try {
        const command = new GetQueryExecutionCommand({ QueryExecutionId: queryId })
        const response = await athenaClient.send(command)
        const queryExecution = response.QueryExecution

        const status = queryExecution.Status.State

        if (status === 'SUCCEEDED') {
          return queryExecution
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          const reason = queryExecution.Status.StateChangeReason || 'Unknown error'
          throw new Error(`Query ${status.toLowerCase()}: ${reason}`)
        }

        // 继续等待
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        if (error.message.includes('Query')) {
          throw error
        }
        // 其他错误继续重试
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    throw new Error(`Query timeout after ${timeout}ms`)
  }

  /**
   * 获取查询结果 - 分页获取所有数据
   */
  async getQueryResults(queryId, maxResults = 1000) {
    try {
      let allData = []
      let nextToken = null
      let totalRecords = 0
      let columns = null
      let isFirstPage = true

      do {
        const command = new GetQueryResultsCommand({
          QueryExecutionId: queryId,
          MaxResults: maxResults,
          NextToken: nextToken
        })
        
        const response = await athenaClient.send(command)
        const resultSet = response.ResultSet

        if (!resultSet || !resultSet.Rows || resultSet.Rows.length === 0) {
          break
        }

        // 只在第一页解析列信息
        if (isFirstPage) {
          columns = resultSet.ResultSetMetadata.ColumnInfo.map(col => ({
            name: col.Name,
            type: col.Type
          }))
        }

        // 解析数据行（第一页跳过标题行，后续页面直接处理）
        const dataRows = isFirstPage ? resultSet.Rows.slice(1) : resultSet.Rows
        const pageData = dataRows.map(row => {
          const record = {}
          row.Data.forEach((cell, index) => {
            const columnName = columns[index].name
            record[columnName] = cell.VarCharValue || null
          })
          return record
        })

        allData = allData.concat(pageData)
        totalRecords += pageData.length
        nextToken = response.NextToken
        isFirstPage = false

        // 添加延迟避免API限制
        if (nextToken) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } while (nextToken)

      return {
        data: allData,
        recordCount: totalRecords,
        columns,
        hasMoreResults: false
      }

    } catch (error) {
      throw new Error(`Failed to get query results: ${error.message}`)
    }
  }

  /**
   * 计算查询统计信息
   */
  calculateQueryStats(queryExecution) {
    const stats = queryExecution.Statistics || {}
    
    return {
      executionTime: stats.EngineExecutionTimeInMillis || 0,
      dataScanned: Math.round((stats.DataScannedInBytes || 0) / (1024 * 1024)), // MB
      cost: this.calculateQueryCost(stats.DataScannedInBytes || 0)
    }
  }

  /**
   * 计算查询成本（基于扫描的数据量）
   */
  calculateQueryCost(dataScannedInBytes) {
    // Athena定价：每TB扫描数据$5.00
    const pricePerTB = 5.00
    const bytesPerTB = 1024 * 1024 * 1024 * 1024
    
    return Math.round((dataScannedInBytes / bytesPerTB) * pricePerTB * 1000) / 1000
  }

  /**
   * 拆分大查询
   */
  async splitQuery({ sql, originalQuery, recordCount, requestId, batchSize = 50000, strategy = 'date_range' }) {
    try {
      const batchCount = Math.ceil(recordCount / batchSize)
      
      logger.info('Splitting query into batches', {
        requestId,
        recordCount,
        batchSize,
        batchCount,
        strategy
      })

      // 这里实现查询拆分逻辑
      // 目前返回模拟结果，实际实现需要根据strategy拆分SQL
      const results = await this.executeQuery(sql, {
        requestId
      })

      return {
        results: results.results,
        totalRecords: recordCount,
        batchCount,
        batchSize,
        splitStrategy: strategy,
        message: `数据已自动拆分为${batchCount}个批次，每批最多${batchSize}条记录`,
        executionTime: results.executionTime,
        dataScanned: results.dataScanned,
        cost: results.cost
      }

    } catch (error) {
      logger.error('Query splitting failed', { requestId, error: error.message })
      throw new Error(`Query splitting failed: ${error.message}`)
    }
  }

  /**
   * 使用 HeadObject 获取单个文件大小（不需要 ListObjects 权限）
   */
  async getResultFileSizeByHeadObject(bucket, fileKey) {
    try {
      if (!bucket || !fileKey) {
        logger.warn('Bucket or fileKey is empty', { bucket, fileKey })
        return null
      }

      logger.info('Getting S3 file size using HeadObject', { bucket, fileKey })

      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: fileKey
      })

      const response = await s3Client.send(command)
      
      if (!response.ContentLength) {
        logger.warn('No ContentLength in response', { bucket, fileKey })
        return null
      }

      const fileSize = response.ContentLength

      logger.info('S3 file size retrieved', { 
        bucket, 
        fileKey, 
        sizeBytes: fileSize,
        sizeMB: Math.round((fileSize / (1024 * 1024)) * 100) / 100
      })

      return {
        totalSizeBytes: fileSize,
        totalSizeMB: Math.round((fileSize / (1024 * 1024)) * 10000) / 10000, // 保留4位小数，避免小文件显示为0
        totalSizeGB: Math.round((fileSize / (1024 * 1024 * 1024)) * 10000) / 10000,
        fileCount: 1,
        formattedSize: this.formatFileSize(fileSize),
        contentType: response.ContentType || null,
        lastModified: response.LastModified || null
      }
    } catch (error) {
      // 如果是 404，文件不存在
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        logger.warn('File not found in S3', { bucket, fileKey })
        return null
      }
      
      logger.error('Failed to get file size using HeadObject', { 
        error: error.message, 
        errorName: error.name,
        bucket,
        fileKey
      })
      return null
    }
  }

  /**
   * 根据 queryId 构建可能的文件路径
   */
  buildPossibleFilePaths(queryId) {
    // Athena 结果文件的常见路径格式
    return [
      `${queryId}/${queryId}.csv`,           // 最常见：queryId/queryId.csv
      `${queryId}.csv`,                      // 直接在根目录
      `${queryId}/000000_0`,                 // Parquet 格式
      `${queryId}/000000_0.csv`,             // CSV 格式
      `${queryId}/part-00000.csv`,           // Spark 格式
      `${queryId}/data.csv`                  // 通用名称
    ]
  }

  /**
   * 尝试获取查询结果文件大小（使用 HeadObject，不需要 ListObjects）
   */
  async getResultFileSizeByQueryId(queryId, bucket = null) {
    try {
      // 如果没有提供 bucket，从环境变量获取
      if (!bucket) {
        const outputLocation = this.outputLocation || process.env.ATHENA_OUTPUT_LOCATION
        if (outputLocation) {
          const match = outputLocation.match(/^s3:\/\/([^\/]+)/)
          if (match) {
            bucket = match[1]
          }
        }
      }

      if (!bucket) {
        logger.warn('Cannot determine S3 bucket', { queryId })
        return null
      }

      // 尝试多个可能的文件路径
      const possiblePaths = this.buildPossibleFilePaths(queryId)
      
      for (const fileKey of possiblePaths) {
        const fileSize = await this.getResultFileSizeByHeadObject(bucket, fileKey)
        if (fileSize) {
          logger.info('Found result file', { queryId, bucket, fileKey, size: fileSize.formattedSize })
          return {
            ...fileSize,
            fileKey: fileKey,
            bucket: bucket
          }
        }
      }

      logger.warn('Could not find result file for query', { queryId, bucket, triedPaths: possiblePaths })
      return null
    } catch (error) {
      logger.error('Failed to get result file size by queryId', { 
        error: error.message, 
        queryId 
      })
      return null
    }
  }

  /**
   * 获取 S3 结果文件大小（旧方法，需要 ListObjects 权限）
   */
  async getResultFileSize(resultLocation) {
    try {
      if (!resultLocation) {
        logger.warn('Result location is empty')
        return null
      }

      // 解析 S3 路径: s3://bucket-name/path/to/file/
      const s3PathMatch = resultLocation.match(/^s3:\/\/([^\/]+)\/(.+)$/)
      if (!s3PathMatch) {
        logger.warn('Invalid S3 path format', { resultLocation })
        return null
      }

      const bucket = s3PathMatch[1]
      let prefix = s3PathMatch[2]
      
      // 移除末尾斜杠，但保留路径
      prefix = prefix.replace(/\/$/, '')
      
      // 如果 prefix 为空，说明是 bucket 根目录
      if (!prefix) {
        logger.warn('S3 prefix is empty', { bucket, resultLocation })
        return null
      }

      logger.info('Getting S3 file size', { bucket, prefix })

      // 列出该查询的所有结果文件
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix
      })

      const response = await s3Client.send(command)
      
      if (!response.Contents || response.Contents.length === 0) {
        logger.warn('No files found in S3', { bucket, prefix })
        return null
      }

      // 计算所有文件的总大小
      let totalSize = 0
      let fileCount = 0
      
      for (const object of response.Contents) {
        if (object.Size) {
          totalSize += object.Size
          fileCount++
        }
      }

      logger.info('S3 file size calculated', { 
        bucket, 
        prefix, 
        fileCount, 
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100 
      })

      return {
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        totalSizeGB: Math.round((totalSize / (1024 * 1024 * 1024)) * 100) / 100,
        fileCount: fileCount,
        formattedSize: this.formatFileSize(totalSize)
      }
    } catch (error) {
      logger.error('Failed to get result file size', { 
        error: error.message, 
        stack: error.stack,
        resultLocation 
      })
      return null
    }
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * 获取查询状态
   */
  async getQueryStatus(queryId) {
    try {
      const command = new GetQueryExecutionCommand({ QueryExecutionId: queryId })
      const response = await athenaClient.send(command)
      const queryExecution = response.QueryExecution

      const status = queryExecution.Status.State
      const statistics = this.calculateQueryStats(queryExecution)
      
      // 获取结果文件大小（仅当查询完成时）
      // 优先使用 HeadObject 方法（不需要 ListObjects 权限）
      let resultFileSize = null
      if (status === 'SUCCEEDED') {
        // 方法1: 使用 HeadObject（推荐，不需要 ListObjects 权限）
        resultFileSize = await this.getResultFileSizeByQueryId(queryId)
        
        // 方法2: 如果方法1失败，尝试使用 ListObjects（需要权限）
        if (!resultFileSize && queryExecution.ResultConfiguration?.OutputLocation) {
          resultFileSize = await this.getResultFileSize(queryExecution.ResultConfiguration.OutputLocation)
        }
      }

      return {
        queryId,
        status: status,
        statusText: this.getStatusText(status),
        submissionDateTime: queryExecution.Status.SubmissionDateTime,
        completionDateTime: queryExecution.Status.CompletionDateTime,
        stateChangeReason: queryExecution.Status.StateChangeReason,
        statistics: statistics,
        resultLocation: queryExecution.ResultConfiguration?.OutputLocation || null,
        resultFileSize: resultFileSize
      }
    } catch (error) {
      throw new Error(`Failed to get query status: ${error.message}`)
    }
  }

  /**
   * 获取状态文本（中文）
   */
  getStatusText(status) {
    if (!status) return '未知状态'
    const statusMap = {
      'QUEUED': '排队中',
      'RUNNING': '正在查询',
      'SUCCEEDED': '已完成',
      'FAILED': '失败',
      'CANCELLED': '已取消'
    }
    return statusMap[status.toUpperCase()] || status
  }

  /**
   * 根据文件大小给出处理建议
   */
  getProcessingRecommendation(fileSizeMB) {
    // 处理 null、undefined 或无效值
    if (fileSizeMB === null || fileSizeMB === undefined || isNaN(fileSizeMB)) {
      return {
        action: 'unknown',
        message: '无法确定文件大小',
        reason: '文件大小未知'
      }
    }

    // 即使小于 1 MB 也显示为小文件（使用更精确的比较）
    // 小文件：< 10 MB - 直接处理
    if (fileSizeMB < 10) {
      // 格式化显示：如果小于 1 MB，显示 KB；否则显示 MB
      const sizeDisplay = fileSizeMB < 1 
        ? `${(fileSizeMB * 1024).toFixed(2)} KB`
        : `${fileSizeMB.toFixed(2)} MB`;
      
      return {
        action: 'direct_process',
        message: '文件较小，建议直接处理',
        reason: `文件大小 ${sizeDisplay}，可以直接下载并处理`,
        threshold: 'small',
        maxSize: 10
      }
    }

    // 中等文件：10-500 MB - 导出文件处理
    if (fileSizeMB <= 500) {
      return {
        action: 'export_or_batch',
        message: '文件中等，建议导出文件处理',
        reason: `文件大小 ${fileSizeMB.toFixed(2)} MB，建议导出为文件处理`,
        threshold: 'medium',
        minSize: 10,
        maxSize: 500
      }
    }

    // 超大文件：> 500 MB - 必须拆分处理
    return {
      action: 'split_process',
      message: '文件超大，必须拆分处理',
      reason: `文件大小 ${fileSizeMB.toFixed(2)} MB，超过 500 MB 限制，必须拆分处理`,
      threshold: 'xlarge',
      minSize: 500
    }
  }

  /**
   * 取消查询
   */
  async cancelQuery(queryId) {
    try {
      const command = new StopQueryExecutionCommand({ QueryExecutionId: queryId })
      await athenaClient.send(command)
      
      logger.info('Query cancelled', { queryId })
    } catch (error) {
      throw new Error(`Failed to cancel query: ${error.message}`)
    }
  }
}

module.exports = new AthenaService()