// 商户ID匹配为商户名 - 只处理商户类数据
// 将上游的商户ID替换为对应的商户名称

const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

// 从第一个输入项获取商户映射数据
const merchantMappingData = inputs[0].json;
console.log("商户映射数据结构:", JSON.stringify(merchantMappingData, null, 2).substring(0, 500) + "...");

// 从第二个输入项开始获取需要匹配的数据
const dataToMatch = inputs.slice(1);
console.log(`需要匹配的数据项数: ${dataToMatch.length}`);

// 检查商户映射数据格式
if (!merchantMappingData.filtered_merchants || !Array.isArray(merchantMappingData.filtered_merchants)) {
  console.error("❌ 商户映射数据格式错误，缺少filtered_merchants数组");
  return [{
    json: {
      error: "商户映射数据格式错误",
      status: "failed",
      timestamp: new Date().toISOString()
    }
  }];
}

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

merchantMappingData.filtered_merchants.forEach(merchant => {
  if (merchant.merchant_id && merchant.sub_merchant_name) {
    merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
    merchantIdToMainMerchantMap.set(merchant.merchant_id.toString(), merchant.main_merchant_name);
  }
});

console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
console.log("映射表示例:", Array.from(merchantIdToNameMap.entries()).slice(0, 5));

// 处理数据匹配
const matchedResults = [];
const unmatchedResults = [];
let merchantDataCount = 0;
let gameDataCount = 0;
let matchedCount = 0;
let unmatchedCount = 0;

dataToMatch.forEach((item, index) => {
  const data = item.json;
  
  // 检查数据类型
  if (!data.stat_type) {
    console.log(`⏭️  跳过第${index + 1}项：缺少stat_type字段`);
    return;
  }

  // 只处理商户类数据，跳过游戏类数据
  if (data.stat_type.includes('game')) {
    gameDataCount++;
    console.log(`⏭️  跳过游戏类数据: ${data.stat_type}`);
    return;
  }

  // 只处理商户类数据
  if (data.stat_type.includes('merchant')) {
    merchantDataCount++;
    
    // 检查是否有merchant字段
    if (!data.merchant) {
      console.log(`⏭️  跳过第${index + 1}项：缺少merchant字段`);
      return;
    }

    const merchantId = data.merchant.toString();
    const merchantName = merchantIdToNameMap.get(merchantId);
    const mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);

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

      matchedResults.push({
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

      unmatchedResults.push({
        json: unmatchedData
      });
      
      unmatchedCount++;
      console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
    }
  }
});

// 生成统计信息
const statistics = {
  total_input_items: dataToMatch.length,
  merchant_data_count: merchantDataCount,
  game_data_count: gameDataCount,
  matched_count: matchedCount,
  unmatched_count: unmatchedCount,
  match_rate: merchantDataCount > 0 ? ((matchedCount / merchantDataCount) * 100).toFixed(1) + '%' : '0%',
  merchant_mapping_size: merchantIdToNameMap.size
};

console.log("=== 商户ID匹配完成 ===");
console.log(`📊 总输入项数: ${dataToMatch.length}`);
console.log(`📊 商户类数据: ${merchantDataCount}`);
console.log(`📊 游戏类数据: ${gameDataCount} (已跳过)`);
console.log(`✅ 匹配成功: ${matchedCount}`);
console.log(`❌ 匹配失败: ${unmatchedCount}`);
console.log(`📈 匹配率: ${statistics.match_rate}`);

// 输出结果
const output = {
  status: "success",
  timestamp: new Date().toISOString(),
  statistics: statistics,
  matched_merchants: matchedResults,
  unmatched_merchants: unmatchedResults,
  summary: {
    total_processed: matchedCount + unmatchedCount,
    success_rate: statistics.match_rate,
    merchant_mapping_used: merchantIdToNameMap.size
  }
};

// 返回匹配成功的数据
if (matchedResults.length === 0) {
  console.log("⚠️ 没有匹配成功的数据，返回空结果");
  return [];
}

console.log(`🎯 返回 ${matchedResults.length} 个匹配成功的数据项`);
return matchedResults;
