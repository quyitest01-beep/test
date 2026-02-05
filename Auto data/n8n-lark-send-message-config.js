// n8n Code Node: Lark 发送消息配置 (基于您的请求体示例)
// 使用 send message API 而不是 reply API

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    const data = item.json;
    
    // 验证必要字段
    if (!data.larkParams || !data.larkParams.sender) {
      throw new Error('缺少 larkParams 或 sender 信息');
    }
    
    if (!data.tenant_access_token) {
      throw new Error('缺少 tenant_access_token');
    }
    
    // 提取发送者信息作为接收者
    const receiverId = data.larkParams.sender.sender_id.open_id;
    const accessToken = data.tenant_access_token;
    
    // 提取消息内容
    const messageText = data.replyMessage || data.larkMessage?.content?.text || "默认回复消息";
    
    // 构建配置对象 (匹配您的请求体示例)
    const config = {
      // 使用发送消息 API
      url: "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=open_id",
      
      // Headers
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      
      // Body - 匹配您的示例格式
      body: {
        receive_id: receiverId,
        content: JSON.stringify({ text: messageText }),
        msg_type: "text"
      },
      
      // 保留原始数据用于调试
      debug: {
        originalData: data,
        extractedReceiverId: receiverId,
        extractedMessage: messageText
      }
    };
    
    results.push(config);
    
  } catch (error) {
    // 错误处理
    const errorConfig = {
      url: "https://httpbin.org/status/500",
      headers: {
        Authorization: "Bearer error",
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        receive_id: "error",
        content: JSON.stringify({ text: `错误: ${error.message}` }),
        msg_type: "text"
      },
      debug: {
        error: error.message,
        originalData: item.json
      }
    };
    
    results.push(errorConfig);
  }
}

return results;