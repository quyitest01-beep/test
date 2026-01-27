// N8N Code Node - Retention Data Mapper
// 处理上游数据，匹配商户名和游戏名，输出格式化的留存数据

// 假设输入数据在 $input.all() 中
const inputData = $input.all()[0].json;

// 提取数据结构
const filteredMerchants = inputData.filtered_merchants || [];
const allData = inputData.filtered_merchants || [];

// 创建商户ID到商户名的映射
const merchantMap = {};
filteredMerchants.forEach(item => {
  if (item.merchant_id && item.sub_merchant_name) {
    merchantMap[item.merchant_id.toString()] = item.sub_merchant_name;
  }
});

// 创建游戏ID到游戏名的映射
const gameMap = {};
allData.forEach(item => {
  if (item.game_id && item.game) {
    gameMap[item.game_id] = item.game;
  }
});

// 处理留存数据（包含 dataType 字段的记录）
const retentionData = allData.filter(item => item.dataType === 'game_act');

// 转换数据格式
const result = retentionData.map(item => {
  // 匹配商户名
  const merchantName = merchantMap[item.merchant] || '未知商户';
  
  // 匹配游戏名
  const gameName = gameMap[item.game_id] || '未知游戏';
  
  // 格式化留存率（转换为百分比字符串）
  const formatRetentionRate = (rate) => {
    const numRate = parseFloat(rate);
    return isNaN(numRate) ? '0%' : `${Math.round(numRate * 100)}%`;
  };
  
  return {
    "游戏名": gameName,
    "商户名": merchantName,
    "币种": item.currency || '',
    "日期": item.cohort_date || '',
    "数据类型": "留存数据",
    "当日用户数": parseInt(item.d0_users) || 0,
    "次日用户数": parseInt(item.d1_users) || 0,
    "次日留存率": formatRetentionRate(item.d1_retention_rate),
    "3日用户数": parseInt(item.d3_users) || 0,
    "3日留存率": formatRetentionRate(item.d3_retention_rate),
    "7日用户数": parseInt(item.d7_users) || 0,
    "7日留存率": formatRetentionRate(item.d7_retention_rate),
    "14日用户数": parseInt(item.d14_users) || 0,
    "14日留存率": formatRetentionRate(item.d14_retention_rate),
    "30日用户数": parseInt(item.d30_users) || 0,
    "30日留存率": formatRetentionRate(item.d30_retention_rate)
  };
});

// 返回处理后的数据
return result.map(item => ({ json: item }));
