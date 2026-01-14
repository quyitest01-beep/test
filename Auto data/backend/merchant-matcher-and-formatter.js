// 商户匹配器和数据格式化器
// 处理数组格式的上游数据，同时完成商户匹配和输出最终的活跃用户数据

const inputs = $input.all();
console.log("=== 商户匹配器和数据格式化器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 获取上游数据（处理所有输入项）
console.log("🔍 上游数据结构分析:");
console.log("输入项数量:", inputs.length);

// 用于收集商户映射数据
const merchantMappingEntries = [];
// 用于收集需要匹配的活跃用户数据
const dataToProcess = [];

// 遍历所有输入项
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  // 检查是否是商户映射数据
  if (item.sub_merchant_name && item.merchant_id && item.main_merchant_name) {
    console.log(`📊 识别到商户映射数据: ${item.sub_merchant_name} (ID: ${item.merchant_id})`);
    merchantMappingEntries.push(item);
  }
  // 检查是否是活跃用户数据
  else if (item.merchant && (item.daily_unique_users || item.weekly_unique_users)) {
    console.log(`📈 识别到活跃用户数据: 商户ID ${item.merchant}, 数据类型: ${item.dataType}`);
    dataToProcess.push({ json: item });
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
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的数据项 (索引: ${index})，数据字段: ${Object.keys(item).join(', ')}`);
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

// 处理数据匹配
const matchedResults = [];
let matchedCount = 0;
let unmatchedCount = 0;

dataToProcess.forEach((item, index) => {
  const data = item.json;

  if (data.merchant) {
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
      matchedResults.push({ json: matchedData });
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
      matchedResults.push({ json: unmatchedData });
      unmatchedCount++;
      console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
    }
  } else {
    console.log(`⏭️  跳过无商户ID的数据`);
  }
});

console.log(`=== 商户匹配完成 ===`);
console.log(`📊 总共尝试匹配数据: ${dataToProcess.length}`);
console.log(`✅ 匹配成功: ${matchedCount}`);
console.log(`❌ 匹配失败: ${unmatchedCount}`);
console.log(`📈 匹配率: ${dataToProcess.length > 0 ? ((matchedCount / dataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);

// 现在处理匹配后的数据，生成Lark表格格式
const merchantDataMap = new Map(); // merchantName -> {total: number, dailyData: []}

// 处理匹配后的数据
matchedResults.forEach(item => {
  const data = item.json;
  
  // 只处理匹配成功的商户数据
  if (data.isMatched && data.merchant) {
    const merchantName = data.merchant;
    const userCount = parseInt(data.daily_unique_users || data.weekly_unique_users || 0);
    const dateStr = data.date_str;
    
    // 初始化商户数据
    if (!merchantDataMap.has(merchantName)) {
      merchantDataMap.set(merchantName, {
        total: 0,
        dailyData: []
      });
    }
    
    const merchantData = merchantDataMap.get(merchantName);
    
    // 如果是按日数据，添加到每日数据中
    if (dateStr && data.dataType === 'merchant_daily') {
      merchantData.dailyData.push({
        date: dateStr,
        users: userCount
      });
    }
    
    // 累计总数
    merchantData.total += userCount;
  }
});

console.log(`📊 收集到 ${merchantDataMap.size} 个商户的活跃用户数据`);

// 生成Lark表格格式数据
const larkTableData = [];

// 按商户名A→Z排序
const sortedMerchantNames = Array.from(merchantDataMap.keys()).sort((a, b) => {
  return a.localeCompare(b, 'zh-CN', { numeric: true });
});

console.log("商户排序结果:", sortedMerchantNames.slice(0, 10));

// 为每个商户生成数据
sortedMerchantNames.forEach(merchantName => {
  const merchantData = merchantDataMap.get(merchantName);
  
  // 1. 先添加合计行
  larkTableData.push({
    商户名: merchantName,
    日期: "合计",
    投注用户数: merchantData.total
  });
  
  // 2. 再添加每日数据（按日期排序）
  const sortedDailyData = merchantData.dailyData.sort((a, b) => {
    return a.date.localeCompare(b.date);
  });
  
  sortedDailyData.forEach(dailyItem => {
    larkTableData.push({
      商户名: merchantName,
      日期: dailyItem.date,
      投注用户数: dailyItem.users
    });
  });
});

console.log(`📈 生成Lark表格数据: ${larkTableData.length} 行`);
console.log("数据示例:", larkTableData.slice(0, 5));

// 返回格式化的数据
return larkTableData.map(item => ({ json: item }));
