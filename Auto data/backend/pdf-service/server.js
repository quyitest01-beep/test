const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || process.env.PDF_SERVICE_API_KEY;

app.use(morgan('tiny'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// Simple API key guard (optional). Set API_KEY env to enable.
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.get('x-api-key');
  if (key && key === API_KEY) return next();
  if (req.path === '/health') return next();
  return res.status(401).json({ error: 'unauthorized' });
});

let browserPromise;
async function getBrowser() {
  if (!browserPromise) {
    // 自动检测Chrome路径
    let executablePath = process.env.CHROME_PATH;
    
    // Windows系统默认Chrome路径
    if (!executablePath && process.platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
      ];
      
      const fs = require('fs');
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`Found Chrome at: ${executablePath}`);
          break;
        }
      }
    }
    
    if (!executablePath) {
      throw new Error('Chrome executable not found. Please install Chrome or set CHROME_PATH environment variable.');
    }
    
    browserPromise = puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      executablePath: executablePath
    });
  }
  return browserPromise;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /render  { html, filename?, pdfOptions? }
app.post('/render', async (req, res) => {
  try {
    const { html, filename = 'document.pdf', pdfOptions = {} } = req.body || {};
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html is required (string)' });
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const defaultOpts = {
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    };
    const buffer = await page.pdf({ ...defaultOpts, ...pdfOptions });
    await page.close();

    // 清理filename，移除非法字符
    // 首先移除所有非ASCII字符和特殊字符，只保留安全字符
    let safeFilename = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 替换非法字符
      .replace(/[^\x20-\x7E]/g, '_')  // 替换所有非ASCII字符（包括中文）
      .replace(/\s+/g, '_')  // 替换空格
      .substring(0, 200);  // 限制长度
    
    // 对原始filename进行URL编码以支持中文和特殊字符
    const encodedFilename = encodeURIComponent(filename.substring(0, 200));

    res.setHeader('Content-Type', 'application/pdf');
    // 使用ASCII安全的filename作为fallback，使用编码的filename*作为主要文件名
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    return res.send(buffer);
  } catch (err) {
    console.error('Render error:', err);
    return res.status(500).json({ error: 'render_failed', message: err.message });
  }
});

// POST /render-url { url, filename?, pdfOptions? }
app.post('/render-url', async (req, res) => {
  try {
    const { url, filename = 'document.pdf', pdfOptions = {} } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required (string)' });
    }
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const defaultOpts = {
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
    };
    const buffer = await page.pdf({ ...defaultOpts, ...pdfOptions });
    await page.close();
    
    // 清理filename，移除非法字符
    // 首先移除所有非ASCII字符和特殊字符，只保留安全字符
    let safeFilename = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 替换非法字符
      .replace(/[^\x20-\x7E]/g, '_')  // 替换所有非ASCII字符（包括中文）
      .replace(/\s+/g, '_')  // 替换空格
      .substring(0, 200);  // 限制长度
    
    // 对原始filename进行URL编码以支持中文和特殊字符
    const encodedFilename = encodeURIComponent(filename.substring(0, 200));
    
    res.setHeader('Content-Type', 'application/pdf');
    // 使用ASCII安全的filename作为fallback，使用编码的filename*作为主要文件名
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    return res.send(buffer);
  } catch (err) {
    console.error('Render-url error:', err);
    return res.status(500).json({ error: 'render_failed', message: err.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`HTML->PDF service listening on http://${HOST}:${PORT}`);
  if (API_KEY) console.log('API key protection enabled');
});


