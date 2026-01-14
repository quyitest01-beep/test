// Lark数据格式化器
// 将商户数据转换为Lark API需要的格式

const inputs = $input.all();
console.log("=== Lark数据格式化器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 获取输入数据
const inputData = inputs[0].json;
console.log("🔍 输入数据结构:", typeof inputData);
console.log("输入数据字段:", Object.keys(inputData));

// 检查必要字段
if (!inputData.merchant_data || !Array.isArray(inputData.merchant_data)) {
  console.error("❌ 没有找到merchant_data字段或不是数组");
  return [];
}

if (!inputData.sheet_id) {
  console.error("❌ 没有找到sheet_id字段");
  return [];
}

// 转换商户数据为Lark API格式
const merchantData = inputData.merchant_data;
console.log(`📊 处理 ${merchantData.length} 条商户数据`);

// 生成表头
const headers = ["商户名", "日期", "投注用户数"];

// 转换数据为二维数组格式
const values = [headers]; // 第一行是表头

merchantData.forEach(item => {
  const row = [
    item.商户名 || "",
    item.日期 || "",
    item.投注用户数 || 0
  ];
  values.push(row);
});

console.log(`📈 生成数据行: ${values.length} 行 (包含表头)`);
console.log("表头:", headers);
console.log("数据示例:", values.slice(0, 3));

// 生成Lark API请求体
const requestBody = {
  valueRanges: [
    {
      range: `${inputData.sheet_id}!A1:C${values.length}`,
      values: values
    }
  ]
};

console.log("📋 生成请求体:", JSON.stringify(requestBody, null, 2));

// 返回格式化的数据
const outputData = {
  ...inputData,
  lark_request_body: requestBody,
  data_rows: values.length,
  headers: headers
};

console.log("📈 生成输出数据完成");

return [{ json: outputData }];
