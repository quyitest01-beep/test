// 商户数据格式化器 - 输出Lark表格格式
// 按商户名A→Z排序，生成合计和每日数据

const inputs = $input.all();
console.log("=== 商户数据格式化开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 收集所有商户数据
const merchantDataMap = new Map(); // merchantName -> {total: number, dailyData: []}

// 处理所有输入数据
inputs.forEach((item, index) => {
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

console.log(`📊 收集到 ${merchantDataMap.size} 个商户的数据`);

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
