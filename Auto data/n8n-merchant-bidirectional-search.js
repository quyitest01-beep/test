// n8n Code Node: 双向商户查询 (ID ↔ 名称)
// 基于您现有的商户数据结构

const items = $input.all();
const results = [];

// 从您的 JSON 文件加载商户数据 (这里需要根据实际数据调整)
function loadMerchantData() {
  // 示例数据结构，您需要根据实际的 JSON 文件调整
  return {
    "1698202251": { name: "betfiery", mainMerchant: "RD1" },
    "1698202252": { name: "example", mainMerchant: "RD2" },
    // 可以从 shangy.json, sy.json 等文件动态加载
  };
}

function searchMerchant(query) {
  const merchants = loadMerchantData();
  const queryClean = query.toLowerCase().trim();
  
  // 1. 直接ID匹配
  if (merchants[query]) {
    return {
      found: true,
      merchant: {
        id: query,
        name: merchants[query].name,
        mainMerchant: merchants[query].mainMerchant
      },
      searchType: "id_exact"
    };
  }
  
  // 2. 商户名匹配
  for (const [id, info] of Object.entries(merchants)) {
    if (info.name.toLowerCase() === queryClean) {
      return {
        found: true,
        merchant: { id, name: info.name, mainMerchant: info.mainMerchant },
        searchType: "name_exact"
      };
    }
  }
  
  // 3. 模糊匹配
  for (const [id, info] of Object.entries(merchants)) {
    if (info.name.toLowerCase().includes(queryClean) || queryClean.includes(info.name.toLowerCase())) {
      return {
        found: true,
        merchant: { id, name: info.name, mainMerchant: info.mainMerchant },
        searchType: "fuzzy"
      };
    }
  }
  
  // 4. 从文本中提取ID
  const idPattern = /\d{10,}/g;
  const matches = query.match(idPattern);
  if (matches) {
    for (const match of matches) {
      if (merchants[match]) {
        return {
          found: true,
          merchant: {
            id: match,
            name: merchants[match].name,
            mainMerchant: merchants[match].mainMerchant
          },
          searchType: "id_extracted"
        };
      }
    }
  }
  
  return { found: false, merchant: null, searchType: "not_found" };
}

for (const item of items) {
  try {
    const data = item.json;
    
    // 提取查询内容
    const queryText = data.dataSource?.queryText || data.query || data.text || "";
    
    if (!queryText) {
      throw new Error('缺少查询文本');
    }
    
    // 执行搜索
    const searchResult = searchMerchant(queryText);
    
    // 生成回复消息
    let replyMessage;
    if (searchResult.found) {
      const m = searchResult.merchant;
      replyMessage = `✅ 找到商户信息：\n📋 商户名称：${m.name}\n🏢 主商户：${m.mainMerchant}\n🆔 商户ID：${m.id}`;
    } else {
      replyMessage = `❌ 未找到商户信息\n🔍 查询：${queryText}\n💡 请检查商户名或ID是否正确`;
    }
    
    // 构建响应
    const result = {
      code: searchResult.found ? 0 : 1,
      expire: 6133,
      msg: searchResult.found ? "ok" : "not_found",
      tenant_access_token: data.tenant_access_token || "",
      replyMessage: replyMessage,
      larkMessage: {
        msg_type: "text",
        content: { text: replyMessage }
      },
      larkParams: data.larkParams || {},
      larkReply: {
        msg_type: "text",
        content: { text: replyMessage },
        ...(data.larkParams || {})
      },
      dataSource: {
        merchantCount: Object.keys(loadMerchantData()).length,
        hasLarkEvent: true,
        paramCount: data.larkParams ? Object.keys(data.larkParams).length : 0,
        queryText: queryText,
        searchType: searchResult.searchType,
        found: searchResult.found
      }
    };
    
    results.push(result);
    
  } catch (error) {
    results.push({
      code: -1,
      msg: `错误: ${error.message}`,
      replyMessage: `❌ 处理错误: ${error.message}`,
      larkMessage: {
        msg_type: "text",
        content: { text: `❌ 处理错误: ${error.message}` }
      },
      dataSource: { hasError: true, errorMessage: error.message }
    });
  }
}

return results;