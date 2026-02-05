// n8n Code Node: 精确匹配您的 Lark 请求体格式

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    const data = item.json;
    
    // 从上游数据提取信息
    const receiverId = data.larkParams.sender.sender_id.open_id;
    const accessToken = data.tenant_access_token;
    const messageText = data.replyMessage || "test content";
    
    // 构建完全匹配您示例的配置
    const config = {
      url: "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=open_id",
      
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      
      body: {
        receive_id: receiverId,
        content: `{"text":"${messageText}"}`,  // 注意：这里是字符串格式的JSON
        msg_type: "text"
      }
    };
    
    results.push(config);
    
  } catch (error) {
    results.push({
      url: "https://httpbin.org/status/400",
      headers: { Authorization: "Bearer error" },
      body: {
        receive_id: "error",
        content: `{"text":"错误: ${error.message}"}`,
        msg_type: "text"
      }
    });
  }
}

return results;