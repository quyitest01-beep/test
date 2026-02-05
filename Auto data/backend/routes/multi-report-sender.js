const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * POST /api/send-reports
 * 统一发送多个报告到Lark群
 * 
 * 请求体格式:
 * {
 *   "reports": [
 *     {
 *       "title": "中文报告",
 *       "file_key": "file_xxx",
 *       "language": "zh",
 *       "period": "2024-02-04"
 *     },
 *     {
 *       "title": "English Report", 
 *       "file_key": "file_yyy",
 *       "language": "en",
 *       "period": "2024-02-04"
 *     }
 *   ],
 *   "webhook_url": "https://open.larksuite.com/open-apis/bot/v2/hook/xxx",
 *   "public_base_url": "https://your-ngrok-url.ngrok.io"
 * }
 */
router.post('/send-reports', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { reports, webhook_url, public_base_url } = req.body;
    
    logger.info('Multi-report send request', { 
      requestId, 
      reportCount: reports?.length,
      webhook_url: webhook_url ? 'provided' : 'missing'
    });

    // 验证请求参数
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reports array is required and must not be empty',
        requestId
      });
    }

    if (!webhook_url) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required',
        requestId
      });
    }

    if (!public_base_url) {
      return res.status(400).json({
        success: false,
        message: 'Public base URL is required (e.g., ngrok URL)',
        requestId
      });
    }

    // 生成下载链接
    const reportLinks = reports.map(report => {
      const encodedTitle = encodeURIComponent(report.title);
      const downloadUrl = `${public_base_url}/lark-download/${report.file_key}?filename=${encodedTitle}`;
      
      return {
        ...report,
        downloadUrl,
        downloadButton: `[📎 ${report.title}](${downloadUrl})`
      };
    });

    // 构建Lark消息卡片
    const card = {
      config: { 
        wide_screen_mode: true, 
        enable_forward: true 
      },
      header: {
        template: 'blue',
        title: { 
          tag: 'plain_text', 
          content: `📊 报告已生成 (${reports.length}个文件)` 
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**生成时间：** ${new Date().toLocaleString()}\n` +
                    `**报告周期：** ${reports[0]?.period || '最新数据'}\n` +
                    `**文件数量：** ${reports.length}个`
          },
        },
        { tag: 'hr' }
      ],
    };

    // 添加每个报告的下载链接
    reportLinks.forEach((report, index) => {
      const languageFlag = report.language === 'zh' ? '🇨🇳' : '🇺🇸';
      
      card.elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `${languageFlag} **${report.title}**\n` +
                  `🔗 [点击下载](${report.downloadUrl})`
        },
      });

      // 添加分隔线（除了最后一个）
      if (index < reportLinks.length - 1) {
        card.elements.push({ tag: 'hr' });
      }
    });

    // 添加下载按钮组
    const actions = reportLinks.map(report => ({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: `📥 ${report.title}`
      },
      type: 'primary',
      url: report.downloadUrl
    }));

    if (actions.length <= 5) { // Lark限制最多5个按钮
      card.elements.push(
        { tag: 'hr' },
        {
          tag: 'action',
          actions: actions
        }
      );
    }

    // 添加说明
    card.elements.push(
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `💡 **使用说明：**\n` +
                  `• 点击链接或按钮直接下载\n` +
                  `• 文件名会自动使用报告标题\n` +
                  `• 链接长期有效，可以分享给其他人\n\n` +
                  `🔄 如有问题，请联系技术支持`
        },
      }
    );

    // 发送到Lark
    const webhookResponse = await axios.post(webhook_url, {
      msg_type: 'interactive',
      card: card
    });

    logger.info('Multi-report sent successfully', { 
      requestId, 
      reportCount: reports.length,
      webhookStatus: webhookResponse.status
    });

    res.json({
      success: true,
      message: `Successfully sent ${reports.length} reports`,
      data: {
        reportCount: reports.length,
        reports: reportLinks.map(r => ({
          title: r.title,
          downloadUrl: r.downloadUrl,
          language: r.language
        }))
      },
      requestId
    });

  } catch (error) {
    logger.error('Multi-report send failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });

    res.status(500).json({
      success: false,
      message: `Send failed: ${error.message}`,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

module.exports = router;