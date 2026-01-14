// 简单Sheet测试 - 直接测试数据提取
const inputItems = $input.all();
console.log("=== 简单Sheet测试开始 ===");
console.log(`输入项数量: ${inputItems.length}`);

// 测试API响应提取
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
    console.log("data字段:", Object.keys(item.json.data));
    if (item.json.data.sheets) {
      console.log("sheets数量:", item.json.data.sheets.length);
      item.json.data.sheets.forEach((sheet, i) => {
        console.log(`  sheet[${i}]: ${sheet.title} (ID: ${sheet.sheetId})`);
      });
    }
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

// 测试sheet匹配
if (apiResponse && tableName) {
  console.log("\n=== 测试Sheet匹配 ===");
  console.log("要匹配的表名:", tableName);
  
  if (apiResponse.data.sheets && apiResponse.data.sheets.length > 0) {
    console.log("可用sheets:");
    apiResponse.data.sheets.forEach((sheet, i) => {
      console.log(`  ${i}: "${sheet.title}" (ID: ${sheet.sheetId})`);
      console.log(`      匹配结果: ${sheet.title === tableName ? "✅ 匹配" : "❌ 不匹配"}`);
    });
    
    // 尝试匹配
    const matchedSheet = apiResponse.data.sheets.find(sheet => sheet.title === tableName);
    if (matchedSheet) {
      console.log("✅ 找到匹配的sheet:", matchedSheet.title, "(ID:", matchedSheet.sheetId + ")");
      
      return [{
        json: {
          status: "success",
          message: "Sheet匹配成功",
          sheet_id: matchedSheet.sheetId,
          sheet_title: matchedSheet.title,
          spreadsheet_token: apiResponse.data.spreadsheetToken,
          table_name: tableName,
          matched: true
        }
      }];
    } else {
      console.log("❌ 没有找到匹配的sheet");
      console.log("可用的sheet标题:", apiResponse.data.sheets.map(s => s.title));
    }
  } else {
    console.log("❌ API响应中没有sheets数组");
  }
} else {
  console.log("❌ 缺少必要数据");
  console.log("API响应:", !!apiResponse);
  console.log("表名:", tableName);
}

return [{
  json: {
    status: "test_complete",
    message: "简单Sheet测试完成",
    api_response_found: !!apiResponse,
    merchant_data_found: !!merchantData,
    table_name: tableName,
    token_found: !!token,
    timestamp: new Date().toISOString()
  }
}];
