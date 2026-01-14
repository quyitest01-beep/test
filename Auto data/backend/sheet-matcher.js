// Sheet匹配器
// 匹配sheet title并获取对应的sheetId，保留商户数据和token值

const inputs = $input.all();
console.log("=== Sheet匹配器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 用于收集API响应数据和商户数据
let apiResponse = null;
let tableName = null;
let tenantAccessToken = null;
const merchantData = [];

// 遍历所有输入项，分离不同类型的数据
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  // 检查是否是API响应数据
  if (item.code === 0 && item.data && item.data.sheets && Array.isArray(item.data.sheets)) {
    console.log(`📊 识别到API响应数据，包含 ${item.data.sheets.length} 个sheet`);
    apiResponse = item;
  }
  // 检查是否是商户数据
  else if (item.商户名 && (item.日期 === "合计" || item.日期.match(/^\d{8}$/))) {
    console.log(`📈 识别到商户数据: ${item.商户名} - ${item.日期}`);
    merchantData.push(item);
  }
  // 检查是否是表名数据
  else if (item.table_name) {
    console.log(`📋 识别到表名数据: ${item.table_name}`);
    tableName = item.table_name;
  }
  // 检查是否是token数据
  else if (item.tenant_access_token) {
    console.log(`🔑 识别到token数据: ${item.tenant_access_token.substring(0, 20)}...`);
    tenantAccessToken = item.tenant_access_token;
  }
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的数据项 (索引: ${index})，数据字段: ${Object.keys(item).join(', ')}`);
  }
});

console.log(`📊 收集到API响应: ${apiResponse ? '是' : '否'}`);
console.log(`📋 收集到表名: ${tableName || '否'}`);
console.log(`🔑 收集到token: ${tenantAccessToken ? '是' : '否'}`);
console.log(`📈 收集到商户数据: ${merchantData.length} 条`);

// 检查是否有必要的数据
if (!apiResponse) {
  console.error("❌ 没有找到API响应数据，无法进行sheet匹配");
  return [];
}

if (!tableName) {
  console.error("❌ 没有找到表名，无法进行sheet匹配");
  return [];
}

// 匹配sheet title
let matchedSheet = null;
const sheets = apiResponse.data.sheets;

console.log(`🔍 开始匹配sheet title: ${tableName}`);
console.log("可用的sheet列表:", sheets.map(sheet => sheet.title));

// 遍历所有sheet，查找匹配的title
for (let i = 0; i < sheets.length; i++) {
  const sheet = sheets[i];
  console.log(`🔍 检查sheet ${i}: "${sheet.title}" vs "${tableName}"`);
  
  if (sheet.title === tableName) {
    matchedSheet = sheet;
    console.log(`✅ 找到匹配的sheet: ${sheet.title} (ID: ${sheet.sheetId})`);
    break;
  }
}

if (!matchedSheet) {
  console.error(`❌ 没有找到匹配的sheet title: ${tableName}`);
  console.log("可用的sheet titles:", sheets.map(sheet => sheet.title));
  return [];
}

// 生成输出数据
const outputData = {
  table_name: tableName,
  sheet_id: matchedSheet.sheetId,
  sheet_title: matchedSheet.title,
  tenant_access_token: tenantAccessToken,
  merchant_data: merchantData,
  data_count: merchantData.length,
  spreadsheet_token: apiResponse.data.spreadsheetToken,
  matched_at: new Date().toISOString()
};

console.log(`📈 生成输出数据完成`);
console.log("输出数据示例:", {
  table_name: outputData.table_name,
  sheet_id: outputData.sheet_id,
  sheet_title: outputData.sheet_title,
  tenant_access_token: outputData.tenant_access_token ? outputData.tenant_access_token.substring(0, 20) + "..." : null,
  data_count: outputData.data_count,
  spreadsheet_token: outputData.spreadsheet_token
});

// 返回格式化的数据
return [{ json: outputData }];
