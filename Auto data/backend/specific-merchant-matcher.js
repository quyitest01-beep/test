// 专门处理你的数据格式的商户匹配器
const inputs = $input.all();
console.log("=== 专门商户匹配器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分析输入数据结构
let merchantMappingData = [];
let dataToMatch = [];

console.log("=== 分析输入数据结构 ===");
inputs.forEach((item, index) => {
  const data = item.json;
  console.log(`输入项 ${index}:`, {
    keys: Object.keys(data),
    hasFilteredMerchants: !!data.filtered_merchants,
    hasStatType: !!data.stat_type,
    hasMerchant: !!data.merchant,
    isArray: Array.isArray(data)
  });
  
  // 检查是否是商户映射数据
  if (data.filtered_merchants && Array.isArray(data.filtered_merchants)) {
    console.log(`📊 发现商户映射数据 (输入项 ${index})`);
    merchantMappingData = data.filtered_merchants;
  }
  // 检查是否是直接数组格式的商户映射数据
  else if (Array.isArray(data) && data.length > 0 && data[0].merchant_id) {
    console.log(`📊 发现直接数组格式的商户映射数据 (输入项 ${index})`);
    merchantMappingData = data;
  }
  // 检查是否是嵌套的商户映射数据
  else if (data.json && Array.isArray(data.json) && data.json.length > 0 && data.json[0].merchant_id) {
    console.log(`📊 发现嵌套格式的商户映射数据 (输入项 ${index})`);
    merchantMappingData = data.json;
  }
  // 检查是否是需要匹配的数据
  else if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    console.log(`📊 发现需要匹配的商户数据 (输入项 ${index})`);
    dataToMatch.push({ json: data });
  }
  // 检查是否是嵌套的需要匹配的数据
  else if (data.json && data.json.stat_type && data.json.stat_type.includes('merchant') && data.json.merchant) {
    console.log(`📊 发现嵌套的需要匹配的商户数据 (输入项 ${index})`);
    dataToMatch.push({ json: data.json });
  }
  // 检查是否是merchantData数组
  else if (data.merchantData && Array.isArray(data.merchantData)) {
    console.log(`📊 发现merchantData数组 (输入项 ${index})`);
    data.merchantData.forEach(subItem => {
      if (subItem.json && subItem.json.stat_type && subItem.json.stat_type.includes('merchant') && subItem.json.merchant) {
        dataToMatch.push({ json: subItem.json });
      }
    });
  }
});

console.log(`=== 数据分类结果 ===`);
console.log(`商户映射数据: ${merchantMappingData.length} 个商户`);
console.log(`需要匹配的数据: ${dataToMatch.length} 条`);

if (merchantMappingData.length === 0) {
  console.error("❌ 没有找到商户映射数据");
  console.log("请检查上游节点是否正确输出了商户映射数据");
  return [];
}

if (dataToMatch.length === 0) {
  console.error("❌ 没有找到需要匹配的数据");
  console.log("请检查上游节点是否正确输出了需要匹配的数据");
  return [];
}

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

merchantMappingData.forEach(merchant => {
  if (merchant.merchant_id && merchant.sub_merchant_name) {
    merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
    merchantIdToMainMerchantMap.set(merchant.merchant_id.toString(), merchant.main_merchant_name);
  }
});

console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
console.log("映射表示例:", Array.from(merchantIdToNameMap.entries()).slice(0, 5));

// 处理需要匹配的数据
const results = [];
let matchedCount = 0;
let unmatchedCount = 0;

dataToMatch.forEach((item, index) => {
  const data = item.json;
  
  // 只处理商户类数据
  if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    const merchantId = data.merchant.toString();
    const merchantName = merchantIdToNameMap.get(merchantId);
    const mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);
    
    console.log(`🔍 处理商户ID: ${merchantId}, 查找结果: ${merchantName || '未找到'}`);
    
    if (merchantName) {
      // 匹配成功，替换merchant字段为商户名
      const matchedData = {
        ...data,
        merchant: merchantName,  // 替换为商户名
        merchant_id: merchantId, // 保留原始ID
        main_merchant_name: mainMerchantName, // 添加主商户名
        isMatched: true,
        matchType: 'merchant_id_to_name'
      };
      
      results.push({
        json: matchedData
      });
      
      matchedCount++;
      console.log(`✅ 匹配成功: ${merchantId} -> ${merchantName} (主商户: ${mainMerchantName})`);
    } else {
      // 匹配失败，保留原始数据但标记为未匹配
      const unmatchedData = {
        ...data,
        merchant_id: merchantId, // 保留原始ID
        isMatched: false,
        matchType: 'merchant_id_not_found'
      };
      
      results.push({
        json: unmatchedData
      });
      
      unmatchedCount++;
      console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
    }
  } else if (data.stat_type && data.stat_type.includes('game')) {
    // 游戏类数据，跳过匹配
    console.log(`⏭️  跳过游戏类数据: ${data.stat_type}`);
    results.push({
      json: {
        ...data,
        isMatched: false,
        matchType: 'game_data_skip'
      }
    });
  } else {
    console.log(`⏭️  跳过未知类型数据: ${data.stat_type || 'unknown'}`);
    results.push({
      json: {
        ...data,
        isMatched: false,
        matchType: 'unknown_data_type'
      }
    });
  }
});

console.log(`=== 商户ID匹配完成 ===`);
console.log(`✅ 匹配成功: ${matchedCount}`);
console.log(`❌ 匹配失败: ${unmatchedCount}`);
console.log(`📈 匹配率: ${dataToMatch.length > 0 ? ((matchedCount / dataToMatch.length) * 100).toFixed(1) + '%' : '0%'}`);

return results;






