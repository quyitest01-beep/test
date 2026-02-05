// n8n Code Node: 简化版 Lark HTTP Request 配置
// 直接匹配您现有的 HTTP Request 节点结构

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    const data = item.json;
    
    // 提取必要信息
    const messageId = data.larkParams.message_id;
    const accessToken = data.tenant_access_token;
    
    // 构建配置对象 (匹配您的 HTTP Request 节点)
    const config = {
      // URL - 使用 Lark reply API
      url: `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}/reply`,
      
      // Headers
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      
      // Body - 发送回复消息
      body: {
        msg_type: data.larkMessage.msg_type,
        content: data.larkMessage.content
      }
    };
    
    results.push(config);
    
  } catch (error) {
    results.push({
      url: "https://httpbin.org/status/500",
      headers: { Authorization: "Bearer error" },
      body: { error: error.message }
    });
  }
}

return results;