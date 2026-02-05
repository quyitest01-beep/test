// n8n Code Node: Lark API 回复处理器
// 基于上游数据结构的完整实现

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // 从输入数据中提取所有字段
    const inputData = item.json;
    
    // 验证必要字段
    if (!inputData.larkParams) {
      throw new Error('缺少 larkParams 参数');
    }
    
    if (!inputData.larkParams.message_id) {
      throw new Error('缺少 message_id 参数');
    }
    
    // 提取核心数据
    const {
      code = 0,
      expire = 6133,
      msg = "ok",
      tenant_access_token,
      replyMessage,
      larkMessage,
      larkParams,
      dataSource
    } = inputData;
    
    // 构建 larkReply 对象（合并 larkMessage 和 larkParams）
    const larkReply = {
      msg_type: larkMessage.msg_type,
      content: larkMessage.content,
      message_id: larkParams.message_id,
      chat_id: larkParams.chat_id,
      tenant_key: larkParams.tenant_key,
      sender: larkParams.sender
    };
    
    // 构建完整的输出对象（保持与上游数据完全一致的结构）
    const result = {
      code,
      expire,
      msg,
      tenant_access_token,
      replyMessage,
      larkMessage,
      larkParams,
      larkReply,
      dataSource: dataSource || {
        merchantCount: 0,
        hasLarkEvent: true,
        paramCount: Object.keys(larkParams).length,
        queryText: "默认查询"
      }
    };
    
    results.push(result);
    
  } catch (error) {
    // 错误处理 - 返回错误信息但保持数据结构
    const errorResult = {
      code: -1,
      expire: 0,
      msg: `处理失败: ${error.message}`,
      tenant_access_token: "",
      replyMessage: `❌ 处理错误: ${error.message}`,
      larkMessage: {
        msg_type: "text",
        content: {
          text: `❌ 处理错误: ${error.message}`
        }
      },
      larkParams: item.json.larkParams || {},
      larkReply: {
        msg_type: "text",
        content: {
          text: `❌ 处理错误: ${error.message}`
        }
      },
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