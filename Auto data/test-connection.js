/**
 * 快速测试 AWS Athena 连接
 * 使用提供的凭证进行连接测试
 */

require('dotenv').config()
const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } = require('@aws-sdk/client-athena')

// 初始化 Athena 客户端
const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

async function testConnection() {
  console.log('\n🔍 测试 AWS Athena 连接...\n')
  
  // 显示配置信息
  console.log('📋 配置信息:')
  console.log(`  区域: ${process.env.AWS_REGION}`)
  console.log(`  数据库: ${process.env.ATHENA_DATABASE}`)
  console.log(`  Access Key: ${process.env.AWS_ACCESS_KEY_ID}`)
  console.log(`  Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 10)}...`)
  
  try {
    // 测试查询
    console.log('\n🚀 执行测试查询...')
    const testSQL = 'SELECT 1 as test_column, "Hello Athena" as message'
    
    // 启动查询
    const startCommand = new StartQueryExecutionCommand({
      QueryString: testSQL,
      QueryExecutionContext: {
        Database: process.env.ATHENA_DATABASE
      },
      ResultConfiguration: {
        OutputLocation: process.env.ATHENA_OUTPUT_LOCATION
      }
    })
    
    const startResponse = await athenaClient.send(startCommand)
    const queryId = startResponse.QueryExecutionId
    console.log(`✓ 查询已启动 (ID: ${queryId})`)
    
    // 等待查询完成
    console.log('⏳ 等待查询完成...')
    let status = 'QUEUED'
    let attempts = 0
    
    while ((status === 'QUEUED' || status === 'RUNNING') && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
      
      const statusCommand = new GetQueryExecutionCommand({
        QueryExecutionId: queryId
      })
      const statusResponse = await athenaClient.send(statusCommand)
      status = statusResponse.QueryExecution.Status.State
      
      process.stdout.write(`\r   状态: ${status} (${attempts}s)`)
    }
    
    console.log('')
    
    if (status === 'SUCCEEDED') {
      console.log('✅ 查询执行成功!')
      
      // 获取结果
      const resultsCommand = new GetQueryResultsCommand({
        QueryExecutionId: queryId
      })
      const resultsResponse = await athenaClient.send(resultsCommand)
      
      const rows = resultsResponse.ResultSet.Rows
      console.log('\n📊 查询结果:')
      rows.forEach((row, index) => {
        const values = row.Data.map(cell => cell.VarCharValue || 'NULL')
        console.log(`   行 ${index + 1}: ${values.join(', ')}`)
      })
      
      console.log('\n🎉 连接测试成功! Athena 配置正确!')
      return true
      
    } else {
      console.log(`\n❌ 查询失败: ${status}`)
      return false
    }
    
  } catch (error) {
    console.log(`\n❌ 连接失败: ${error.message}`)
    
    // 提供错误诊断
    if (error.name === 'InvalidRequestException') {
      console.log('\n💡 可能的原因:')
      console.log('   - 数据库名称不正确')
      console.log('   - S3 输出位置不可访问')
      console.log('   - SQL 语法错误')
    } else if (error.name === 'CredentialsProviderError') {
      console.log('\n💡 可能的原因:')
      console.log('   - Access Key ID 或 Secret Access Key 错误')
      console.log('   - 凭证权限不足')
    } else if (error.name === 'AccessDeniedException') {
      console.log('\n💡 可能的原因:')
      console.log('   - IAM 用户权限不足')
      console.log('   - 需要 Athena 和 S3 权限')
    }
    
    return false
  }
}

// 检查必要的配置
function checkConfig() {
  console.log('🔧 检查配置...')
  
  const required = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID', 
    'AWS_SECRET_ACCESS_KEY',
    'ATHENA_DATABASE',
    'ATHENA_OUTPUT_LOCATION'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.log(`❌ 缺少配置项: ${missing.join(', ')}`)
    console.log('\n请检查 .env 文件中的配置')
    return false
  }
  
  console.log('✅ 配置检查通过')
  return true
}

// 主函数
async function main() {
  if (!checkConfig()) {
    process.exit(1)
  }
  
  const success = await testConnection()
  process.exit(success ? 0 : 1)
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})












