const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')

// 基础健康检查
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Athena Query Backend is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    requestId: req.requestId
  })
})

// 详细健康检查
router.get('/detailed', async (req, res) => {
  const healthCheck = {
    success: true,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform
    },
    services: {
      aws: 'checking',
      athena: 'checking',
      s3: 'checking'
    }
  }

  try {
    // 检查AWS服务连接
    const awsHealth = await checkAWSServices()
    healthCheck.services = { ...healthCheck.services, ...awsHealth }
    
    logger.info('Health check completed', { requestId: req.requestId, services: healthCheck.services })
    
    res.json(healthCheck)
  } catch (error) {
    logger.error('Health check failed', { requestId: req.requestId, error: error.message })
    
    healthCheck.success = false
    healthCheck.error = error.message
    
    res.status(503).json(healthCheck)
  }
})

// 检查AWS服务状态
async function checkAWSServices() {
  const services = {
    aws: 'unknown',
    athena: 'unknown',
    s3: 'unknown'
  }

  try {
    // 这里可以添加实际的AWS服务检查
    // 目前返回基础状态
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      services.aws = 'configured'
      services.athena = 'configured'
      services.s3 = 'configured'
    } else {
      services.aws = 'not_configured'
      services.athena = 'not_configured'
      services.s3 = 'not_configured'
    }
  } catch (error) {
    services.aws = 'error'
    services.athena = 'error'
    services.s3 = 'error'
  }

  return services
}

module.exports = router