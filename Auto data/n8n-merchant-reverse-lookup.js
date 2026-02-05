// n8n Code Node: 商户反向查询处理器
// 支持通过商户ID查询商户名，以及通过商户名查询ID

const items = $input.all();
const results = [];

// 商户数据映射 (从您的数据文件中提取)
const merchantData = {
  // 商户ID到商户信息的映射
  "1698202251": {
    name: "betfiery",
    mainMerchant: "RD1",
    id: "1698202251"
  },
  // 可以添加更多商户数据
  "1698202252": {
    name: "example_merchant",
    mainMerchant: "RD2", 
    id: "1698202252"
  }
  // 这里可以从您的 JSON 文件动态加载更多商户数据
};

// 创建反向映射 (商户名到ID)
const merchantNameToId = {};
const merchantIdToInfo = {};

Object.values(merchantData).forEach(merchant => {
  merchantNameToId[merchant.name.toLowerCase()] = merchant;
  merchantIdToInfo[merchant.id] = merchant;
});

function findMerchantInfo(query) {
  const queryLower = query.toLowerCase().trim();
  
  // 1. 尝试直接匹配商户ID
  if (merchantIdToInfo[query]) {
    return {
      found: true,
      type: "id_lookup",
      merchant: merchantIdToInfo[query]
    };
  }
  
  // 2. 尝试匹配商户名
  if (merchantNameToId[queryLower]) {
    return {
      found: true,
      type: "name_lookup", 
      merchant: merchantNameToId[queryLower]
    };
  }
  
  // 3. 模糊匹配商户名
  for (const [name, merchant] of Object.entries(merchantNameToId)) {
    if (name.includes(queryLower) || queryLower.includes(name)) {
      return {
        found: true,
        type: "fuzzy_match",
        merchant: merchant
      };
    }
  }
  
  // 4. 检查是否包含商户ID的查询
  const idMatch = query.match(/(\d{10,})/);
  if (idMatch && merchantIdToInfo[idMatch[1]]) {
    return {
      found: true,
      type: "id_in_text",
      merchant: merchantIdToInfo[idMatch[1]]
    };
  }
  
  return {
    found: false,
    type: "not_found",
    merchant: null
  };
}

function generateReplyMessage(searchResult, originalQuery) {
  if (!searchResult.found) {
    return `❌ 未找到商户信息\n🔍 查询内容：${originalQuery}\n💡 请检查商户名称或ID是否正确`;
  }
  
  const merchant = searchResult.merchant;
  let typeText = "";
  
  switch (searchResult.type) {
    case "id_lookup":
      typeText = "通过ID查询";
      break;
    case "name_lookup":
      typeText = "通过名称查询";
      break;
    case "fuzzy_match":
      typeText = "模糊匹配";
      break;
    case "id_in_text":
      typeText = "文本中提取ID";
      break;
  }
  
  return `✅ 找到商户信息（${typeText}）：\n📋 商户名称：${merchant.name}\n🏢 主商户：${merchant.mainMerchant}\n🆔 商户ID：${merchant.id}`;
}

for (const item of items) {
  try {
    const data = item.json;
    
    // 提取查询文本
    let queryText = "";
    if (data.dataSource && data.dataSource.queryText) {
      queryText = data.dataSource.queryText;
    } else if (data.query) {
      queryText = data.query;
    } else if (data.text) {
      queryText = data.text;
    } else {
      throw new Error('未找到查询文本');
    }
    
    // 执行商户查询
    const searchResult = findMerchantInfo(queryText);
    const replyMessage = generateReplyMessage(searchResult, queryText);
    
    // 构建 Lark 消息对象
    const larkMessage = {
      msg_type: "text",
      content: {
        text: replyMessage
      }
    };
    
    // 构建完整响应
    const result = {
      code: searchResult.found ? 0 : 1,
      expire: 6133,
      msg: searchResult.found ? "ok" : "not_found",
      tenant_access_token: data.tenant_access_token || "",
      replyMessage: replyMessage,
      larkMessage: larkMessage,
      larkParams: data.larkParams || {},
      larkReply: {
        ...larkMessage,
        ...(data.larkParams || {})
      },
      dataSource: {
        merchantCount: Object.keys(merchantData).length,
        hasLarkEvent: true,
        paramCount: data.larkParams ? Object.keys(data.larkParams).length : 0,
        queryText: queryText,
        searchType: searchResult.type,
        found: searchResult.found,
        merchantInfo: searchResult.merchant
      }
    };
    
    results.push(result);
    
  } catch (error) {
    // 错误处理
    const errorResult = {
      code: -1,
      expire: 0,
      msg: `处理失败: ${error.message}`,
      tenant_access_token: "",
      replyMessage: `❌ 查询处理错误: ${error.message}`,
      larkMessage: {
        msg_type: "text",
        content: {
          text: `❌ 查询处理错误: ${error.message}`
        }
      },
      larkParams: item.json.larkParams || {},
      larkReply: {
        msg_type: "text",
        content: {
          text: `❌ 查询处理错误: ${error.message}`
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