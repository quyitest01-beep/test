const express = require('express');
const Joi = require('joi');
const asyncQueryService = require('../services/asyncQueryService');
const logger = require('../utils/logger');

const router = express.Router();

// 验证模式
const asyncQuerySchema = Joi.object({
  sql: Joi.string().required().min(1).max(10000),
  database: Joi.string().optional(),
  maxRetries: Joi.number().integer().min(0).max(5).default(3),
  options: Joi.object().optional()
});

const queryStatusSchema = Joi.object({
  queryId: Joi.string().uuid().required()
});

/**
 * @swagger
 * /api/async/start:
 *   post:
 *     summary: 启动异步查询
 *     description: 启动一个异步查询，立即返回查询ID，可通过状态接口查询进度
 *     tags: [Async Query]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sql
 *             properties:
 *               sql:
 *                 type: string
 *                 description: SQL查询语句
 *                 example: "SELECT * FROM game_records WHERE id = '123'"
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
 *         description: 查询启动成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 queryId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 estimatedTime:
 *                   type: string
 */
router.post('/start', async (req, res, next) => {
  try {
    const { error, value } = asyncQuerySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: error.details[0].message
      });
    }

    const { sql, database, maxRetries, options = {} } = value;

    logger.info('Starting async query', { 
      sqlLength: sql.length,
      database,
      maxRetries 
    });

    // 启动异步查询
    const result = await asyncQueryService.startAsyncQuery(sql, {
      database,
      maxRetries,
      ...options
    });

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to start async query', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/async/status/{queryId}:
 *   get:
 *     summary: 查询异步查询状态
 *     description: 根据查询ID获取查询执行状态和结果
 *     tags: [Async Query]
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 查询ID
 *     responses:
 *       200:
 *         description: 查询状态获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 queryId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending, running, retrying, completed, failed, timeout]
 *                 elapsed:
 *                   type: number
 *                 progress:
 *                   type: number
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   description: 查询结果（仅当status为completed时返回）
 *       404:
 *         description: 查询ID不存在
 */
router.get('/status/:queryId', async (req, res, next) => {
  try {
    const { error, value } = queryStatusSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query ID',
        message: error.details[0].message
      });
    }

    const { queryId } = value;
    const status = asyncQueryService.getQueryStatus(queryId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
        message: '查询ID不存在或已过期'
      });
    }

    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get query status', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/async/cancel/{queryId}:
 *   post:
 *     summary: 取消异步查询
 *     description: 取消正在执行的异步查询
 *     tags: [Async Query]
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 查询ID
 *     responses:
 *       200:
 *         description: 查询取消成功
 *       404:
 *         description: 查询ID不存在
 */
router.post('/cancel/:queryId', async (req, res, next) => {
  try {
    const { error, value } = queryStatusSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query ID',
        message: error.details[0].message
      });
    }

    const { queryId } = value;
    const status = asyncQueryService.getQueryStatus(queryId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
        message: '查询ID不存在或已过期'
      });
    }

    if (['completed', 'failed', 'timeout'].includes(status.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel',
        message: '查询已完成，无法取消'
      });
    }

    // 更新状态为取消
    asyncQueryService.updateQueryStatus(queryId, 'cancelled', {
      error: '查询已被用户取消'
    });

    logger.info('Query cancelled by user', { queryId });

    res.json({
      success: true,
      message: '查询已取消',
      queryId: queryId
    });

  } catch (error) {
    logger.error('Failed to cancel query', { error: error.message });
    next(error);
  }
});

/**
 * @swagger
 * /api/async/list:
 *   get:
 *     summary: 获取所有异步查询列表
 *     description: 获取当前所有异步查询的状态列表
 *     tags: [Async Query]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, retrying, completed, failed, timeout, cancelled]
 *         description: 按状态筛选
 *     responses:
 *       200:
 *         description: 查询列表获取成功
 */
router.get('/list', async (req, res, next) => {
  try {
    const { status: filterStatus } = req.query;
    
    // 这里需要实现获取所有查询的方法
    // 为了简化，我们先返回成功响应
    res.json({
      success: true,
      message: '异步查询列表功能开发中',
      queries: [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get query list', { error: error.message });
    next(error);
  }
});

module.exports = router;












