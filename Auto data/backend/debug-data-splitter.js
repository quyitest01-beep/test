// n8n Code节点：调试数据拆分器
// 帮助调试数据类型判断过程

const inputData = $input.all();
console.log(`开始处理 ${inputData.length} 条数据`);

const results = [];
const debugInfo = [];

for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i];
  const data = item.json;
  
  // 调试信息
  const debug = {
    index: i,
    hasStatType: !!data.stat_type,
    statType: data.stat_type,
    hasGameId: !!data.game_id,
    hasMerchant: !!data.merchant,
    hasDailyUsers: !!data.daily_unique_users,
    hasUniqueUsers: !!data.unique_users,
    hasDateStr: !!data.date_str,
    hasMonthStr: !!data.month_str
  };
  
  // 精确判断数据类型
  let dataType = 'unknown';
  
  if (data.stat_type) {
    // 有stat_type字段的情况
    if (data.stat_type === 'merchant_daily' || data.stat_type === 'merchant_monthly') {
      dataType = 'merchant';
    } else if (data.stat_type === 'game_daily' || data.stat_type === 'game_monthly') {
      dataType = 'game';
    } else {
      dataType = 'other';
    }
  } else {
    // 没有stat_type字段的情况，通过字段组合判断
    if (data.game_id) {
      // 有game_id字段，说明是游戏数据
      dataType = 'game';
    } else if (data.merchant) {
      // 有merchant字段，可能是商户数据
      if (data.daily_unique_users || data.unique_users) {
        dataType = 'merchant';
      } else if (data.date_str || data.month_str) {
        dataType = 'merchant';
      } else {
        dataType = 'merchant'; // 默认认为是商户数据
      }
    } else {
      dataType = 'other';
    }
  }
  
  debug.dataType = dataType;
  debugInfo.push(debug);
  
  results.push({
    json: {
      ...data,
      dataType: dataType,
      originalIndex: i
    }
  });
}

console.log(`处理完成，共 ${results.length} 条数据`);

// 统计各类型数据数量
const typeCount = results.reduce((acc, item) => {
  const type = item.json.dataType;
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {});

console.log('数据类型统计:', typeCount);

// 输出前10条调试信息
console.log('前10条数据调试信息:', debugInfo.slice(0, 10));

return results;






