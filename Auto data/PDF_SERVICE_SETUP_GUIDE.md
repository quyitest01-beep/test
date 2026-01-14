# PDF渲染服务配置指南

## 📋 概述

本项目包含一个独立的HTML转PDF渲染服务，使用Express + Puppeteer实现。

## 🎯 服务信息

- **端口**: 8787
- **默认地址**: `http://localhost:8787`
- **端点**: `POST /render`
- **技术栈**: Express + Puppeteer-core

## 🚀 启动步骤

### 方法1：使用启动脚本（推荐）

双击运行或在PowerShell中执行：
```powershell
.\start-pdf-service.bat
```

脚本会自动：
1. 检查并安装依赖
2. 启动服务在8787端口
3. 显示服务状态

### 方法2：手动启动

```powershell
# 1. 进入pdf-service目录
cd backend\pdf-service

# 2. 安装依赖（首次运行）
npm install

# 3. 启动服务
node server.js
```

## 📡 API使用

### 端点1：POST /render

将HTML内容转换为PDF。

**请求示例**：
```json
{
  "html": "<html><body><h1>Hello PDF</h1></body></html>",
  "filename": "report.pdf",
  "pdfOptions": {
    "format": "A4",
    "margin": {
      "top": "12mm",
      "right": "12mm",
      "bottom": "12mm",
      "left": "12mm"
    }
  }
}
```

**参数说明**：
- `html` (必需): HTML字符串内容
- `filename` (可选): PDF文件名，默认"document.pdf"
- `pdfOptions` (可选): Puppeteer PDF选项

**响应**：
- Content-Type: `application/pdf`
- 返回PDF文件二进制流

### 端点2：POST /render-url

将URL页面转换为PDF。

**请求示例**：
```json
{
  "url": "https://example.com/page",
  "filename": "page.pdf",
  "pdfOptions": {}
}
```

### 健康检查：GET /health

**响应**：
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T15:00:00.000Z"
}
```

## 🔒 认证配置（可选）

设置环境变量启用API Key保护：
```powershell
$env:API_KEY = "your-secret-key"
```

或创建 `.env` 文件：
```
API_KEY=your-secret-key
```

启用后，所有请求（除了/health）需要在Header中携带：
```
x-api-key: your-secret-key
```

## 🌐 通过Cloudflare Tunnel暴露

### 本地暴露步骤

1. **启动PDF服务**
   ```powershell
   .\start-pdf-service.bat
   ```

2. **启动Tunnel**（在新窗口）
   ```powershell
   cloudflared tunnel --url http://localhost:8787
   ```

3. **获取公网URL**
   ```
   Your quick Tunnel has been created! Visit it at:
   https://xxx-xxx-xxx-xxx.trycloudflare.com
   ```

4. **在n8n中配置**
   - URL: `https://你的隧道URL/render`
   - Method: POST
   - Body: JSON格式，包含html和filename

## 📝 n8n配置示例

### HTTP Request节点配置

```json
{
  "method": "POST",
  "url": "https://your-tunnel-url.trycloudflare.com/render",
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "html",
        "value": "={{ $json.html }}"
      },
      {
        "name": "filename",
        "value": "={{ $json.filename }}"
      }
    ]
  },
  "options": {
    "response": {
      "responseFormat": "file",
      "outputPropertyName": "pdf"
    }
  }
}
```

## ⚠️ 常见问题

### 问题1：连接失败

**错误信息**：
```
The connection cannot be established
```

**解决步骤**：
1. 确认PDF服务运行在8787端口：`netstat -ano | findstr :8787`
2. 确认Tunnel正确配置：检查Tunnel命令中的URL
3. 获取新的Tunnel URL：Tunnel URL每次重启可能变化

### 问题2：依赖安装失败

**错误信息**：
```
npm error
```

**解决方法**：
1. 检查网络连接
2. 尝试清除npm缓存：`npm cache clean --force`
3. 手动安装依赖：`cd backend\pdf-service && npm install`

### 问题3：Puppeteer启动失败

**错误信息**：
```
Failed to launch browser
```

**解决方法**：
1. 安装Chrome浏览器
2. 设置Chrome路径：
   ```powershell
   $env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
   ```
3. 或使用系统Chrome，设置executablePath环境变量

### 问题4：端口被占用

**错误信息**：
```
EADDRINUSE: address already in use :::8787
```

**解决方法**：
```powershell
# 查找占用端口的进程
netstat -ano | findstr :8787

# 停止进程（替换PID）
taskkill /PID <进程ID> /F
```

## 🔧 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务端口 | 8787 |
| HOST | 监听地址 | 0.0.0.0 |
| API_KEY | API密钥（可选） | null |
| CHROME_PATH | Chrome路径（可选） | null |

## 📚 相关文件

- `backend/pdf-service/server.js` - 服务主文件
- `backend/pdf-service/package.json` - 依赖配置
- `start-pdf-service.bat` - 启动脚本
- `CLOUDFLARE_TUNNEL_GUIDE.md` - Tunnel配置指南

## 🎯 测试示例

### 使用cURL测试

```powershell
curl -X POST http://localhost:8787/render ^
  -H "Content-Type: application/json" ^
  -d "{\"html\":\"<h1>Test</h1>\",\"filename\":\"test.pdf\"}" ^
  --output test.pdf
```

### 使用PowerShell测试

```powershell
$body = @{
    html = "<html><body><h1>Hello</h1></body></html>"
    filename = "test.pdf"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8787/render" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -OutFile "test.pdf"
```

## 📞 支持

如有问题，请查看：
1. 服务日志：检查服务启动窗口的输出
2. 工作日志：`worklog.md`
3. Cloudflare Tunnel指南：`CLOUDFLARE_TUNNEL_GUIDE.md`









