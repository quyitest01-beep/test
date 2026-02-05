const express = require('express');
const Joi = require('joi');
const athenaService = require('../services/athenaService');
const exportService = require('../services/exportService');
const logger = require('../utils/logger');

const router = express.Router();

// 请求验证schema
const progressiveQuerySchema = Joi.object({
  sql: Joi.string().required(),
  database: Joi.string().default('gmp'),
  progressiveOptions: Joi.object({
    initialLimit: Joi.number().integer().min(1000).max(50000).default(10000),
    maxLimit: Joi.number().integer().min(10000).max(1000000).default(100000),
    stepSize: Joi.number().integer().min(1000).max(10000).default(5000),
    autoExport: Joi.boolean().default(true)
  }).default({})
});

/**
 * POST /api/query/progressive
 * 渐进式查询执行
 */
router.post('/progressive', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证请求参数
    const { error, value } = progressiveQuerySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.details[0].message,
        requestId
      });
    }

    const { sql, database, progressiveOptions } = value;
    const { initialLimit, maxLimit, stepSize, autoExport } = progressiveOptions;
    
    logger.info('Progressive query started', { 
      service: 'query-backend', 
      requestId, 
      sqlLength: sql.length,
      database,
      initialLimit,
      maxLimit
    });

    // 生成带LIMIT的SQL
    const limitedSQL = addLimitToSQL(sql, initialLimit);
    
    // 执行查询
    const queryResult = await athenaService.executeQuery(limitedSQL, database);
    
    if (!queryResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Query execution failed',
        details: queryResult.error,
        requestId
      });
    }

    const data = queryResult.data || [];
    const actualRows = data.length;
    const hasMore = actualRows >= initialLimit;
    
    let exportResult = null;
    let downloadUrl = null;
    
    // 如果启用自动导出
    if (autoExport && data.length > 0) {
      try {
        const filename = `progressive_query_${requestId}_${Date.now()}`;
        exportResult = await exportService.exportToExcel(data, {
          filename: filename,
          sheetName: 'Progressive Query Results',
          includeMetadata: true,
          requestId: requestId
        });
        
        if (exportResult.success) {
          downloadUrl = exportResult.downloadUrl;
        }
      } catch (exportError) {
        logger.warn('Export failed during progressive query', {
          service: 'query-backend',
          requestId,
          error: exportError.message
        });
      }
    }

    const result = {
      success: true,
      data: data,
      totalRows: actualRows,
      hasMore: hasMore,
      currentLimit: initialLimit,
      nextLimit: hasMore ? Math.min(initialLimit + stepSize, maxLimit) : null,
      maxLimit: maxLimit,
      downloadUrl: downloadUrl,
      requestId,
      message: `渐进式查询完成: ${actualRows} 行数据${hasMore ? ', 还有更多数据' : ''}`
    };

    logger.info('Progressive query completed', { 
      service: 'query-backend', 
      requestId, 
      actualRows,
      hasMore,
      exported: !!downloadUrl
    });

    res.json(result);

  } catch (error) {
    logger.error('Progressive query error', { 
      service: 'query-backend', 
      requestId, 
      error: error.message 
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      requestId
    });
  }
});

/**
 * 为SQL添加LIMIT子句
 */
function addLimitToSQL(sql, limit) {
  const sqlLower = sql.toLowerCase();
  
  // 如果已经有LIMIT，替换它
  if (sqlLower.includes('limit')) {
    return sql.replace(/limit\s+\d+/i, `LIMIT ${limit}`);
  } else {
    // 添加LIMIT子句
    return `${sql} LIMIT ${limit}`;
  }
}

/**
 * GET /api/query/progressive/next
 * 获取下一批数据
 */
router.post('/next', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { sql, database, currentLimit, stepSize, maxLimit } = req.body;
    
    if (!sql || !currentLimit || !stepSize) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        requestId
      });
    }

    const nextLimit = Math.min(currentLimit + stepSize, maxLimit);
    const limitedSQL = addLimitToSQL(sql, nextLimit);
    
    logger.info('Progressive query next batch', { 
      service: 'query-backend', 
      requestId, 
      currentLimit,
      nextLimit
    });

    const queryResult = await athenaService.executeQuery(limitedSQL, database);
    
    if (!queryResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Next batch query failed',
        details: queryResult.error,
        requestId
      });
    }

    const data = queryResult.data || [];
    const actualRows = data.length;
    const hasMore = actualRows >= nextLimit && nextLimit < maxLimit;
    
    const result = {
      success: true,
      data: data,
      totalRows: actualRows,
      hasMore: hasMore,
      currentLimit: nextLimit,
      nextLimit: hasMore ? Math.min(nextLimit + stepSize, maxLimit) : null,
      requestId,
      message: `下一批数据: ${actualRows} 行${hasMore ? ', 还有更多' : ', 已全部完成'}`
    };

    res.json(result);

  } catch (error) {
    logger.error('Progressive query next batch error', { 
      service: 'query-backend', 
      requestId, 
      error: error.message 
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      requestId
    });
  }
});

module.exports = router;











