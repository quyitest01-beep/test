// backend/routes/publicDownload.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// 存储临时下载链接（实际项目中应该用Redis或数据库）
const downloadTokens = new Map();

// 生成公开下载链接
router.post('/generate-download-link', async (req, res) => {
  try {
    const { file_key, file_name, tenant_access_token } = req.body;
    
    if (!file_key || !tenant_access_token) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 生成临时token
    const downloadToken = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 存储下载信息（24小时过期）
    downloadTokens.set(downloadToken, {
      file_key,
      file_name,
      tenant_access_token,
      created_at: Date.now(),
      expires_at: Date.now() + 24 * 60 * 60 * 1000 // 24小时
    });
    
    // 生成公开下载链接
    const publicUrl = `${req.protocol}://${req.get('host')}/api/public/download/${downloadToken}`;
    const shortUrl = `${req.protocol}://${req.get('host')}/d/${downloadToken.slice(-8)}`;
    
    res.json({
      success: true,
      download_url: publicUrl,
      short_url: shortUrl,
      expires_in: '24小时',
      file_name
    });
    
  } catch (error) {
    console.error('生成下载链接失败:', error);
    res.status(500).json({ error: '生成下载链接失败' });
  }
});

// 公开下载端点
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // 查找下载信息
    const downloadInfo = downloadTokens.get(token);
    
    if (!downloadInfo) {
      return res.status(404).json({ error: '下载链接不存在或已过期' });
    }
    
    // 检查是否过期
    if (Date.now() > downloadInfo.expires_at) {
      downloadTokens.delete(token);
      return res.status(410).json({ error: '下载链接已过期' });
    }
    
    // 通过Lark API获取文件
    const fileResponse = await axios.get(
      `https://open.larksuite.com/open-apis/drive/v1/medias/${downloadInfo.file_key}/download`,
      {
        headers: {
          'Authorization': `Bearer ${downloadInfo.tenant_access_token}`
        },
        responseType: 'stream'
      }
    );
    
    // 设置下载响应头
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.file_name}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // 流式传输文件
    fileResponse.data.pipe(res);
    
  } catch (error) {
    console.error('下载文件失败:', error);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: '文件不存在' });
    } else if (error.response?.status === 401) {
      res.status(401).json({ error: '文件访问权限不足' });
    } else {
      res.status(500).json({ error: '下载失败' });
    }
  }
});

// 短链接重定向
router.get('/d/:shortToken', (req, res) => {
  const { shortToken } = req.params;
  
  // 查找完整token
  for (const [fullToken, info] of downloadTokens.entries()) {
    if (fullToken.endsWith(shortToken)) {
      return res.redirect(`/api/public/download/${fullToken}`);
    }
  }
  
  res.status(404).json({ error: '链接不存在' });
});

// 清理过期token（定时任务）
setInterval(() => {
  const now = Date.now();
  for (const [token, info] of downloadTokens.entries()) {
    if (now > info.expires_at) {
      downloadTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

module.exports = router;