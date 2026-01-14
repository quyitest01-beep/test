// 留存数据聚合器：按月份、游戏、商户汇总并计算留存率
const inputs = $input.all();

console.log("=== 留存数据聚合器开始 ===");
console.log("📊 输入项数量:", inputs.length);

// 1. 解析和预处理数据
const rawData = [];
inputs.forEach((input, index) => {
  const data = input.json || {};
  if (data["游戏名"] || data["日期"]) {
    rawData.push(data);
  }
});

console.log(`✅ 解析到 ${rawData.length} 条数据`);

// 2. 按月份分组（从日期中提取年月）
function extractYearMonth(dateStr) {
  if (!dateStr) return null;
  // 支持格式：2025-11-03, 2025/11/03, 20251103
  const match = dateStr.match(/(\d{4})[-/]?(\d{2})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

// 3. 计算留存率（百分比，保留两位小数）
function calculateRetentionRate(numerator, denominator) {
  if (!denominator || denominator === 0) {
    return "0.00%";
  }
  const rate = (numerator / denominator) * 100;
  return `${rate.toFixed(2)}%`;
}

// 4. 解析数值（处理字符串格式的数值）
function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // 移除百分号、逗号等
    const cleaned = value.replace(/%|,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 5. 数据结构：月份 -> 游戏名 -> 商户名 -> 数据数组
const dataMap = {};

rawData.forEach(item => {
  const dateStr = item["日期"] || "";
  const yearMonth = extractYearMonth(dateStr);
  if (!yearMonth) {
    console.warn(`⚠️ 无法解析日期: ${dateStr}`);
    return;
  }
  
  const gameName = item["游戏名"] || "未知游戏";
  const merchantName = item["商户名"] || "未知商户";
  const dataType = item["数据类型"] || "";
  
  // 只处理新用户留存数据
  if (dataType !== "新用户留存") {
    return;
  }
  
  // 初始化数据结构
  if (!dataMap[yearMonth]) {
    dataMap[yearMonth] = {};
  }
  if (!dataMap[yearMonth][gameName]) {
    dataMap[yearMonth][gameName] = {};
  }
  if (!dataMap[yearMonth][gameName][merchantName]) {
    dataMap[yearMonth][gameName][merchantName] = {
      totalUsers: 0,      // 当日用户数之和
      totalD1Users: 0,    // 次日用户数之和
      totalD7Users: 0     // 7日用户数之和
    };
  }
  
  // 累加数据
  const merchantData = dataMap[yearMonth][gameName][merchantName];
  merchantData.totalUsers += parseNumber(item["当日用户数"]);
  merchantData.totalD1Users += parseNumber(item["次日用户数"]);
  merchantData.totalD7Users += parseNumber(item["7日用户数"]);
});

// 6. 构建输出结果
const results = [];

// 遍历每个月份
Object.keys(dataMap).sort().forEach(yearMonth => {
  const monthData = dataMap[yearMonth];
  
  // 6.1 计算整体汇总（所有游戏、所有商户）
  let overallTotalUsers = 0;
  let overallTotalD1Users = 0;
  let overallTotalD7Users = 0;
  
  Object.keys(monthData).forEach(gameName => {
    Object.keys(monthData[gameName]).forEach(merchantName => {
      const merchantData = monthData[gameName][merchantName];
      overallTotalUsers += merchantData.totalUsers;
      overallTotalD1Users += merchantData.totalD1Users;
      overallTotalD7Users += merchantData.totalD7Users;
    });
  });
  
  // 6.2 添加整体汇总
  results.push({
    "汇总": yearMonth,
    "唯一用户数": overallTotalUsers.toString(),
    "新用户D1留存率": calculateRetentionRate(overallTotalD1Users, overallTotalUsers),
    "新用户D7留存率": calculateRetentionRate(overallTotalD7Users, overallTotalUsers)
  });
  
  // 6.3 按游戏维度汇总
  Object.keys(monthData).sort().forEach(gameName => {
    const gameData = monthData[gameName];
    
    // 计算游戏整体汇总（所有商户）
    let gameTotalUsers = 0;
    let gameTotalD1Users = 0;
    let gameTotalD7Users = 0;
    
    Object.keys(gameData).forEach(merchantName => {
      const merchantData = gameData[merchantName];
      gameTotalUsers += merchantData.totalUsers;
      gameTotalD1Users += merchantData.totalD1Users;
      gameTotalD7Users += merchantData.totalD7Users;
    });
    
    // 构建游戏输出对象
    const gameOutput = {
      "游戏名": gameName,
      "时间": yearMonth,
      "汇总": {
        "唯一用户数": gameTotalUsers.toString(),
        "新用户D1留存率": calculateRetentionRate(gameTotalD1Users, gameTotalUsers),
        "新用户D7留存率": calculateRetentionRate(gameTotalD7Users, gameTotalUsers)
      },
      "商户数据": []
    };
    
    // 添加各商户数据
    Object.keys(gameData).sort().forEach(merchantName => {
      const merchantData = gameData[merchantName];
      gameOutput["商户数据"].push({
        "商户名": merchantName,
        "唯一用户数": merchantData.totalUsers.toString(),
        "新用户D1留存率": calculateRetentionRate(merchantData.totalD1Users, merchantData.totalUsers),
        "新用户D7留存率": calculateRetentionRate(merchantData.totalD7Users, merchantData.totalUsers)
      });
    });
    
    results.push(gameOutput);
    
    // 输出日志
    console.log(`\n📊 游戏: ${gameName} (${yearMonth})`);
    console.log(`   整体汇总: 用户数=${gameTotalUsers}, D1=${calculateRetentionRate(gameTotalD1Users, gameTotalUsers)}, D7=${calculateRetentionRate(gameTotalD7Users, gameTotalUsers)}`);
    console.log(`   商户数量: ${gameOutput["商户数据"].length}`);
  });
});

console.log(`\n📊 输出结果: ${results.length} 条`);

// 7. 返回结果
return results.map(item => ({ json: item }));

