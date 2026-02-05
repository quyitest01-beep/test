// 诊断Lark file_key问题
const axios = require('axios');
require('dotenv').config();

async function diagnoseLarkFileKey(fileKey) {
  console.log('=== Lark File Key 诊断 ===');
  console.log(`检查的file_key: ${fileKey}`);
  console.log(`App ID: ${process.env.LARK_APP_ID}`);
  
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

    // 2. 尝试获取文件信息
    console.log('\n2. 尝试获取文件信息...');
    try {
      const metaResponse = await axios.get(`https://open.larksuite.com/open-apis/drive/v1/medias/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (metaResponse.data.code === 0) {
        console.log('✅ 文件存在！');
        console.log('文件信息:', metaResponse.data.data);
      } else {
        console.log('❌ 文件不存在或无权限访问');
        console.log('错误代码:', metaResponse.data.code);
        console.log('错误信息:', metaResponse.data.msg);
      }
    } catch (error) {
      console.log('❌ API调用失败:', error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('详细错误:', error.response.data);
      }
    }

    // 3. 分析file_key格式
    console.log('\n3. File Key 格式分析:');
    console.log(`长度: ${fileKey.length} 字符`);
    console.log(`格式: ${/^[a-zA-Z0-9_-]+$/.test(fileKey) ? '✅ 有效字符' : '❌ 包含无效字符'}`);
    
    // 标准Lark file_key通常是这样的格式
    if (fileKey.length < 10) {
      console.log('⚠️ file_key太短，可能无效');
    } else if (fileKey.length > 100) {
      console.log('⚠️ file_key太长，可能无效');
    } else {
      console.log('✅ file_key长度合理');
    }

  } catch (error) {
    console.log('❌ 诊断过程出错:', error.message);
  }
}

// 从命令行参数获取file_key，或使用默认的测试key
const fileKey = process.argv[2] || 'file_3_Onc_1a6Q6T9-2c4e-4ab7-a328-4d937af6Bfmg';
diagnoseLarkFileKey(fileKey);