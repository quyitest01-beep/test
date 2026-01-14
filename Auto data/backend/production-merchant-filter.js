// Lark子商户数据处理节点 - 只输出生产环境的商户信息
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

// 按主商户分组处理数据，只保留生产环境的商户
const groupedMerchants = {};
let processedRows = 0;
let skippedRows = 0;
let productionRows = 0;

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

  // 提取子商户信息
  const subMerchant = {
    sub_merchant_name: row[columnMapping.merchant_name] || null,
    developer_account: row[columnMapping.account] || null,
    merchant_id: row[columnMapping.merchant_id] || null,
    status: row[columnMapping.status] || null,
    environment: row[columnMapping.environment] || null,
    type: row[columnMapping.type] || null,
    password: row[columnMapping.password] || null
  };

  // 处理富文本单元格（如邮箱链接等）
  Object.keys(subMerchant).forEach(key => {
    if (typeof subMerchant[key] === 'object' && subMerchant[key] !== null && subMerchant[key].text) {
      subMerchant[key] = subMerchant[key].text;
    }
  });

  // 检查子商户名称是否为空
  if (!subMerchant.sub_merchant_name || subMerchant.sub_merchant_name.trim() === '') {
    skippedRows++;
    console.log(`⏭️  跳过第${index + 3}行：子商户名称为空`);
    return;
  }

  // 只处理生产环境的商户
  if (subMerchant.environment !== '生产') {
    skippedRows++;
    console.log(`⏭️  跳过第${index + 3}行：非生产环境 (${subMerchant.environment})`);
    return;
  }

  // 初始化主商户数据结构
  if (!groupedMerchants[mainMerchantName]) {
    groupedMerchants[mainMerchantName] = {
      main_merchant_name: mainMerchantName,
      sub_merchants: [],
      statistics: {
        total_sub_merchants: 0,
        active_count: 0,
        inactive_count: 0,
        production_count: 0,
        test_count: 0
      }
    };
  }

  // 添加到主商户分组
  groupedMerchants[mainMerchantName].sub_merchants.push(subMerchant);
  
  // 更新统计信息
  groupedMerchants[mainMerchantName].statistics.total_sub_merchants++;
  
  if (subMerchant.status === '正常' || subMerchant.status === '启用') {
    groupedMerchants[mainMerchantName].statistics.active_count++;
  } else if (subMerchant.status === '禁用' || subMerchant.status === '停用') {
    groupedMerchants[mainMerchantName].statistics.inactive_count++;
  }
  
  // 由于只处理生产环境，所以都是生产环境
  groupedMerchants[mainMerchantName].statistics.production_count++;

  processedRows++;
  productionRows++;
  console.log(`✅ 处理生产环境子商户: ${subMerchant.sub_merchant_name} (主商户: ${mainMerchantName}, ID: ${subMerchant.merchant_id})`);
});

// 转换为数组格式
const result = Object.values(groupedMerchants);

// 生成总体统计
const overallStatistics = {
  total_main_merchants: result.length,
  total_sub_merchants: result.reduce((sum, group) => sum + group.statistics.total_sub_merchants, 0),
  total_active_sub_merchants: result.reduce((sum, group) => sum + group.statistics.active_count, 0),
  total_inactive_sub_merchants: result.reduce((sum, group) => sum + group.statistics.inactive_count, 0),
  total_production_sub_merchants: result.reduce((sum, group) => sum + group.statistics.production_count, 0),
  total_test_sub_merchants: 0, // 只处理生产环境，所以测试环境为0
  processed_rows: processedRows,
  skipped_rows: skippedRows,
  production_rows: productionRows,
  success_rate: dataRows.length > 0 ? ((processedRows / dataRows.length) * 100).toFixed(1) + '%' : '0%'
};

console.log("=== Lark子商户数据处理完成 ===");
console.log(`✅ 成功处理 ${processedRows} 行生产环境数据`);
console.log(`⏭️  跳过 ${skippedRows} 个非生产环境行`);
console.log(`📊 主商户数量: ${result.length}`);
console.log(`📊 生产环境子商户总数: ${overallStatistics.total_sub_merchants}`);

// 输出结果
const output = {
  status: "success",
  timestamp: new Date().toISOString(),
  statistics: overallStatistics,
  column_mapping: {
    chinese_headers: chineseHeaders,
    english_headers: englishHeaders,
    mapping: columnMapping
  },
  grouped_sub_merchants: result,
  raw_data_summary: {
    spreadsheet_token: inputData.data.spreadsheetToken,
    range: inputData.data.valueRange.range,
    total_rows: values.length
  }
};

return [{
  json: output
}];
