// n8n Code Node: 为 HTTP Request 节点生成 Lark API 配置
// 基于上游数据生成正确的 API 调用参数

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    const inputData = item.json;
    
    // 验证必要字段
    if (!inputData.larkParams || !inputData.larkParams.message_id) {
      throw new Error('缺少必要的 larkParams 或 message_id');
    }
    
    if (!inputData.tenant_access_token) {
      throw new Error('缺少 tenant_access_token');
    }
    
    // 提取数据
    const messageId = inputData.larkParams.message_id;
    const accessToken = inputData.tenant_access_token;
    const replyContent = inputData.larkMessage || {
      msg_type: "text",
      content: {
        text: inputData.replyMessage || "默认回复消息"
      }
    };
    
    // 构建 Lark API URL (使用 reply 接口)
    const apiUrl = `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}/reply`;
    
    // 构建请求体
    const requestBody = {
      msg_type: replyContent.msg_type,
      content: replyContent.content
    };
    
    // 构建 HTTP Request 节点需要的配置格式
    const httpConfig = {
      // URL 配置
      url: apiUrl,
      
      // Headers 配置
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      
      // Body 配置
      body: requestBody,
      
      // 原始数据保留
      originalData: {
        code: inputData.code || 0,
        expire: inputData.expire || 6133,
        msg: inputData.msg || "ok",
        tenant_access_token: accessToken,
        replyMessage: inputData.replyMessage,
        larkMessage: inputData.larkMessage,
        larkParams: inputData.larkParams,
        larkReply: inputData.larkReply,
        dataSource: inputData.dataSource
      }
    };
    
    results.push(httpConfig);
    
  } catch (error) {
    // 错误处理
    const errorConfig = {
      url: "https://httpbin.org/status/400", // 错误测试 URL
      headers: {
        Authorization: "Bearer invalid",
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        error: error.message,
        timestamp: new Date().toISOString()
      },
      originalData: {
        code: -1,
        msg: `配置错误: ${error.message}`,
        error: error.message
      }
    };
    
    results.push(errorConfig);
  }
}

return results;