// API结构分析器 - 详细分析API响应数据结构
const inputItems = $input.all();
console.log("=== API结构分析开始 ===");

let apiResponse = null;
let tableName = null;

// 找到API响应
inputItems.forEach((item, index) => {
  if (item.json.code === 0 && item.json.data) {
    apiResponse = item.json;
    console.log(`\n📊 输入项 ${index} - API响应:`);
    console.log("完整结构:", JSON.stringify(item.json, null, 2));
  }
  if (item.json.table_name) {
    tableName = item.json.table_name;
  }
});

if (apiResponse) {
  console.log("\n=== API响应详细分析 ===");
  console.log("code:", apiResponse.code);
  console.log("msg:", apiResponse.msg);
  console.log("data字段:", Object.keys(apiResponse.data));
  
  if (apiResponse.data.properties) {
    console.log("properties:", apiResponse.data.properties);
  }
  
  if (apiResponse.data.sheets) {
    console.log("✅ 找到sheets数组，数量:", apiResponse.data.sheets.length);
    apiResponse.data.sheets.forEach((sheet, i) => {
      console.log(`  sheet[${i}]:`, {
        title: sheet.title,
        sheetId: sheet.sheetId,
        index: sheet.index,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount
      });
    });
  } else {
    console.log("❌ 没有找到sheets数组");
    console.log("data字段内容:", apiResponse.data);
  }
  
  if (apiResponse.data.replies) {
    console.log("✅ 找到replies数组，数量:", apiResponse.data.replies.length);
    apiResponse.data.replies.forEach((reply, i) => {
      console.log(`  reply[${i}]:`, Object.keys(reply));
      if (reply.addSheet) {
        console.log("    addSheet:", reply.addSheet);
      }
    });
  } else {
    console.log("❌ 没有找到replies数组");
  }
  
  if (apiResponse.data.spreadsheetToken) {
    console.log("✅ 找到spreadsheetToken:", apiResponse.data.spreadsheetToken.substring(0, 10) + "...");
  } else {
    console.log("❌ 没有找到spreadsheetToken");
  }
  
  console.log("\n=== 表名匹配测试 ===");
  console.log("要匹配的表名:", tableName);
  
  if (apiResponse.data.sheets && apiResponse.data.sheets.length > 0) {
    console.log("可用sheets标题:");
    apiResponse.data.sheets.forEach((sheet, i) => {
      const isMatch = sheet.title === tableName;
      console.log(`  ${i}: "${sheet.title}" ${isMatch ? "✅ 匹配" : "❌ 不匹配"}`);
    });
    
    const matchedSheet = apiResponse.data.sheets.find(sheet => sheet.title === tableName);
    if (matchedSheet) {
      console.log("✅ 找到匹配的sheet:", matchedSheet.title, "(ID:", matchedSheet.sheetId + ")");
    } else {
      console.log("❌ 没有找到匹配的sheet");
    }
  }
  
} else {
  console.log("❌ 没有找到API响应数据");
}

return [{
  json: {
    status: "analysis_complete",
    message: "API结构分析完成",
    api_response_found: !!apiResponse,
    table_name: tableName,
    timestamp: new Date().toISOString()
  }
}];
