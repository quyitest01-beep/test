// 修复版商户匹配 - 处理实际的数据格式
const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 检查输入数据格式
const firstInput = inputs[0].json;
console.log("第一个输入数据结构:", JSON.stringify(firstInput, null, 2).substring(0, 500) + "...");

// 如果输入数据包含需要匹配的数据（如gameData, merchantData等）
if (firstInput.stat_type || firstInput.merchant || firstInput.game_id) {
  console.log("📊 检测到需要匹配的数据，但缺少商户映射数据");
  console.log("数据示例:", {
    stat_type: firstInput.stat_type,
    merchant: firstInput.merchant,
    game_id: firstInput.game_id,
    unique_users: firstInput.unique_users
  });
  
  // 由于没有商户映射数据，无法进行匹配
  console.log("⚠️ 无法进行商户匹配：缺少商户映射数据");
  return [];
}

// 如果输入数据包含商户映射数据
if (firstInput.filtered_merchants && Array.isArray(firstInput.filtered_merchants)) {
  console.log("📊 检测到商户映射数据，但缺少需要匹配的数据");
  console.log(`商户映射数据: ${firstInput.filtered_merchants.length} 个商户`);
  
  // 构建商户ID到商户名的映射表
  const merchantIdToNameMap = new Map();
  const merchantIdToMainMerchantMap = new Map();

  firstInput.filtered_merchants.forEach(merchant => {
    if (merchant.merchant_id && merchant.sub_merchant_name) {
      merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
      merchantIdToMainMerchantMap.set(merchant.merchant_id.toString(), merchant.main_merchant_name);
    }
  });

  console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
  console.log("⚠️ 无法进行商户匹配：缺少需要匹配的数据");
  return [];
}

// 如果输入数据格式不明确
console.log("❌ 输入数据格式不明确，无法确定是商户映射数据还是需要匹配的数据");
console.log("输入数据字段:", Object.keys(firstInput));
return [];