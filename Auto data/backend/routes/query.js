const express = require('express')
const router = express.Router()
const Joi = require('joi')
const logger = require('../utils/logger')
const athenaService = require('../services/athenaService')
const sqlGenerator = require('../services/sqlGenerator')
const queryOptimizer = require('../services/queryOptimizer')
const memoryManager = require('../services/memoryManager')
const pythonCodeGenerator = require('../services/pythonCodeGenerator')
const pythonExecutor = require('../services/pythonExecutor')
// 认证中间件已移除

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

// 新增Python查询schema
const pythonQuerySchema = Joi.object({
  query: Joi.string().required().min(1).max(2000),
  options: Joi.object({
    limit: Joi.number().integer().min(1).max(100000).default(1000),
    splitThreshold: Joi.number().integer().min(10000).max(1000000).default(100000),
    maxReturnRows: Joi.number().integer().min(100).max(50000).default(10000),
    timeout: Joi.number().integer().min(5000).max(600000).default(300000),
    optimize: Joi.boolean().default(true)
  }).default({})
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

// 执行查询（带内存优化）
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

    // 优化查询（内存感知）
    const optimizationResult = queryOptimizer.optimizeQuery(sql, 'memory', {
      maxRows: options.maxRows || 50000,
      removeUnnecessarySorting: true,
      optimizeSelect: true
    })
    
    // 检查内存限制
    const memoryStatus = memoryManager.getMemoryStatus()
    const availableMemory = memoryStatus.limits.safeThreshold - memoryStatus.process.heapUsed
    
    if (!queryOptimizer.isQuerySuitableForMemory(optimizationResult.sql, availableMemory)) {
      return res.status(400).json({
        success: false,
        message: '查询所需内存超过系统限制，请简化查询或分批执行',
        requestId: req.requestId,
        memoryStatus: {
          available: availableMemory,
          required: memoryManager.estimateQueryMemory(optimizationResult.sql),
          currentUsage: memoryStatus.process.heapUsed
        },
        suggestions: queryOptimizer.generateOptimizationSuggestions(optimizationResult.analysis)
      })
    }

    // 执行优化后的查询
    const result = await athenaService.executeQuery(optimizationResult.sql, {
      database: database || process.env.ATHENA_DATABASE,
      requestId: req.requestId,
      ...options,
      expectedRows: options.maxRows || 50000
    })

    // 记录查询日志
    logger.logQuery(req.requestId, {
      queryId: result.queryId,
      sql: optimizationResult.sql,
      executionTime: result.executionTime,
      dataScanned: result.dataScanned,
      cost: result.cost,
      recordCount: result.recordCount,
      memoryUsage: result.memoryUsage
    })

    res.json({
      success: true,
      data: {
        ...result,
        optimization: {
          applied: optimizationResult.changes.length > 0,
          changes: optimizationResult.changes,
          memoryReduction: optimizationResult.memoryReduction,
          originalSqlLength: sql.length,
          optimizedSqlLength: optimizationResult.sql.length
        }
      },
      requestId: req.requestId
    })

  } catch (error) {
    next(error)
  }
})

// 分割查询
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

// Python查询 - 生成并执行
router.post('/python-query', async (req, res, next) => {
  try {
    const { error, value } = pythonQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.details
      })
    }

    const { query, options } = value
    const requestId = req.requestId

    logger.info('Python query request', { 
      requestId, 
      query: query.substring(0, 100),
      dbType: process.env.DB_TYPE || 'mysql'
    })

    // 1. 生成Python代码（使用环境变量配置）
    const codeGenResult = await pythonCodeGenerator.generatePythonCode(
      query, 
      null, // 不再传递数据库配置，由服务内部从环境变量读取
      options
    )

    logger.info('Python code generated', { 
      requestId,
      intent: codeGenResult.intent,
      estimatedRows: codeGenResult.estimated_rows,
      requiresSplit: codeGenResult.requires_split
    })

    // 2. 执行Python代码
    let executionResult
    if (codeGenResult.requires_split) {
      // 需要拆分执行
      const splitSuggestions = codeGenResult.split_suggestions || [{
        type: 'limit',
        estimated_parts: Math.ceil(codeGenResult.estimated_rows / options.splitThreshold)
      }]
      
      executionResult = await pythonExecutor.executeSplitQuery(
        codeGenResult.python_code,
        splitSuggestions[0],
        {
          maxChunkSize: options.splitThreshold,
          timeout: options.timeout
        }
      )
    } else {
      // 直接执行
      executionResult = await pythonExecutor.executePythonCode(
        codeGenResult.python_code,
        {
          timeout: options.timeout
        }
      )
    }

    logger.info('Python query completed', { 
      requestId,
      success: executionResult.success,
      rowCount: executionResult.row_count,
      executionTime: executionResult.execution_time
    })

    // 3. 返回结果
    res.json({
      success: true,
      data: {
        query_result: executionResult,
        code_info: {
          intent: codeGenResult.intent,
          sql_query: codeGenResult.sql_query,
          estimated_time: codeGenResult.estimated_time,
          requires_split: codeGenResult.requires_split
        },
        execution_info: {
          execution_id: executionResult.execution_id,
          execution_time: executionResult.execution_time,
          memory_usage: executionResult.memory_usage
        }
      }
    })

  } catch (error) {
    logger.error('Python query failed', { 
      requestId: req.requestId,
      error: error.message 
    })
    next(error)
  }
})

// Python环境检查
router.get('/python-env', async (req, res, next) => {
  try {
    const requestId = req.requestId
    
    logger.info('Python environment check request', { requestId })
    
    const envInfo = await pythonExecutor.checkPythonEnvironment()
    
    logger.info('Python environment check completed', { 
      requestId,
      pythonVersion: envInfo.python_version?.split(' ')[0],
      availableModules: envInfo.available_modules?.length
    })
    
    res.json({
      success: true,
      data: envInfo
    })
    
  } catch (error) {
    logger.error('Python environment check failed', { 
      requestId: req.requestId,
      error: error.message 
    })
    next(error)
  }
})

// 生成Python代码（不执行）
router.post('/generate-python', async (req, res, next) => {
  try {
    const { error, value } = pythonQuerySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.details
      })
    }

    const { query, options } = value
    const requestId = req.requestId

    logger.info('Generate Python code request', { 
      requestId, 
      query: query.substring(0, 100),
      dbType: process.env.DB_TYPE || 'mysql'
    })

    // 生成Python代码（使用环境变量配置）
    const result = await pythonCodeGenerator.generatePythonCode(
      query, 
      null, // 不再传递数据库配置，由服务内部从环境变量读取
      options
    )

    logger.info('Python code generation completed', { 
      requestId,
      intent: result.intent,
      estimatedRows: result.estimated_rows,
      codeLength: result.python_code.length
    })

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Python code generation failed', { 
      requestId: req.requestId,
      error: error.message 
    })
    next(error)
  }
})

// 查询状态
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

/**
 * 获取内存状态
 */
router.get('/memory/status', (req, res) => {
  try {
    const status = memoryManager.getMemoryStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get memory status', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Failed to get memory status: ${error.message}`
    });
  }
});

/**
 * 获取查询优化建议
 */
router.post('/optimize/suggestions', (req, res) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        message: 'SQL query is required for optimization suggestions'
      });
    }
    
    const analysis = queryOptimizer.analyzeQuery(sql);
    const suggestions = queryOptimizer.generateOptimizationSuggestions(analysis);
    
    res.json({
      success: true,
      data: {
        analysis,
        suggestions,
        memoryEstimate: memoryManager.estimateQueryMemory(sql)
      }
    });
    
  } catch (error) {
    logger.error('Failed to generate optimization suggestions', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Failed to generate optimization suggestions: ${error.message}`
    });
  }
});

/**
 * 优化查询
 */
router.post('/optimize', (req, res) => {
  try {
    const { sql, strategy = 'balanced', options = {} } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        message: 'SQL query is required for optimization'
      });
    }
    
    const result = queryOptimizer.optimizeQuery(sql, strategy, options);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Failed to optimize query', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Failed to optimize query: ${error.message}`
    });
  }
});

/**
 * 批量获取查询结果文件大小
 * POST /api/query/file-size/batch
 */
router.post('/file-size/batch', async (req, res, next) => {
  try {
    const { queryIds } = req.body;
    const requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    logger.info('Getting batch file sizes', { requestId, count: queryIds.length });

    const results = [];
    
    // 并行处理所有查询（但限制并发数，避免过多S3请求）
    const batchSize = 10; // 每批处理10个
    for (let i = 0; i < queryIds.length; i += batchSize) {
      const batch = queryIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (queryId) => {
        try {
          // 获取文件大小
          const fileSize = await athenaService.getResultFileSizeByQueryId(queryId);
          
          if (!fileSize) {
            return {
              queryId,
              success: false,
              error: 'File not found',
              message: '未找到查询结果文件'
            };
          }

          // 获取处理建议
          const recommendation = athenaService.getProcessingRecommendation(fileSize.totalSizeMB);

          return {
            queryId,
            success: true,
            fileSize: {
              totalSizeBytes: fileSize.totalSizeBytes,
              totalSizeMB: fileSize.totalSizeMB,
              totalSizeGB: fileSize.totalSizeGB,
              fileCount: fileSize.fileCount,
              formattedSize: fileSize.formattedSize,
              contentType: fileSize.contentType,
              lastModified: fileSize.lastModified
            },
            recommendation: recommendation,
            bucket: fileSize.bucket,
            fileKey: fileSize.fileKey
          };

        } catch (error) {
          logger.error('Failed to get file size for query', { requestId, queryId, error: error.message });
          return {
            queryId,
            success: false,
            error: error.message,
            message: '获取文件大小失败'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return res.json({
      success: true,
      data: results,
      totalQueries: queryIds.length,
      successfulQueries: results.filter(r => r.success).length,
      failedQueries: results.filter(r => !r.success).length,
      requestId
    });

  } catch (error) {
    logger.error('Batch file size API error', { requestId: req.requestId, error: error.message });
    next(error);
  }
});

module.exports = router