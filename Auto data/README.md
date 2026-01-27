# Auto Data - 智能查数系统

基于 AWS Athena 的智能数据查询和分析系统，支持自然语言查询、批量查询、PDF 报告生成等功能。

## 项目结构

```
Auto data/
├── backend/                    # 后端服务
│   ├── routes/                # API 路由
│   ├── services/              # 业务逻辑服务
│   ├── middleware/            # 中间件
│   ├── utils/                 # 工具函数
│   ├── pdf-service/           # PDF 渲染服务
│   └── server.js              # 主服务器入口
├── frontend/                   # 前端应用（如果有）
├── docs/                       # 文档
├── n8n-workflows/             # n8n 工作流配置
└── README.md                  # 项目说明
```

## 核心功能

### 1. 智能查询系统
- 自然语言转 SQL 查询
- 支持复杂查询条件
- 自动查询优化
- 查询结果缓存

### 2. 批量查询
- 支持多个查询并发执行
- 查询状态跟踪
- 失败重试机制
- 结果聚合

### 3. 异步查询
- 长时间查询异步处理
- 实时状态更新
- 超时控制
- 查询取消功能

### 4. PDF 报告生成
- HTML 转 PDF
- URL 转 PDF
- 支持中文文件名
- 自定义页面样式

### 5. 数据导出
- CSV 格式导出
- Excel 格式导出
- 大数据量分批导出
- 压缩打包下载

## 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **AWS SDK** - AWS 服务集成
  - Athena - 数据查询
  - S3 - 文件存储
- **Puppeteer** - PDF 生成
- **Winston** - 日志管理
- **Joi** - 数据验证

### 数据库
- **AWS Athena** - 数据查询引擎
- **S3** - 数据存储

### 工作流
- **n8n** - 工作流自动化

## 快速开始

### 前置要求

- Node.js 14+
- Google Chrome（用于 PDF 生成）
- AWS 账号和凭证
- n8n（可选，用于工作流）

### 安装

1. 克隆仓库
```bash
git clone <repository-url>
cd "Auto data"
```

2. 安装后端依赖
```bash
cd backend
npm install
```

3. 安装 PDF 服务依赖
```bash
cd backend/pdf-service
npm install
```

4. 配置环境变量

复制 `backend/.env.example` 到 `backend/.env` 并填写配置：

```env
# AWS 配置
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-west-2

# Athena 配置
ATHENA_DATABASE=your_database
ATHENA_OUTPUT_LOCATION=s3://your-bucket/
ATHENA_WORKGROUP=primary

# 服务器配置
PORT=8000
NODE_ENV=development

# API Key
API_KEY=your_api_key
```

### 启动服务

#### 方式1：使用启动脚本（推荐）

```cmd
# 启动主后端服务
start-server.bat

# 启动 PDF 服务
start-pdf-here.bat
```

#### 方式2：手动启动

```bash
# 启动主后端服务（端口 8000）
cd backend
node server.js

# 启动 PDF 服务（端口 8787）
cd backend/pdf-service
node server.js
```

### 验证服务

```bash
# 检查主后端服务
curl http://localhost:8000/api/health

# 检查 PDF 服务
curl http://localhost:8787/health
```

## API 文档

### 主后端服务（端口 8000）

#### 1. 健康检查
```
GET /api/health
```

#### 2. 执行查询
```
POST /api/query/execute
Content-Type: application/json

{
  "sql": "SELECT * FROM table LIMIT 10",
  "database": "gmp"
}
```

#### 3. 批量查询
```
POST /api/batch/start
Content-Type: application/json

{
  "queries": [
    {"name": "query1", "sql": "SELECT ..."},
    {"name": "query2", "sql": "SELECT ..."}
  ],
  "database": "gmp"
}
```

#### 4. 异步查询
```
POST /api/async/start
Content-Type: application/json

{
  "sql": "SELECT * FROM large_table",
  "database": "gmp"
}
```

#### 5. 查询状态
```
GET /api/async/status/:queryId
```

### PDF 服务（端口 8787）

#### 1. HTML 转 PDF
```
POST /render
Content-Type: application/json

{
  "html": "<html>...</html>",
  "filename": "report.pdf",
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

#### 2. URL 转 PDF
```
POST /render-url
Content-Type: application/json

{
  "url": "https://example.com",
  "filename": "webpage.pdf"
}
```

## 配置说明

### AWS 凭证

系统需要以下 AWS 权限：
- Athena: 查询执行权限
- S3: 读写权限（用于查询结果存储）

### Chrome 浏览器

PDF 服务需要 Chrome 浏览器。系统会自动检测以下路径：
- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

如果自动检测失败，可以设置环境变量：
```bash
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

## n8n 集成

项目包含多个 n8n 工作流配置，用于：
- 数据查询自动化
- 报告生成
- 数据同步
- 通知发送

工作流配置文件位于 `n8n-workflows/` 目录。

## 故障排查

### 端口被占用

```cmd
# 查找占用端口的进程
netstat -ano | findstr "8000 8787"

# 终止进程
taskkill /F /PID <进程ID>
```

### Chrome 未找到

安装 Google Chrome：https://www.google.com/chrome/

或设置 `CHROME_PATH` 环境变量。

### AWS 凭证错误

检查 `.env` 文件中的 AWS 凭证是否正确。

### 查询超时

调整 `MAX_QUERY_TIMEOUT` 环境变量（默认 5 分钟）。

## 开发指南

### 添加新的 API 端点

1. 在 `backend/routes/` 创建新的路由文件
2. 在 `backend/server.js` 注册路由
3. 在 `backend/services/` 添加业务逻辑

### 添加新的查询功能

1. 在 `backend/services/athenaService.js` 添加方法
2. 在相应的路由中调用
3. 添加错误处理和日志

### 测试

```bash
# 运行测试
npm test

# 测试 PDF API
node test-pdf-api.js
```

## 文档

- [如何启动服务](如何启动服务.md)
- [PDF 服务文档](backend/pdf-service/README.md)
- [n8n 使用说明](N8N使用说明.md)
- [问题修复总结](问题修复总结.md)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

ISC

## 联系方式

如有问题，请联系项目维护者。

---

**最后更新**: 2026-01-27
