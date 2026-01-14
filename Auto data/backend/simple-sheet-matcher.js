// 简化Sheet匹配器
// 处理上游数据，匹配sheet title并获取sheetId

const inputs = $input.all();
console.log("=== 简化Sheet匹配器开始 ===");
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
  
  // 这里需要根据你的实际需求来匹配sheet
  // 假设我们要匹配第一个sheet
  const matchedSheet = sheets[0]; // 或者根据你的逻辑选择特定的sheet
  
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
  return [];
}
