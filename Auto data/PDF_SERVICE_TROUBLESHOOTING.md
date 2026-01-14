# PDF服务故障排查指南

## 常见错误及解决方案

### 错误1: Invalid character in header content

**错误信息**：
```
TypeError: [ERR_INVALID_CHAR]: Invalid character in header content ["Content-Disposition"]
```

**原因**：HTTP响应头中包含了非ASCII字符（如中文字符），导致Node.js抛出错误。

**影响范围**：
- PDF服务的`/render`和`/render-url`端点
- 导出服务的`/api/export/download/:filename`端点

**解决方案**：
已在代码中修复。现在会：
1. 将所有非ASCII字符替换为下划线作为fallback文件名
2. 使用`filename*=UTF-8''`参数提供URL编码的原始文件名
3. 现代浏览器会优先使用`filename*`参数，支持中文文件名

**修复后的代码逻辑**：
```javascript
// 创建ASCII安全的fallback文件名
let safeFilename = filename
  .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // 替换非法字符
  .replace(/[^\x20-\x7E]/g, '_')  // 替换所有非ASCII字符
  .replace(/\s+/g, '_')  // 替换空格
  .substring(0, 200);  // 限制长度
  
// 对原始文件名进行URL编码
const encodedFilename = encodeURIComponent(filename.substring(0, 200));

// 设置双重文件名：ASCII fallback + UTF-8编码
res.setHeader('Content-Disposition', 
  `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
```

**修复位置**：
- `backend/pdf-service/server.js` - `/render`端点（已修复）
- `backend/pdf-service/server.js` - `/render-url`端点（已修复）
- `backend/routes/export.js` - `/api/export/download/:filename`端点（已修复）

**验证方法**：
1. 重启PDF服务和主后端服务
2. 使用包含中文字符的文件名测试PDF生成
3. 使用包含中文字符的文件名测试文件下载
4. 确认不再出现`ERR_INVALID_CHAR`错误

### 错误2: FileNotFoundError - 系统找不到指定的文件

**错误信息**：
```
FileNotFoundError: [WinError 2] 系统找不到指定的文件。
```

**原因**：PDF服务使用`puppeteer-core`启动Chrome浏览器时找不到Chrome可执行文件。

**解决方案**：

#### 方案1：安装Google Chrome浏览器
1. 下载并安装Google Chrome：https://www.google.com/chrome/
2. 确保安装在默认路径：
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

#### 方案2：手动设置Chrome路径
如果Chrome安装在非标准路径，可以设置环境变量：

**Windows命令行**：
```cmd
set CHROME_PATH=C:\你的Chrome路径\chrome.exe
```

**PowerShell**：
```powershell
$env:CHROME_PATH = "C:\你的Chrome路径\chrome.exe"
```

#### 方案3：使用完整版puppeteer
修改`backend/pdf-service/package.json`：
```json
{
  "dependencies": {
    "puppeteer": "^22.15.0"  // 替换 puppeteer-core
  }
}
```

然后重新安装依赖：
```cmd
cd backend\pdf-service
npm install
```

### 错误3: 端口占用

**错误信息**：
```
Error: listen EADDRINUSE: address already in use :::8787
```

**解决方案**：
1. 检查端口占用：
   ```cmd
   netstat -ano | findstr :8787
   ```

2. 终止占用进程：
   ```cmd
   taskkill /PID <进程ID> /F
   ```

3. 或者使用其他端口：
   ```cmd
   set PORT=8788
   node server.js
   ```

### 错误4: 权限不足

**错误信息**：
```
Error: Failed to launch the browser process
```

**解决方案**：
1. 以管理员身份运行命令行
2. 或者添加更多Chrome启动参数：
   ```javascript
   args: [
     '--no-sandbox',
     '--disable-setuid-sandbox',
     '--disable-dev-shm-usage',
     '--disable-gpu'
   ]
   ```

## 测试PDF服务

### 1. 健康检查
```cmd
curl http://localhost:8787/health
```

预期响应：
```json
{"status":"ok","timestamp":"2026-01-13T..."}
```

### 2. 测试PDF渲染
```cmd
curl -X POST http://localhost:8787/render ^
  -H "Content-Type: application/json" ^
  -d "{\"html\":\"<h1>测试PDF</h1><p>这是一个测试页面</p>\"}" ^
  --output test.pdf
```

### 3. 使用PowerShell测试
```powershell
$body = @{
    html = "<h1>测试PDF</h1><p>这是一个测试页面</p>"
    filename = "test.pdf"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8787/render" -Method POST -Body $body -ContentType "application/json" -OutFile "test.pdf"
```

## 服务配置

### 环境变量
- `PORT`: 服务端口（默认8787）
- `HOST`: 服务主机（默认0.0.0.0）
- `CHROME_PATH`: Chrome可执行文件路径
- `API_KEY`: API密钥（可选）

### 启动服务
```cmd
# 使用启动脚本（推荐）
start-pdf-service.bat

# 手动启动
cd backend\pdf-service
npm install
node server.js
```

## 日志分析

### 正常启动日志
```
HTML->PDF service listening on http://0.0.0.0:8787
Found Chrome at: C:\Program Files\Google\Chrome\Application\chrome.exe
```

### 错误日志
```
Render error: Error: Failed to launch the browser process!
```

## 性能优化

### 1. 浏览器复用
服务会自动复用浏览器实例，避免重复启动。

### 2. 内存管理
每次渲染后会关闭页面，释放内存。

### 3. 超时设置
可以在请求中设置超时：
```json
{
  "html": "<h1>内容</h1>",
  "pdfOptions": {
    "timeout": 30000
  }
}
```

## 联系支持

如果问题仍然存在，请提供：
1. 完整的错误日志
2. 系统信息（Windows版本、Node.js版本）
3. Chrome浏览器版本
4. 使用的命令和配置