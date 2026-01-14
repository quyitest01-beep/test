// Lark子商户数据处理节点 - 只保留子商户名称、主商户和"生产"环境下的商户ID
// 处理从Lark Sheets API获取的子商户数据

const inputs = $input.all();
const inputData = inputs[0].json;

console.log("=== Lark子商户数据处理开始 ===");
console.log("输入数据结构预览:", JSON.stringify(inputData, null, 2).substring(0, 500) + "...");

// 检查输入数据格式
if (!inputData.data || !inputData.data.valueRange || !inputData.data.valueRange.values) {
  console.error("❌ 输入数据格式错误，缺少values数组");
  return [{
    json: {
      error: "输入数据格式错误",
      status: "failed",
      timestamp: new Date().toISOString()
    }
  }];
}

const values = inputData.data.valueRange.values;
console.log(`📊 原始数据行数: ${values.length}`);

// 检查是否有足够的数据行（至少需要2行表头+1行数据）
if (values.length < 3) {
  console.warn("⚠️ 数据行数不足，可能没有实际数据或表头不完整。");
  return [{
    json: {
      error: "数据行数不足或格式异常",
      status: "failed",
      timestamp: new Date().toISOString(),
      details: "至少需要2行表头+1行数据"
    }
  }];
}

// 获取表头信息
const chineseHeaders = values[0]; // 中文表头
const englishHeaders = values[1]; // 英文/内部键名表头
const dataRows = values.slice(2); // 数据行

console.log("📋 中文表头:", chineseHeaders);
console.log("📋 英文表头:", englishHeaders);
console.log(`📊 数据行数: ${dataRows.length}`);

// 定义需要提取的列映射
const columnMapping = {
  type: 0,           // 类型
  merchant: 1,       // 主商户
  merchant_name: 2,  // 子商户名称
  account: 3,        // 开发者账号
  password: 4,       // 密码
  merchant_id: 5,    // 商户ID
  status: 6,         // 状态
  environment: 7     // 环境 (实际列名是 "evel")
};

// 验证表头是否包含必要的列 (注意：environment列实际名称是"evel")
const requiredColumns = ['merchant', 'merchant_name', 'account', 'merchant_id', 'status', 'evel'];
const missingColumns = [];

for (const col of requiredColumns) {
  if (englishHeaders.indexOf(col) === -1) {
    missingColumns.push(col);
  }
}

if (missingColumns.length > 0) {
  console.error("❌ 缺少必要的列:", missingColumns);
  return [{
    json: {
      error: "表头不完整",
      status: "failed",
      timestamp: new Date().toISOString(),
      details: `缺少列: ${missingColumns.join(', ')}`,
      available_columns: englishHeaders
    }
  }];
}

// 处理数据，只保留需要的字段
const filteredMerchants = [];
let processedRows = 0;
let skippedRows = 0;
let productionCount = 0;

dataRows.forEach((row, index) => {
  // 跳过空行
  if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
    skippedRows++;
    console.log(`⏭️  跳过空行 ${index + 3}`);
    return;
  }

  // 提取主商户名称
  const mainMerchantName = row[columnMapping.merchant];
  if (!mainMerchantName || typeof mainMerchantName !== 'string' || mainMerchantName.trim() === '') {
    skippedRows++;
    console.log(`⏭️  跳过第${index + 3}行：主商户名称为空`);
    return;
  }

  // 提取子商户名称
  let subMerchantName = row[columnMapping.merchant_name];
  if (!subMerchantName || subMerchantName.trim() === '') {
    skippedRows++;
    console.log(`⏭️  跳过第${index + 3}行：子商户名称为空`);
    return;
  }

  // 处理富文本单元格（如邮箱链接等）
  if (typeof subMerchantName === 'object' && subMerchantName !== null && subMerchantName.text) {
    subMerchantName = subMerchantName.text;
  }

  // 提取环境信息
  let environment = row[columnMapping.environment];
  if (typeof environment === 'object' && environment !== null && environment.text) {
    environment = environment.text;
  }

  // 只保留"生产"环境的商户
  if (environment !== '生产') {
    skippedRows++;
    console.log(`⏭️  跳过第${index + 3}行：非生产环境 (${environment})`);
    return;
  }

  // 提取商户ID
  let merchantId = row[columnMapping.merchant_id];
  if (typeof merchantId === 'object' && merchantId !== null && merchantId.text) {
    merchantId = merchantId.text;
  }

  // 创建过滤后的商户数据
  const filteredMerchant = {
    sub_merchant_name: subMerchantName,
    main_merchant_name: mainMerchantName,
    merchant_id: merchantId
  };

  // 添加到结果数组
  filteredMerchants.push(filteredMerchant);
  productionCount++;
  processedRows++;

  console.log(`✅ 保留生产环境商户: ${subMerchantName} (主商户: ${mainMerchantName}, ID: ${merchantId})`);
});

// 生成统计信息
const statistics = {
  total_rows: dataRows.length,
  processed_rows: processedRows,
  skipped_rows: skippedRows,
  production_merchants: productionCount,
  success_rate: dataRows.length > 0 ? ((processedRows / dataRows.length) * 100).toFixed(1) + '%' : '0%'
};

console.log("=== Lark子商户数据处理完成 ===");
console.log(`✅ 成功处理 ${processedRows} 行数据`);
console.log(`⏭️  跳过 ${skippedRows} 个空行或非生产环境`);
console.log(`📊 生产环境商户数量: ${productionCount}`);

// 输出结果 - 只包含需要的字段
const output = {
  status: "success",
  timestamp: new Date().toISOString(),
  statistics: statistics,
  filtered_merchants: filteredMerchants
};

return [{
  json: output
}];
