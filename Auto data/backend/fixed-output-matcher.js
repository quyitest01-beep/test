// 修复输出版匹配器
// 确保输出所有必要的字段

const inputs = $input.all();
console.log("=== 修复输出版匹配器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 获取第一个输入项的数据
const inputData = inputs[0].json;
console.log("🔍 输入数据结构:", typeof inputData);
console.log("输入数据字段:", Object.keys(inputData));

// 检查数据结构
if (inputData.code === 0 && inputData.data && inputData.data.replies) {
  console.log("📊 识别到API响应数据，包含replies字段");
  
  const replies = inputData.data.replies;
  console.log(`📋 发现 ${replies.length} 个replies`);
  
  if (replies.length > 0 && replies[0].addSheet) {
    const sheet = replies[0].addSheet;
    console.log(`📋 发现sheet: ${sheet.title} (ID: ${sheet.sheetId})`);
    
    // 获取spreadsheet_token
    let spreadsheetToken = "未知";
    if (inputData.data.spreadsheetToken) {
      spreadsheetToken = inputData.data.spreadsheetToken;
    } else if (inputData.spreadsheet_token) {
      spreadsheetToken = inputData.spreadsheet_token;
    }
    
    // 确保所有字段都有值
    const outputData = {
      table_name: sheet.title || "未知表名",
      sheet_id: sheet.sheetId || "未知ID",
      sheet_title: sheet.title || "未知标题",
      spreadsheet_token: spreadsheetToken,
      matched_at: new Date().toISOString()
    };
    
    console.log("📈 生成输出数据:", outputData);
    console.log("输出数据字段:", Object.keys(outputData));
    
    return [{ json: outputData }];
  }
}

// 如果没有找到replies，尝试其他字段
if (inputData.data && inputData.data.sheets) {
  console.log("📊 识别到sheets字段");
  
  const sheets = inputData.data.sheets;
  console.log(`📋 发现 ${sheets.length} 个sheet`);
  
  if (sheets.length > 0) {
    const sheet = sheets[0];
    console.log(`📋 使用第一个sheet: ${sheet.title} (ID: ${sheet.sheetId})`);
    
    // 获取spreadsheet_token
    let spreadsheetToken = "未知";
    if (inputData.data.spreadsheetToken) {
      spreadsheetToken = inputData.data.spreadsheetToken;
    } else if (inputData.spreadsheet_token) {
      spreadsheetToken = inputData.spreadsheet_token;
    }
    
    // 确保所有字段都有值
    const outputData = {
      table_name: sheet.title || "未知表名",
      sheet_id: sheet.sheetId || "未知ID",
      sheet_title: sheet.title || "未知标题",
      spreadsheet_token: spreadsheetToken,
      matched_at: new Date().toISOString()
    };
    
    console.log("📈 生成输出数据:", outputData);
    console.log("输出数据字段:", Object.keys(outputData));
    
    return [{ json: outputData }];
  }
}

console.error("❌ 无法处理输入数据");
console.log("输入数据内容:", JSON.stringify(inputData, null, 2));
return [];
