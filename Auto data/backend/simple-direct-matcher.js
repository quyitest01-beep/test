// 简化直接匹配器 - 基于你提供的上游数据
const inputItems = $input.all();
console.log("=== 简化直接匹配开始 ===");
console.log("输入项数量:", inputItems.length);

// 提取数据
let apiResponse = null;
let merchantData = null;
let tableName = null;
let token = null;

inputItems.forEach((item, index) => {
  console.log(`\n📊 检查输入项 ${index}:`);
  console.log("JSON字段:", Object.keys(item.json));
  
  // 检查API响应
  if (item.json.code === 0 && item.json.data) {
    console.log("✅ 找到API响应");
    apiResponse = item.json;
    console.log("sheets数量:", item.json.data.sheets ? item.json.data.sheets.length : 0);
    console.log("spreadsheetToken:", item.json.data.spreadsheetToken ? "存在" : "不存在");
  }
  
  // 检查商户数据
  if (item.json.merchant_data) {
    console.log("✅ 找到商户数据");
    merchantData = item.json.merchant_data;
    console.log("商户数据数量:", merchantData.length);
  }
  
  // 检查表名
  if (item.json.table_name) {
    console.log("✅ 找到表名:", item.json.table_name);
    tableName = item.json.table_name;
  }
  
  // 检查token
  if (item.json.tenant_access_token) {
    console.log("✅ 找到token");
    token = item.json.tenant_access_token;
  }
});

console.log("\n=== 数据提取结果 ===");
console.log("API响应:", !!apiResponse);
console.log("商户数据:", !!merchantData);
console.log("表名:", tableName);
console.log("Token:", !!token);

// 直接匹配sheet
if (apiResponse && tableName && apiResponse.data.sheets) {
  console.log("\n=== 直接匹配Sheet ===");
  console.log("要匹配的表名:", tableName);
  console.log("可用sheets:");
  apiResponse.data.sheets.forEach((sheet, i) => {
    console.log(`  ${i}: "${sheet.title}" (ID: ${sheet.sheetId})`);
  });
  
  const matchedSheet = apiResponse.data.sheets.find(sheet => sheet.title === tableName);
  
  if (matchedSheet) {
    console.log("✅ 匹配成功:", matchedSheet.title, "(ID:", matchedSheet.sheetId + ")");
    
    // 构建Lark表格数据
    const tableData = [];
    tableData.push(["商户名", "日期", "投注用户数"]);
    
    // 按商户分组
    const merchantGroups = {};
    merchantData.forEach(item => {
      const merchantName = item.商户名;
      if (!merchantGroups[merchantName]) {
        merchantGroups[merchantName] = [];
      }
      merchantGroups[merchantName].push(item);
    });
    
    // 按商户名排序
    const sortedMerchants = Object.keys(merchantGroups).sort();
    
    // 添加数据
    sortedMerchants.forEach(merchantName => {
      const merchantData = merchantGroups[merchantName];
      
      // 先添加合计行
      const totalUsers = merchantData.reduce((sum, item) => sum + (Number(item.投注用户数) || 0), 0);
      tableData.push([merchantName, "合计", totalUsers]);
      
      // 再添加每日数据
      const dailyData = merchantData
        .filter(item => item.日期 !== "合计")
        .sort((a, b) => a.日期.localeCompare(b.日期));
      
      dailyData.forEach(item => {
        tableData.push([merchantName, item.日期, Number(item.投注用户数) || 0]);
      });
    });
    
    console.log("表格数据构建完成，行数:", tableData.length);
    
    return [{
      json: {
        status: "success",
        message: "Sheet匹配和数据构建成功",
        sheet_id: matchedSheet.sheetId,
        sheet_title: matchedSheet.title,
        spreadsheet_token: apiResponse.data.spreadsheetToken,
        tenant_access_token: token,
        table_name: tableName,
        merchant_data: merchantData,
        lark_data: tableData,
        range: `${matchedSheet.sheetId}!A1:C${tableData.length}`,
        http_request: {
          method: "POST",
          url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${apiResponse.data.spreadsheetToken}/values_batch_update`,
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueRanges: [{
              range: `${matchedSheet.sheetId}!A1:C${tableData.length}`,
              values: tableData
            }]
          })
        },
        statistics: {
          total_rows: tableData.length,
          total_merchants: sortedMerchants.length,
          total_users: merchantData.reduce((sum, item) => sum + (Number(item.投注用户数) || 0), 0)
        },
        timestamp: new Date().toISOString()
      }
    }];
  } else {
    console.log("❌ 没有找到匹配的sheet");
    console.log("可用的sheet标题:", apiResponse.data.sheets.map(s => s.title));
    console.log("要匹配的表名:", tableName);
    
    return [{
      json: {
        status: "error",
        error: "没有找到匹配的sheet",
        available_sheets: apiResponse.data.sheets.map(s => s.title),
        target_table_name: tableName,
        timestamp: new Date().toISOString()
      }
    }];
  }
} else {
  console.log("❌ 缺少必要数据");
  return [{
    json: {
      status: "error",
      error: "缺少必要数据",
      api_response: !!apiResponse,
      table_name: tableName,
      sheets_available: apiResponse ? !!apiResponse.data.sheets : false,
      timestamp: new Date().toISOString()
    }
  }];
}
