/**
 * 验证下载URL功能实现
 * 检查代码修改是否正确
 */

const fs = require('fs');
const path = require('path');

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContains(filePath, searchText) {
  if (!checkFileExists(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(searchText);
}

function verifyImplementation() {
  console.log('🔍 验证下载URL功能实现...\n');

  const checks = [
    {
      name: '检查 athenaService.js 是否导入了 s3-request-presigner',
      file: 'backend/services/athenaService.js',
      search: '@aws-sdk/s3-request-presigner',
      required: true
    },
    {
      name: '检查 athenaService.js 是否有 generatePresignedDownloadUrl 方法',
      file: 'backend/services/athenaService.js',
      search: 'generatePresignedDownloadUrl',
      required: true
    },
    {
      name: '检查 query.js 是否添加了下载URL生成逻辑',
      file: 'backend/routes/query.js',
      search: 'downloadUrl = await athenaService.generatePresignedDownloadUrl',
      required: true
    },
    {
      name: '检查 query.js 是否有500KB文件大小判断',
      file: 'backend/routes/query.js',
      search: 'fileSize.totalSizeBytes > 500 * 1024',
      required: true
    },
    {
      name: '检查 package.json 是否添加了 s3-request-presigner 依赖',
      file: 'backend/package.json',
      search: '@aws-sdk/s3-request-presigner',
      required: true
    },
    {
      name: '检查测试脚本是否存在',
      file: 'test-file-size-batch-with-download-url.js',
      search: 'testFileSizeBatchWithDownloadUrl',
      required: false
    },
    {
      name: '检查安装脚本是否存在',
      file: 'install-s3-presigner.bat',
      search: 'npm install @aws-sdk/s3-request-presigner',
      required: false
    },
    {
      name: '检查使用文档是否存在',
      file: 'file-size-batch-download-url-guide.md',
      search: '文件大小批量查询API下载链接功能',
      required: false
    }
  ];

  let passedChecks = 0;
  let requiredChecks = 0;

  checks.forEach((check, index) => {
    const checkNumber = (index + 1).toString().padStart(2, '0');
    
    if (check.required) {
      requiredChecks++;
    }

    if (checkFileContains(check.file, check.search)) {
      console.log(`✅ ${checkNumber}. ${check.name}`);
      passedChecks++;
    } else {
      const status = check.required ? '❌' : '⚠️ ';
      console.log(`${status} ${checkNumber}. ${check.name}`);
      
      if (!checkFileExists(check.file)) {
        console.log(`     📁 文件不存在: ${check.file}`);
      } else {
        console.log(`     🔍 未找到内容: ${check.search}`);
      }
    }
  });

  console.log('\n📊 验证结果:');
  console.log(`   总检查项: ${checks.length}`);
  console.log(`   通过检查: ${passedChecks}`);
  console.log(`   必需检查: ${requiredChecks}`);
  
  const requiredPassed = checks.filter((check, index) => 
    check.required && checkFileContains(check.file, check.search)
  ).length;
  
  console.log(`   必需通过: ${requiredPassed}`);

  if (requiredPassed === requiredChecks) {
    console.log('\n🎉 所有必需的修改都已完成！');
    console.log('\n📋 下一步操作:');
    console.log('   1. 运行 install-s3-presigner.bat 安装依赖');
    console.log('   2. 重启后端服务');
    console.log('   3. 运行 node test-file-size-batch-with-download-url.js 测试功能');
  } else {
    console.log('\n⚠️  还有必需的修改未完成，请检查上述失败项。');
  }

  return requiredPassed === requiredChecks;
}

// 运行验证
console.log('🚀 开始验证实现...\n');
const success = verifyImplementation();
process.exit(success ? 0 : 1);