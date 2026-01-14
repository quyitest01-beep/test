const express = require('express');
const Joi = require('joi');
const athenaService = require('../services/athenaService');
const logger = require('../utils/logger');

const router = express.Router();

// 请求验证schema
const estimateSchema = Joi.object({
  sql: Joi.string().required(),
  database: Joi.string().default('gmp')
});

/**
 * POST /api/query/estimate
 * 预估查询数据量
 */
router.post('/estimate', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证请求参数
    const { error, value } = estimateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.details[0].message,
        requestId
      });
    }

    const { sql, database } = value;
    
    logger.info('Query estimation started', { 
      service: 'query-backend', 
      requestId, 
      sqlLength: sql.length,
      database 
    });

    // 生成预估查询的SQL
    const estimateSQL = generateEstimateSQL(sql);
    
    // 执行预估查询
    const estimateResult = await athenaService.executeQuery(estimateSQL, database);
    
    if (!estimateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Estimation query failed',
        details: estimateResult.error,
        requestId
      });
    }

    const estimatedRows = estimateResult.data[0]?.count || 0;
    const estimatedSize = estimateDataSize(estimatedRows);
    const strategy = determineStrategy(estimatedRows);
    
    const result = {
      success: true,
      estimatedRows: estimatedRows,
      estimatedSize: estimatedSize,
      recommendedStrategy: strategy.strategy,
      batchSize: strategy.batchSize,
      estimatedBatches: strategy.estimatedBatches,
      maxRows: strategy.maxRows,
      requestId,
      message: `预估完成: ${estimatedRows} 行数据, 建议使用 ${strategy.strategy} 策略`
    };

    logger.info('Query estimation completed', { 
      service: 'query-backend', 
      requestId, 
      estimatedRows,
      strategy: strategy.strategy 
    });

    res.json(result);

  } catch (error) {
    logger.error('Query estimation error', { 
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
 * 生成预估查询的SQL
 */
function generateEstimateSQL(originalSQL) {
  // 将原始SQL转换为COUNT查询
  const sql = originalSQL.toLowerCase();
  
  // 提取FROM子句
  const fromMatch = sql.match(/from\s+([^\s]+)/);
  if (!fromMatch) {
    throw new Error('Invalid SQL: No FROM clause found');
  }
  
  const tableName = fromMatch[1];
  
  // 提取WHERE子句
  const whereMatch = sql.match(/where\s+(.+?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/i);
  const whereClause = whereMatch ? whereMatch[1] : '';
  
  // 构建COUNT查询
  let countSQL = `SELECT COUNT(*) as count FROM ${tableName}`;
  if (whereClause) {
    countSQL += ` WHERE ${whereClause}`;
  }
  
  return countSQL;
}

/**
 * 估算数据大小
 */
function estimateDataSize(rowCount) {
  // 假设平均每行 1KB
  const avgRowSize = 1024; // bytes
  const totalBytes = rowCount * avgRowSize;
  
  if (totalBytes < 1024) {
    return `${totalBytes} B`;
  } else if (totalBytes < 1024 * 1024) {
    return `${(totalBytes / 1024).toFixed(1)} KB`;
  } else if (totalBytes < 1024 * 1024 * 1024) {
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

/**
 * 确定执行策略
 */
function determineStrategy(rowCount) {
  if (rowCount <= 1000) {
    return {
      strategy: 'direct',
      batchSize: null,
      estimatedBatches: 1,
      maxRows: rowCount
    };
  } else if (rowCount <= 10000) {
    return {
      strategy: 'batch',
      batchSize: 2000,
      estimatedBatches: Math.ceil(rowCount / 2000),
      maxRows: rowCount
    };
  } else if (rowCount <= 100000) {
    return {
      strategy: 'batch',
      batchSize: 5000,
      estimatedBatches: Math.ceil(rowCount / 5000),
      maxRows: rowCount
    };
  } else if (rowCount <= 1000000) {
    return {
      strategy: 'progressive',
      batchSize: 10000,
      estimatedBatches: Math.ceil(rowCount / 10000),
      maxRows: 500000 // 限制最大行数
    };
  } else {
    return {
      strategy: 'rejected',
      batchSize: null,
      estimatedBatches: 0,
      maxRows: 0
    };
  }
}

module.exports = router;
