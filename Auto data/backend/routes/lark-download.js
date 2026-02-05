const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * GET /lark-download/:file_key
 * 从Lark下载文件并提供给外部用户
 * 支持自定义文件名: /lark-download/:file_key?filename=报告名称
 */
router.get('/lark-download/:file_key', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { file_key } = req.params;
  const { filename } = req.query;

  try {
    logger.info('Lark file download request', { requestId, file_key, filename });

    if (!file_key) {
      return res.status(400).json({
        success: false,
        message: 'File key is required',
        requestId
      });
    }

    // 1. 获取tenant_access_token
    const tokenResponse = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    if (tokenResponse.data.code !== 0) {
      throw new Error(`Failed to get token: ${tokenResponse.data.msg}`);
    }

    const token = tokenResponse.data.tenant_access_token;

    // 2. 直接下载文件 (im/v1/files API直接返回文件流)
    const downloadResponse = await axios.get(`https://open.larksuite.com/open-apis/im/v1/files/${file_key}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'stream'
    });

    // 3. 设置响应头 - 支持自定义文件名
    let fileName;
    if (filename) {
      // 清理文件名，移除不安全字符
      const cleanFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
      fileName = `${cleanFilename}.pdf`;
    } else {
      fileName = `report_${file_key}.pdf`;
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    
    // 4. 流式传输文件
    downloadResponse.data.pipe(res);

    logger.info('Lark file download successful', { requestId, file_key, fileName });

  } catch (error) {
    logger.error('Lark file download failed', { 
      requestId, 
      file_key, 
      error: error.message,
      stack: error.stack 
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: `Download failed: ${error.message}`,
        requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  }
});

/**
 * GET /lark-file-info/:file_key
 * 获取Lark文件信息
 */
router.get('/lark-file-info/:file_key', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { file_key } = req.params;

  try {
    logger.info('Lark file info request', { requestId, file_key });

    // 1. 获取token
    const tokenResponse = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    if (tokenResponse.data.code !== 0) {
      throw new Error(`Failed to get token: ${tokenResponse.data.msg}`);
    }

    const token = tokenResponse.data.tenant_access_token;

    // 2. 获取文件元数据 (使用正确的im/v1/files API)
    const metaResponse = await axios.get(`https://open.larksuite.com/open-apis/im/v1/files/${file_key}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (metaResponse.data.code !== 0) {
      throw new Error(`Failed to get file info: ${metaResponse.data.msg}`);
    }

    const fileInfo = metaResponse.data.data;

    res.json({
      success: true,
      data: {
        file_key,
        file_name: fileInfo.file_name,
        file_size: fileInfo.size,
        mime_type: fileInfo.mime_type,
        download_url: `/lark-download/${file_key}`,
        direct_url: `http://localhost:8000/lark-download/${file_key}`
      },
      requestId
    });

    logger.info('Lark file info retrieved', { requestId, file_key, file_name: fileInfo.file_name });

  } catch (error) {
    logger.error('Lark file info request failed', { 
      requestId, 
      file_key, 
      error: error.message 
    });

    res.status(500).json({
      success: false,
      message: `File info request failed: ${error.message}`,
      requestId
    });
  }
});

module.exports = router;