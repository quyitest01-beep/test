// 修复版商户匹配器 - 处理Merge节点的实际数据格式
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
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(data, null, 2).substring(0, 300) + "...");

  // 检查是否是商户映射数据（直接数组格式）
  if (Array.isArray(data)) {
    console.log(`📊 识别到商户映射数据数组，共 ${data.length} 条`);
    data.forEach(merchant => {
      if (merchant.merchant_id && merchant.sub_merchant_name) {
        merchantMappingEntries.push(merchant);
      }
    });
  }
  // 检查是否是包含 filtered_merchants 的对象
  else if (data.filtered_merchants && Array.isArray(data.filtered_merchants)) {
    console.log(`📊 识别到包含 filtered_merchants 的商户映射数据，共 ${data.filtered_merchants.length} 条`);
    data.filtered_merchants.forEach(merchant => {
      if (merchant.merchant_id && merchant.sub_merchant_name) {
        merchantMappingEntries.push(merchant);
      }
    });
  }
  // 检查是否是包含 merchantData 的对象
  else if (data.merchantData && Array.isArray(data.merchantData)) {
    console.log(`📈 识别到包含 merchantData 的活跃用户数据，共 ${data.merchantData.length} 条`);
    data.merchantData.forEach(subItem => {
      if (subItem.json && subItem.json.stat_type && subItem.json.stat_type.includes('merchant') && subItem.json.merchant) {
        dataToProcess.push({ json: subItem.json });
      }
    });
  }
  // 检查是否是包含 gameData 的对象
  else if (data.gameData && Array.isArray(data.gameData)) {
    console.log(`🎮 识别到包含 gameData 的游戏数据，共 ${data.gameData.length} 条`);
    // 游戏数据暂时跳过，不处理
  }
  // 检查是否是直接的活跃用户数据项
  else if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
    console.log(`📈 识别到直接的商户活跃用户数据: ${data.merchant}`);
    dataToProcess.push(item);
  }
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的输入数据项 (索引: ${index})，数据字段: ${Object.keys(data).join(', ')}`);
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







