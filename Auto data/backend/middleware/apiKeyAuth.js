/**
 * API Key 认证中间件
 * 用于保护 webhook 和外部集成接口
 */

const logger = require('../utils/logger')

/**
 * API Key 认证中间件
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey
  
  // 从环境变量获取有效的API密钥
  const validApiKeys = (process.env.API_KEYS || '').split(',').filter(key => key.trim())
  
  if (!apiKey) {
    logger.warn('API key authentication failed: No API key provided', {
      ip: req.ip,
      path: req.path
    })
    
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid API key in X-API-Key header or apiKey query parameter'
    })
  }
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('API key authentication failed: Invalid API key', {
      ip: req.ip,
      path: req.path,
      providedKey: apiKey.substring(0, 8) + '...' // 只记录部分密钥用于调试
    })
    
    return res.status(403).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid API key'
    })
  }
  
  // 认证成功
  logger.info('API key authentication successful', {
    path: req.path,
    keyPrefix: apiKey.substring(0, 8)
  })
  
  next()
}

module.exports = apiKeyAuth







