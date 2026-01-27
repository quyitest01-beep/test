// N8N Code Node - 简化版留存数据映射器
// 直接在 N8N 的 Code 节点中使用

// 获取输入数据
const data = $input.all()[0].json;

// 构建商户映射表 (merchant_id -> sub_merchant_name)
const merchantMap = {};
data.filtered_merchants.forEach(m => {
  if (m.merchant_id && m.sub_merchant_name) {
    merchantMap[m.merchant_id.toString()] = m.sub_merchant_name;
  }
});

// 构建游戏映射表 (game_id -> game)
const gameMap = {};
data.filtered_merchants.forEach(g => {
  if (g.game_id && g.game) {
    gameMap[g.game_id] = g.game;
  }
});

// 筛选留存数据并转换格式
const output = data.filtered_merchants
  .filter(item => item.dataType === 'game_act')
  .map(item => {
    const formatRate = (rate) => {
      const num = parseFloat(rate);
      return isNaN(num) ? '0%' : `${Math.round(num * 100)}%`;
    };
    
    return {
      json: {
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
      }
    };
  });

return output;
