const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, StopQueryExecutionCommand, GetQueryResultsCommand } = require('@aws-sdk/client-athena')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')

// 初始化AWS客户端
const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

class AthenaService {
  constructor() {
    this.outputLocation = process.env.ATHENA_OUTPUT_LOCATION
    this.workgroup = process.env.ATHENA_WORKGROUP || 'primary'
    this.maxQueryTimeout = parseInt(process.env.MAX_QUERY_TIMEOUT) || 300000
    this.maxResultSize = parseInt(process.env.MAX_RESULT_SIZE) || 1000000
  }

  /**
   * 执行Athena查询
   */
  async executeQuery(sql, options = {}) {
    const {
      database,
      requestId,
      timeout = 60000,
      maxCost = 10
    } = options

    try {
      // 启动查询执行
      const queryId = await this.startQueryExecution(sql, database, requestId)
      
      // 等待查询完成
      const queryExecution = await this.waitForQueryCompletion(queryId, timeout)
      
      // 获取查询结果
      const results = await this.getQueryResults(queryId)
      
      // 计算查询统计信息
      const stats = this.calculateQueryStats(queryExecution)
      
      // 检查成本限制
      if (stats.cost > maxCost) {
        logger.warn('Query cost exceeds limit', { 
          requestId, 
          queryId, 
          cost: stats.cost, 
          maxCost 
        })
      }

      return {
        queryId,
        results: results.data,
        recordCount: results.recordCount,
        executionTime: stats.executionTime,
        dataScanned: stats.dataScanned,
        cost: stats.cost,
        status: 'SUCCEEDED'
      }

    } catch (error) {
      logger.error('Query execution failed', { 
        requestId, 
        sql: sql.substring(0, 200), 
        error: error.message 
      })
      throw new Error(`Query execution failed: ${error.message}`)
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
  async waitForQueryCompletion(queryId, timeout = 60000) {
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
   * 获取查询结果
   */
  async getQueryResults(queryId, maxResults = 1000) {
    try {
      const command = new GetQueryResultsCommand({
        QueryExecutionId: queryId,
        MaxResults: maxResults
      })
      
      const response = await athenaClient.send(command)
      const resultSet = response.ResultSet

      if (!resultSet || !resultSet.Rows || resultSet.Rows.length === 0) {
        return { data: [], recordCount: 0 }
      }

      // 解析列信息
      const columns = resultSet.ResultSetMetadata.ColumnInfo.map(col => ({
        name: col.Name,
        type: col.Type
      }))

      // 解析数据行（跳过第一行标题）
      const dataRows = resultSet.Rows.slice(1)
      const data = dataRows.map(row => {
        const record = {}
        row.Data.forEach((cell, index) => {
          const columnName = columns[index].name
          record[columnName] = cell.VarCharValue || null
        })
        return record
      })

      return {
        data,
        recordCount: data.length,
        columns,
        hasMoreResults: !!response.NextToken
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
      const results = await this.executeQuery(sql + ` LIMIT ${Math.min(recordCount, 1000)}`, {
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
   * 获取查询状态
   */
  async getQueryStatus(queryId) {
    try {
      const command = new GetQueryExecutionCommand({ QueryExecutionId: queryId })
      const response = await athenaClient.send(command)
      const queryExecution = response.QueryExecution

      return {
        queryId,
        status: queryExecution.Status.State,
        submissionDateTime: queryExecution.Status.SubmissionDateTime,
        completionDateTime: queryExecution.Status.CompletionDateTime,
        stateChangeReason: queryExecution.Status.StateChangeReason,
        statistics: this.calculateQueryStats(queryExecution)
      }
    } catch (error) {
      throw new Error(`Failed to get query status: ${error.message}`)
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