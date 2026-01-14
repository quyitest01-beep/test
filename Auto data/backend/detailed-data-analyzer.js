// 详细数据结构分析器
// 深度分析上游数据的完整结构

const inputs = $input.all();
console.log("=== 详细数据结构分析器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分析所有输入项
inputs.forEach((inputItem, index) => {
  console.log(`\n🔍 分析输入项 ${index + 1}:`);
  const data = inputItem.json;
  
  console.log("数据类型:", typeof data);
  console.log("是否为数组:", Array.isArray(data));
  console.log("主要字段:", Object.keys(data));
  
  // 分析每个字段的详细信息
  Object.keys(data).forEach(key => {
    const value = data[key];
    console.log(`\n  📋 字段: ${key}`);
    console.log(`    类型: ${typeof value}`);
    console.log(`    是否为数组: ${Array.isArray(value)}`);
    
    if (Array.isArray(value)) {
      console.log(`    数组长度: ${value.length}`);
      if (value.length > 0) {
        console.log(`    第一个元素:`, value[0]);
        if (value[0] && typeof value[0] === 'object') {
          console.log(`    第一个元素的字段:`, Object.keys(value[0]));
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      console.log(`    对象字段:`, Object.keys(value));
      // 深度分析对象
      Object.keys(value).forEach(subKey => {
        const subValue = value[subKey];
        console.log(`      ${subKey}: ${typeof subValue} ${Array.isArray(subValue) ? `(数组, 长度: ${subValue.length})` : ''}`);
      });
    } else {
      console.log(`    值: ${value}`);
    }
  });
});

// 生成综合分析报告
const firstInput = inputs[0].json;
const analysisReport = {
  total_inputs: inputs.length,
  first_input_analysis: {
    type: typeof firstInput,
    is_array: Array.isArray(firstInput),
    fields: Object.keys(firstInput),
    has_code: !!firstInput.code,
    has_data: !!firstInput.data,
    has_msg: !!firstInput.msg,
    has_table_name: !!firstInput.table_name,
    has_tenant_access_token: !!firstInput.tenant_access_token,
    has_merchant_data: !!firstInput.merchant_data
  },
  data_structure: firstInput.data ? {
    has_replies: !!firstInput.data.replies,
    has_sheets: !!firstInput.data.sheets,
    has_spreadsheetToken: !!firstInput.data.spreadsheetToken,
    replies_count: firstInput.data.replies ? firstInput.data.replies.length : 0,
    sheets_count: firstInput.data.sheets ? firstInput.data.sheets.length : 0
  } : null,
  merchant_data_analysis: firstInput.merchant_data ? {
    count: firstInput.merchant_data.length,
    sample: firstInput.merchant_data[0] || null
  } : null,
  analysis_time: new Date().toISOString()
};

console.log("\n📊 综合分析报告:", JSON.stringify(analysisReport, null, 2));

// 返回分析结果
return [{ json: analysisReport }];
