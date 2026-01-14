// 完整Sheet匹配器
// 处理上游数据，匹配sheet title并获取sheetId

const inputs = $input.all();
console.log("=== 完整Sheet匹配器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 获取第一个输入项的数据
const inputData = inputs[0].json;
console.log("🔍 输入数据结构:", typeof inputData);
console.log("输入数据字段:", Object.keys(inputData));

// 检查是否是API响应数据
if (inputData.code === 0 && inputData.data && inputData.data.sheets) {
  console.log("📊 识别到API响应数据");
  
  const sheets = inputData.data.sheets;
  const spreadsheetToken = inputData.data.spreadsheetToken;
  
  console.log(`📋 发现 ${sheets.length} 个sheet:`);
  sheets.forEach((sheet, index) => {
    console.log(`  ${index + 1}. ${sheet.title} (ID: ${sheet.sheetId})`);
  });
  
  // 根据你的需求，这里需要匹配特定的sheet
  // 假设我们要匹配包含"商户活跃用户数"的sheet
  let matchedSheet = null;
  
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    if (sheet.title.includes("商户活跃用户数")) {
      matchedSheet = sheet;
      console.log(`✅ 找到匹配的sheet: ${sheet.title} (ID: ${sheet.sheetId})`);
      break;
    }
  }
  
  if (!matchedSheet) {
    console.log("⚠️ 没有找到包含'商户活跃用户数'的sheet，使用第一个sheet");
    matchedSheet = sheets[0];
  }
  
  const outputData = {
    table_name: matchedSheet.title,
    sheet_id: matchedSheet.sheetId,
    sheet_title: matchedSheet.title,
    spreadsheet_token: spreadsheetToken,
    matched_at: new Date().toISOString()
  };
  
  console.log("📈 生成输出数据:", outputData);
  
  return [{ json: outputData }];
} else {
  console.error("❌ 输入数据格式不正确");
  console.log("期望的数据格式:", {
    code: 0,
    data: {
      sheets: "数组",
      spreadsheetToken: "字符串"
    }
  });
  return [];
}
