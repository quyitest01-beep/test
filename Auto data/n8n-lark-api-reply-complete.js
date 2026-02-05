// n8n Code Node: Lark API 回复配置完整版
// 使用 /message/{message_id}/reply API 回复特定消息

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // 检查输入数据
    if (!item.json.larkParams || !item.json.larkMessage) {
      throw new Error('输入数据缺少必要参数');
    }

    const larkParams = item.json.larkParams;
    const larkMessage = item.json.larkMessage;

    // 配置你的Access Token
    const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"; // 替换为你的实际token

    // 检查必要参数
    if (ACCESS_TOKEN === "YOUR_ACCESS_TOKEN_HERE") {
      throw new Error('请先设置ACCESS_TOKEN');
    }

    if (!larkParams.message_id) {
      throw new Error('缺少message_id参数，无法回复特定消息');
    }

    // 构建API URL
    const messageId = larkParams.message_id;
    const apiUrl = `https://open.larksuite.com/open-apis/im/v1/messages/${messageId}/reply`;

    // 构建请求体
    const requestBody = {
      msg_type: larkMessage.msg_type,
      content: larkMessage.content
    };

    // 构建完整的输出对象
    const result = {
      code: 0,
      expire: 6133,
      msg: "ok",
      tenant_access_token: ACCESS_TOKEN,
      replyMessage: larkMessage.content.text,
      larkMessage: larkMessage,
      larkParams: larkParams,
      larkReply: {
        ...larkMessage,
        ...larkParams
      },
      dataSource: item.json.dataSource || {
        merchantCount: 0,
        hasLarkEvent: true,
        paramCount: Object.keys(larkParams).length,
        queryText: "API回复处理"
      },
      // API调用配置
      apiConfig: {
        url: apiUrl,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: requestBody
      }
    };

    results.push(result);

  } catch (error) {
    // 错误处理
    const errorResult = {
      code: -1,
      msg: `处理失败: ${error.message}`,
      error: error.message,
      larkParams: item.json.larkParams || {},
      dataSource: {
        hasError: true,
        errorMessage: error.message,
        processedAt: new Date().toISOString()
      }
    };
    
    results.push(errorResult);
  }
}

return results;