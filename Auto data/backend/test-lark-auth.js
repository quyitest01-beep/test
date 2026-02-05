// 测试Lark认证是否正常工作
const axios = require('axios');
require('dotenv').config();

async function testLarkAuth() {
  console.log('=== 测试Lark认证 ===');
  console.log(`App ID: ${process.env.LARK_APP_ID}`);
  console.log(`App Secret: ${process.env.LARK_APP_SECRET ? '已设置' : '未设置'}`);
  
  try {
    // 测试获取tenant_access_token
    const tokenResponse = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET
    });

    console.log('Token响应状态:', tokenResponse.status);
    console.log('Token响应数据:', tokenResponse.data);

    if (tokenResponse.data.code === 0) {
      console.log('✅ Lark认证成功！');
      console.log(`Token: ${tokenResponse.data.tenant_access_token.substring(0, 20)}...`);
      console.log(`过期时间: ${tokenResponse.data.expire}秒`);
      
      // 测试一个简单的API调用
      const token = tokenResponse.data.tenant_access_token;
      
      try {
        // 尝试获取应用信息
        const appInfoResponse = await axios.get('https://open.larksuite.com/open-apis/application/v6/applications/self', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('应用信息响应:', appInfoResponse.data);
        
        if (appInfoResponse.data.code === 0) {
          console.log('✅ API调用成功！');
          console.log(`应用名称: ${appInfoResponse.data.data.app_name}`);
        } else {
          console.log('⚠️ API调用返回错误:', appInfoResponse.data.msg);
        }
      } catch (apiError) {
        console.log('⚠️ API调用失败:', apiError.response?.data || apiError.message);
      }
      
    } else {
      console.log('❌ Lark认证失败:', tokenResponse.data.msg);
    }
    
  } catch (error) {
    console.log('❌ 认证请求失败:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.log('可能的原因:');
      console.log('1. App ID 或 App Secret 不正确');
      console.log('2. 应用未启用或被禁用');
      console.log('3. 网络连接问题');
    }
  }
}

testLarkAuth();