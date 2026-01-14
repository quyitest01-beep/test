// Lark Sheets API 正确配置 - 根据官方文档
const inputs = $input.all();
console.log("=== Lark Sheets API 配置开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 提取token和商户数据
let larkToken = null;
const merchantData = [];

inputs.forEach((item, index) => {
  const data = item.json;
  
  // 检查是否是token数据
  if (data.tenant_access_token) {
    larkToken = data.tenant_access_token;
    console.log(`🔑 获取到Lark token: ${larkToken.substring(0, 20)}...`);
  }
  // 检查是否是商户数据
  else if (data.stat_type && data.merchant) {
    merchantData.push(data);
  }
});

if (!larkToken) {
  console.error("❌ 没有找到Lark token，无法创建表格");
  return [];
}

if (merchantData.length === 0) {
  console.error("❌ 没有找到商户数据");
  return [];
}

console.log(`📊 处理商户数据: ${merchantData.length} 条`);

// 按stat_type分组数据
const groupedData = new Map();
let totalProcessed = 0;

merchantData.forEach((data) => {
  const statType = data.stat_type;
  
  if (!groupedData.has(statType)) {
    groupedData.set(statType, []);
  }
  
  groupedData.get(statType).push(data);
  totalProcessed++;
});

console.log(`📊 处理完成，共 ${totalProcessed} 条数据`);
console.log(`📊 分组数量: ${groupedData.size}`);

// 为每个stat_type创建Lark子表
const results = [];

groupedData.forEach((dataList, statType) => {
  console.log(`📋 处理 ${statType} 数据，共 ${dataList.length} 条`);
  
  // 根据stat_type生成子表名
  const tableName = generateTableName(statType);
  console.log(`📋 生成子表名: ${tableName}`);
  
  // 准备写入Lark的数据
  const larkData = prepareLarkData(dataList, statType);
  
  // 创建Lark表格写入结果
  const result = {
    stat_type: statType,
    table_name: tableName,
    data_count: dataList.length,
    lark_token: larkToken,
    lark_data: larkData,
    lark_url: `https://d4ft1c7bo4f.sg.larksuite.com/wiki/P5xzwpnIxiwWmTkNph5louAoggf`,
    summary: {
      total_rows: dataList.length,
      matched_count: dataList.filter(d => d.isMatched).length,
      unmatched_count: dataList.filter(d => !d.isMatched).length,
      match_rate: dataList.length > 0 ? ((dataList.filter(d => d.isMatched).length / dataList.length) * 100).toFixed(1) + '%' : '0%'
    }
  };
  
  results.push({
    json: result
  });
  
  console.log(`✅ ${statType} 数据处理完成，准备写入Lark表格: ${tableName}`);
});

console.log(`=== Lark表格写入准备完成 ===`);
console.log(`📊 总共创建 ${results.length} 个子表`);

return results;

// 根据stat_type生成子表名
function generateTableName(statType) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = `${year}${month}${day}`;
  
  switch (statType) {
    case 'merchant_daily':
      return `商户日活跃用户_${timestamp}`;
    case 'merchant_monthly':
      return `商户月活跃用户_${timestamp}`;
    case 'game_daily':
      return `游戏日活跃用户_${timestamp}`;
    case 'game_monthly':
      return `游戏月活跃用户_${timestamp}`;
    default:
      return `${statType}_${timestamp}`;
  }
}

// 准备写入Lark的数据格式
function prepareLarkData(dataList, statType) {
  const headers = [
    '日期',
    '商户名称',
    '商户ID',
    '主商户名称',
    '唯一用户数',
    '数据类型',
    '匹配状态',
    '原始索引'
  ];
  
  const rows = dataList.map(data => [
    data.date_str || '',
    data.merchant || '',
    data.merchant_id || '',
    data.main_merchant_name || '',
    data.unique_users || '',
    data.dataType || '',
    data.isMatched ? '已匹配' : '未匹配',
    data.originalIndex || ''
  ]);
  
  return {
    headers: headers,
    rows: rows,
    total_rows: rows.length
  };
}







