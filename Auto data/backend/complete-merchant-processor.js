// 完整商户数据处理器
// 处理商户映射数据和活跃用户数据，生成Lark表格格式

const inputs = $input.all();
console.log("=== 完整商户数据处理器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分析上游数据结构
const inputData = inputs[0].json;
console.log("🔍 上游数据结构分析:");
console.log("数据类型:", typeof inputData);
console.log("主要字段:", Object.keys(inputData));

// 检查数据结构
if (inputData.filtered_merchants && Array.isArray(inputData.filtered_merchants)) {
  console.log(`📊 发现filtered_merchants数组，共 ${inputData.filtered_merchants.length} 个商户`);
  
  // 生成商户映射数据
  const merchantMappingData = inputData.filtered_merchants.map(merchant => {
    return {
      商户名: merchant.sub_merchant_name,
      主商户名: merchant.main_merchant_name,
      商户ID: merchant.merchant_id
    };
  });
  
  // 按商户名A→Z排序
  const sortedMerchants = merchantMappingData.sort((a, b) => {
    return a.商户名.localeCompare(b.商户名, 'zh-CN', { numeric: true });
  });
  
  console.log("商户排序结果:", sortedMerchants.slice(0, 10).map(m => m.商户名));
  
  // 生成Lark表格格式数据
  const larkTableData = sortedMerchants.map(merchant => {
    return {
      商户名: merchant.商户名,
      主商户名: merchant.主商户名,
      商户ID: merchant.商户ID
    };
  });
  
  console.log(`📈 生成商户映射数据: ${larkTableData.length} 行`);
  console.log("数据示例:", larkTableData.slice(0, 5));
  
  // 返回格式化的数据
  return larkTableData.map(item => ({ json: item }));
  
} else if (inputData.merchantData && Array.isArray(inputData.merchantData)) {
  console.log(`📊 发现merchantData数组，共 ${inputData.merchantData.length} 条数据`);
  
  // 处理商户活跃用户数据
  const merchantDataMap = new Map(); // merchantName -> {total: number, dailyData: []}
  
  inputData.merchantData.forEach(item => {
    const data = item.json;
    
    // 只处理匹配成功的商户数据
    if (data.isMatched && data.merchant && data.stat_type && data.stat_type.includes('merchant')) {
      const merchantName = data.merchant;
      const userCount = parseInt(data.daily_unique_users || data.unique_users || 0);
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
      if (dateStr && data.stat_type.includes('daily')) {
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
  
} else {
  console.log("⚠️ 未发现预期的数据结构，尝试其他处理方式");
  
  // 尝试处理其他可能的数据结构
  if (Array.isArray(inputData)) {
    console.log("📊 输入数据是数组格式");
    return inputData.map(item => ({ json: item }));
  } else {
    console.log("📊 输入数据是对象格式，直接返回");
    return [{ json: inputData }];
  }
}





