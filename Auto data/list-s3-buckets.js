/**
 * 查看现有的 S3 存储桶
 * 使用提供的 AWS 凭证列出所有存储桶
 */

require('dotenv').config()
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3')

// 初始化 S3 客户端
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

async function listBuckets() {
  console.log('\n🔍 查看 AWS S3 存储桶...\n')
  
  try {
    const command = new ListBucketsCommand({})
    const response = await s3Client.send(command)
    
    console.log('📦 现有的 S3 存储桶:')
    console.log('=' * 50)
    
    if (response.Buckets && response.Buckets.length > 0) {
      response.Buckets.forEach((bucket, index) => {
        console.log(`${index + 1}. ${bucket.Name}`)
        console.log(`   创建时间: ${bucket.CreationDate}`)
        console.log('')
      })
      
      console.log(`\n✅ 总共找到 ${response.Buckets.length} 个存储桶`)
      
      // 推荐适合 Athena 的存储桶
      const athenaBuckets = response.Buckets.filter(bucket => 
        bucket.Name.toLowerCase().includes('athena') || 
        bucket.Name.toLowerCase().includes('query') ||
        bucket.Name.toLowerCase().includes('data') ||
        bucket.Name.toLowerCase().includes('gmp')
      )
      
      if (athenaBuckets.length > 0) {
        console.log('\n🎯 推荐用于 Athena 的存储桶:')
        athenaBuckets.forEach(bucket => {
          console.log(`   - ${bucket.Name}`)
        })
      } else {
        console.log('\n💡 建议创建一个新的存储桶用于 Athena:')
        console.log('   - athena-query-results-gmp')
        console.log('   - gmp-athena-results')
        console.log('   - data-query-results')
      }
      
    } else {
      console.log('❌ 没有找到任何存储桶')
      console.log('\n💡 需要创建一个新的存储桶用于 Athena')
    }
    
  } catch (error) {
    console.log(`❌ 获取存储桶列表失败: ${error.message}`)
    
    if (error.name === 'CredentialsProviderError') {
      console.log('\n💡 可能的原因:')
      console.log('   - Access Key ID 或 Secret Access Key 错误')
      console.log('   - 凭证权限不足')
    } else if (error.name === 'AccessDeniedException') {
      console.log('\n💡 可能的原因:')
      console.log('   - IAM 用户没有 S3 权限')
      console.log('   - 需要 s3:ListAllMyBuckets 权限')
    }
    
    return false
  }
  
  return true
}

// 主函数
async function main() {
  const success = await listBuckets()
  process.exit(success ? 0 : 1)
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})












