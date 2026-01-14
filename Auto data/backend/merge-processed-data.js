// n8n Code节点：合并处理后的商户和游戏数据
// 将匹配后的数据重新合并，准备输出

const merchantData = $input.first().json.merchantData || [];
const gameData = $input.first().json.gameData || [];

console.log(`合并数据 - 商户: ${merchantData.length} 条, 游戏: ${gameData.length} 条`);

const mergedData = [];

// 添加商户数据
for (const item of merchantData) {
  mergedData.push({
    json: {
      ...item.json,
      dataCategory: 'merchant',
      processedAt: new Date().toISOString()
    }
  });
}

// 添加游戏数据
for (const item of gameData) {
  mergedData.push({
    json: {
      ...item.json,
      dataCategory: 'game',
      processedAt: new Date().toISOString()
    }
  });
}

// 按时间排序（如果有时间字段）
mergedData.sort((a, b) => {
  const timeA = a.json.date_str || a.json.month_str || '';
  const timeB = b.json.date_str || b.json.month_str || '';
  return timeA.localeCompare(timeB);
});

console.log(`合并完成，总计 ${mergedData.length} 条数据`);

// 生成处理摘要
const summary = {
  totalRecords: mergedData.length,
  merchantRecords: merchantData.length,
  gameRecords: gameData.length,
  processedAt: new Date().toISOString(),
  dataTypes: {
    merchant_daily: mergedData.filter(item => item.json.stat_type === 'merchant_daily').length,
    merchant_monthly: mergedData.filter(item => item.json.stat_type === 'merchant_monthly').length,
    game_daily: mergedData.filter(item => item.json.stat_type === 'game_daily').length,
    game_monthly: mergedData.filter(item => item.json.stat_type === 'game_monthly').length
  }
};

console.log('处理摘要:', summary);

return mergedData;









