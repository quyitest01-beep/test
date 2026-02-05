// 在 backend/server.js 中添加这个路由

// 简单的文件下载端点
app.get('/download/:fileKey', async (req, res) => {
  try {
    const { fileKey } = req.params;
    
    // 这里需要你的 tenant_access_token
    // 可以从环境变量或配置文件读取
    const tenantAccessToken = process.env.LARK_TENANT_ACCESS_TOKEN || 'your_token_here';
    
    if (!tenantAccessToken || tenantAccessToken === 'your_token_here') {
      return res.status(500).json({ 
        error: '服务配置错误：缺少访问令牌' 
      });
    }
    
    // 调用Lark API下载文件
    const axios = require('axios');
    
    const response = await axios.get(
      `https://open.larksuite.com/open-apis/drive/v1/medias/${fileKey}/download`,
      {
        headers: {
          'Authorization': `Bearer ${tenantAccessToken}`
        },
        responseType: 'stream'
      }
    );
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${fileKey.slice(-8)}.pdf"`);
    
    // 流式传输文件
    response.data.pipe(res);
    
  } catch (error) {
    console.error('下载文件失败:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: '文件不存在或已过期' });
    } else if (error.response?.status === 401) {
      res.status(401).json({ error: '文件访问权限不足' });
    } else {
      res.status(500).json({ error: '下载失败，请稍后重试' });
    }
  }
});

// 文件信息查询端点
app.get('/file-info/:fileKey', async (req, res) => {
  try {
    const { fileKey } = req.params;
    
    res.json({
      file_key: fileKey,
      download_url: `${req.protocol}://${req.get('host')}/download/${fileKey}`,
      instructions: [
        '1. 点击下载链接直接下载文件',
        '2. 或复制链接在浏览器中打开',
        '3. 如遇问题请联系管理员'
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: '获取文件信息失败' });
  }
});