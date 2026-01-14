// n8n Function节点：根据target period获取sheet id
// 功能：自动计算上个月，并从上游输出中查找对应period的sheet id

async function execute() {
  try {
    console.log("=== 开始获取sheet id ===");
    
    // 计算上个月（格式：YYYY年MM月，例如：2025年11月）
    function getLastMonth() {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = lastMonth.getFullYear();
      const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
      return `${year}年${month}月`;
    }
    
    // 自动计算目标期间（上个月）
    const targetPeriod = getLastMonth();
    console.log("📅 自动计算目标期间（上个月）:", targetPeriod);
    
    // 获取输入数据
    const inputItems = $input.all();
    console.log("📊 输入数据项数:", inputItems.length);
    
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }
    
    // 查找包含表格信息和 token 的输入项
    let spreadsheetData = null;
    let tenantAccessToken = null;
    
    for (let i = 0; i < inputItems.length; i++) {
      const item = inputItems[i];
      const json = item.json || {};
      console.log(`检查第${i + 1}个输入项:`, Object.keys(json));
      
      // 查找包含sheets信息的项 (code: 0, data.sheets)
      if (json.code === 0 && json.data && json.data.sheets) {
        spreadsheetData = json;
        console.log("✅ 找到表格数据");
      }
      
      // 查找 tenant_access_token
      if (!tenantAccessToken && typeof json.tenant_access_token === "string" && json.tenant_access_token) {
        tenantAccessToken = json.tenant_access_token;
        console.log("✅ 找到 tenant_access_token");
      }
    }
    
    if (!spreadsheetData) {
      throw new Error("没有找到表格数据 (code: 0, data.sheets)");
    }
    
    if (!tenantAccessToken) {
      throw new Error("没有找到 tenant_access_token");
    }
    
    console.log("📋 目标期间:", targetPeriod);
    console.log("📋 可用sheets数量:", spreadsheetData.data.sheets.length);
    
    // 显示所有可用的sheets
    spreadsheetData.data.sheets.forEach((sheet, index) => {
      console.log(`Sheet ${index + 1}: "${sheet.title}" (ID: ${sheet.sheetId})`);
    });
    
    // 查找匹配的sheet - 精确匹配title
    const matchingSheet = spreadsheetData.data.sheets.find(sheet => {
      const isMatch = sheet.title === targetPeriod;
      console.log(`检查: "${sheet.title}" === "${targetPeriod}" → ${isMatch ? '✅' : '❌'}`);
      return isMatch;
    });
    
    if (!matchingSheet) {
      // 如果没有找到精确匹配，返回错误信息
      console.log("❌ 没有找到精确匹配的sheet");
      
      const result = {
        status: "error",
        message: `没有找到title为 "${targetPeriod}" 的sheet`,
        timestamp: new Date().toISOString(),
        target_period: targetPeriod,
        tenant_access_token: tenantAccessToken,
        available_sheets: spreadsheetData.data.sheets.map(sheet => ({
          sheet_id: sheet.sheetId,
          title: sheet.title,
          row_count: sheet.rowCount,
          column_count: sheet.columnCount
        })),
        spreadsheet_info: {
          token: spreadsheetData.data.spreadsheetToken,
          title: spreadsheetData.data.properties.title,
          sheet_count: spreadsheetData.data.properties.sheetCount
        }
      };
      
      return [{
        json: result
      }];
    }
    
    // 找到匹配的sheet
    console.log("✅ 找到匹配的sheet:", matchingSheet.title);
    
    const result = {
      status: "success",
      message: `找到匹配的sheet: ${matchingSheet.title}`,
      timestamp: new Date().toISOString(),
      target_period: targetPeriod,
      sheet_id: matchingSheet.sheetId,
      sheet_title: matchingSheet.title,
      tenant_access_token: tenantAccessToken,
      spreadsheet_token: spreadsheetData.data.spreadsheetToken,
      sheet_info: {
        sheet_id: matchingSheet.sheetId,
        sheet_title: matchingSheet.title,
        row_count: matchingSheet.rowCount,
        column_count: matchingSheet.columnCount,
        index: matchingSheet.index
      },
      spreadsheet_info: {
          token: spreadsheetData.data.spreadsheetToken,
          title: spreadsheetData.data.properties.title,
          sheet_count: spreadsheetData.data.properties.sheetCount
        }
      };
    
    console.log("=== 获取sheet id完成 ===");
    console.log("📅 目标期间:", targetPeriod);
    console.log("📋 匹配sheet:", matchingSheet.title);
    console.log("🆔 Sheet ID:", matchingSheet.sheetId);
    
    return [{
      json: result
    }];
    
  } catch (error) {
    console.error("=== 获取sheet id时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
    
    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: $input.all ? $input.all().length : "无法获取",
          input_data: $input.all() ? $input.all().map(item => Object.keys(item.json || {})) : "无数据",
          error_type: error.constructor.name
        }
      }
    }];
  }
}

return execute();

