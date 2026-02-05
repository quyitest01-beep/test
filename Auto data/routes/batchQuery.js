const express = require('express');
const Joi = require('joi');
const asyncQueryService = require('../services/asyncQueryService');
const logger = require('../utils/logger');

const router = express.Router();

// 验证模式
const batchQuerySchema = Joi.object({
  queries: Joi.object().pattern(
    Joi.string(), // 查询名称
    Joi.string().min(1).max(10000) // SQL查询语句
  ).min(1).max(10).required(),
  database: Joi.string().optional(),
  maxRetries: Joi.number().integer().min(0).max(5).default(3),
  options: Joi.object().optional()
});

/**
 * @swagger
 * /api/batch/start:
 *   post:
 *     summary: 启动批量异步查询
 *     description: 启动多个异步查询，立即返回查询ID列表，可通过状态接口查询进度
 *     tags: [Batch Query]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queries
 *             properties:
 *               queries:
 *                 type: object
 *                 description: 查询名称到SQL语句的映射
 *                 example: {
 *                   "merchantDailyLastWeek": "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_daily'",
 *                   "merchantMonthlyLastWeek": "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_monthly'"
 *                 }
 *               database:
 *                 type: string
 *                 description: 数据库名称（可选）
 *                 example: "gmp"
 *               maxRetries:
 *                 type: number
 *                 description: 最大重试次数（0-5）
 *                 example: 3
 *     responses:
 *       200:
 *         description: 批量查询启动成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 batchId:
 *                   type: string
 *                 queryResults:
 *                   type: object
 *                   description: 查询名称到查询ID的映射
 *                 totalQueries:
 *                   type: number
 *                 message:
 *                   type: string
 */
router.post('/start', async (req, res, next) => {
  try {
    const { error, value } = batchQuerySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: error.details[0].message
      });
    }

    const { queries, database, maxRetries, options = {} } = value;
    const queryNames = Object.keys(queries);
    const totalQueries = queryNames.length;

    logger.info('Starting batch async queries', { 
      totalQueries,
      queryNames,
      database,
      maxRetries 
    });

    // 生成批量查询ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 启动所有异步查询
    const queryResults = {};
    const startPromises = [];

    for (const queryName of queryNames) {
      const sql = queries[queryName];
      
      const startPromise = asyncQueryService.startAsyncQuery(sql, {
        database,
        maxRetries,
        batchId,
        queryName,
        ...options
      }).then(result => {
        queryResults[queryName] = {
          queryId: result.queryId,
          status: result.status,
          message: result.message
        };
        return result;
      }).catch(error => {
        queryResults[queryName] = {
          queryId: null,
          status: 'failed',
          message: error.message,
          error: error.message
        };
        return { queryName, error: error.message };
      });

      startPromises.push(startPromise);
    }

    // 等待所有查询启动完成
    await Promise.allSettled(startPromises);

    // 统计启动结果
    const successfulQueries = Object.values(queryResults).filter(r => r.queryId).length;
    const failedQueries = totalQueries - successfulQueries;

    logger.info('Batch queries started', { 
      batchId,
      totalQueries,
      successfulQueries,
      failedQueries
    });

    res.json({
      success: true,
      batchId: batchId,
      queryResults: queryResults,
      totalQueries: totalQueries,
      successfulQueries: successfulQueries,
      failedQueries: failedQueries,
      message: `批量查询已启动: ${successfulQueries}/${totalQueries} 成功`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to start batch queries', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/batch/status/{batchId}:
 *   get:
 *     summary: 查询批量查询状态
 *     description: 根据批量查询ID获取所有查询的执行状态和结果
 *     tags: [Batch Query]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *         description: 批量查询ID
 *     responses:
 *       200:
 *         description: 批量查询状态获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 batchId:
 *                   type: string
 *                 queryStatuses:
 *                   type: object
 *                   description: 查询名称到状态的映射
 *                 summary:
 *                   type: object
 *                   description: 批量查询汇总信息
 */
router.get('/status/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch ID',
        message: '批量查询ID不能为空'
      });
    }

    // 获取批量查询状态
    const batchStatus = asyncQueryService.getBatchQueryStatus(batchId);

    if (!batchStatus) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found',
        message: '批量查询ID不存在或已过期'
      });
    }

    res.json({
      success: true,
      batchId: batchId,
      ...batchStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get batch query status', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/batch/cancel/{batchId}:
 *   post:
 *     summary: 取消批量查询
 *     description: 取消批量查询中的所有查询
 *     tags: [Batch Query]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *         description: 批量查询ID
 *     responses:
 *       200:
 *         description: 批量查询取消成功
 */
router.post('/cancel/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch ID',
        message: '批量查询ID不能为空'
      });
    }

    // 取消批量查询
    const cancelResult = asyncQueryService.cancelBatchQuery(batchId);

    if (!cancelResult) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found',
        message: '批量查询ID不存在或已过期'
      });
    }

    logger.info('Batch queries cancelled', { batchId, ...cancelResult });

    res.json({
      success: true,
      batchId: batchId,
      ...cancelResult,
      message: '批量查询已取消',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to cancel batch queries', { error: error.message });
    next(error);
  }
});

module.exports = router;