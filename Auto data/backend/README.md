# 智能数据查询系统 - 后端API服务

## 项目简介

这是智能数据查询系统的后端API服务，提供与云数据库的集成功能，支持自然语言查询转换为SQL、查询执行、结果处理等核心功能。

## 功能特性

- 🔍 **自然语言SQL生成**：将用户的自然语言查询转换为标准SQL语句
- 🚀 **数据库查询执行**：直接连接云数据库执行SQL查询
- 📊 **查询结果处理**：从S3获取查询结果并格式化返回
- 🔄 **大数据集拆分**：自动检测并拆分大数据集查询（>10万条记录）
- 💰 **成本控制**：监控查询成本，提供成本估算和限制
- 📈 **查询状态跟踪**：实时跟踪查询执行状态和进度
- 🛡️ **安全验证**：SQL注入防护和查询安全验证

## 技术栈

- **Node.js** + **Express.js** - 后端框架
- **AWS SDK v3** - AWS服务集成
- **Winston** - 日志管理
- **Joi** - 请求参数验证
- **Helmet** + **CORS** - 安全中间件

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

复制环境配置文件并填写相关信息：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下参数：

```env
# AWS配置
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Athena配置
ATHENA_DATABASE=your_database_name
ATHENA_WORKGROUP=primary
ATHENA_OUTPUT_LOCATION=s3://your-athena-results-bucket/

# S3配置
S3_RESULTS_BUCKET=your-athena-results-bucket
```

### 3. 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

服务将在 `http://localhost:8000` 启动。

## API接口文档

### 健康检查

- `GET /api/health` - 基础健康检查
- `GET /api/health/detailed` - 详细健康检查（包含AWS服务状态）

### 查询接口

- `POST /api/query/generate-sql` - 生成SQL语句
- `POST /api/query/execute` - 执行查询
- `POST /api/query/split` - 拆分大数据集查询
- `GET /api/query/status/:queryId` - 获取查询状态
- `POST /api/query/cancel/:queryId` - 取消查询

### 请求示例

#### 生成SQL

```bash
curl -X POST http://localhost:8000/api/query/generate-sql \
  -H "Content-Type: application/json" \
  -d '{
    "queryText": "查询最近30天的销售数据",
    "database": "sales_db",
    "options": {
      "limit": 1000,
      "optimize": true
    }
  }'
```

#### 执行查询

```bash
curl -X POST http://localhost:8000/api/query/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM sales_data LIMIT 100",
    "database": "sales_db",
    "options": {
      "timeout": 60000,
      "maxCost": 10
    }
  }'
```

## AWS配置要求

### IAM权限

确保AWS凭证具有以下权限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:StopQueryExecution",
        "athena:ListQueryExecutions"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::your-athena-results-bucket",
        "arn:aws:s3:::your-athena-results-bucket/*",
        "arn:aws:s3:::your-data-bucket",
        "arn:aws:s3:::your-data-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetTable",
        "glue:GetPartitions"
      ],
      "Resource": "*"
    }
  ]
}
```

### Athena工作组配置

确保Athena工作组已正确配置：
- 设置查询结果位置（S3存储桶）
- 配置适当的查询超时时间
- 设置成本控制限制（可选）

## 开发指南

### 项目结构

```
backend/
├── server.js              # 服务器入口文件
├── routes/                # 路由定义
│   ├── health.js         # 健康检查路由
│   └── query.js          # 查询相关路由
├── services/             # 业务逻辑服务
│   ├── athenaService.js  # Athena集成服务
│   └── sqlGenerator.js   # SQL生成服务
├── utils/                # 工具函数
│   └── logger.js         # 日志工具
├── logs/                 # 日志文件目录
├── package.json          # 项目配置
└── .env.example          # 环境配置模板
```

### 日志管理

系统使用Winston进行日志管理：
- 错误日志：`logs/error.log`
- 综合日志：`logs/combined.log`
- 开发环境同时输出到控制台

### 错误处理

- 统一的错误响应格式
- 请求ID追踪
- 详细的错误日志记录
- 开发环境包含错误堆栈信息

## 部署说明

### Docker部署（推荐）

```dockerfile
# Dockerfile示例
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

### 环境变量

生产环境需要设置的关键环境变量：
- `NODE_ENV=production`
- `PORT=8000`
- AWS相关配置
- Athena相关配置

## 监控和维护

### 健康检查

- 基础健康检查：`GET /api/health`
- 详细健康检查：`GET /api/health/detailed`

### 日志监控

- 查看错误日志：`tail -f logs/error.log`
- 查看访问日志：`tail -f logs/combined.log`

### 性能监控

建议监控以下指标：
- API响应时间
- Athena查询执行时间
- 查询成本
- 错误率

## 故障排除

### 常见问题

1. **AWS凭证错误**
   - 检查 `.env` 文件中的AWS配置
   - 验证IAM权限设置

2. **Athena查询失败**
   - 检查数据库和表是否存在
   - 验证S3结果存储桶权限
   - 查看Athena工作组配置

3. **网络连接问题**
   - 检查AWS区域设置
   - 验证网络连接和防火墙设置

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License