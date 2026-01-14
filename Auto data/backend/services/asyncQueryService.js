const { v4: uuidv4 } = require('uuid');
const athenaService = require('./athenaService');
const logger = require('../utils/logger');

/**
 * 异步查询服务
 * 实现：收到查询请求→执行查询→查询成功→输出结果；查询失败→继续执行查询→查询超过5分钟，告知查询超时
 */
class AsyncQueryService {
  constructor() {
    // 存储查询状态
    this.queryStatus = new Map();
    // 存储查询结果
    this.queryResults = new Map();
    // 存储批量查询状态
    this.batchQueryStatus = new Map();
    // 最大超时时间：5分钟
    this.maxTimeout = 5 * 60 * 1000;
    // 重试间隔：10秒
    this.retryInterval = 10 * 1000;
  }

  /**
   * 启动异步查询
   * @param {string} sql - SQL查询语句
   * @param {object} options - 查询选项
   * @returns {object} 查询ID和状态
   */
  async startAsyncQuery(sql, options = {}) {
    const internalQueryId = uuidv4();
    const startTime = Date.now();
    
    // 初始化查询状态
    this.queryStatus.set(internalQueryId, {
      id: internalQueryId,
      sql: sql,
      status: 'pending', // pending, running, completed, failed, timeout
      startTime: startTime,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      lastError: null,
      progress: 0,
      batchId: options.batchId || null,
      queryName: options.queryName || null
    });

    logger.info('Async query started', { internalQueryId, sql: sql.substring(0, 100) + '...' });

    try {
      // 启动Athena查询并获取实际的查询ID
      const athenaQueryId = await athenaService.startQueryExecution(sql, options.database || process.env.ATHENA_DATABASE, internalQueryId);
      
      // 更新查询状态，存储Athena查询ID
      this.queryStatus.set(internalQueryId, {
        ...this.queryStatus.get(internalQueryId),
        athenaQueryId: athenaQueryId,
        status: 'running',
        progress: 10
      });

      // 如果是批量查询，记录到批量查询状态中
      if (options.batchId && options.queryName) {
        this.recordBatchQuery(options.batchId, options.queryName, internalQueryId);
      }

      // 异步等待查询完成（不阻塞返回）
      this.waitForQueryCompletion(internalQueryId, athenaQueryId, sql, options).catch(error => {
        logger.error('Async query execution failed', { internalQueryId, athenaQueryId, error: error.message });
        this.updateQueryStatus(internalQueryId, 'failed', { error: error.message });
      });

      // 设置超时检查
      this.setTimeoutCheck(internalQueryId);

      // 返回Athena的查询ID
      return {
        queryId: athenaQueryId,
        status: 'pending',
        message: '查询已启动，正在执行中...',
        estimatedTime: '2-5分钟'
      };

    } catch (error) {
      logger.error('Failed to start Athena query', { internalQueryId, error: error.message });
      this.updateQueryStatus(internalQueryId, 'failed', { error: error.message });
      
      return {
        queryId: internalQueryId,
        status: 'failed',
        message: '查询启动失败',
        error: error.message
      };
    }
  }

  /**
   * 等待查询完成
   * @param {string} internalQueryId - 内部查询ID
   * @param {string} athenaQueryId - Athena查询ID
   * @param {string} sql - SQL查询语句
   * @param {object} options - 查询选项
   */
  async waitForQueryCompletion(internalQueryId, athenaQueryId, sql, options = {}) {
    const queryInfo = this.queryStatus.get(internalQueryId);
    if (!queryInfo) {
      throw new Error('Query not found');
    }

    try {
      // 等待Athena查询完成
      const queryExecution = await athenaService.waitForQueryCompletion(athenaQueryId, this.maxTimeout);
      
      // 获取查询结果
      const results = await athenaService.getQueryResults(athenaQueryId);
      
      // 计算查询统计信息
      const stats = athenaService.calculateQueryStats(queryExecution);
      
      const result = {
        success: true,
        requestId: internalQueryId,
        queryId: athenaQueryId,
        executionTime: queryExecution.statistics.totalExecutionTimeInMillis || 0,
        rowCount: results.recordCount || 0,
        dataScanned: queryExecution.statistics.dataScannedInBytes || 0,
        cost: stats.cost || 0,
        data: results.data || []
      };

      // 查询成功
      this.queryResults.set(internalQueryId, result);
      this.updateQueryStatus(internalQueryId, 'completed', { 
        progress: 100,
        result: result 
      });

      logger.info('Async query completed successfully', { 
        internalQueryId, 
        athenaQueryId,
        rowCount: result.rowCount,
        executionTime: result.executionTime 
      });

    } catch (error) {
      logger.error('Async query execution error', { internalQueryId, athenaQueryId, error: error.message });
      
      // 检查是否应该重试
      if (queryInfo.retryCount < queryInfo.maxRetries) {
        queryInfo.retryCount++;
        this.updateQueryStatus(internalQueryId, 'retrying', { 
          error: error.message,
          retryCount: queryInfo.retryCount,
          progress: 50 + (queryInfo.retryCount * 10)
        });

        // 等待重试间隔后重试
        setTimeout(() => {
          logger.info('Retrying async query', { internalQueryId, athenaQueryId, retryCount: queryInfo.retryCount });
          this.waitForQueryCompletion(internalQueryId, athenaQueryId, sql, options);
        }, this.retryInterval);

      } else {
        // 重试次数用完，标记为失败
        this.updateQueryStatus(internalQueryId, 'failed', { 
          error: error.message,
          retryCount: queryInfo.retryCount
        });
      }
    }
  }

  /**
   * 异步执行查询（已废弃，使用waitForQueryCompletion替代）
   * @param {string} queryId - 查询ID
   * @param {string} sql - SQL查询语句
   * @param {object} options - 查询选项
   */
  async executeQueryAsync(queryId, sql, options = {}) {
    const queryInfo = this.queryStatus.get(queryId);
    if (!queryInfo) {
      throw new Error('Query not found');
    }

    try {
      // 更新状态为运行中
      this.updateQueryStatus(queryId, 'running', { progress: 10 });

      // 执行查询
      const result = await athenaService.executeQuery(sql, {
        database: options.database || process.env.ATHENA_DATABASE,
        requestId: queryId,
        timeout: this.maxTimeout, // 使用5分钟超时
        ...options
      });

      // 查询成功
      this.queryResults.set(queryId, result);
      this.updateQueryStatus(queryId, 'completed', { 
        progress: 100,
        result: result 
      });

      logger.info('Async query completed successfully', { 
        queryId, 
        rowCount: result.rowCount,
        executionTime: result.executionTime 
      });

    } catch (error) {
      logger.error('Async query execution error', { queryId, error: error.message });
      
      // 检查是否应该重试
      if (queryInfo.retryCount < queryInfo.maxRetries) {
        queryInfo.retryCount++;
        this.updateQueryStatus(queryId, 'retrying', { 
          error: error.message,
          retryCount: queryInfo.retryCount,
          progress: 50 + (queryInfo.retryCount * 10)
        });

        // 等待重试间隔后重试
        setTimeout(() => {
          logger.info('Retrying async query', { queryId, retryCount: queryInfo.retryCount });
          this.executeQueryAsync(queryId, sql, options);
        }, this.retryInterval);

      } else {
        // 重试次数用完，标记为失败
        this.updateQueryStatus(queryId, 'failed', { 
          error: error.message,
          retryCount: queryInfo.retryCount
        });
      }
    }
  }

  /**
   * 更新查询状态
   * @param {string} queryId - 查询ID
   * @param {string} status - 新状态
   * @param {object} data - 附加数据
   */
  updateQueryStatus(queryId, status, data = {}) {
    const queryInfo = this.queryStatus.get(queryId);
    if (queryInfo) {
      Object.assign(queryInfo, { status, ...data });
      this.queryStatus.set(queryId, queryInfo);
    }
  }

  /**
   * 设置超时检查
   * @param {string} queryId - 查询ID
   */
  setTimeoutCheck(queryId) {
    setTimeout(() => {
      const queryInfo = this.queryStatus.get(queryId);
      if (queryInfo && ['pending', 'running', 'retrying'].includes(queryInfo.status)) {
        logger.warn('Async query timeout', { queryId, elapsed: Date.now() - queryInfo.startTime });
        this.updateQueryStatus(queryId, 'timeout', { 
          error: '查询超时（5分钟）',
          progress: 100
        });
      }
    }, this.maxTimeout);
  }

  /**
   * 获取查询状态
   * @param {string} queryId - 查询ID
   * @returns {object} 查询状态
   */
  getQueryStatus(queryId) {
    // 首先尝试直接查找
    let queryInfo = this.queryStatus.get(queryId);
    
    // 如果没找到，尝试通过Athena查询ID查找
    if (!queryInfo) {
      for (const [internalId, info] of this.queryStatus.entries()) {
        if (info.athenaQueryId === queryId) {
          queryInfo = info;
          break;
        }
      }
    }
    
    if (!queryInfo) {
      return null;
    }

    const elapsed = Date.now() - queryInfo.startTime;
    const statusInfo = {
      queryId: queryId,
      status: queryInfo.status,
      elapsed: Math.round(elapsed / 1000), // 秒
      progress: queryInfo.progress,
      retryCount: queryInfo.retryCount,
      message: this.getStatusMessage(queryInfo)
    };

    // 如果查询完成，添加结果
    if (queryInfo.status === 'completed') {
      const result = this.queryResults.get(queryId);
      if (result) {
        statusInfo.result = result;
      }
    }

    // 如果有错误，添加错误信息
    if (queryInfo.lastError) {
      statusInfo.error = queryInfo.lastError;
    }

    return statusInfo;
  }

  /**
   * 获取状态消息
   * @param {object} queryInfo - 查询信息
   * @returns {string} 状态消息
   */
  getStatusMessage(queryInfo) {
    switch (queryInfo.status) {
      case 'pending':
        return '查询已启动，正在准备执行...';
      case 'running':
        return '查询正在执行中，请稍候...';
      case 'retrying':
        return `查询失败，正在重试 (${queryInfo.retryCount}/${queryInfo.maxRetries})...`;
      case 'completed':
        return '查询执行成功！';
      case 'failed':
        return '查询执行失败，已达到最大重试次数';
      case 'timeout':
        return '查询超时（5分钟），请检查查询复杂度或稍后重试';
      default:
        return '未知状态';
    }
  }

  /**
   * 记录批量查询
   * @param {string} batchId - 批量查询ID
   * @param {string} queryName - 查询名称
   * @param {string} queryId - 查询ID
   */
  recordBatchQuery(batchId, queryName, queryId) {
    if (!this.batchQueryStatus.has(batchId)) {
      this.batchQueryStatus.set(batchId, {
        batchId: batchId,
        startTime: Date.now(),
        totalQueries: 0,
        queryIds: {}
      });
    }

    const batchInfo = this.batchQueryStatus.get(batchId);
    batchInfo.queryIds[queryName] = queryId;
    batchInfo.totalQueries = Object.keys(batchInfo.queryIds).length;

    logger.info('Recorded batch query', { batchId, queryName, queryId });
  }

  /**
   * 获取批量查询状态
   * @param {string} batchId - 批量查询ID
   * @returns {object|null} 批量查询状态
   */
  getBatchQueryStatus(batchId) {
    const batchInfo = this.batchQueryStatus.get(batchId);
    if (!batchInfo) {
      return null;
    }

    // 获取所有查询的状态
    const queryStatuses = {};
    let completedCount = 0;
    let failedCount = 0;
    let runningCount = 0;

    for (const [queryName, queryId] of Object.entries(batchInfo.queryIds)) {
      const status = this.getQueryStatus(queryId);
      queryStatuses[queryName] = status;

      if (status) {
        switch (status.status) {
          case 'completed':
            completedCount++;
            break;
          case 'failed':
          case 'timeout':
            failedCount++;
            break;
          case 'running':
          case 'pending':
          case 'retrying':
            runningCount++;
            break;
        }
      }
    }

    // 计算批量查询的整体状态
    let batchStatus = 'running';
    if (completedCount + failedCount === batchInfo.totalQueries) {
      batchStatus = failedCount === 0 ? 'completed' : 'partial_failed';
    }

    return {
      batchId: batchId,
      status: batchStatus,
      queryStatuses: queryStatuses,
      summary: {
        totalQueries: batchInfo.totalQueries,
        completedQueries: completedCount,
        failedQueries: failedCount,
        runningQueries: runningCount,
        progress: Math.round(((completedCount + failedCount) / batchInfo.totalQueries) * 100)
      },
      startTime: batchInfo.startTime,
      elapsed: Date.now() - batchInfo.startTime
    };
  }

  /**
   * 取消批量查询
   * @param {string} batchId - 批量查询ID
   * @returns {object|null} 取消结果
   */
  cancelBatchQuery(batchId) {
    const batchInfo = this.batchQueryStatus.get(batchId);
    if (!batchInfo) {
      return null;
    }

    let cancelledCount = 0;
    let alreadyCompletedCount = 0;

    for (const [queryName, queryId] of Object.entries(batchInfo.queryIds)) {
      const queryInfo = this.queryStatus.get(queryId);
      if (queryInfo && !['completed', 'failed', 'timeout'].includes(queryInfo.status)) {
        this.updateQueryStatus(queryId, 'cancelled', {
          error: '批量查询被取消'
        });
        cancelledCount++;
      } else if (queryInfo && ['completed', 'failed', 'timeout'].includes(queryInfo.status)) {
        alreadyCompletedCount++;
      }
    }

    return {
      totalQueries: batchInfo.totalQueries,
      cancelledQueries: cancelledCount,
      alreadyCompletedQueries: alreadyCompletedCount
    };
  }

  /**
   * 清理过期的查询记录
   * @param {number} maxAge - 最大保留时间（毫秒）
   */
  cleanup(maxAge = 30 * 60 * 1000) { // 默认30分钟
    const now = Date.now();
    
    // 清理单个查询
    for (const [queryId, queryInfo] of this.queryStatus.entries()) {
      if (now - queryInfo.startTime > maxAge) {
        this.queryStatus.delete(queryId);
        this.queryResults.delete(queryId);
        logger.info('Cleaned up expired query', { queryId });
      }
    }

    // 清理批量查询
    for (const [batchId, batchInfo] of this.batchQueryStatus.entries()) {
      if (now - batchInfo.startTime > maxAge) {
        this.batchQueryStatus.delete(batchId);
        logger.info('Cleaned up expired batch query', { batchId });
      }
    }
  }
}

// 创建单例实例
const asyncQueryService = new AsyncQueryService();

// 定期清理过期查询（每10分钟）
setInterval(() => {
  asyncQueryService.cleanup();
}, 10 * 60 * 1000);

module.exports = asyncQueryService;



