// 测试留存数据映射器
// 使用 shangy.json 的数据结构进行测试

const fs = require('fs');

// 读取测试数据
const testData = {
  "status": "success",
  "timestamp": "2026-01-20T04:14:26.148Z",
  "filtered_merchants": [
    {
      "sub_merchant_name": "betfiery",
      "main_merchant_name": "RD1",
      "merchant_id": 1698202251
    },
    {
      "sub_merchant_name": "mexlucky",
      "main_merchant_name": "RD1",
      "merchant_id": 1698203058
    },
    {
      "game_id": "1698217736104",
      "game": "Fortune Tiger",
      "merchant": "1698203185"
    },
    {
      "game_id": "1698217753408",
      "game": "Chicken Road Zombie",
      "merchant": null
    },
    {
      "merchant": "1698202251",
      "game_id": "1698217736104",
      "currency": "BRL",
      "cohort_date": "2025-12-05",
      "d0_users": "1",
      "d1_users": "0",
      "d1_retention_rate": "0.0",
      "d3_users": "0",
      "d3_retention_rate": "0.0",
      "d7_users": "0",
      "d7_retention_rate": "0.0",
      "d14_users": "0",
      "d14_retention_rate": "0.0",
      "d30_users": "0",
      "d30_retention_rate": "0.0",
      "dataType": "game_act"
    },
    {
      "merchant": "1698203058",
      "game_id": "1698217753408",
      "currency": "MXN",
      "cohort_date": "2025-12-31",
      "d0_users": "1",
      "d1_users": "0",
      "d1_retention_rate": "0.0",
      "d3_users": "0",
      "d3_retention_rate": "0.0",
      "d7_users": "0",
      "d7_retention_rate": "0.0",
      "d14_users": "0",
      "d14_retention_rate": "0.0",
      "d30_users": "0",
      "d30_retention_rate": "0.0",
      "dataType": "game_act"
    }
  ]
};

// 映射逻辑
function processRetentionData(data) {
  // 构建商户映射表
  const merchantMap = {};
  data.filtered_merchants.forEach(m => {
    if (m.merchant_id && m.sub_merchant_name) {
      merchantMap[m.merchant_id.toString()] = m.sub_merchant_name;
    }
  });

  // 构建游戏映射表
  const gameMap = {};
  data.filtered_merchants.forEach(g => {
    if (g.game_id && g.game) {
      gameMap[g.game_id] = g.game;
    }
  });

  // 格式化留存率
  const formatRate = (rate) => {
    const num = parseFloat(rate);
    return isNaN(num) ? '0%' : `${Math.round(num * 100)}%`;
  };

  // 筛选并转换留存数据
  const result = data.filtered_merchants
    .filter(item => item.dataType === 'game_act')
    .map(item => ({
      "游戏名": gameMap[item.game_id] || '未知游戏',
      "商户名": merchantMap[item.merchant] || '未知商户',
      "币种": item.currency || '',
      "日期": item.cohort_date || '',
      "数据类型": "留存数据",
      "当日用户数": parseInt(item.d0_users) || 0,
      "次日用户数": parseInt(item.d1_users) || 0,
      "次日留存率": formatRate(item.d1_retention_rate),
      "3日用户数": parseInt(item.d3_users) || 0,
      "3日留存率": formatRate(item.d3_retention_rate),
      "7日用户数": parseInt(item.d7_users) || 0,
      "7日留存率": formatRate(item.d7_retention_rate),
      "14日用户数": parseInt(item.d14_users) || 0,
      "14日留存率": formatRate(item.d14_retention_rate),
      "30日用户数": parseInt(item.d30_users) || 0,
      "30日留存率": formatRate(item.d30_retention_rate)
    }));

  return result;
}

// 执行测试
console.log('开始测试留存数据映射器...\n');
const result = processRetentionData(testData);

console.log('处理结果:');
console.log(JSON.stringify(result, null, 2));

console.log('\n映射统计:');
console.log(`- 总记录数: ${testData.filtered_merchants.length}`);
console.log(`- 留存数据记录数: ${result.length}`);
console.log(`- 处理成功: ${result.length > 0 ? '✓' : '✗'}`);
