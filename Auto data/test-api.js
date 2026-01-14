/**
 * 简单的 API 测试脚本
 */

const https = require('http');

const apiKey = 'f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d';
const url = 'http://localhost:8000/api/webhook/health';

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/webhook/health',
  method: 'GET',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  }
};

console.log('🔍 测试后端 API 连接...');
console.log(`URL: ${url}`);
console.log(`API Key: ${apiKey.substring(0, 8)}...`);

const req = https.request(options, (res) => {
  console.log(`\n📊 响应状态: ${res.statusCode}`);
  console.log(`📋 响应头:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n✅ 响应内容:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.log('\n❌ 连接错误:', error.message);
  console.log('\n💡 可能的原因:');
  console.log('   - 后端服务没有启动');
  console.log('   - 端口 8000 被占用');
  console.log('   - 防火墙阻止连接');
});

req.end();












