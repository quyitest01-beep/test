# PDF 渲染服务

基于 Puppeteer 的 HTML 转 PDF 服务

## 功能

- 将 HTML 内容转换为 PDF
- 从 URL 生成 PDF
- 支持自定义 PDF 选项（页面大小、边距等）
- 支持中文文件名

## 前置要求

- Node.js 14+
- Google Chrome 浏览器（已安装）

## 安装

```bash
cd backend/pdf-service
npm install
```

## 启动服务

### 方式1：使用启动脚本（推荐）

在项目根目录运行：
```cmd
start-pdf-here.bat
```

### 方式2：手动启动

```bash
cd backend/pdf-service
node server.js
```

## API 端点

### 1. 健康检查

```
GET /health
```

响应：
```json
{
  "status": "ok",
  "service": "PDF Rendering Service",
  "port": 8787,
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}
```

### 2. 渲染 HTML 为 PDF

```
POST /render
```

请求体：
```json
{
  "html": "<html><body><h1>Hello World</h1></body></html>",
  "filename": "document.pdf",
  "options": {
    "format": "A4",
    "margin": {
      "top": "20px",
      "right": "20px",
      "bottom": "20px",
      "left": "20px"
    }
  }
}
```

参数说明：
- `html` (必需): HTML 内容字符串
- `filename` (可选): PDF 文件名，默认 "document.pdf"
- `options` (可选): PDF 生成选项
  - `format`: 页面大小，如 "A4", "Letter" 等
  - `margin`: 页边距设置

响应：PDF 文件（二进制）

### 3. 从 URL 渲染 PDF

```
POST /render-url
```

请求体：
```json
{
  "url": "https://example.com",
  "filename": "webpage.pdf",
  "options": {
    "format": "A4"
  }
}
```

参数说明：
- `url` (必需): 要渲染的网页 URL
- `filename` (可选): PDF 文件名
- `options` (可选): PDF 生成选项

响应：PDF 文件（二进制）

## 配置

### Chrome 浏览器路径

服务会自动检测以下路径的 Chrome：
- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

如果自动检测失败，可以设置环境变量：
```bash
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

### 端口配置

默认端口：8787

修改端口：
```bash
set PORT=8888
node server.js
```

## 故障排查

### 1. Chrome 未找到

错误：`Chrome browser not found`

解决方案：
1. 安装 Google Chrome：https://www.google.com/chrome/
2. 或设置 `CHROME_PATH` 环境变量指向 Chrome 可执行文件

### 2. 端口被占用

错误：`EADDRINUSE: address already in use`

解决方案：
```cmd
# 查找占用端口的进程
netstat -ano | findstr "8787"

# 终止进程
taskkill /F /PID <进程ID>
```

### 3. 内存不足

如果处理大型 HTML 或高分辨率 PDF 时出现内存错误，可以增加 Node.js 内存限制：

```bash
node --max-old-space-size=4096 server.js
```

## 使用示例

### curl 示例

```bash
# 渲染 HTML
curl -X POST http://localhost:8787/render \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Hello</h1>","filename":"test.pdf"}' \
  --output test.pdf

# 从 URL 渲染
curl -X POST http://localhost:8787/render-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","filename":"example.pdf"}' \
  --output example.pdf
```

### JavaScript 示例

```javascript
const axios = require('axios');
const fs = require('fs');

async function generatePDF() {
  const response = await axios.post('http://localhost:8787/render', {
    html: '<html><body><h1>Hello World</h1></body></html>',
    filename: 'test.pdf'
  }, {
    responseType: 'arraybuffer'
  });

  fs.writeFileSync('output.pdf', response.data);
  console.log('PDF generated successfully!');
}

generatePDF();
```

## 注意事项

1. **文件名处理**：服务会自动处理中文文件名，确保 HTTP 响应头兼容性
2. **内存管理**：大量并发请求可能导致内存问题，建议使用队列或限流
3. **安全性**：不要直接暴露此服务到公网，建议通过反向代理或 API 网关访问
4. **性能**：每次请求都会启动新的 Chrome 实例，对于高并发场景建议使用浏览器池

## 许可证

ISC
