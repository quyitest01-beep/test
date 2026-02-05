const express = require('express');
const router = express.Router();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

// 配置S3客户端
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * GET /download/:fileKey
 * 通用文件下载路由 - 重定向到S3预签名URL
 */
router.get('/download/:fileKey', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { fileKey } = req.params;

  try {
    logger.info('Download request received', { requestId, fileKey });

    if (!fileKey) {
      return res.status(400).json({
        success: false,
        message: 'File key is required',
        requestId
      });
    }

    // S3配置
    const bucket = process.env.S3_OUTPUT_LOCATION?.replace('s3://', '').split('/')[0] || 
                   'aws-athena-query-results-us-west-2-034986963036';
    
    // 生成预签名URL
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `${fileKey}.csv` // 假设是CSV文件，你可以根据需要调整
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15分钟

    logger.info('Generated presigned URL for download', { 
      requestId, 
      fileKey, 
      bucket,
      expiresIn: 900 
    });

    // 重定向到S3预签名URL
    res.redirect(signedUrl);

  } catch (error) {
    logger.error('Download failed', { 
      requestId, 
      fileKey, 
      error: error.message,
      stack: error.stack 
    });

    res.status(500).json({
      success: false,
      message: `Download failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * GET /file-info/:fileKey
 * 获取文件信息（不下载）
 */
router.get('/file-info/:fileKey', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const { fileKey } = req.params;

  try {
    logger.info('File info request received', { requestId, fileKey });

    const bucket = process.env.S3_OUTPUT_LOCATION?.replace('s3://', '').split('/')[0] || 
                   'aws-athena-query-results-us-west-2-034986963036';

    // 这里可以添加获取文件元数据的逻辑
    // 目前返回基本信息
    res.json({
      success: true,
      data: {
        fileKey,
        bucket,
        downloadUrl: `/download/${fileKey}`,
        directUrl: `http://localhost:8000/download/${fileKey}`
      },
      requestId
    });

  } catch (error) {
    logger.error('File info request failed', { 
      requestId, 
      fileKey, 
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