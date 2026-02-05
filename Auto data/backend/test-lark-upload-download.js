// 测试Lark文件上传和下载完整流程
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

async function testUploadDownload() {
  console.log('=== 测试Lark文件上传和下载完整流程 ===');
  
  try {
    // 1. 获取token
    console.log('\n1. 获取访问令牌...');
    const tokenResponse = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    if (tokenResponse.data.code !== 0) {
      console.log('❌ Token获取失败:', tokenResponse.data.msg);
      return;
    }

    console.log('✅ Token获取成功');
    const token = tokenResponse.data.tenant_access_token;

    // 2. 创建一个测试PDF文件
    console.log('\n2. 创建测试PDF文件...');
    const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;

    fs.writeFileSync('test-upload.pdf', testPdfContent);
    console.log('✅ 测试PDF文件创建成功');

    // 3. 上传文件到Lark
    console.log('\n3. 上传文件到Lark...');
    const form = new FormData();
    form.append('file_type', 'pdf');
    form.append('file_name', 'test-report.pdf');
    form.append('file', fs.createReadStream('test-upload.pdf'));

    const uploadResponse = await axios.post('https://open.larksuite.com/open-apis/im/v1/files', form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    });

    if (uploadResponse.data.code !== 0) {
      console.log('❌ 文件上传失败:', uploadResponse.data.msg);
      return;
    }

    const fileKey = uploadResponse.data.data.file_key;
    console.log('✅ 文件上传成功！');
    console.log(`File Key: ${fileKey}`);

    // 4. 测试下载文件
    console.log('\n4. 测试下载文件...');
    const downloadResponse = await axios.get(`https://open.larksuite.com/open-apis/im/v1/files/${fileKey}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'stream'
    });

    console.log(`下载响应状态: ${downloadResponse.status}`);
    
    if (downloadResponse.status === 200) {
      console.log('✅ 文件下载成功！');
      
      // 保存下载的文件
      const writeStream = fs.createWriteStream('test-downloaded.pdf');
      downloadResponse.data.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log('📄 文件已保存为: test-downloaded.pdf');
        
        // 5. 测试我们的后端代理
        console.log('\n5. 测试后端代理下载...');
        testBackendProxy(fileKey);
      });
    }

  } catch (error) {
    console.log('❌ 测试过程出错:', error.response?.data || error.message);
  }
}

async function testBackendProxy(fileKey) {
  try {
    const proxyResponse = await axios.get(`http://localhost:8000/lark-download/${fileKey}`, {
      responseType: 'stream'
    });

    console.log(`代理响应状态: ${proxyResponse.status}`);
    
    if (proxyResponse.status === 200) {
      console.log('✅ 后端代理下载成功！');
      console.log(`下载URL: http://localhost:8000/lark-download/${fileKey}`);
      
      const writeStream = fs.createWriteStream('test-proxy-downloaded.pdf');
      proxyResponse.data.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log('📄 代理下载文件已保存为: test-proxy-downloaded.pdf');
        console.log('\n🎉 完整测试成功！');
        console.log(`\n📋 你可以在n8n中使用这个file_key: ${fileKey}`);
        console.log(`📋 或者直接使用代理URL: http://localhost:8000/lark-download/${fileKey}`);
      });
    }
  } catch (error) {
    console.log('❌ 后端代理测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
testUploadDownload();