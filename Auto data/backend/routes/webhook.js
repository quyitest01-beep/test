/**
 * Webhook API 路由
 * 专门用于外部集成（如 n8n）
 */

const express = require('express')
const router = express.Router()
const Joi = require('joi')
const logger = require('../utils/logger')
const athenaService = require('../services/athenaService')
const pythonCodeGenerator = require('../services/pythonCodeGenerator')
const pythonExecutor = require('../services/pythonExecutor')
const apiKeyAuth = require('../middleware/apiKeyAuth')

// 应用 API Key 认证到所有 webhook 路由
router.use(apiKeyAuth)

// 请求验证 schemas
const sqlQuerySchema = Joi.object({
  sql: Joi.string().required().min(1).max(50000),
  database: Joi.string().optional(),
  timeout: Joi.number().integer().min(1000).max(300000).default(60000),
  maxRows: Joi.number().integer().min(1).max(50000).default(1000)
})

const naturalLanguageQuerySchema = Joi.object({
  query: Joi.string().required().min(1).max(2000),
  timeout: Joi.number().integer().min(5000).max(600000).default(120000),
  maxRows: Joi.number().integer().min(1).max(50000).default(1000)
})

/**
 * Webhook: 执行 SQL 查询
 * POST /api/webhook/query/sql
 * 
 * Headers:
 *   X-API-Key: your-api-key
 * 
 * Body:
 *   {
 *     "sql": "SELECT * FROM table LIMIT 10",
 *     "database": "my_database",  // 可选
 *     "timeout": 60000,            // 可选，默认60秒
 *     "maxRows": 1000              // 可选，默认1000行
 *   }
 */
router.post('/query/sql', async (req, res) => {
  const startTime = Date.now()
  
  try {
    // 验证请求
    const { error, value } = sqlQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: error.details[0].message
      })
    }
    
    const { sql, database, timeout, maxRows } = value
    
    logger.info('Webhook SQL query received', {
      requestId: req.requestId,
      sqlLength: sql.length,
      database
    })
    
    // 执行查询
    const result = await athenaService.executeQuery(sql, {
      database: database || process.env.ATHENA_DATABASE,
      timeout: timeout || 300000, // 默认5分钟超时
      requestId: req.requestId,
      expectedRows: maxRows
    })
    
    // 限制返回行数
    const data = result.data ? result.data.slice(0, maxRows) : []
    
    logger.info('Webhook SQL query completed', {
      requestId: req.requestId,
      executionTime: Date.now() - startTime,
      rowCount: data.length
    })
    
    // 返回简化的响应格式（适合 n8n）
    res.json({
      success: true,
      data: {
        rows: data,
        columns: result.columns || [],
        rowCount: data.length,
        totalRows: result.row_count || data.length,
        executionTime: result.executionTime,
        dataScanned: result.dataScanned,
        cost: result.cost
      },
      meta: {
        queryId: result.queryId,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    logger.error('Webhook SQL query failed', {
      requestId: req.requestId,
      error: error.message
    })
    
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: error.message,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    })
  }
})

/**
 * Webhook: 自然语言查询
 * POST /api/webhook/query/natural
 * 
 * Headers:
 *   X-API-Key: your-api-key
 * 
 * Body:
 *   {
 *     "query": "查询最近7天的活跃用户数",
 *     "timeout": 120000,           // 可选，默认120秒
 *     "maxRows": 1000              // 可选，默认1000行
 *   }
 */
router.post('/query/natural', async (req, res) => {
  const startTime = Date.now()
  
  try {
    // 验证请求
    const { error, value } = naturalLanguageQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: error.details[0].message
      })
    }
    
    const { query, timeout, maxRows } = value
    
    logger.info('Webhook natural language query received', {
      requestId: req.requestId,
      query: query.substring(0, 100)
    })
    
    // 生成 Python 代码
    const codeGenResult = await pythonCodeGenerator.generatePythonCode(
      query,
      null,
      { limit: maxRows }
    )
    
    // 执行查询
    const executionResult = await pythonExecutor.executePythonCode(
      codeGenResult.python_code,
      { timeout }
    )
    
    if (!executionResult.success) {
      throw new Error(executionResult.error || 'Query execution failed')
    }
    
    // 限制返回行数
    const data = executionResult.result ? executionResult.result.slice(0, maxRows) : []
    
    logger.info('Webhook natural language query completed', {
      requestId: req.requestId,
      executionTime: Date.now() - startTime,
      rowCount: data.length
    })
    
    // 返回简化的响应格式
    res.json({
      success: true,
      data: {
        rows: data,
        columns: executionResult.columns || [],
        rowCount: data.length,
        totalRows: executionResult.row_count || data.length,
        executionTime: executionResult.execution_time,
        generatedSQL: codeGenResult.sql_query
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        intent: codeGenResult.intent
      }
    })
    
  } catch (error) {
    logger.error('Webhook natural language query failed', {
      requestId: req.requestId,
      error: error.message
    })
    
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: error.message,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    })
  }
})

/**
 * Webhook: 快速查询（简化版本，适合简单查询）
 * GET /api/webhook/query/quick?sql=SELECT * FROM table LIMIT 10&apiKey=your-key
 * 
 * Query Parameters:
 *   sql: SQL查询语句（必需）
 *   database: 数据库名（可选）
 *   apiKey: API密钥（可选，也可以用header）
 */
router.get('/query/quick', async (req, res) => {
  try {
    const { sql, database } = req.query
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'SQL query is required'
      })
    }
    
    logger.info('Webhook quick query received', {
      requestId: req.requestId,
      sqlLength: sql.length
    })
    
    // 执行查询（使用默认配置）
    const result = await athenaService.executeQuery(sql, {
      database: database || process.env.ATHENA_DATABASE,
      timeout: 30000,
      requestId: req.requestId,
      expectedRows: 100
    })
    
    // 限制返回100行
    const data = result.data ? result.data.slice(0, 100) : []
    
    res.json({
      success: true,
      data: {
        rows: data,
        rowCount: data.length
      }
    })
    
  } catch (error) {
    logger.error('Webhook quick query failed', {
      requestId: req.requestId,
      error: error.message
    })
    
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: error.message
    })
  }
})

/**
 * 健康检查
 * GET /api/webhook/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'webhook-api',
    timestamp: new Date().toISOString()
  })
})

module.exports = router

