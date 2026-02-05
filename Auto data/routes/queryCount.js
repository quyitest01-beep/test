const express = require('express');
const router = express.Router();
const asyncQueryService = require('../services/asyncQueryService');
const athenaService = require('../services/athenaService');
const logger = require('../utils/logger');

/**
 * 获取查询结果数量
 * GET /api/query/count/:queryId
 */
router.get('/count/:queryId', async (req, res) => {
  const { queryId } = req.params;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Getting query count', { requestId, queryId });

    // 首先检查查询状态
    const queryStatus = asyncQueryService.getQueryStatus(queryId);
    if (!queryStatus) {
      // 如果本地没有查询状态，尝试直接从Athena获取
      logger.info('Query not found in local cache, attempting to get from Athena', { requestId, queryId });
      try {
        const athenaResult = await athenaService.getQueryResults(queryId);
        return res.json({
          success: true,
          queryId,
          status: 'completed',
          rowCount: athenaResult.recordCount || 0,
          dataScanned: athenaResult.dataScanned || 0,
          executionTime: athenaResult.executionTime || 0,
          cost: athenaResult.cost || 0,
          message: `查询完成，共返回 ${athenaResult.recordCount || 0} 条记录`,
          requestId
        });
      } catch (athenaError) {
        logger.error('Failed to get results from Athena', { requestId, queryId, error: athenaError.message });
        return res.status(404).json({
          success: false,
          error: 'Query not found',
          message: '查询ID不存在或已过期',
          requestId
        });
      }
    }

    // 如果查询还在进行中
    if (queryStatus.status === 'pending' || queryStatus.status === 'running') {
      return res.json({
        success: true,
        queryId,
        status: queryStatus.status,
        message: '查询仍在执行中，请稍后再试',
        elapsed: queryStatus.elapsed,
        progress: queryStatus.progress,
        requestId
      });
    }

    // 如果查询失败或超时
    if (queryStatus.status === 'failed' || queryStatus.status === 'timeout') {
      return res.json({
        success: false,
        queryId,
        status: queryStatus.status,
        error: queryStatus.error || '查询执行失败',
        message: queryStatus.message,
        rowCount: 0,
        requestId
      });
    }

    // 如果查询已完成，获取结果数量
    if (queryStatus.status === 'completed' && queryStatus.result) {
      const result = queryStatus.result;
      return res.json({
        success: true,
        queryId,
        status: 'completed',
        rowCount: result.row_count || result.rowCount || 0,
        dataScanned: result.dataScanned || 0,
        executionTime: result.executionTime || 0,
        cost: result.cost || 0,
        message: `查询完成，共返回 ${result.row_count || result.rowCount || 0} 条记录`,
        requestId
      });
    }

    // 如果查询已完成但没有结果，或者查询ID不在本地管理中，尝试直接从Athena获取
    try {
      logger.info('Attempting to get results directly from Athena', { requestId, queryId });
      const athenaResult = await athenaService.getQueryResults(queryId);
      return res.json({
        success: true,
        queryId,
        status: 'completed',
        rowCount: athenaResult.recordCount || 0,
        dataScanned: athenaResult.dataScanned || 0,
        executionTime: athenaResult.executionTime || 0,
        cost: athenaResult.cost || 0,
        message: `查询完成，共返回 ${athenaResult.recordCount || 0} 条记录`,
        requestId
      });
    } catch (athenaError) {
      logger.error('Failed to get results from Athena', { requestId, queryId, error: athenaError.message });
      return res.status(500).json({
        success: false,
        queryId,
        error: 'Failed to get query results',
        message: '无法获取查询结果',
        requestId
      });
    }

  } catch (error) {
    logger.error('Query count API error', { requestId, queryId, error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
      message: '服务器内部错误',
      requestId
    });
  }
});

/**
 * 获取查询统计信息
 * GET /api/query/stats/:queryId
 */
router.get('/stats/:queryId', async (req, res) => {
  const { queryId } = req.params;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Getting query stats', { requestId, queryId });

    // 获取查询状态
    const queryStatus = asyncQueryService.getQueryStatus(queryId);
    if (!queryStatus) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
        message: '查询ID不存在或已过期',
        requestId
      });
    }

    // 获取Athena查询统计信息
    try {
      const athenaStats = await athenaService.getQueryStatus(queryId);
      
      return res.json({
        success: true,
        queryId,
        status: queryStatus.status,
        stats: {
          ...athenaStats.statistics,
          rowCount: queryStatus.result?.row_count || queryStatus.result?.rowCount || 0,
          elapsed: queryStatus.elapsed,
          progress: queryStatus.progress,
          retryCount: queryStatus.retryCount
        },
        message: '查询统计信息获取成功',
        requestId
      });
    } catch (athenaError) {
      logger.error('Failed to get Athena stats', { requestId, queryId, error: athenaError.message });
      
      // 如果无法从Athena获取统计信息，返回基本状态
      return res.json({
        success: true,
        queryId,
        status: queryStatus.status,
        stats: {
          rowCount: queryStatus.result?.row_count || queryStatus.result?.rowCount || 0,
          elapsed: queryStatus.elapsed,
          progress: queryStatus.progress,
          retryCount: queryStatus.retryCount
        },
        message: '查询统计信息获取成功（部分信息）',
        requestId
      });
    }

  } catch (error) {
    logger.error('Query stats API error', { requestId, queryId, error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
      message: '服务器内部错误',
      requestId
    });
  }
});

/**
 * 批量获取查询结果数量
 * POST /api/query/count/batch
 */
router.post('/count/batch', async (req, res) => {
  const { queryIds } = req.body;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    if (!Array.isArray(queryIds) || queryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: '请提供有效的查询ID数组',
        requestId
      });
    }

    if (queryIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many queries',
        message: '一次最多查询50个查询ID',
        requestId
      });
    }

    logger.info('Getting batch query counts', { requestId, count: queryIds.length });

    const results = [];
    
    for (const queryId of queryIds) {
      try {
        const queryStatus = asyncQueryService.getQueryStatus(queryId);
        if (!queryStatus) {
          results.push({
            queryId,
            success: false,
            error: 'Query not found',
            message: '查询ID不存在或已过期'
          });
          continue;
        }

        let rowCount = 0;
        if (queryStatus.status === 'completed' && queryStatus.result) {
          rowCount = queryStatus.result.row_count || queryStatus.result.rowCount || 0;
        }

        results.push({
          queryId,
          success: true,
          status: queryStatus.status,
          rowCount,
          elapsed: queryStatus.elapsed,
          progress: queryStatus.progress,
          message: queryStatus.message
        });

      } catch (error) {
        results.push({
          queryId,
          success: false,
          error: error.message,
          message: '获取查询信息失败'
        });
      }
    }

    return res.json({
      success: true,
      results,
      totalQueries: queryIds.length,
      completedQueries: results.filter(r => r.success && r.status === 'completed').length,
      message: `批量查询完成，共处理 ${queryIds.length} 个查询`,
      requestId
    });

  } catch (error) {
    logger.error('Batch query count API error', { requestId, error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
      message: '服务器内部错误',
      requestId
    });
  }
});

module.exports = router;
