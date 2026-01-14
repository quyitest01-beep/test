// Sheet匹配调试器
// 专门用于调试sheet匹配问题

async function execute() {
  try {
    console.log("=== Sheet匹配调试器开始 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 获取API响应数据
    const apiResponse = getApiResponse(inputItems);
    const tableName = getTableName(inputItems);

    if (!apiResponse) {
      throw new Error("没有找到API响应数据");
    }

    if (!tableName) {
      throw new Error("没有找到表名");
    }

    console.log("🔍 调试信息:");
    console.log("表名:", tableName);
    console.log("API响应数据结构:", Object.keys(apiResponse.data));

    // 详细分析API响应
    const debugInfo = {
      table_name: tableName,
      api_response_structure: Object.keys(apiResponse.data),
      has_replies: !!(apiResponse.data.replies),
      has_sheets: !!(apiResponse.data.sheets),
      has_spreadsheetToken: !!(apiResponse.data.spreadsheetToken),
      replies_count: apiResponse.data.replies ? apiResponse.data.replies.length : 0,
      sheets_count: apiResponse.data.sheets ? apiResponse.data.sheets.length : 0
    };

    // 分析replies字段
    if (apiResponse.data.replies && apiResponse.data.replies.length > 0) {
      console.log("📋 分析replies字段:");
      apiResponse.data.replies.forEach((reply, index) => {
        console.log(`  Reply ${index}:`, Object.keys(reply));
        if (reply.addSheet) {
          console.log(`    addSheet标题: "${reply.addSheet.title}"`);
          console.log(`    addSheet ID: "${reply.addSheet.sheetId}"`);
          console.log(`    是否匹配: ${reply.addSheet.title === tableName}`);
        }
      });
      
      debugInfo.replies_details = apiResponse.data.replies.map((reply, index) => ({
        index: index,
        has_addSheet: !!reply.addSheet,
        title: reply.addSheet ? reply.addSheet.title : null,
        sheetId: reply.addSheet ? reply.addSheet.sheetId : null,
        matches: reply.addSheet ? reply.addSheet.title === tableName : false
      }));
    }

    // 分析sheets字段
    if (apiResponse.data.sheets && apiResponse.data.sheets.length > 0) {
      console.log("📋 分析sheets字段:");
      apiResponse.data.sheets.forEach((sheet, index) => {
        console.log(`  Sheet ${index}: "${sheet.title}" (ID: ${sheet.sheetId})`);
        console.log(`    是否匹配: ${sheet.title === tableName}`);
      });
      
      debugInfo.sheets_details = apiResponse.data.sheets.map((sheet, index) => ({
        index: index,
        title: sheet.title,
        sheetId: sheet.sheetId,
        matches: sheet.title === tableName
      }));
    }

    // 尝试匹配sheet
    const matchedSheet = findMatchingSheet(apiResponse, tableName);
    
    if (matchedSheet) {
      console.log("✅ 找到匹配的sheet:", matchedSheet);
      debugInfo.matched_sheet = matchedSheet;
      debugInfo.match_success = true;
    } else {
      console.log("❌ 没有找到匹配的sheet");
      debugInfo.match_success = false;
    }

    console.log("📊 调试信息:", debugInfo);

    return [{
      json: {
        status: "debug_complete",
        message: "Sheet匹配调试完成",
        timestamp: new Date().toISOString(),
        debug_info: debugInfo
      }
    }];

  } catch (error) {
    console.error("=== Sheet匹配调试出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: $input.all ? $input.all().length : "无法获取"
        }
      }
    }];
  }
}

// 辅助函数：从输入项中获取API响应
function getApiResponse(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.code === 0 && item.json.data) {
      return item.json;
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

// 辅助函数：查找匹配的sheet
function findMatchingSheet(apiResponse, tableName) {
  // 优先从replies中获取
  if (apiResponse.data.replies && apiResponse.data.replies.length > 0) {
    for (let i = 0; i < apiResponse.data.replies.length; i++) {
      const reply = apiResponse.data.replies[i];
      if (reply.addSheet && reply.addSheet.title === tableName) {
        return {
          source: "replies",
          index: i,
          sheetId: reply.addSheet.sheetId,
          title: reply.addSheet.title
        };
      }
    }
  }
  
  // 从sheets中查找匹配的sheet
  if (apiResponse.data.sheets && apiResponse.data.sheets.length > 0) {
    for (let i = 0; i < apiResponse.data.sheets.length; i++) {
      const sheet = apiResponse.data.sheets[i];
      if (sheet.title === tableName) {
        return {
          source: "sheets",
          index: i,
          sheetId: sheet.sheetId,
          title: sheet.title
        };
      }
    }
  }
  
  return null;
}

return execute();





