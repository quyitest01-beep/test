const express = require('express');
const puppeteer = require('puppeteer-core');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8787;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 查找Chrome浏览器路径
function findChrome() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error('Chrome browser not found. Please install Google Chrome or set CHROME_PATH environment variable.');
}

const CHROME_PATH = findChrome();
console.log(`Found Chrome at: ${CHROME_PATH}`);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PDF Rendering Service',
    port: PORT,
    chromePath: CHROME_PATH
  });
});

// 渲染HTML为PDF
app.post('/render', async (req, res) => {
  let browser;
  try {
    const { html, filename = 'document.pdf', options = {} } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }

    // 清理文件名：移除非ASCII字符，保留原始名称用于URL编码
    const safeFilename = filename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    // 启动浏览器
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // PDF选项
    const pdfOptions = {
      format: options.format || 'A4',
      printBackground: true,
      margin: options.margin || {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      ...options
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();

    // 设置响应头（使用ASCII安全的文件名）
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    
    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

// 从URL渲染PDF
app.post('/render-url', async (req, res) => {
  let browser;
  try {
    const { url, filename = 'document.pdf', options = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // 清理文件名：移除非ASCII字符，保留原始名称用于URL编码
    const safeFilename = filename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(filename);

    // 启动浏览器
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    // PDF选项
    const pdfOptions = {
      format: options.format || 'A4',
      printBackground: true,
      margin: options.margin || {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      ...options
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();

    // 设置响应头（使用ASCII安全的文件名）
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    
    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF from URL',
      message: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTML->PDF service listening on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
