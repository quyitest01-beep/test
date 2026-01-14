// Lark表格展开器：将sheets数组展开为单个请求
const inputs = $input.all();

console.log("=== Lark表格展开器开始 ===");
console.log("📊 输入数据数量:", inputs.length);

// 通常输入只有一个，包含所有sheets信息
const inputData = inputs[0].json;

// 提取基本信息
const spreadsheetToken = inputData.data?.spreadsheetToken || inputData.spreadsheetToken;
const tenantAccessToken = inputData.tenant_access_token;
const sheets = inputData.data?.sheets || [];

console.log(`📋 电子表格Token: ${spreadsheetToken}`);
console.log(`🔑 访问令牌: ${tenantAccessToken ? '已获取' : '缺失'}`);
console.log(`📊 Sheets数量: ${sheets.length}`);

if (!spreadsheetToken) {
  console.error("❌ 缺少spreadsheetToken");
  return [];
}

if (!tenantAccessToken) {
  console.error("❌ 缺少tenant_access_token");
  return [];
}

// 展开每个sheet为独立请求
const expandedRequests = sheets.map((sheet, index) => {
  console.log(`\n📄 Sheet ${index + 1}:`);
  console.log(`   sheetId: ${sheet.sheetId}`);
  console.log(`   title: ${sheet.title}`);
  console.log(`   rowCount: ${sheet.rowCount}`);
  console.log(`   columnCount: ${sheet.columnCount}`);
  
  // 生成HTTP请求URL（使用A列到最后一列，最大行数）
  // 列号转换：1->A, 2->B, ..., 26->Z, 27->AA, 28->AB...
  function numberToColumnLetter(num) {
    let result = '';
    while (num > 0) {
      num--;
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result || 'A';
  }
  
  const lastColumn = numberToColumnLetter(sheet.columnCount);
  const range = `${sheet.sheetId}!A1:${lastColumn}${sheet.rowCount}`;
  const url = `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${range}`;
  
  return {
    sheet_index: sheet.index,
    sheet_id: sheet.sheetId,
    sheet_title: sheet.title,
    row_count: sheet.rowCount,
    column_count: sheet.columnCount,
    range: range,
    url: url,
    spreadsheet_token: spreadsheetToken,
    tenant_access_token: tenantAccessToken,
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
      'Content-Type': 'application/json'
    }
  };
});

console.log(`\n✅ 成功展开 ${expandedRequests.length} 个请求`);

// 返回展开后的数组
return expandedRequests.map(req => ({ json: req }));
