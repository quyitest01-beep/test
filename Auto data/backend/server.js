const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
require('dotenv').config()

const logger = require('./utils/logger')
const queryRoutes = require('./routes/query')
const healthRoutes = require('./routes/health')
const exportRoutes = require('./routes/export')
const webhookRoutes = require('./routes/webhook')
const asyncQueryRoutes = require('./routes/asyncQuery')
const queryEstimateRoutes = require('./routes/queryEstimate')
const progressiveQueryRoutes = require('./routes/progressiveQuery')
const batchQueryRoutes = require('./routes/batchQuery')
const queryCountRoutes = require('./routes/queryCount')
const downloadRoutes = require('./routes/download')
const larkDownloadRoutes = require('./routes/lark-download')
const multiReportRoutes = require('./routes/multi-report-sender')
const testRoutes = require('./routes/test-route')

const app = express()
const PORT = process.env.PORT || 8000

// 中间件配置
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 请求ID中间件
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  res.setHeader('X-Request-ID', req.requestId)
  next()
})

// 路由配置
app.use('/api/health', healthRoutes)
app.use('/api/query', queryRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/async', asyncQueryRoutes)
app.use('/api/query', queryEstimateRoutes)
app.use('/api/query', progressiveQueryRoutes)
app.use('/api/batch', batchQueryRoutes)
app.use('/api/query-count', queryCountRoutes)
app.use('/api', downloadRoutes) // 通用下载路由
app.use('/api', larkDownloadRoutes) // Lark文件下载路由
app.use('/api', multiReportRoutes) // 多报告发送API
app.use('/api', testRoutes) // 测试路由

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    requestId: req.requestId
  })
})

// 全局错误处理
app.use((error, req, res, next) => {
  logger.error(`Request ${req.requestId} failed:`, error)
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  })
})

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 Query Backend Server running on port ${PORT}`)
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
})

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

module.exports = app