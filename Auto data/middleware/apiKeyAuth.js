/**
 * API Key 认证中间件
 */

const logger = require('../utils/logger')

// API Key 从环境变量读取，如果没有则使用默认值
const API_KEY = process.env.API_KEY || 'f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d'

/**
 * API Key 认证中间件
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    logger.warn('API request without API key', {
      path: req.path,
      ip: req.ip
    })
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required'
    })
  }

  if (apiKey !== API_KEY) {
    logger.warn('API request with invalid API key', {
      path: req.path,
      ip: req.ip,
      providedKey: apiKey.substring(0, 10) + '...'
    })
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Invalid API key'
    })
  }

  // API key 验证通过
  next()
}

module.exports = apiKeyAuth
