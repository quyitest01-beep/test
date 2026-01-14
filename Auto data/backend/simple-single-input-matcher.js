// 简单版单输入商户匹配 - 专门处理你的数据格式
const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const inputData = inputs[0].json;
console.log("输入数据字段:", Object.keys(inputData));

// 检查是否有商户映射数据
if (!inputData.filtered_merchants || !Array.isArray(inputData.filtered_merchants)) {
  console.error("❌ 输入数据中缺少filtered_merchants数组");
  return [];
}

console.log(`📊 商户映射数据: ${inputData.filtered_merchants.length} 个商户`);

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

inputData.filtered_merchants.forEach(merchant => {
  if (merchant.merchant_id && merchant.sub_merchant_name) {
    merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
    merchantIdToMainMerchantMap.set(merchant.merchant_id.toString(), merchant.main_merchant_name);
  }
});

console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);

// 检查是否有需要匹配的数据
// 从你的截图看，输入数据只有商户映射数据，没有需要匹配的数据
// 这意味着你需要先获取需要匹配的数据，然后再进行匹配

console.log("⚠️ 当前输入只有商户映射数据，没有需要匹配的数据");
console.log("需要先获取需要匹配的数据，然后再进行匹配");

// 返回空结果，因为当前没有需要匹配的数据
return [];
