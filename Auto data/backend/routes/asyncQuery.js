/**
 * 异步查询路由
 */

const express = require('express')
const router = express.Router()
const Joi = require('joi')
const asyncQueryService = require('../services/asyncQueryService')
const logger = require('../utils/logger')

// 验证模式
const asyncQuerySchema = Joi.object({
  sql: Joi.string().required().min(1).max(50000),
  database: Joi.string().optional(),
  maxRetries: Joi.number().integer().min(0).max(5).default(3),
  options: Joi.object().optional()
})

/**
 * 启动异步查询
 * POST /api/async/start
 */
router.post('/start', async (req, res, next) => {
  try {
    const { error, value } = asyncQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: error.details[0].message
      })
    }

    const { sql, database, maxRetries, options = {} } = value

    logger.info('Starting async query', { 
      database,
      maxRetries,
      sqlLength: sql.length
    })

    // 启动异步查询
    const result = await asyncQueryService.startAsyncQuery(sql, {
      database,
      maxRetries,
      ...options
    })

    res.json({
      success: true,
      queryId: result.queryId,
      status: result.status,
      message: result.message,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to start async query', { error: error.message })
    next(error)
  }
})

/**
 * 查询异步查询状态
 * GET /api/async/status/:queryId
 */
router.get('/status/:queryId', async (req, res, next) => {
  try {
    const { queryId } = req.params

    if (!queryId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query ID',
        message: '查询ID不能为空'
      })
    }

    // 获取查询状态
    const status = asyncQueryService.getQueryStatus(queryId)

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
        message: '查询ID不存在或已过期'
      })
    }

    res.json({
      success: true,
      queryId: queryId,
      ...status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to get query status', { error: error.message })
    next(error)
  }
})

/**
 * 取消异步查询
 * POST /api/async/cancel/:queryId
 */
router.post('/cancel/:queryId', async (req, res, next) => {
  try {
    const { queryId } = req.params

    if (!queryId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query ID',
        message: '查询ID不能为空'
      })
    }

    // 取消查询
    const result = asyncQueryService.cancelQuery(queryId)

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
        message: '查询ID不存在或已过期'
      })
    }

    logger.info('Query cancelled', { queryId })

    res.json({
      success: true,
      queryId: queryId,
      message: '查询已取消',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to cancel query', { error: error.message })
    next(error)
  }
})

module.exports = router

