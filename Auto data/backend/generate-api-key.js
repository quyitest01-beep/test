const crypto = require('crypto')
const apiKey = crypto.randomBytes(32).toString('hex')
console.log('生成的 API Key:', apiKey)

