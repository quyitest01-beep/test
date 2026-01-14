/**
 * 简单的 S3 存储桶检查
 */

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3')

// 直接使用你提供的凭证
const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'AKIAQQJLCWBOOKC7J6ZI',
    secretAccessKey: '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'
  }
})

async function checkS3() {
  console.log('🔍 检查 S3 存储桶...')
  
  try {
    const command = new ListBucketsCommand({})
    const response = await s3Client.send(command)
    
    console.log('\n📦 找到的存储桶:')
    if (response.Buckets && response.Buckets.length > 0) {
      response.Buckets.forEach((bucket, index) => {
        console.log(`${index + 1}. ${bucket.Name}`)
      })
    } else {
      console.log('❌ 没有找到存储桶')
    }
    
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`)
    console.log(`错误类型: ${error.name}`)
  }
}

checkS3()












