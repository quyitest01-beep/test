// 商户匹配器 - 处理嵌套数据结构 { "json": { ... } }
const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 用于收集商户映射数据
const merchantMappingEntries = [];
// 用于收集需要匹配的活跃用户数据
const dataToProcess = [];

// 遍历所有输入项，智能识别数据类型
inputs.forEach((item, index) => {
  const data = item.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(data, null, 2).substring(0, 200) + "...");

  // 尝试识别商户映射数据：
  // 1. 如果是直接的商户对象
  if (data.merchant_id && (data.sub_merchant_name || data.main_merchant_name)) {
    merchantMappingEntries.push(data);
    console.log(`📊 识别到单个商户映射条目: ${data.sub_merchant_name || data.merchant_id}`);
  }
  // 2. 如果是包含 'filtered_merchants' 数组的对象
  else if (data.filtered_merchants && Array.isArray(data.filtered_merchants)) {
    data.filtered_merchants.forEach(merchant => merchantMappingEntries.push(merchant));
    console.log(`📊 识别到包含 filtered_merchants 的商户映射数据，共 ${data.filtered_merchants.length} 条`);
  }
  // 尝试识别需要匹配的活跃用户数据：
  // 1. 如果是直接的活跃用户数据项
  else if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    dataToProcess.push(item);
    console.log(`📈 识别到直接的商户活跃用户数据: ${data.merchant}`);
  }
  // 2. 如果是嵌套的活跃用户数据项 { "json": { ... } }
  else if (data.json && data.json.stat_type && data.json.stat_type.includes('merchant') && data.json.merchant) {
    dataToProcess.push({ json: data.json });
    console.log(`📈 识别到嵌套的商户活跃用户数据: ${data.json.merchant}`);
  }
  // 3. 如果是游戏类数据，跳过
  else if (data.stat_type && data.stat_type.includes('game')) {
    console.log(`⏭️  跳过游戏类数据: ${data.stat_type}`);
  }
  // 4. 其他无法识别的数据类型
  else {
    console.log(`⚠️ 无法识别的输入数据项 (索引: ${index})，跳过。数据字段: ${Object.keys(data).join(', ')}`);
  }
});

console.log(`📊 收集到商户映射数据: ${merchantMappingEntries.length} 条`);
console.log(`📈 收集到需要匹配的数据: ${dataToProcess.length} 条`);

// 检查是否收集到商户映射数据
if (merchantMappingEntries.length === 0) {
  console.error("❌ 没有找到商户映射数据，无法进行匹配。请检查上游节点输出。");
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

// 检查是否收集到需要匹配的活跃用户数据
if (dataToProcess.length === 0) {
  console.warn("⚠️ 没有找到需要匹配的活跃用户数据。");
  return [];
}

// 处理数据匹配
const results = [];
let matchedCount = 0;
let unmatchedCount = 0;

dataToProcess.forEach((item, index) => {
  const data = item.json;

  if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    const merchantId = data.merchant.toString();
    const merchantName = merchantIdToNameMap.get(merchantId);
    const mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);

    console.log(`🔍 处理商户ID: ${merchantId}, 查找结果: ${merchantName || '未找到'}`);

    if (merchantName) {
      // 匹配成功，替换merchant字段为商户名
      const matchedData = {
        ...data,
        merchant: merchantName,        // 替换为商户名
        merchant_id: merchantId,       // 保留原始ID
        main_merchant_name: mainMerchantName, // 添加主商户名
        isMatched: true,
        matchType: 'merchant_id_to_name'
      };
      results.push({ json: matchedData });
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
      results.push({ json: unmatchedData });
      unmatchedCount++;
      console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
    }
  } else {
    console.log(`⏭️  跳过非商户类数据: ${data.stat_type || 'unknown'}`);
  }
});

console.log(`=== 商户ID匹配完成 ===`);
console.log(`📊 总共尝试匹配商户类数据: ${dataToProcess.length}`);
console.log(`✅ 匹配成功: ${matchedCount}`);
console.log(`❌ 匹配失败: ${unmatchedCount}`);
console.log(`📈 匹配率: ${dataToProcess.length > 0 ? ((matchedCount / dataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);

// 返回匹配结果
return results;







