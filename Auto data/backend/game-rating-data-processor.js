// n8n Code节点：新游戏评级数据处理器
// 功能：将上游数据（Merge2.json格式）处理成便于AI分析的结构化数据
// 输出：包含所有评级所需指标的结构化JSON

const inputs = $input.all();
console.log("=== 新游戏评级数据处理器 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 数据分类标识
let dataSection = 'unknown'; // 'user_count' | 'revenue' | 'retention'
let currentHeader = null;

// 数据存储
const userCountData = []; // 投注用户数数据
const revenueData = []; // 营收数据
const retentionData = []; // 留存数据

// 解析数据
inputs.forEach((item, index) => {
  const json = item.json || {};
  const values = json.values || [];
  
  if (!Array.isArray(values) || values.length === 0) {
    return;
  }
  
  // 检测表头，判断数据类型
  if (json.is_header) {
    currentHeader = values;
    const headerStr = values.map(v => String(v || '').toLowerCase()).join('|');
    
    // 投注用户数表头：["日期", "游戏名", "投注用户数"]
    if (headerStr.includes('投注用户数') || headerStr.includes('日期') && headerStr.includes('游戏名')) {
      dataSection = 'user_count';
      console.log(`📋 检测到投注用户数表头: [${values.join(', ')}]`);
      return;
    }
    
    // 营收表头：包含"总投注USD"、"GGR-USD"等
    if (headerStr.includes('总投注') || headerStr.includes('ggr') || headerStr.includes('商户名')) {
      dataSection = 'revenue';
      console.log(`📋 检测到营收表头: [${values.join(', ')}]`);
      return;
    }
  }
  
  // 检测留存数据（通过用户类型字段）
  if (values.length > 3) {
    const userTypeField = String(values[3] || '').trim();
    if (userTypeField === '新用户留存' || userTypeField === '活跃用户留存') {
      dataSection = 'retention';
    }
  }
  
  // 根据数据类型存储
  if (dataSection === 'user_count') {
    // 跳过表头
    if (!json.is_header) {
      userCountData.push({
        date: values[0],
        gameName: values[1],
        userCount: parseFloat(values[2]) || 0
      });
    }
  } else if (dataSection === 'revenue') {
    // 跳过表头
    if (!json.is_header && values.length >= 13) {
      revenueData.push({
        time: values[0],
        merchantName: values[1],
        currency: values[2],
        usdRate: parseFloat(values[3]) || 0,
        gameName: values[4],
        totalBet: parseFloat(values[5]) || 0,
        totalBetUSD: parseFloat(values[6]) || 0,
        totalPayout: parseFloat(values[7]) || 0,
        totalPayoutUSD: parseFloat(values[8]) || 0,
        totalRounds: parseFloat(values[9]) || 0,
        rtp: parseFloat(values[10]) || 0,
        ggr: parseFloat(values[11]) || 0,
        ggrUSD: parseFloat(values[12]) || 0
      });
    }
  } else if (dataSection === 'retention') {
    if (values.length >= 5) {
      const userType = String(values[3] || '').trim();
      const dailyUsers = parseFloat(values[4]) || 0;
      
      // 提取D1-D14留存数据（索引5-18）
      const retentionRates = [];
      for (let i = 5; i < Math.min(19, values.length); i++) {
        retentionRates.push(parseFloat(values[i]) || 0);
      }
      
      retentionData.push({
        gameName: values[0],
        merchantName: values[1],
        timestamp: values[2],
        userType: userType, // "新用户留存" 或 "活跃用户留存"
        dailyUsers: dailyUsers,
        retentionRates: retentionRates // [D1, D2, D3, ..., D14]
      });
    }
  }
});

console.log(`\n📊 数据解析完成:`);
console.log(`   - 投注用户数记录: ${userCountData.length}`);
console.log(`   - 营收记录: ${revenueData.length}`);
console.log(`   - 留存记录: ${retentionData.length}`);

// 提取游戏名（从第一个非表头数据项中获取）
let targetGameName = null;
if (userCountData.length > 0) {
  targetGameName = userCountData[0].gameName;
} else if (revenueData.length > 0) {
  targetGameName = revenueData[0].gameName;
} else if (retentionData.length > 0) {
  targetGameName = retentionData[0].gameName;
}

if (!targetGameName) {
  console.error("❌ 无法识别游戏名");
  return [];
}

console.log(`\n🎮 目标游戏: ${targetGameName}`);

// ==================== 计算指标 ====================

// 1. 计算游戏投注用户数（从"合计"行获取，或汇总所有日期）
let gameUserCount = 0;
const totalRow = userCountData.find(row => String(row.date) === '合计' || String(row.date).toLowerCase() === 'total');
if (totalRow) {
  gameUserCount = totalRow.userCount;
} else {
  // 如果没有"合计"行，汇总所有日期（去重逻辑，这里简单相加）
  gameUserCount = userCountData.reduce((sum, row) => {
    if (String(row.date) !== '合计' && String(row.date) !== 'total') {
      return sum + row.userCount;
    }
    return sum;
  }, 0);
}

// 2. 计算全平台投注用户数
// 尝试从用户数据中查找"合计"行，如果没有，则汇总所有游戏的用户数
let platformTotalUserCount = 0;
const platformTotalUserRow = userCountData.find(row => 
  String(row.gameName).toLowerCase() === '合计' || 
  String(row.gameName).toLowerCase() === 'total' ||
  String(row.date).toLowerCase() === '合计'
);
if (platformTotalUserRow) {
  // 如果找到"合计"行，使用该行的用户数
  platformTotalUserCount = platformTotalUserRow.userCount;
  console.log(`📊 从用户数据中找到全平台合计用户数: ${platformTotalUserCount}`);
} else {
  // 如果没有"合计"行，尝试汇总所有游戏的用户数（需要去重，这里简化处理）
  // 注意：这可能导致重复计算，最好有明确的"合计"数据
  const uniqueDates = new Set();
  userCountData.forEach(row => {
    const dateKey = String(row.date);
    if (dateKey !== '合计' && dateKey !== 'total') {
      uniqueDates.add(dateKey);
    }
  });
  console.log(`⚠️ 未找到全平台合计用户数，检测到 ${uniqueDates.size} 个不同的日期`);
}

// 3. 计算游戏营收数据
const gameRevenue = revenueData
  .filter(row => row.gameName === targetGameName)
  .reduce((acc, row) => {
    return {
      totalBetUSD: acc.totalBetUSD + (row.totalBetUSD || 0),
      totalPayoutUSD: acc.totalPayoutUSD + (row.totalPayoutUSD || 0),
      totalGGRUSD: acc.totalGGRUSD + (row.ggrUSD || 0),
      totalRounds: acc.totalRounds + (row.totalRounds || 0)
    };
  }, { totalBetUSD: 0, totalPayoutUSD: 0, totalGGRUSD: 0, totalRounds: 0 });

// 4. 计算全平台营收数据
// 尝试从营收数据中查找"合计"行（游戏名为"合计"）
let platformTotalBetUSD = 0;
const platformTotalBetRow = revenueData.find(row => 
  String(row.gameName).toLowerCase() === '合计' || 
  String(row.gameName).toLowerCase() === 'total'
);
if (platformTotalBetRow) {
  platformTotalBetUSD = platformTotalBetRow.totalBetUSD;
  console.log(`📊 从营收数据中找到全平台合计投注: $${platformTotalBetUSD.toFixed(2)}`);
} else {
  // 如果没有"合计"行，汇总所有游戏的投注金额
  platformTotalBetUSD = revenueData.reduce((sum, row) => {
    // 排除负值（可能是退款等）
    return sum + Math.max(0, row.totalBetUSD || 0);
  }, 0);
  console.log(`📊 汇总所有游戏投注作为全平台数据: $${platformTotalBetUSD.toFixed(2)}`);
  console.log(`⚠️ 注意：此数据可能包含重复计算，建议使用明确的"合计"数据`);
}

// 5. 计算留存数据
const gameRetention = {
  newUser: [],
  activeUser: []
};

retentionData
  .filter(row => row.gameName === targetGameName && row.dailyUsers >= 50) // 过滤掉用户数<50的记录
  .forEach(row => {
    if (row.userType === '新用户留存') {
      gameRetention.newUser.push(row);
    } else if (row.userType === '活跃用户留存') {
      gameRetention.activeUser.push(row);
    }
  });

// 计算加权平均留存率
// retentionRates数组中的值可能是留存用户数（需要除以当日用户数）或已经是百分比
function calculateWeightedRetention(retentionList, dayIndex) {
  if (!retentionList || retentionList.length === 0) return 0;
  
  let totalUsers = 0;
  let totalRetainedUsers = 0;
  
  retentionList.forEach(row => {
    const dailyUsers = row.dailyUsers || 0;
    const retainedUsers = row.retentionRates[dayIndex] || 0; // D1=索引0, D7=索引6
    
    // 如果retainedUsers > dailyUsers，说明retainedUsers可能是百分比 * 100
    // 否则，retainedUsers就是留存用户数
    let retentionRate;
    if (dailyUsers > 0) {
      if (retainedUsers > dailyUsers) {
        // 可能是百分比形式（如 30.5 表示 30.5%）
        retentionRate = retainedUsers;
      } else {
        // 是留存用户数，需要转换为百分比
        retentionRate = (retainedUsers / dailyUsers) * 100;
      }
    } else {
      retentionRate = 0;
    }
    
    totalUsers += dailyUsers;
    totalRetainedUsers += dailyUsers * (retentionRate / 100);
  });
  
  if (totalUsers === 0) return 0;
  return (totalRetainedUsers / totalUsers) * 100; // 返回百分比
}

// 计算D1和D7留存率（新用户和活跃用户分别计算）
const newUserD1Retention = calculateWeightedRetention(gameRetention.newUser, 0); // D1
const newUserD7Retention = calculateWeightedRetention(gameRetention.newUser, 6); // D7
const activeUserD1Retention = calculateWeightedRetention(gameRetention.activeUser, 0); // D1
const activeUserD7Retention = calculateWeightedRetention(gameRetention.activeUser, 6); // D7

// 使用新用户留存率作为主要指标（根据评级标准）
const avgRetentionRate = newUserD7Retention > 0 ? newUserD7Retention : newUserD1Retention;

// 6. 计算人均指标
const avgBetPerUser = gameUserCount > 0 ? gameRevenue.totalBetUSD / gameUserCount : 0;
const avgGGRPerUser = gameUserCount > 0 ? gameRevenue.totalGGRUSD / gameUserCount : 0;

// ==================== 提取数据周期 ====================
// 从用户数据中提取日期范围
let dataPeriod = "未知";
if (userCountData.length > 0) {
  const dates = userCountData
    .filter(row => String(row.date) !== '合计' && String(row.date) !== 'total')
    .map(row => String(row.date))
    .filter(date => date && /^\d{8}$/.test(date)) // 8位数字日期格式 YYYYMMDD
    .sort();
  
  if (dates.length > 0) {
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    dataPeriod = `${startDate} - ${endDate}`;
  }
}

// ==================== 构建输出数据结构 ====================

const output = {
  gameName: targetGameName,
  dataPeriod: dataPeriod,
  
  // 基础数据
  gameData: {
    userCount: gameUserCount,
    totalBetUSD: gameRevenue.totalBetUSD,
    totalGGRUSD: gameRevenue.totalGGRUSD,
    totalRounds: gameRevenue.totalRounds,
    avgBetPerUser: avgBetPerUser,
    avgGGRPerUser: avgGGRPerUser
  },
  
  // 全平台数据
  platformData: {
    totalUserCount: platformTotalUserCount,
    totalBetUSD: platformTotalBetUSD,
    note: platformTotalUserCount > 0 && platformTotalBetUSD > 0 
      ? "全平台数据已从输入数据中提取" 
      : "⚠️ 未找到全平台合计数据，占比计算可能不准确"
  },
  
  // 计算后的指标
  metrics: {
    // 下注人数全平台占比 (%)
    userCountPlatformRatio: platformTotalUserCount > 0 
      ? (gameUserCount / platformTotalUserCount) * 100 
      : null,
    
    // 留存占比 (%)
    retentionRate: avgRetentionRate,
    
    // 下注金额全平台占比 (%)
    betAmountPlatformRatio: platformTotalBetUSD > 0 
      ? (gameRevenue.totalBetUSD / platformTotalBetUSD) * 100 
      : null,
    
    // 游戏人均GGR
    avgGGRPerUser: avgGGRPerUser
  },
  
  // 详细留存数据
  retentionDetails: {
    newUser: {
      d1Retention: newUserD1Retention,
      d7Retention: newUserD7Retention,
      recordsCount: gameRetention.newUser.length,
      totalDailyUsers: gameRetention.newUser.reduce((sum, r) => sum + (r.dailyUsers || 0), 0)
    },
    activeUser: {
      d1Retention: activeUserD1Retention,
      d7Retention: activeUserD7Retention,
      recordsCount: gameRetention.activeUser.length,
      totalDailyUsers: gameRetention.activeUser.reduce((sum, r) => sum + (r.dailyUsers || 0), 0)
    }
  },
  
  // 评级标准参考（用于AI分析）
  ratingCriteria: {
    score100: {
      resource: "首页第一位",
      requirements: {
        userCountPlatformRatio: ">10%",
        retentionRate: ">30%",
        betAmountPlatformRatio: ">10%",
        avgGGRPerUser: ">40"
      }
    },
    score80: {
      resource: "首页2-6位",
      requirements: {
        userCountPlatformRatio: "5%-9%",
        retentionRate: "25-29%",
        betAmountPlatformRatio: "5%-9%",
        avgGGRPerUser: "25-39"
      }
    },
    score60: {
      resource: "分组页1-6位",
      requirements: {
        userCountPlatformRatio: "3%-4%",
        retentionRate: "21-24%",
        betAmountPlatformRatio: "3%-4%",
        avgGGRPerUser: "15-24"
      }
    },
    score40: {
      resource: "分组页7-12位",
      requirements: {
        userCountPlatformRatio: "1%-2%",
        retentionRate: "15-20%",
        betAmountPlatformRatio: "1%-2%",
        avgGGRPerUser: "5-14"
      }
    },
    score20: {
      resource: "分组页13位以后",
      requirements: {
        userCountPlatformRatio: "<1%",
        retentionRate: "<14%",
        betAmountPlatformRatio: "<1%",
        avgGGRPerUser: "<5"
      }
    }
  },
  
  // 权重参考
  weights: {
    userCount: 0.2,
    avgBetPerUser: 0.3,
    avgGGRPerUser: 0.2,
    retention: 0.3
  },
  
  // 原始数据统计（用于验证）
  rawDataStats: {
    userCountRecords: userCountData.length,
    revenueRecords: revenueData.length,
    retentionRecords: retentionData.length,
    gameRevenueRecords: revenueData.filter(r => r.gameName === targetGameName).length,
    gameRetentionRecords: retentionData.filter(r => r.gameName === targetGameName).length
  }
};

// 输出提示信息
console.log("\n📊 计算完成:");
console.log(`   - 游戏投注用户数: ${gameUserCount}`);
console.log(`   - 游戏总投注USD: $${gameRevenue.totalBetUSD.toFixed(2)}`);
console.log(`   - 游戏总GGR-USD: $${gameRevenue.totalGGRUSD.toFixed(2)}`);
console.log(`   - 游戏人均GGR: $${avgGGRPerUser.toFixed(2)}`);
console.log(`   - 新用户D7留存率: ${newUserD7Retention.toFixed(2)}%`);
console.log(`   - 新用户D1留存率: ${newUserD1Retention.toFixed(2)}%`);

console.log("\n📊 全平台数据:");
console.log(`   - 全平台用户数: ${platformTotalUserCount > 0 ? platformTotalUserCount : '未找到'}`);
console.log(`   - 全平台投注USD: ${platformTotalBetUSD > 0 ? '$' + platformTotalBetUSD.toFixed(2) : '未找到'}`);

if (platformTotalUserCount === 0 || platformTotalBetUSD === 0) {
  console.log("\n⚠️ 提示:");
  console.log("   - 如果未找到全平台合计数据，占比指标可能不准确");
  console.log("   - 建议确保输入数据中包含全平台汇总行（游戏名为'合计'）");
}

return [{
  json: output
}];

