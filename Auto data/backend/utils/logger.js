const winston = require('winston')
const path = require('path')

// 创建日志目录
const logDir = path.join(__dirname, '../logs')
const fs = require('fs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`
    }
    return log
  })
)

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'athena-query-backend' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
})

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }))
}

// 添加请求日志方法
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`
  }
  
  if (res.statusCode >= 400) {
    logger.warn('Request completed with error', logData)
  } else {
    logger.info('Request completed', logData)
  }
}

// 添加查询日志方法
logger.logQuery = (requestId, queryData) => {
  logger.info('Athena query executed', {
    requestId,
    queryId: queryData.queryId,
    sql: queryData.sql?.substring(0, 200) + (queryData.sql?.length > 200 ? '...' : ''),
    executionTime: queryData.executionTime,
    dataScanned: queryData.dataScanned,
    cost: queryData.cost,
    recordCount: queryData.recordCount
  })
}

module.exports = logger