// n8n Function节点：Lark商户数据写入器 (优化版)
// 处理商户活跃用户数据，支持多商户和详细的数据统计

async function execute() {
  const inputItems = $input.all();
  
  try {
    console.log("=== 开始处理商户数据写入Lark表格 (优化版) ===");

    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 获取API响应数据
    const apiResponse = getApiResponse(inputItems);
    // 获取商户数据
    const merchantData = getMerchantData(inputItems);
    // 获取tenant_access_token
    const tenantAccessToken = getTenantAccessToken(inputItems);
    // 获取表名
    const tableName = getTableName(inputItems);

    if (!apiResponse) {
      throw new Error("缺少API响应数据，无法获取sheet信息");
    }
    if (!merchantData || !Array.isArray(merchantData) || merchantData.length === 0) {
      throw new Error("商户数据无效或为空");
    }
    if (!tenantAccessToken) {
      throw new Error("缺少tenant_access_token，无法构建请求");
    }
    if (!tableName) {
      throw new Error("缺少表名，无法匹配sheet");
    }

    console.log("找到商户数据，数量:", merchantData.length);
    console.log("找到tenant_access_token:", tenantAccessToken ? `${tenantAccessToken.substring(0, 10)}...` : "未找到");
    console.log("找到表名:", tableName);

    // 获取fallback spreadsheetToken（有些replies没有返回token）
  const fallbackSpreadsheetToken = findSpreadsheetTokenInInputs(inputItems);

    // 获取sheet信息
    const sheetInfo = getSheetInfo(apiResponse, tableName, fallbackSpreadsheetToken);
    if (!sheetInfo) {
      throw new Error("无法获取sheet信息");
    }

    console.log("找到sheet信息:", sheetInfo.title, "(ID:", sheetInfo.sheetId + ")");

    // 构建优化版的Lark表格数据
    const larkTableData = buildOptimizedTableData(merchantData);

    // 构建写入数据的HTTP请求配置
    const writeHttpRequest = buildLarkSheetsWriteRequest(larkTableData, sheetInfo.spreadsheetToken, sheetInfo.sheetId, tenantAccessToken);

    console.log("=== 构建完成 ===");
    console.log("表格行数:", larkTableData.length);
    console.log("写入HTTP请求配置已准备");

    return [{
      json: {
        status: "success",
        message: "Lark表格数据构建完成 (优化版)",
        timestamp: new Date().toISOString(),
        table_name: tableName,
        sheet_id: sheetInfo.sheetId,
        sheet_title: sheetInfo.title,
        spreadsheet_token: sheetInfo.spreadsheetToken,
        tenant_access_token: tenantAccessToken,
        merchant_data: merchantData,
        data_count: merchantData.length,
        // Lark API需要的字段
        lark_request_body: writeHttpRequest.body,
        headers: larkTableData[0] || [],
        values: larkTableData,
        range: `${sheetInfo.sheetId}!A1:C${larkTableData.length}`,
        http_request: writeHttpRequest,
        statistics: {
          total_rows: larkTableData.length,
          total_merchants: getUniqueMerchants(merchantData).length,
          total_users: getTotalUsers(merchantData)
        },
        matched_at: new Date().toISOString()
      }
    }];

  } catch (error) {
    console.error("=== 处理商户数据写入时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: inputItems ? inputItems.length : "无法获取",
          merchant_data_type: inputItems && inputItems[0] ? typeof inputItems[0].json : "无数据",
          merchant_data_keys: inputItems && inputItems[0] && inputItems[0].json ? Object.keys(inputItems[0].json) : "无数据"
        }
      }
    }];
  }
}

// 构建优化版的Lark表格数据
function buildOptimizedTableData(merchantData) {
  const tableData = [];
  
  // 添加表头
  tableData.push([
    "商户名",
    "日期", 
    "投注用户数"
  ]);
  
  // 按商户名A→Z排序
  const sortedMerchants = [...merchantData].sort((a, b) => {
    const nameA = (a.商户名 || "").toUpperCase();
    const nameB = (b.商户名 || "").toUpperCase();
    return nameA.localeCompare(nameB);
  });
  
  console.log("商户排序结果:", sortedMerchants.map(m => m.商户名));
  
  // 按商户分组处理
  const merchantGroups = groupByMerchant(sortedMerchants);
  
  // 添加每个商户的数据
  Object.keys(merchantGroups).forEach(merchantName => {
    const merchantData = merchantGroups[merchantName];
    
    // 先添加合计行
    const totalUsers = merchantData.reduce((sum, item) => sum + (Number(item.投注用户数) || 0), 0);
    tableData.push([
      merchantName,
      "合计",
      totalUsers
    ]);
    
    // 再添加每日数据（按日期排序）
    const dailyData = merchantData
      .filter(item => item.日期 !== "合计")
      .sort((a, b) => a.日期.localeCompare(b.日期));
    
    dailyData.forEach(item => {
      tableData.push([
        merchantName,
        item.日期,
        Number(item.投注用户数) || 0
      ]);
    });
  });
  
  // 数据验证
  console.log("=== 表格数据验证 ===");
  console.log("总行数:", tableData.length);
  console.log("表头列数:", tableData[0] ? tableData[0].length : 0);
  
  return tableData;
}

// 构建Lark电子表格写入数据的HTTP请求
function buildLarkSheetsWriteRequest(tableData, spreadsheetToken, targetSheetId, tenantAccessToken) {
  if (!tenantAccessToken) {
    throw new Error("缺少tenant_access_token，无法构建写入请求");
  }

  console.log("Lark Sheets写入配置信息:", {
    spreadsheet_token: spreadsheetToken ? `${spreadsheetToken.substring(0, 10)}...` : "未找到",
    target_sheet_id: targetSheetId,
    tenant_access_token: tenantAccessToken ? `${tenantAccessToken.substring(0, 10)}...` : "未找到"
  });

  const httpRequest = {
    method: "POST",
    url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
    headers: {
      "Authorization": `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      valueRanges: [
        {
          range: `${targetSheetId}!A1:C${tableData.length}`,
          values: tableData
        }
      ]
    })
  };
  return httpRequest;
}

// 辅助函数：从输入项中获取API响应
function getApiResponse(inputItems) {
  // 优先返回包含 sheets 的响应；若没有，再返回仅包含 replies 的响应
  let sheetsResp = null;
  let repliesResp = null;

  for (const item of inputItems) {
    if (!item || item.json == null) continue;

    // 1) 直接是对象 { code, data }
    if (!Array.isArray(item.json) && item.json.code === 0 && item.json.data) {
      const d = item.json.data;
      if (d && Array.isArray(d.sheets) && d.sheets.length > 0) {
        console.log("🔍 找到包含 sheets 的API响应(对象)");
        sheetsResp = item.json;
      } else if (d && Array.isArray(d.replies) && d.replies.length > 0) {
        console.log("🔍 找到包含 replies 的API响应(对象)");
        repliesResp = item.json;
      }
      continue;
    }

    // 2) json 是数组，取其中 code===0 的元素
    if (Array.isArray(item.json)) {
      const found = item.json.find(el => el && el.code === 0 && el.data);
      if (found) {
        const d = found.data;
        if (d && Array.isArray(d.sheets) && d.sheets.length > 0) {
          console.log("🔍 找到包含 sheets 的API响应(数组元素)");
          sheetsResp = found;
        } else if (d && Array.isArray(d.replies) && d.replies.length > 0) {
          console.log("🔍 找到包含 replies 的API响应(数组元素)");
          repliesResp = found;
        }
      }
    }

    // 3) 深度兜底：不带code，但内部包含 sheets/replies/spreadsheetToken
    const bundle = extractSheetBundleFromAny(item.json);
    if (bundle) {
      console.log("🔍 发现嵌套的sheet结构，构造兼容响应");
      // 兜底也可能有用作 sheetsResp
      if (bundle.sheets && bundle.sheets.length > 0) {
        sheetsResp = { code: 0, data: bundle, msg: "ok" };
      } else if (bundle.replies && bundle.replies.length > 0) {
        repliesResp = { code: 0, data: bundle, msg: "ok" };
      }
    }
  }

  // 如果有包含 sheets 的响应，直接返回
  if (sheetsResp) {
    try { console.log("API响应结构(sheets):", Object.keys(sheetsResp.data)); } catch {}
    return sheetsResp;
  }

  // 如果只有 replies，补齐 spreadsheetToken（从其它输入中找）
  if (repliesResp) {
    if (!repliesResp.data.spreadsheetToken) {
      const token = findSpreadsheetTokenInInputs(inputItems);
      if (token) {
        repliesResp.data.spreadsheetToken = token;
        console.log("ℹ️ 为 replies 响应补齐 spreadsheetToken");
      }
    }
    try { console.log("API响应结构(replies):", Object.keys(repliesResp.data)); } catch {}
    return repliesResp;
  }

  console.log("❌ 未找到API响应数据");
  return null;
}

// 在任意对象里提取 {sheets, replies, spreadsheetToken}
function extractSheetBundleFromAny(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // 直接命中
  if (Array.isArray(obj.sheets) || Array.isArray(obj.replies) || obj.spreadsheetToken) {
    return {
      sheets: Array.isArray(obj.sheets) ? obj.sheets : [],
      replies: Array.isArray(obj.replies) ? obj.replies : [],
      spreadsheetToken: obj.spreadsheetToken
    };
  }

  // 常见路径 data / data.data
  const paths = [
    obj.data,
    obj.data && obj.data.data,
    obj[0],
    obj[0] && obj[0].data,
    obj[0] && obj[0].data && obj[0].data.data
  ];

  for (const node of paths) {
    if (node && typeof node === 'object') {
      const hit = extractSheetBundleFromAny(node);
      if (hit) return hit;
    }
  }
  return null;
}

// 在所有输入项中搜索 spreadsheetToken
function findSpreadsheetTokenInInputs(items) {
  for (const it of items) {
    const j = it && it.json;
    if (!j) continue;
    // 直接字段
    if (typeof j.spreadsheet_token === 'string' && j.spreadsheet_token) return j.spreadsheet_token;
    if (typeof j.spreadsheetToken === 'string' && j.spreadsheetToken) return j.spreadsheetToken;
    const bundle = extractSheetBundleFromAny(j);
    if (bundle && bundle.spreadsheetToken) return bundle.spreadsheetToken;
  }
  return undefined;
}

// 辅助函数：从输入项中获取商户数据
function getMerchantData(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.merchant_data && Array.isArray(item.json.merchant_data)) {
      return item.json.merchant_data;
    }
  }
  return null;
}

// 辅助函数：从输入项中获取tenant_access_token
function getTenantAccessToken(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.tenant_access_token) {
      return item.json.tenant_access_token;
    }
  }
  return null;
}

// 辅助函数：从输入项中获取表名
function getTableName(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.table_name) {
      return item.json.table_name;
    }
  }
  return null;
}

// 辅助函数：规范化API响应中的data根节点，兼容不同返回结构
function getNormalizedDataRoot(apiResponse) {
  if (!apiResponse || !apiResponse.data) return { sheets: [], replies: [], spreadsheetToken: undefined };
  const root = apiResponse.data;
  // 有些接口会把实际数据再包一层 data
  const maybeNested = root && root.data && (root.data.sheets || root.data.replies || root.data.spreadsheetToken) ? root.data : null;
  const dataRoot = maybeNested || root;
  const sheets = Array.isArray(dataRoot.sheets) ? dataRoot.sheets : [];
  const replies = Array.isArray(dataRoot.replies) ? dataRoot.replies : [];
  const spreadsheetToken = dataRoot.spreadsheetToken || root.spreadsheetToken || apiResponse.spreadsheetToken;
  return { sheets, replies, spreadsheetToken };
}

// 辅助函数：获取sheet信息
function getSheetInfo(apiResponse, tableName, fallbackSpreadsheetToken) {
  console.log("🔍 开始匹配sheet信息");
  console.log("表名:", tableName);
  console.log("API响应数据结构:", apiResponse && apiResponse.data ? Object.keys(apiResponse.data) : []);

  const { sheets, replies, spreadsheetToken } = getNormalizedDataRoot(apiResponse);
  const token = spreadsheetToken || fallbackSpreadsheetToken;
  console.log("规范化后: sheets数量=", sheets.length, "replies数量=", replies.length, "有无spreadsheetToken=", !!token);
  
  // 优先从replies中获取
  if (replies && replies.length > 0) {
    console.log("📋 检查replies字段，共", replies.length, "个");
    
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];
      console.log(`📋 检查reply ${i}:`, Object.keys(reply));
      
      if (reply.addSheet) {
        console.log("📋 找到addSheet:", reply.addSheet);
        console.log("addSheet标题:", reply.addSheet.title);
        console.log("addSheet ID:", reply.addSheet.sheetId);
        
        // 检查标题是否匹配
        if (reply.addSheet.title === tableName) {
          console.log("✅ 在replies中找到匹配的sheet:", reply.addSheet.title);
          return {
            sheetId: reply.addSheet.sheetId,
            title: reply.addSheet.title,
            spreadsheetToken: token
          };
        }
      }
    }
  }
  
  // 从sheets中查找匹配的sheet
  if (sheets && sheets.length > 0) {
    console.log("📋 检查sheets字段，共", sheets.length, "个");
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      console.log(`📋 检查sheet ${i}:`, sheet.title, "(ID:", sheet.sheetId + ")");
      
      if (sheet.title === tableName) {
        console.log("✅ 在sheets中找到匹配的sheet:", sheet.title);
        return {
          sheetId: sheet.sheetId,
          title: sheet.title,
          spreadsheetToken: token
        };
      }
    }
    
    // 如果没有找到匹配的，使用第一个
    console.log("⚠️ 没有找到匹配的sheet，使用第一个:", sheets[0].title);
    return {
      sheetId: sheets[0].sheetId,
      title: sheets[0].title,
      spreadsheetToken: token
    };
  }
  
  console.error("❌ 没有找到任何sheet信息");
  console.error("API响应data字段内容:", apiResponse && apiResponse.data);
  return null;
}

// 从输入中兜底提取 spreadsheetToken
// 兼容旧名称，内部复用增强版查找
function getSpreadsheetTokenFromInputs(inputItems) {
  return findSpreadsheetTokenInInputs(inputItems);
}

// 辅助函数：按商户分组
function groupByMerchant(merchantData) {
  const groups = {};
  merchantData.forEach(item => {
    const merchantName = item.商户名;
    if (!groups[merchantName]) {
      groups[merchantName] = [];
    }
    groups[merchantName].push(item);
  });
  return groups;
}

// 辅助函数：获取唯一商户数量
function getUniqueMerchants(merchantData) {
  const uniqueMerchants = new Set();
  merchantData.forEach(item => {
    if (item.商户名) {
      uniqueMerchants.add(item.商户名);
    }
  });
  return Array.from(uniqueMerchants);
}

// 辅助函数：获取总用户数
function getTotalUsers(merchantData) {
  return merchantData.reduce((sum, item) => {
    return sum + (Number(item.投注用户数) || 0);
  }, 0);
}

return execute();
