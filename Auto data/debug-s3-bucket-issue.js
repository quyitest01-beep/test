/**
 * 调试S3 bucket无法确定的问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 调试S3 Bucket配置问题\n');

// 手动读取.env文件
const envPath = path.join(__dirname, 'backend', '.env');
console.log(`📁 .env文件路径: ${envPath}`);

if (fs.existsSync(envPath)) {
  console.log('✅ .env文件存在');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  // 解析环境变量
  const envVars = {};
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  console.log('\n📋 解析的环境变量:');
  console.log(`   ATHENA_OUTPUT_LOCATION: "${envVars.ATHENA_OUTPUT_LOCATION || 'undefined'}"`);
  console.log(`   AWS_REGION: "${envVars.AWS_REGION || 'undefined'}"`);
  console.log(`   AWS_ACCESS_KEY_ID: "${envVars.AWS_ACCESS_KEY_ID ? envVars.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'undefined'}"`);
  
  // 测试bucket解析逻辑
  const outputLocation = envVars.ATHENA_OUTPUT_LOCATION;
  console.log('\n🧪 Bucket解析测试:');
  console.log(`   输入: ${outputLocation}`);

  if (outputLocation) {
    const match = outputLocation.match(/^s3:\/\/([^\/]+)/);
    console.log(`   正则匹配结果: ${match ? match[1] : 'null'}`);
    
    if (match) {
      const bucket = match[1];
      console.log(`   ✅ 解析成功: ${bucket}`);
    } else {
      console.log(`   ❌ 解析失败: 正则表达式不匹配`);
    }
  } else {
    console.log(`   ❌ 解析失败: ATHENA_OUTPUT_LOCATION 为空`);
  }
  
} else {
  console.log('❌ .env文件不存在');
}

// 模拟AthenaService的逻辑
class TestAthenaService {
  constructor() {
    this.outputLocation = process.env.ATHENA_OUTPUT_LOCATION;
    console.log(`🏗️  AthenaService构造函数:`);
    console.log(`   this.outputLocation: "${this.outputLocation}"`);
  }

  testBucketResolution(queryId) {
    console.log(`\n🧪 测试查询ID: ${queryId}`);
    
    let bucket = null;
    
    // 如果没有提供 bucket，从环境变量获取
    const outputLocation = this.outputLocation || process.env.ATHENA_OUTPUT_LOCATION;
    console.log(`   使用的outputLocation: "${outputLocation}"`);
    
    if (outputLocation) {
      const match = outputLocation.match(/^s3:\/\/([^\/]+)/);
      console.log(`   正则匹配: ${match ? `成功 -> ${match[1]}` : '失败'}`);
      
      if (match) {
        bucket = match[1];
      }
    }

    if (!bucket) {
      console.log(`   ❌ 无法确定S3 bucket`);
      return null;
    } else {
      console.log(`   ✅ 成功确定bucket: ${bucket}`);
      return bucket;
    }
  }
}

// 运行测试
const testService = new TestAthenaService();

// 测试几个查询ID
const testQueryIds = [
  '20c19c3c-7f4b-470e-a144-e26974a302a6',
  'b7d5033a-8dd9-48cc-9d12-54b317db8fac',
  'bd43f1a3-038b-42ad-8054-8e9b6306d881'
];

testQueryIds.forEach(queryId => {
  testService.testBucketResolution(queryId);
});

console.log('\n🔧 建议的修复方案:');
console.log('1. 确保 backend/.env 文件存在且包含正确的 ATHENA_OUTPUT_LOCATION');
console.log('2. 检查服务器启动时是否正确加载了 .env 文件');
console.log('3. 验证 ATHENA_OUTPUT_LOCATION 格式是否正确 (s3://bucket-name/)');
console.log('4. 重启后端服务以重新加载环境变量');