// n8n Code节点：生成 AWS S3 预签名 URL
// 功能：为 S3 文件生成预签名 URL，避免在 HTTP Request 节点中配置 AWS 认证的区域问题

const AWS = require('aws-sdk');

// 从输入中获取参数
const item = $input.first().json;
const bucketName = 'aws-athena-query-results-us-west-2-034986963036';
const fileKey = item.queryId + '.csv';
const region = 'us-west-2';
const expiresIn = 3600; // 1小时（可以根据需要调整）

console.log(`📦 生成预签名 URL:`);
console.log(`  - Bucket: ${bucketName}`);
console.log(`  - Key: ${fileKey}`);
console.log(`  - Region: ${region}`);
console.log(`  - Expires: ${expiresIn} 秒`);

// 配置 AWS S3（使用 n8n 的 AWS 凭证）
// 注意：AWS 凭证应该已经在 n8n 的 Credentials 中配置
const s3 = new AWS.S3({
  region: region
  // AWS 凭证会自动从 n8n 的 Credentials 中获取
});

// 生成预签名 URL
const params = {
  Bucket: bucketName,
  Key: fileKey,
  Expires: expiresIn
};

try {
  const presignedUrl = s3.getSignedUrl('getObject', params);
  
  console.log(`✅ 预签名 URL 生成成功`);
  console.log(`  URL: ${presignedUrl.substring(0, 100)}...`);
  
  return [{
    json: {
      ...item,
      presignedUrl: presignedUrl,
      bucketName: bucketName,
      fileKey: fileKey,
      region: region,
      expiresIn: expiresIn
    }
  }];
} catch (error) {
  console.error(`❌ 生成预签名 URL 失败:`, error.message);
  throw new Error(`无法生成预签名 URL: ${error.message}`);
}

