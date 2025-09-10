const express = require('express');
const Joi = require('joi');
const path = require('path');
const fs = require('fs').promises;
const exportService = require('../services/exportService');
const logger = require('../utils/logger');

const router = express.Router();

// 请求验证schemas
const exportSchema = Joi.object({
  data: Joi.array().items(Joi.object()).required(),
  format: Joi.string().valid('excel', 'csv').default('excel'),
  options: Joi.object({
    filename: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).default(`export_${Date.now()}`),
    sheetName: Joi.string().default('Query Results'),
    strategy: Joi.string().valid('auto', 'single', 'multi-sheet', 'multi-file').default('auto'),
    maxRowsPerSheet: Joi.number().integer().min(1000).max(1048576).default(1000000),
    maxRowsPerFile: Joi.number().integer().min(1000).max(10000000).default(1000000),
    includeMetadata: Joi.boolean().default(true)
  }).default({})
});

const exportQueryResultSchema = Joi.object({
  queryId: Joi.string().required(),
  format: Joi.string().valid('excel', 'csv').default('excel'),
  options: Joi.object({
    filename: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/),
    sheetName: Joi.string().default('Query Results'),
    strategy: Joi.string().valid('auto', 'single', 'multi-sheet', 'multi-file').default('auto'),
    maxRowsPerSheet: Joi.number().integer().min(1000).max(1048576).default(1000000),
    maxRowsPerFile: Joi.number().integer().min(1000).max(10000000).default(1000000),
    includeMetadata: Joi.boolean().default(true)
  }).default({})
});

/**
 * POST /api/export/data
 * 导出数据
 */
router.post('/data', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证请求参数
    const { error, value } = exportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid request parameters: ${error.details[0].message}`,
        requestId
      });
    }

    const { data, format, options } = value;
    
    // 检查数据是否为空
    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data provided for export',
        requestId
      });
    }

    logger.logRequest(req, requestId);
    logger.info('Starting data export', { 
      requestId, 
      format, 
      dataLength: data.length,
      options 
    });

    let result;
    const exportOptions = { ...options, requestId };

    // 根据格式选择导出方法
    if (format === 'excel') {
      result = await exportService.exportToExcel(data, exportOptions);
    } else if (format === 'csv') {
      result = await exportService.exportToCSV(data, exportOptions);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // 返回导出结果
    res.json({
      success: true,
      message: 'Data exported successfully',
      requestId,
      data: {
        ...result,
        downloadUrls: result.files.map(file => ({
          filename: file.filename,
          url: `/api/export/download/${encodeURIComponent(file.filename)}`,
          size: file.size,
          rows: file.rows
        }))
      }
    });

    logger.info('Data export completed', { requestId, result });

  } catch (error) {
    logger.error('Data export failed', { requestId, error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: `Export failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * POST /api/export/query-result
 * 导出查询结果
 */
router.post('/query-result', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证请求参数
    const { error, value } = exportQueryResultSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: `Invalid request parameters: ${error.details[0].message}`,
        requestId
      });
    }

    const { queryId, format, options } = value;
    
    logger.logRequest(req, requestId);
    logger.info('Starting query result export', { requestId, queryId, format, options });

    // 这里应该从查询结果缓存或数据库中获取数据
    // 目前使用模拟数据
    const mockData = generateMockQueryResult(queryId);
    
    let result;
    const exportOptions = { 
      ...options, 
      requestId,
      filename: options.filename || `query_${queryId}_${Date.now()}`
    };

    // 根据格式选择导出方法
    if (format === 'excel') {
      result = await exportService.exportToExcel(mockData, exportOptions);
    } else if (format === 'csv') {
      result = await exportService.exportToCSV(mockData, exportOptions);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    // 返回导出结果
    res.json({
      success: true,
      message: 'Query result exported successfully',
      requestId,
      data: {
        ...result,
        queryId,
        downloadUrls: result.files.map(file => ({
          filename: file.filename,
          url: `/api/export/download/${encodeURIComponent(file.filename)}`,
          size: file.size,
          rows: file.rows
        }))
      }
    });

    logger.info('Query result export completed', { requestId, queryId, result });

  } catch (error) {
    logger.error('Query result export failed', { requestId, error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: `Export failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * GET /api/export/files
 * 获取导出文件列表
 */
router.get('/files', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.logRequest(req, requestId);
    
    const files = await exportService.getExportFiles();
    
    res.json({
      success: true,
      message: 'Export files retrieved successfully',
      requestId,
      data: {
        files: files.map(file => ({
          filename: file.filename,
          size: file.size,
          created: file.created,
          modified: file.modified,
          downloadUrl: `/api/export/download/${encodeURIComponent(file.filename)}`
        })),
        totalFiles: files.length
      }
    });

  } catch (error) {
    logger.error('Failed to get export files', { requestId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Failed to get export files: ${error.message}`,
      requestId
    });
  }
});

/**
 * GET /api/export/download/:filename
 * 下载导出文件
 */
router.get('/download/:filename', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { filename } = req.params;
  
  try {
    logger.logRequest(req, requestId);
    
    // 验证文件名安全性
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename',
        requestId
      });
    }

    const filepath = path.join(__dirname, '../services/exports', filename);
    
    // 检查文件是否存在
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        requestId
      });
    }

    // 设置下载响应头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // 发送文件
    res.sendFile(filepath, (err) => {
      if (err) {
        logger.error('File download failed', { requestId, filename, error: err.message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'File download failed',
            requestId
          });
        }
      } else {
        logger.info('File downloaded successfully', { requestId, filename });
      }
    });

  } catch (error) {
    logger.error('File download error', { requestId, filename, error: error.message });
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: `Download failed: ${error.message}`,
        requestId
      });
    }
  }
});

/**
 * DELETE /api/export/cleanup
 * 清理过期文件
 */
router.delete('/cleanup', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.logRequest(req, requestId);
    
    const maxAgeHours = parseInt(req.query.maxAge) || 24;
    const result = await exportService.cleanupOldFiles(maxAgeHours);
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      requestId,
      data: result
    });

    logger.info('File cleanup completed', { requestId, result });

  } catch (error) {
    logger.error('File cleanup failed', { requestId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Cleanup failed: ${error.message}`,
      requestId
    });
  }
});

/**
 * 生成模拟查询结果数据
 */
function generateMockQueryResult(queryId) {
  const rowCount = Math.floor(Math.random() * 50000) + 1000; // 1000-51000行
  const data = [];
  
  for (let i = 0; i < rowCount; i++) {
    data.push({
      id: i + 1,
      query_id: queryId,
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      product_name: `Product ${Math.floor(Math.random() * 100)}`,
      category: ['Electronics', 'Clothing', 'Books', 'Home'][Math.floor(Math.random() * 4)],
      price: (Math.random() * 1000).toFixed(2),
      quantity: Math.floor(Math.random() * 100) + 1,
      order_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: ['pending', 'completed', 'cancelled'][Math.floor(Math.random() * 3)],
      revenue: ((Math.random() * 1000) * (Math.floor(Math.random() * 100) + 1)).toFixed(2)
    });
  }
  
  return data;
}

module.exports = router;