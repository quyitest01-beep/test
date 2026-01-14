// 简化版商户ID匹配 - 专门处理你的数据格式
const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

// 从第一个输入项获取商户映射数据
const merchantMappingData = inputs[0].json;
console.log("商户映射数据:", merchantMappingData);

// 从第二个输入项开始获取需要匹配的数据
const dataToMatch = inputs.slice(1);
console.log(`需要匹配的数据项数: ${dataToMatch.length}`);

// 检查商户映射数据格式
if (!merchantMappingData.filtered_merchants || !Array.isArray(merchantMappingData.filtered_merchants)) {
  console.error("❌ 商户映射数据格式错误");
  return [];
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

// 处理数据匹配
const results = [];
let processedCount = 0;
let matchedCount = 0;

dataToMatch.forEach((item, index) => {
  const data = item.json;
  
  // 只处理商户类数据
  if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    processedCount++;
    
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
        isMatched: true
      };

      results.push({
        json: matchedData
      });
      
      matchedCount++;
      console.log(`✅ 匹配成功: ${merchantId} -> ${merchantName}`);
    } else {
      console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
    }
  } else {
    console.log(`⏭️  跳过非商户类数据: ${data.stat_type || 'unknown'}`);
  }
});

console.log(`=== 商户ID匹配完成 ===`);
console.log(`📊 处理商户类数据: ${processedCount}`);
console.log(`✅ 匹配成功: ${matchedCount}`);
console.log(`📈 匹配率: ${processedCount > 0 ? ((matchedCount / processedCount) * 100).toFixed(1) + '%' : '0%'}`);

// 返回结果
return results;