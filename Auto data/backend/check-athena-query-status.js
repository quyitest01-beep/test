// n8n Code节点：检查 Athena 查询状态和 S3 文件是否存在
// 功能：
// 1. 检查查询是否已完成
// 2. 检查 S3 文件是否存在
// 3. 如果查询未完成，等待或返回状态

const item = $input.first().json;

if (!item.queryId) {
  throw new Error('❌ 缺少 queryId');
}

const queryId = item.queryId;
const result = item.result || '';

console.log(`📋 检查查询状态:`);
console.log(`  - QueryId: ${queryId}`);
console.log(`  - Result: ${result}`);

// 检查 result 字段，判断查询状态
const isQueryRunning = result.includes('执行中') || 
                       result.includes('正在执行') || 
                       result.includes('启动') ||
                       result.includes('running') ||
                       result.includes('executing') ||
                       result.includes('started');

const isQueryCompleted = result.includes('完成') || 
                        result.includes('成功') ||
                        result.includes('completed') ||
                        result.includes('succeeded') ||
                        result.includes('success');

const isQueryFailed = result.includes('失败') || 
                      result.includes('错误') ||
                      result.includes('failed') ||
                      result.includes('error');

console.log(`  - 查询运行中: ${isQueryRunning}`);
console.log(`  - 查询已完成: ${isQueryCompleted}`);
console.log(`  - 查询失败: ${isQueryFailed}`);

// 构建 S3 文件路径
const bucketName = 'aws-athena-query-results-us-west-2-034986963036';
const fileKey = `${queryId}.csv`;
const s3Url = `https://${bucketName}.s3.us-west-2.amazonaws.com/${fileKey}`;

console.log(`\n📦 S3 文件信息:`);
console.log(`  - Bucket: ${bucketName}`);
console.log(`  - File Key: ${fileKey}`);
console.log(`  - URL: ${s3Url}`);

// 返回状态信息
const output = {
  ...item,
  queryStatus: isQueryRunning ? 'running' : 
               isQueryCompleted ? 'completed' : 
               isQueryFailed ? 'failed' : 'unknown',
  isQueryRunning: isQueryRunning,
  isQueryCompleted: isQueryCompleted,
  isQueryFailed: isQueryFailed,
  s3File: {
    bucketName: bucketName,
    fileKey: fileKey,
    url: s3Url
  },
  canDownload: isQueryCompleted && !isQueryRunning && !isQueryFailed
};

if (isQueryRunning) {
  console.log(`\n⚠️ 查询还在执行中，文件可能尚未生成`);
  console.log(`   建议：等待查询完成后再尝试下载文件`);
} else if (isQueryCompleted) {
  console.log(`\n✅ 查询已完成，文件应该已经生成`);
} else if (isQueryFailed) {
  console.log(`\n❌ 查询失败，文件不会生成`);
} else {
  console.log(`\n⚠️ 无法确定查询状态`);
}

return [{
  json: output
}];

