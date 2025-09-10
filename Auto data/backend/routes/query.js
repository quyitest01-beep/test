const express = require('express')
const router = express.Router()
const Joi = require('joi')
const logger = require('../utils/logger')
const athenaService = require('../services/athenaService')
const sqlGenerator = require('../services/sqlGenerator')

// 请求验证schemas
const generateSQLSchema = Joi.object({
  queryText: Joi.string().required().min(1).max(1000),
  database: Joi.string().optional(),
  options: Joi.object({
    limit: Joi.number().integer().min(1).max(10000).default(1000),
    optimize: Joi.boolean().default(true)
  }).optional()
})

const executeQuerySchema = Joi.object({
  sql: Joi.string().required().min(1).max(10000),
  database: Joi.string().optional(),
  options: Joi.object({
    timeout: Joi.number().integer().min(1000).max(300000).default(60000),
    maxCost: Joi.number().min(0).max(100).default(10)
  }).optional()
})

const splitQuerySchema = Joi.object({
  sql: Joi.string().required(),
  originalQuery: Joi.string().required(),
  recordCount: Joi.number().integer().min(1).required(),
  options: Joi.object({
    batchSize: Joi.number().integer().min(1000).max(100000).default(50000),
    strategy: Joi.string().valid('date_range', 'id_range', 'hash_partition').default('date_range')
  }).optional()
})

// 生成SQL
router.post('/generate-sql', async (req, res, next) => {
  try {
    // 验证请求参数
    const { error, value } = generateSQLSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        details: error.details[0].message,
        requestId: req.requestId
      })
    }

    const { queryText, database, options = {} } = value
    
    logger.info('Generating SQL', { 
      requestId: req.requestId, 
      queryText: queryText.substring(0, 100) + (queryText.length > 100 ? '...' : ''),
      database 
    })

    // 生成SQL
    const result = await sqlGenerator.generateSQL(queryText, {
      database: database || process.env.ATHENA_DATABASE,
      ...options
    })

    logger.info('SQL generated successfully', { 
      requestId: req.requestId, 
      estimatedCost: result.estimated_cost,
      estimatedTime: result.estimated_time 
    })

    res.json({
      success: true,
      data: result,
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

// 执行查询
router.post('/execute', async (req, res, next) => {
  try {
    // 验证请求参数
    const { error, value } = executeQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        details: error.details[0].message,
        requestId: req.requestId
      })
    }

    const { sql, database, options = {} } = value
    
    logger.info('Executing query', { 
      requestId: req.requestId, 
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      database 
    })

    // 执行查询
    const result = await athenaService.executeQuery(sql, {
      database: database || process.env.ATHENA_DATABASE,
      requestId: req.requestId,
      ...options
    })

    // 记录查询日志
    logger.logQuery(req.requestId, {
      queryId: result.queryId,
      sql,
      executionTime: result.executionTime,
      dataScanned: result.dataScanned,
      cost: result.cost,
      recordCount: result.recordCount
    })

    res.json({
      success: true,
      data: result,
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

// 拆分查询（处理大数据集）
router.post('/split', async (req, res, next) => {
  try {
    // 验证请求参数
    const { error, value } = splitQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        details: error.details[0].message,
        requestId: req.requestId
      })
    }

    const { sql, originalQuery, recordCount, options = {} } = value
    
    logger.info('Splitting large query', { 
      requestId: req.requestId, 
      recordCount,
      strategy: options.strategy 
    })

    // 拆分查询
    const result = await athenaService.splitQuery({
      sql,
      originalQuery,
      recordCount,
      requestId: req.requestId,
      ...options
    })

    logger.info('Query split completed', { 
      requestId: req.requestId, 
      batchCount: result.batchCount,
      totalRecords: result.totalRecords 
    })

    res.json({
      success: true,
      data: result,
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

// 获取查询状态
router.get('/status/:queryId', async (req, res, next) => {
  try {
    const { queryId } = req.params
    
    if (!queryId) {
      return res.status(400).json({
        success: false,
        message: 'Query ID is required',
        requestId: req.requestId
      })
    }

    logger.info('Checking query status', { requestId: req.requestId, queryId })

    const status = await athenaService.getQueryStatus(queryId)

    res.json({
      success: true,
      data: status,
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

// 取消查询
router.post('/cancel/:queryId', async (req, res, next) => {
  try {
    const { queryId } = req.params
    
    if (!queryId) {
      return res.status(400).json({
        success: false,
        message: 'Query ID is required',
        requestId: req.requestId
      })
    }

    logger.info('Cancelling query', { requestId: req.requestId, queryId })

    await athenaService.cancelQuery(queryId)

    res.json({
      success: true,
      message: 'Query cancelled successfully',
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

module.exports = router