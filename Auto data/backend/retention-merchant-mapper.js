// 留存数据商户映射器
// 处理新用户留存和活跃用户留存数据，完成商户ID到商户名的映射

const inputs = $input.all();
console.log("=== 留存数据商户映射器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 用于收集商户映射数据
const merchantMappingEntries = [];
// 用于收集需要匹配的留存数据
const retentionDataToProcess = [];

// 遍历所有输入项
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  // 检查是否是商户映射数据
  if (item.sub_merchant_name && item.merchant_id && item.main_merchant_name) {
    console.log(`📊 识别到商户映射数据: ${item.sub_merchant_name} (ID: ${item.merchant_id})`);
    merchantMappingEntries.push(item);
  }
  // 检查是否是包含 filtered_merchants 的对象
  else if (item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
    console.log(`📊 识别到包含 filtered_merchants 的对象，共 ${item.filtered_merchants.length} 条`);
    item.filtered_merchants.forEach(merchant => {
      if (merchant.merchant_id && merchant.sub_merchant_name) {
        merchantMappingEntries.push(merchant);
      }
    });
  }
  // 检查是否是留存数据（新用户留存）
  else if (item.merchant && item.new_date && (item.dataType === 'merchant_new' || item.dataType === 'game_new')) {
    console.log(`📈 识别到新用户留存数据: 商户ID ${item.merchant}, 日期 ${item.new_date}, 类型 ${item.dataType}`);
    retentionDataToProcess.push({ json: item });
  }
  // 检查是否是留存数据（活跃用户留存）
  else if (item.merchant && item.cohort_date && (item.dataType === 'merchant_act' || item.dataType === 'game_act')) {
    console.log(`📈 识别到活跃用户留存数据: 商户ID ${item.merchant}, 日期 ${item.cohort_date}, 类型 ${item.dataType}`);
    retentionDataToProcess.push({ json: item });
  }
  // 检查是否是数组格式的数据
  else if (Array.isArray(item)) {
    item.forEach(subItem => {
      if (subItem && subItem.sub_merchant_name && subItem.merchant_id && subItem.main_merchant_name) {
        console.log(`📊 识别到数组中的商户映射数据: ${subItem.sub_merchant_name} (ID: ${subItem.merchant_id})`);
        merchantMappingEntries.push(subItem);
      } else if (subItem && subItem.merchant && subItem.new_date && (subItem.dataType === 'merchant_new' || subItem.dataType === 'game_new')) {
        console.log(`📈 识别到数组中的新用户留存数据: 商户ID ${subItem.merchant}, 日期 ${subItem.new_date}`);
        retentionDataToProcess.push({ json: subItem });
      } else if (subItem && subItem.merchant && subItem.cohort_date && (subItem.dataType === 'merchant_act' || subItem.dataType === 'game_act')) {
        console.log(`📈 识别到数组中的活跃用户留存数据: 商户ID ${subItem.merchant}, 日期 ${subItem.cohort_date}`);
        retentionDataToProcess.push({ json: subItem });
      }
    });
  }
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的数据项 (索引: ${index})，数据字段: ${Object.keys(item).join(', ')}`);
  }
});

console.log(`📊 收集到商户映射数据: ${merchantMappingEntries.length} 条`);
console.log(`📈 收集到留存数据: ${retentionDataToProcess.length} 条`);

// 检查是否收集到必要的映射数据
if (merchantMappingEntries.length === 0) {
  console.error("❌ 没有找到商户映射数据，无法进行商户映射");
  return [];
}

if (retentionDataToProcess.length === 0) {
  console.warn("⚠️ 没有找到留存数据");
  return [];
}

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

merchantMappingEntries.forEach(merchant => {
  if (merchant.merchant_id !== undefined && merchant.merchant_id !== null && merchant.sub_merchant_name) {
    const merchantIdStr = merchant.merchant_id.toString();
    merchantIdToNameMap.set(merchantIdStr, merchant.sub_merchant_name);
    merchantIdToMainMerchantMap.set(merchantIdStr, merchant.main_merchant_name || '未知主商户');
  }
});

console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
console.log("映射表示例:", Array.from(merchantIdToNameMap.entries()).slice(0, 5));

// 处理留存数据映射
const matchedResults = [];
let matchedCount = 0;
let unmatchedCount = 0;

retentionDataToProcess.forEach((item, index) => {
  const data = item.json;
  
  // 商户映射
  const merchantId = data.merchant ? data.merchant.toString() : null;
  const merchantName = merchantId ? merchantIdToNameMap.get(merchantId) : null;
  const mainMerchantName = merchantId ? merchantIdToMainMerchantMap.get(merchantId) : null;
  
  console.log(`🔍 处理留存数据 ${index}:`);
  console.log(`  商户ID: ${merchantId} -> ${merchantName || '未找到'}`);
  
  // 构建映射后的数据
  const mappedData = {
    ...data,
    // 商户映射结果
    merchant: merchantName || data.merchant,  // 如果映射成功使用商户名，否则保留ID
    merchant_id: merchantId,                  // 保留原始商户ID
    main_merchant_name: mainMerchantName,     // 主商户名
    merchant_matched: !!merchantName,          // 商户是否映射成功
    // 整体匹配状态
    isFullyMatched: !!merchantName,
    matchType: merchantName ? 'merchant_ok' : 'merchant_fail'
  };
  
  matchedResults.push({ json: mappedData });
  
  // 统计匹配结果
  if (merchantName) {
    matchedCount++;
    console.log(`✅ 商户映射成功: ${merchantId} -> ${merchantName} (主商户: ${mainMerchantName})`);
  } else {
    unmatchedCount++;
    console.log(`❌ 商户映射失败: 商户ID ${merchantId} 未找到对应商户名`);
  }
});

console.log(`=== 留存数据商户映射完成 ===`);
console.log(`📊 总共处理留存数据: ${retentionDataToProcess.length}`);
console.log(`✅ 商户映射成功: ${matchedCount}`);
console.log(`❌ 商户映射失败: ${unmatchedCount}`);
console.log(`📈 商户映射率: ${retentionDataToProcess.length > 0 ? ((matchedCount / retentionDataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);

// 按商户名和日期排序，生成最终数据
const finalResults = [];

// 按商户名A→Z排序
const sortedMerchantNames = Array.from(new Set(matchedResults
  .filter(item => item.json.merchant_matched)
  .map(item => item.json.merchant)
)).sort((a, b) => {
  return a.localeCompare(b, 'zh-CN', { numeric: true });
});

console.log("商户排序结果:", sortedMerchantNames.slice(0, 10));

// 为每个商户生成数据
sortedMerchantNames.forEach(merchantName => {
  // 获取该商户的所有数据
  const merchantData = matchedResults
    .filter(item => item.json.merchant_matched && item.json.merchant === merchantName)
    .map(item => item.json);
  
  // 按日期排序（新用户留存用new_date，活跃用户留存用cohort_date）
  const sortedData = merchantData.sort((a, b) => {
    const dateA = a.new_date || a.cohort_date || '';
    const dateB = b.new_date || b.cohort_date || '';
    return dateA.localeCompare(dateB);
  });
  
  // 生成最终数据
  sortedData.forEach(item => {
    const finalItem = {
      商户名: merchantName,
      日期: item.new_date || item.cohort_date,
      数据类型: item.dataType === 'merchant_new' || item.dataType === 'game_new' ? '新用户留存' : '活跃用户留存',
      当日用户数: parseInt(item.d0_users || 0),
      次日用户数: parseInt(item.d1_users || 0),
      次日留存率: parseFloat(item.d1_retention_rate || 0),
      "3日用户数": parseInt(item.d3_users || 0),
      "3日留存率": parseFloat(item.d3_retention_rate || 0),
      "7日用户数": parseInt(item.d7_users || 0),
      "7日留存率": parseFloat(item.d7_retention_rate || 0)
    };
    
    // 动态添加14日留存数据（如果存在）
    if (item.d14_users !== undefined || item.d14_retention_rate !== undefined) {
      finalItem["14日用户数"] = parseInt(item.d14_users || 0);
      finalItem["14日留存率"] = parseFloat(item.d14_retention_rate || 0);
    }
    
    // 动态添加30日留存数据（如果存在）
    if (item.d30_users !== undefined || item.d30_retention_rate !== undefined) {
      finalItem["30日用户数"] = parseInt(item.d30_users || 0);
      finalItem["30日留存率"] = parseFloat(item.d30_retention_rate || 0);
    }
    
    // 添加调试字段
    finalItem.original_merchant_id = item.merchant_id;
    finalItem.main_merchant_name = item.main_merchant_name;
    finalItem.isFullyMatched = item.isFullyMatched;
    
    finalResults.push({ json: finalItem });
  });
});

console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);
console.log("数据示例:", finalResults.slice(0, 3).map(item => item.json));

// 返回格式化的数据
return finalResults;
