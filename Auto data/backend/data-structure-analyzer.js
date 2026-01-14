// 数据结构分析器
// 分析上游数据的完整结构

const inputs = $input.all();
console.log("=== 数据结构分析器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分析第一个输入项
const inputData = inputs[0].json;
console.log("🔍 输入数据结构分析:");
console.log("数据类型:", typeof inputData);
console.log("是否为数组:", Array.isArray(inputData));
console.log("主要字段:", Object.keys(inputData));

// 详细分析每个字段
console.log("\n📊 字段详细分析:");
Object.keys(inputData).forEach(key => {
  const value = inputData[key];
  console.log(`  ${key}:`, {
    type: typeof value,
    isArray: Array.isArray(value),
    length: Array.isArray(value) ? value.length : 'N/A',
    value: typeof value === 'object' ? 'Object' : value
  });
});

// 分析data字段
if (inputData.data) {
  console.log("\n📋 data字段分析:");
  console.log("data类型:", typeof inputData.data);
  console.log("data字段:", Object.keys(inputData.data));
  
  // 分析replies字段
  if (inputData.data.replies) {
    console.log("\n📝 replies字段分析:");
    console.log("replies类型:", typeof inputData.data.replies);
    console.log("replies是否为数组:", Array.isArray(inputData.data.replies));
    console.log("replies长度:", inputData.data.replies.length);
    
    if (inputData.data.replies.length > 0) {
      console.log("第一个reply:", inputData.data.replies[0]);
      if (inputData.data.replies[0].addSheet) {
        console.log("addSheet字段:", inputData.data.replies[0].addSheet);
      }
    }
  }
  
  // 分析sheets字段
  if (inputData.data.sheets) {
    console.log("\n📊 sheets字段分析:");
    console.log("sheets类型:", typeof inputData.data.sheets);
    console.log("sheets是否为数组:", Array.isArray(inputData.data.sheets));
    console.log("sheets长度:", inputData.data.sheets.length);
    
    if (inputData.data.sheets.length > 0) {
      console.log("第一个sheet:", inputData.data.sheets[0]);
    }
  }
  
  // 分析spreadsheetToken字段
  if (inputData.data.spreadsheetToken) {
    console.log("\n🔑 spreadsheetToken字段分析:");
    console.log("spreadsheetToken类型:", typeof inputData.data.spreadsheetToken);
    console.log("spreadsheetToken值:", inputData.data.spreadsheetToken);
  }
}

// 分析merchant_data字段
if (inputData.merchant_data) {
  console.log("\n📈 merchant_data字段分析:");
  console.log("merchant_data类型:", typeof inputData.merchant_data);
  console.log("merchant_data是否为数组:", Array.isArray(inputData.merchant_data));
  console.log("merchant_data长度:", inputData.merchant_data.length);
  
  if (inputData.merchant_data.length > 0) {
    console.log("第一个商户数据:", inputData.merchant_data[0]);
  }
}

// 分析table_name字段
if (inputData.table_name) {
  console.log("\n📋 table_name字段分析:");
  console.log("table_name类型:", typeof inputData.table_name);
  console.log("table_name值:", inputData.table_name);
}

// 分析tenant_access_token字段
if (inputData.tenant_access_token) {
  console.log("\n🔑 tenant_access_token字段分析:");
  console.log("tenant_access_token类型:", typeof inputData.tenant_access_token);
  console.log("tenant_access_token值:", inputData.tenant_access_token.substring(0, 20) + "...");
}

// 生成分析报告
const analysisReport = {
  input_count: inputs.length,
  data_type: typeof inputData,
  is_array: Array.isArray(inputData),
  main_fields: Object.keys(inputData),
  has_data: !!inputData.data,
  has_replies: !!(inputData.data && inputData.data.replies),
  has_sheets: !!(inputData.data && inputData.data.sheets),
  has_spreadsheet_token: !!(inputData.data && inputData.data.spreadsheetToken),
  has_merchant_data: !!inputData.merchant_data,
  has_table_name: !!inputData.table_name,
  has_tenant_access_token: !!inputData.tenant_access_token,
  analysis_time: new Date().toISOString()
};

console.log("\n📊 分析报告:", analysisReport);

// 返回分析结果
return [{ json: analysisReport }];





