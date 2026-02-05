const express = require('express');
const Joi = require('joi');
const path = require('path');
const fs = require('fs').promises;
const exportService = require('../services/exportService');
const logger = require('../utils/logger');
// 认证中间件已移除

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

    // 从异步查询服务获取真实查询结果
    const asyncQueryService = require('../services/asyncQueryService');
    const athenaService = require('../services/athenaService');
    
    let queryStatus = await asyncQueryService.getQueryStatus(queryId);
    let queryData = [];
    
    if (!queryStatus || queryStatus.status !== 'completed') {
      // 如果本地缓存中没有找到，尝试直接从Athena获取
      logger.info('Query not found in local cache, attempting to get from Athena', { requestId, queryId });
      try {
        const athenaResult = await athenaService.getQueryResults(queryId);
        queryData = athenaResult.data || [];
        logger.info('Successfully retrieved query results from Athena', { requestId, queryId, rowCount: queryData.length });
      } catch (athenaError) {
        logger.error('Failed to get results from Athena', { requestId, queryId, error: athenaError.message });
        return res.status(404).json({
          success: false,
          message: 'Query not found or not completed',
          requestId
        });
      }
    } else {
      // 从本地缓存获取数据
      queryData = queryStatus.result?.data || [];
    }
    
    let result;
    const exportOptions = { 
      ...options, 
      requestId,
      filename: options.filename || `query_${queryId}_${Date.now()}`
    };

    // 根据格式选择导出方法
    if (format === 'excel') {
      result = await exportService.exportToExcel(queryData, exportOptions);
    } else if (format === 'csv') {
      result = await exportService.exportToCSV(queryData, exportOptions);
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

    const filepath = path.join(__dirname, '../exports', filename);
    
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
    // 清理filename，移除非法字符
    let safeFilename = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 替换非法字符
      .replace(/[^\x20-\x7E]/g, '_')  // 替换所有非ASCII字符（包括中文）
      .replace(/\s+/g, '_')  // 替换空格
      .substring(0, 200);  // 限制长度
    
    // 对原始filename进行URL编码以支持中文和特殊字符
    const encodedFilename = encodeURIComponent(filename.substring(0, 200));
    
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
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
 * POST /api/export/read-csv
 * 读取CSV文件内容
 */
router.post('/read-csv', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { filepath, filename } = req.body;
    
    if (!filepath || !filename) {
      return res.status(400).json({
        success: false,
        message: 'filepath and filename are required',
        requestId
      });
    }

    logger.logRequest(req, requestId);
    logger.info('Reading CSV file', { requestId, filepath, filename });

    // 读取CSV文件
    const csvContent = await fs.readFile(filepath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.json({
        success: true,
        message: 'CSV file is empty',
        requestId,
        data: []
      });
    }

    // 解析CSV
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });
        rows.push(row);
      }
    }

    res.json({
      success: true,
      message: 'CSV file read successfully',
      requestId,
      data: {
        headers,
        rows,
        totalRows: rows.length
      }
    });

    logger.info('CSV file read completed', { requestId, totalRows: rows.length });

  } catch (error) {
    logger.error('CSV file read failed', { requestId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: `Failed to read CSV file: ${error.message}`,
      requestId
    });
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

/**
 * POST /api/export/batch-download
 * 批量下载多个文件
 */
router.post('/batch-download', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { urls, format = 'zip' } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'urls must be a non-empty array',
        requestId
      });
    }
    
    if (urls.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 URLs allowed per batch',
        requestId
      });
    }
    
    logger.info('Starting batch download', { requestId, urlCount: urls.length, format });
    
    const downloadResults = [];
    
    // 处理每个URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        // 从URL中提取文件名
        const filename = url.split('/').pop();
        const filepath = path.join(__dirname, '../exports', filename);
        
        // 检查文件是否存在
        try {
          await fs.access(filepath);
          const stats = await fs.stat(filepath);
          
          downloadResults.push({
            url: url,
            filename: filename,
            size: stats.size,
            exists: true,
            success: true
          });
        } catch (fileError) {
          downloadResults.push({
            url: url,
            filename: filename,
            exists: false,
            success: false,
            error: 'File not found'
          });
        }
      } catch (error) {
        logger.error('Failed to process URL in batch download', { requestId, url, error: error.message });
        downloadResults.push({
          url: url,
          success: false,
          error: error.message
        });
      }
    }
    
    const successfulDownloads = downloadResults.filter(r => r.success && r.exists);
    const failedDownloads = downloadResults.filter(r => !r.success || !r.exists);
    
    res.json({
      success: true,
      message: `Batch download completed: ${successfulDownloads.length} successful, ${failedDownloads.length} failed`,
      requestId,
      data: {
        totalUrls: urls.length,
        successful: successfulDownloads.length,
        failed: failedDownloads.length,
        results: downloadResults,
        downloadUrls: successfulDownloads.map(r => ({
          filename: r.filename,
          url: `/api/export/download/${encodeURIComponent(r.filename)}`,
          size: r.size
        }))
      }
    });
    
  } catch (error) {
    logger.error('Batch download failed', { requestId, error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: `Batch download failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * POST /api/export/batch-query-result
 * 批量导出查询结果
 */
router.post('/batch-query-result', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证请求参数
    const { queryIds, format = 'csv', options = {} } = req.body;
    
    if (!Array.isArray(queryIds) || queryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'queryIds must be a non-empty array',
        requestId
      });
    }

    if (queryIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 query IDs allowed per batch',
        requestId
      });
    }
    
    logger.logRequest(req, requestId);
    logger.info('Starting batch query result export', { requestId, queryIds, format, options });

    const asyncQueryService = require('../services/asyncQueryService');
    const athenaService = require('../services/athenaService');
    
    const results = [];
    const errors = [];
    
    // 并行处理所有查询
    const promises = queryIds.map(async (queryId, index) => {
      try {
        let queryStatus = await asyncQueryService.getQueryStatus(queryId);
        let queryData = [];
        
        if (!queryStatus || queryStatus.status !== 'completed') {
          // 如果本地缓存中没有找到，尝试直接从Athena获取
          logger.info('Query not found in local cache, attempting to get from Athena', { requestId, queryId });
          try {
            const athenaResult = await athenaService.getQueryResults(queryId);
            queryData = athenaResult.data || [];
            logger.info('Successfully retrieved query results from Athena', { requestId, queryId, rowCount: queryData.length });
          } catch (athenaError) {
            logger.error('Failed to get results from Athena', { requestId, queryId, error: athenaError.message });
            throw new Error(`Query ${queryId} not found or not completed`);
          }
        } else {
          // 从本地缓存获取数据
          queryData = queryStatus.result?.data || [];
        }
        
        if (queryData.length === 0) {
          throw new Error(`Query ${queryId} has no data`);
        }
        
        // 导出数据
        const exportOptions = { 
          ...options, 
          requestId: `${requestId}_${index}`,
          filename: options.filename || `batch_query_${queryId}_${Date.now()}`
        };

        let result;
        if (format === 'excel') {
          result = await exportService.exportToExcel(queryData, exportOptions);
        } else if (format === 'csv') {
          result = await exportService.exportToCSV(queryData, exportOptions);
        } else {
          throw new Error(`Unsupported export format: ${format}`);
        }

        return {
          queryId,
          success: true,
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
        };
        
      } catch (error) {
        logger.error('Failed to process query in batch', { requestId, queryId, error: error.message });
        return {
          queryId,
          success: false,
          error: error.message
        };
      }
    });
    
    const batchResults = await Promise.all(promises);
    
    // 分离成功和失败的结果
    const successfulResults = batchResults.filter(r => r.success);
    const failedResults = batchResults.filter(r => !r.success);
    
    // 返回批量结果
    res.json({
      success: true,
      message: `Batch export completed: ${successfulResults.length} successful, ${failedResults.length} failed`,
      requestId,
      data: {
        totalQueries: queryIds.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        results: batchResults,
        summary: {
          totalFiles: successfulResults.reduce((sum, r) => sum + (r.data?.files?.length || 0), 0),
          totalRows: successfulResults.reduce((sum, r) => sum + (r.data?.totalRows || 0), 0)
        }
      }
    });

    logger.info('Batch query result export completed', { requestId, successful: successfulResults.length, failed: failedResults.length });

  } catch (error) {
    logger.error('Batch query result export failed', { requestId, error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: `Batch export failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

module.exports = router;