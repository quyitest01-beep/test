/**
 * 调试脚本：检查Athena查询状态和S3文件
 */

const { AthenaClient, GetQueryExecutionCommand } = require('@aws-sdk/client-athena');
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// 配置AWS
const credentials = {
  accessKeyId: 'AKIAQQJLCWBOOKC7J6ZI',
  secretAccessKey: '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'
};

const athena = new AthenaClient({ 
  region: 'us-west-2',
  credentials
});

const s3 = new S3Client({ 
  region: 'us-west-2',
  credentials
});

// 要检查的查询ID
const queryIds = [
  '20c19c3c-7f4b-470e-a144-e26974a302a6',
  'b7d5033a-8dd9-48cc-9d12-54b317db8fac',
  'bd43f1a3-038b-42ad-8054-8e9b6306d881'
];

async function checkQueryStatus(queryId) {
  try {
    console.log(`\n========== 检查查询: ${queryId} ==========`);
    
    // 1. 获取查询执行状态
    const command = new GetQueryExecutionCommand({
      QueryExecutionId: queryId
    });
    
    const result = await athena.send(command);
    
    const execution = result.QueryExecution;
    console.log(`状态: ${execution.Status.State}`);
    console.log(`提交时间: ${execution.Status.SubmissionDateTime}`);
    
    if (execution.Status.CompletionDateTime) {
      console.log(`完成时间: ${execution.Status.CompletionDateTime}`);
    }
    
    if (execution.Status.StateChangeReason) {
      console.log(`状态原因: ${execution.Status.StateChangeReason}`);
    }
    
    // 2. 检查输出位置
    if (execution.ResultConfiguration && execution.ResultConfiguration.OutputLocation) {
      const outputLocation = execution.ResultConfiguration.OutputLocation;
      console.log(`输出位置: ${outputLocation}`);
      
      // 解析S3路径
      const match = outputLocation.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        const bucket = match[1];
        const key = match[2];
        
        console.log(`Bucket: ${bucket}`);
        console.log(`Key: ${key}`);
        
        // 3. 检查文件是否存在
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: bucket,
            Key: key
          });
          
          const headResult = await s3.send(headCommand);
          
          console.log(`✅ 文件存在!`);
          console.log(`文件大小: ${headResult.ContentLength} bytes (${(headResult.ContentLength / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`Content-Type: ${headResult.ContentType}`);
          console.log(`最后修改: ${headResult.LastModified}`);
          
        } catch (s3Error) {
          if (s3Error.name === 'NotFound') {
            console.log(`❌ 文件不存在: ${key}`);
            
            // 尝试列出目录下的文件
            console.log(`\n尝试列出目录下的文件...`);
            const dirKey = key.substring(0, key.lastIndexOf('/') + 1);
            try {
              const listCommand = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: dirKey,
                MaxKeys: 10
              });
              
              const listResult = await s3.send(listCommand);
              
              if (listResult.Contents && listResult.Contents.length > 0) {
                console.log(`找到 ${listResult.Contents.length} 个文件:`);
                listResult.Contents.forEach(obj => {
                  console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
                });
              } else {
                console.log(`目录为空或不存在`);
              }
            } catch (listError) {
              console.log(`无法列出目录: ${listError.message}`);
            }
          } else {
            console.log(`❌ S3错误: ${s3Error.message}`);
          }
        }
      }
    } else {
      console.log(`❌ 没有输出位置信息`);
    }
    
    // 4. 显示查询统计
    if (execution.Statistics) {
      console.log(`\n统计信息:`);
      console.log(`  执行时间: ${execution.Statistics.TotalExecutionTimeInMillis || 0} ms`);
      console.log(`  数据扫描: ${((execution.Statistics.DataScannedInBytes || 0) / 1024 / 1024).toFixed(2)} MB`);
    }
    
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
  }
}

async function main() {
  console.log('开始检查查询状态...\n');
  
  for (const queryId of queryIds) {
    await checkQueryStatus(queryId);
  }
  
  console.log('\n========== 检查完成 ==========');
}

main().catch(console.error);
