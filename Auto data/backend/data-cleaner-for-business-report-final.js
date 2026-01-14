// n8n Code节点：业务数据报告数据清洗器（最终版）
// 功能：处理SQL查询结果，格式化为AI可理解的结构化数据
// 输入：Untitled-1.json格式的数据（包含newGameList和periods数组）

const inputs = $input.all();
console.log("=== 业务数据报告数据清洗器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：解析数值
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const cleaned = value.toString().replace(/[$,，\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 工具函数：计算环比
function calculateChangeRate(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// 工具函数：计算人均投注
function calculateAvgBetPerUser(totalBet, totalUsers) {
  if (!totalUsers || totalUsers === 0) return 0;
  return totalBet / totalUsers;
}

// 工具函数：从Formatted字符串提取数值
function extractPercentageFromFormatted(formatted) {
  if (!formatted) return 0;
  const match = formatted.toString().match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// 步骤1：解析输入数据
let rawData = null;
let retentionDataObject = null;

if (inputs.length === 1) {
  const item = inputs[0].json;
  
  // 如果输入是数组，需要处理多个对象
  if (Array.isArray(item)) {
    // 第一个对象包含newGameList和periods（业务数据）
    rawData = item[0];
    
    // 查找包含retention数据的对象
    for (let i = 0; i < item.length; i++) {
      if (item[i].periods && Array.isArray(item[i].periods)) {
        // 检查是否有period包含retention数据
        const periodWithRetention = item[i].periods.find(p => p.retention);
        if (periodWithRetention) {
          retentionDataObject = item[i];
          console.log(`✅ 找到包含retention数据的对象，索引: ${i}, periods数量: ${item[i].periods.length}`);
          // 输出所有period的标识
          item[i].periods.forEach((p, idx) => {
            console.log(`  period[${idx}]: ${p.period || p.periodDisplay}, 有retention: ${!!p.retention}`);
          });
          break;
        }
      }
    }
    
    if (!retentionDataObject) {
      console.warn(`⚠️ 未找到包含retention数据的对象，数组长度: ${item.length}`);
    }
  } else {
    rawData = item;
    // 如果单个对象有retention数据，也记录下来
    if (item.periods && Array.isArray(item.periods)) {
      const periodWithRetention = item.periods.find(p => p.retention);
      if (periodWithRetention) {
        retentionDataObject = item;
      }
    }
  }
} else {
  // 如果多个输入，合并数据
  rawData = inputs.map(input => input.json)[0];
}

if (!rawData || !rawData.periods || !Array.isArray(rawData.periods)) {
  console.error("❌ 数据格式不正确，缺少periods数组");
  return [];
}

const newGameList = rawData.newGameList || [];
const periods = rawData.periods;

console.log(`📅 周期数: ${periods.length}`);
console.log(`🎮 新游戏数: ${newGameList.length}`);

// 步骤2：识别当前期和上期
const currentPeriod = periods[periods.length - 1];
const previousPeriod = periods.length > 1 ? periods[periods.length - 2] : null;

if (!currentPeriod) {
  console.error("❌ 没有当前期数据");
  return [];
}

console.log(`✅ 当前期: ${currentPeriod.period || currentPeriod.periodDisplay}`);
if (previousPeriod) {
  console.log(`✅ 上期: ${previousPeriod.period || previousPeriod.periodDisplay}`);
}

// 步骤3：处理总体数据
const overall = {
  current: {
    totalGGRUSD: parseNumber(currentPeriod.overall?.totalGGRUSD),
    totalBetUSD: parseNumber(currentPeriod.overall?.totalBetUSD),
    totalPayoutUSD: parseNumber(currentPeriod.overall?.totalPayoutUSD),
    totalRounds: parseNumber(currentPeriod.overall?.totalRounds),
    totalRTP: parseNumber(currentPeriod.overall?.totalRTP),
    totalActiveUsers: 0  // 需要从merchantUsers或gameUsers汇总
  },
  previous: previousPeriod?.overall ? {
    totalGGRUSD: parseNumber(previousPeriod.overall.totalGGRUSD),
    totalBetUSD: parseNumber(previousPeriod.overall.totalBetUSD),
    totalPayoutUSD: parseNumber(previousPeriod.overall.totalPayoutUSD),
    totalRounds: parseNumber(previousPeriod.overall.totalRounds),
    totalRTP: parseNumber(previousPeriod.overall.totalRTP),
    totalActiveUsers: 0
  } : null
};

// 计算总体活跃用户数（从merchantUsers汇总，需要去重）
const currentMerchantUsers = currentPeriod.merchantUsers || [];
const previousMerchantUsers = previousPeriod?.merchantUsers || [];
overall.current.totalActiveUsers = currentMerchantUsers.reduce((sum, m) => sum + parseNumber(m.totalUsers), 0);
if (overall.previous) {
  overall.previous.totalActiveUsers = previousMerchantUsers.reduce((sum, m) => sum + parseNumber(m.totalUsers), 0);
}

// 计算环比
overall.ggrChangeRate = calculateChangeRate(overall.current.totalGGRUSD, overall.previous?.totalGGRUSD);
overall.ggrChangeAmount = overall.previous ? overall.current.totalGGRUSD - overall.previous.totalGGRUSD : null;
overall.betChangeRate = calculateChangeRate(overall.current.totalBetUSD, overall.previous?.totalBetUSD);
overall.betChangeAmount = overall.previous ? overall.current.totalBetUSD - overall.previous.totalBetUSD : null;
overall.roundsChangeRate = calculateChangeRate(overall.current.totalRounds, overall.previous?.totalRounds);
overall.roundsChangeAmount = overall.previous ? overall.current.totalRounds - overall.previous.totalRounds : null;
overall.usersChangeRate = calculateChangeRate(overall.current.totalActiveUsers, overall.previous?.totalActiveUsers);
overall.usersChangeAmount = overall.previous ? overall.current.totalActiveUsers - overall.previous.totalActiveUsers : null;
overall.rtpChange = overall.previous ? overall.current.totalRTP - overall.previous.totalRTP : null;

// 步骤4：处理商户数据（带环比和人均投注）
const currentMerchants = currentPeriod.merchants || [];
const previousMerchants = previousPeriod?.merchants || [];

// 创建商户用户数映射
const currentMerchantUserMap = new Map();
currentMerchantUsers.forEach(m => {
  currentMerchantUserMap.set(m.merchantName, parseNumber(m.totalUsers));
});

const previousMerchantUserMap = new Map();
previousMerchantUsers.forEach(m => {
  previousMerchantUserMap.set(m.merchantName, parseNumber(m.totalUsers));
});

const merchantsWithChange = currentMerchants.map(merchant => {
  const merchantName = merchant.merchantName;
  const currentUsers = currentMerchantUserMap.get(merchantName) || 0;
  const previousMerchant = previousMerchants.find(p => p.merchantName === merchantName);
  const previousUsers = previousMerchant ? (previousMerchantUserMap.get(merchantName) || 0) : 0;
  
  const currentGGR = parseNumber(merchant.totalGGRUSD);
  const currentBet = parseNumber(merchant.totalBetUSD);
  const currentPayout = parseNumber(merchant.totalPayoutUSD);
  const currentRounds = parseNumber(merchant.totalRounds);
  const currentRTP = parseNumber(merchant.totalRTP);
  
  const previousGGR = previousMerchant ? parseNumber(previousMerchant.totalGGRUSD) : null;
  const previousBet = previousMerchant ? parseNumber(previousMerchant.totalBetUSD) : null;
  const previousPayout = previousMerchant ? parseNumber(previousMerchant.totalPayoutUSD) : null;
  const previousRounds = previousMerchant ? parseNumber(previousMerchant.totalRounds) : null;
  const previousRTP = previousMerchant ? parseNumber(previousMerchant.totalRTP) : null;
  
  const ggrChangeAmount = previousGGR !== null ? currentGGR - previousGGR : null;
  const ggrChangeRate = previousGGR !== null && previousGGR !== 0 ? calculateChangeRate(currentGGR, previousGGR) : null;
  
  const betChangeAmount = previousBet !== null ? currentBet - previousBet : null;
  const betChangeRate = previousBet !== null && previousBet !== 0 ? calculateChangeRate(currentBet, previousBet) : null;
  
  const avgBetPerUser = calculateAvgBetPerUser(currentBet, currentUsers);
  const previousAvgBetPerUser = previousBet !== null && previousUsers > 0 ? calculateAvgBetPerUser(previousBet, previousUsers) : null;
  const avgBetChangeAmount = previousAvgBetPerUser !== null ? avgBetPerUser - previousAvgBetPerUser : null;
  const avgBetChangeRate = previousAvgBetPerUser !== null && previousAvgBetPerUser !== 0 ? calculateChangeRate(avgBetPerUser, previousAvgBetPerUser) : null;
  
  return {
    merchantName: merchantName,
    totalGGRUSD: currentGGR,
    totalBetUSD: currentBet,
    totalPayoutUSD: currentPayout,
    totalRounds: currentRounds,
    totalRTP: currentRTP,
    totalUsers: currentUsers,
    avgBetPerUser: avgBetPerUser,
    previousGGRUSD: previousGGR,
    previousBetUSD: previousBet,
    previousPayoutUSD: previousPayout,
    previousRounds: previousRounds,
    previousRTP: previousRTP,
    previousUsers: previousUsers,
    previousAvgBetPerUser: previousAvgBetPerUser,
    ggrChangeAmount: ggrChangeAmount,
    ggrChangeRate: ggrChangeRate,
    betChangeAmount: betChangeAmount,
    betChangeRate: betChangeRate,
    avgBetChangeAmount: avgBetChangeAmount,
    avgBetChangeRate: avgBetChangeRate
  };
});

// 步骤5：处理游戏数据（带环比和人均投注）
const currentGames = currentPeriod.games || [];
const previousGames = previousPeriod?.games || [];

// 创建游戏用户数映射
const currentGameUserMap = new Map();
const currentGameUsers = currentPeriod.gameUsers || [];
currentGameUsers.forEach(g => {
  currentGameUserMap.set(g.gameName, parseNumber(g.totalUsers));
});

const previousGameUserMap = new Map();
const previousGameUsers = previousPeriod?.gameUsers || [];
previousGameUsers.forEach(g => {
  previousGameUserMap.set(g.gameName, parseNumber(g.totalUsers));
});

const gamesWithChange = currentGames.map(game => {
  const gameName = game.gameName;
  const currentUsers = currentGameUserMap.get(gameName) || 0;
  const previousGame = previousGames.find(p => p.gameName === gameName);
  const previousUsers = previousGame ? (previousGameUserMap.get(gameName) || 0) : 0;
  
  const currentGGR = parseNumber(game.totalGGRUSD);
  const currentBet = parseNumber(game.totalBetUSD);
  const currentPayout = parseNumber(game.totalPayoutUSD);
  const currentRounds = parseNumber(game.totalRounds);
  const currentRTP = parseNumber(game.totalRTP);
  
  const previousGGR = previousGame ? parseNumber(previousGame.totalGGRUSD) : null;
  const previousBet = previousGame ? parseNumber(previousGame.totalBetUSD) : null;
  const previousPayout = previousGame ? parseNumber(previousGame.totalPayoutUSD) : null;
  const previousRounds = previousGame ? parseNumber(previousGame.totalRounds) : null;
  const previousRTP = previousGame ? parseNumber(previousGame.totalRTP) : null;
  
  const ggrChangeAmount = previousGGR !== null ? currentGGR - previousGGR : null;
  const ggrChangeRate = previousGGR !== null && previousGGR !== 0 ? calculateChangeRate(currentGGR, previousGGR) : null;
  
  const betChangeAmount = previousBet !== null ? currentBet - previousBet : null;
  const betChangeRate = previousBet !== null && previousBet !== 0 ? calculateChangeRate(currentBet, previousBet) : null;
  
  const roundsChangeAmount = previousRounds !== null ? currentRounds - previousRounds : null;
  const roundsChangeRate = previousRounds !== null && previousRounds !== 0 ? calculateChangeRate(currentRounds, previousRounds) : null;
  
  const rtpChange = previousRTP !== null ? currentRTP - previousRTP : null;
  
  const avgBetPerUser = calculateAvgBetPerUser(currentBet, currentUsers);
  const previousAvgBetPerUser = previousBet !== null && previousUsers > 0 ? calculateAvgBetPerUser(previousBet, previousUsers) : null;
  const avgBetChangeAmount = previousAvgBetPerUser !== null ? avgBetPerUser - previousAvgBetPerUser : null;
  const avgBetChangeRate = previousAvgBetPerUser !== null && previousAvgBetPerUser !== 0 ? calculateChangeRate(avgBetPerUser, previousAvgBetPerUser) : null;
  
  return {
    gameName: gameName,
    totalGGRUSD: currentGGR,
    totalBetUSD: currentBet,
    totalPayoutUSD: currentPayout,
    totalRounds: currentRounds,
    totalRTP: currentRTP,
    totalUsers: currentUsers,
    avgBetPerUser: avgBetPerUser,
    previousGGRUSD: previousGGR,
    previousBetUSD: previousBet,
    previousPayoutUSD: previousPayout,
    previousRounds: previousRounds,
    previousRTP: previousRTP,
    previousUsers: previousUsers,
    previousAvgBetPerUser: previousAvgBetPerUser,
    ggrChangeAmount: ggrChangeAmount,
    ggrChangeRate: ggrChangeRate,
    betChangeAmount: betChangeAmount,
    betChangeRate: betChangeRate,
    roundsChangeAmount: roundsChangeAmount,
    roundsChangeRate: roundsChangeRate,
    rtpChange: rtpChange,
    avgBetChangeAmount: avgBetChangeAmount,
    avgBetChangeRate: avgBetChangeRate
  };
});

// 步骤6：处理币种数据（带环比）
const currentCurrencies = currentPeriod.currencies || [];
const previousCurrencies = previousPeriod?.currencies || [];

const currenciesWithChange = currentCurrencies.map(currency => {
  const currencyCode = currency.currency;
  const previousCurrency = previousCurrencies.find(p => p.currency === currencyCode);
  
  const currentGGR = parseNumber(currency.totalGGRUSD);
  const previousGGR = previousCurrency ? parseNumber(previousCurrency.totalGGRUSD) : null;
  
  const ggrChangeAmount = previousGGR !== null ? currentGGR - previousGGR : null;
  const ggrChangeRate = previousGGR !== null && previousGGR !== 0 ? calculateChangeRate(currentGGR, previousGGR) : null;
  
  return {
    currency: currencyCode,
    totalGGRUSD: currentGGR,
    totalBetUSD: parseNumber(currency.totalBetUSD),
    totalPayoutUSD: parseNumber(currency.totalPayoutUSD),
    totalRounds: parseNumber(currency.totalRounds),
    previousGGRUSD: previousGGR,
    ggrChangeAmount: ggrChangeAmount,
    ggrChangeRate: ggrChangeRate
  };
});

// 步骤7：处理新游戏数据
const currentNewGames = currentPeriod.newGames || [];
const newGamesData = [];

// 从games中获取新游戏的完整数据
currentNewGames.forEach(newGame => {
  const gameName = newGame.gameName;
  const gameData = currentGames.find(g => g.gameName === gameName);
  
  if (gameData) {
    const totalGGRUSD = parseNumber(gameData.totalGGRUSD);
    const totalBetUSD = parseNumber(gameData.totalBetUSD);
    const totalPayoutUSD = parseNumber(gameData.totalPayoutUSD);
    const totalRounds = parseNumber(gameData.totalRounds);
    const totalUsers = currentGameUserMap.get(gameName) || 0;
    const rtp = parseNumber(gameData.totalRTP);
    
    // 处理topMerchants（添加占比）
    const topMerchants = (newGame.topMerchants || []).map((merchant, index) => {
      const ggrUSD = parseNumber(merchant.ggrUSD);
      const percentage = totalGGRUSD > 0 ? ((ggrUSD / totalGGRUSD) * 100).toFixed(1) : '0';
      return {
        rank: index + 1,
        merchantName: merchant.merchantName,
        ggrUSD: ggrUSD,
        ggrUSDFormatted: merchant.ggrUSDFormatted || Math.round(ggrUSD).toLocaleString('en-US'),
        percentage: percentage
      };
    });
    
    // 处理topCurrencies（添加占比）
    const topCurrencies = (newGame.topCurrencies || []).map((currency, index) => {
      const ggrUSD = parseNumber(currency.ggrUSD);
      const percentage = totalGGRUSD > 0 ? ((ggrUSD / totalGGRUSD) * 100).toFixed(1) : '0';
      return {
        rank: index + 1,
        currency: currency.currency,
        ggrUSD: ggrUSD,
        ggrUSDFormatted: currency.ggrUSDFormatted || Math.round(ggrUSD).toLocaleString('en-US'),
        percentage: percentage
      };
    });
    
    newGamesData.push({
      gameName: gameName,
      totalGGRUSD: totalGGRUSD,
      totalBetUSD: totalBetUSD,
      totalPayoutUSD: totalPayoutUSD,
      totalRounds: totalRounds,
      totalUsers: totalUsers,
      rtp: rtp,
      topMerchants: topMerchants,
      topCurrencies: topCurrencies
    });
  }
});

// 步骤8：处理留存数据
// 注意：retention数据可能在另一个对象的periods中
// 先检查当前期是否有retention数据，如果没有或者是空对象，则从其他对象中查找
let currentRetention = null;
let previousRetention = null;

// 检查当前期是否有retention数据
if (currentPeriod.retention && Object.keys(currentPeriod.retention).length > 0) {
  currentRetention = currentPeriod.retention;
  console.log(`✅ 当前期自身包含retention数据`);
}

// 检查上期是否有retention数据
if (previousPeriod?.retention && Object.keys(previousPeriod.retention).length > 0) {
  previousRetention = previousPeriod.retention;
  console.log(`✅ 上期自身包含retention数据`);
}

// 工具函数：标准化周期标识用于匹配
function normalizePeriodKey(periodKey) {
  if (!periodKey) return '';
  
  // 如果已经是 "10.27-11.02" 格式，直接返回
  if (periodKey.match(/^\d{2}\.\d{2}-\d{2}\.\d{2}$/)) {
    return periodKey;
  }
  
  // 将 "20251027-1102" 转换为 "10.27-11.02"
  // 格式：YYYYMMDD-MMDD，其中第二个MMDD可能只有4位数字
  const match1 = periodKey.match(/^(\d{4})(\d{2})(\d{2})-(\d{1,4})$/); // 20251027-1102
  if (match1) {
    const startMonth = match1[2];
    const startDay = match1[3];
    const endPart = match1[4];
    
    // 处理结束日期部分：可能是 "1102" (4位) 或 "11" (2位)
    let endMonth, endDay;
    if (endPart.length === 4) {
      // "1102" -> 11月02日
      endMonth = endPart.substring(0, 2);
      endDay = endPart.substring(2, 4);
    } else if (endPart.length === 2) {
      // "11" -> 11月，日期需要从startDate推断或使用默认值
      endMonth = endPart;
      endDay = startDay; // 假设同一天，或者需要其他逻辑
    } else {
      return periodKey; // 无法解析，返回原值
    }
    
    return `${startMonth}.${startDay}-${endMonth}.${endDay}`;
  }
  
  return periodKey;
}

// 工具函数：检查两个周期标识是否匹配
function isPeriodMatch(period1, period2) {
  if (!period1 || !period2) return false;
  
  // 获取周期标识（可能是字符串或对象）
  const key1 = typeof period1 === 'string' ? period1 : (period1.periodDisplay || period1.period);
  const key2 = typeof period2 === 'string' ? period2 : (period2.periodDisplay || period2.period);
  
  if (!key1 || !key2) {
    console.log(`    ⚠️ 周期标识为空: key1="${key1}", key2="${key2}"`);
    return false;
  }
  
  // 标准化两个周期标识
  const normalized1 = normalizePeriodKey(key1);
  const normalized2 = normalizePeriodKey(key2);
  
  console.log(`    匹配检查: "${key1}" (标准化: "${normalized1}") vs "${key2}" (标准化: "${normalized2}")`);
  
  // 直接比较标准化后的值
  if (normalized1 === normalized2) {
    console.log(`    ✓ 标准化后匹配成功!`);
    return true;
  }
  
  // 如果标准化后不匹配，尝试直接比较原始值
  if (key1 === key2) {
    console.log(`    ✓ 原始值匹配成功!`);
    return true;
  }
  
  console.log(`    ✗ 不匹配`);
  return false;
}

// 直接从所有输入中查找retention数据（改进逻辑）
// 优先使用步骤1中找到的retentionDataObject
if (!currentRetention) {
  console.log(`🔍 查找当前期retention数据`);
  console.log(`  当前期: period="${currentPeriod.period}", periodDisplay="${currentPeriod.periodDisplay}"`);
  
  // 方法1：使用步骤1中找到的retentionDataObject
  if (retentionDataObject && retentionDataObject.periods && Array.isArray(retentionDataObject.periods)) {
    console.log(`  使用步骤1中找到的retentionDataObject`);
    for (const period of retentionDataObject.periods) {
      if (period.retention && isPeriodMatch(period, currentPeriod)) {
        currentRetention = period.retention;
        console.log(`✅ 从retentionDataObject中找到当前期retention数据`);
        console.log(`  retention数据结构: newUsers=${!!currentRetention.newUsers}, activeUsers=${!!currentRetention.activeUsers}`);
        break;
      }
    }
    
    // 如果找到了当前期，也查找上期数据
    if (currentRetention && previousPeriod && !previousRetention) {
      for (const period of retentionDataObject.periods) {
        if (period.retention && isPeriodMatch(period, previousPeriod)) {
          previousRetention = period.retention;
          console.log(`✅ 从retentionDataObject中找到上期retention数据`);
          break;
        }
      }
    }
  }
  
  // 方法2：如果方法1没找到，从所有输入中查找
  if (!currentRetention) {
    console.log(`  方法1未找到，从所有输入中查找`);
    for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
      const item = inputs[inputIdx].json;
      
      if (Array.isArray(item)) {
        console.log(`  输入[${inputIdx}]是数组，长度: ${item.length}`);
        
        // 遍历所有对象
        for (let objIdx = 0; objIdx < item.length; objIdx++) {
          const obj = item[objIdx];
          if (obj.periods && Array.isArray(obj.periods)) {
            console.log(`  检查输入[${inputIdx}]对象[${objIdx}], periods数量: ${obj.periods.length}`);
            
            // 遍历所有period
            for (const period of obj.periods) {
              if (period.retention) {
                const periodKey = period.period || period.periodDisplay;
                const currentPeriodKey = currentPeriod.periodDisplay || currentPeriod.period;
                
                console.log(`    找到有retention的period: "${periodKey}" (当前期: "${currentPeriodKey}")`);
                
                // 检查是否匹配
                if (isPeriodMatch(period, currentPeriod)) {
                  currentRetention = period.retention;
                  console.log(`✅ 匹配成功! 从输入[${inputIdx}]对象[${objIdx}]中找到当前期retention数据`);
                  console.log(`  retention数据结构: newUsers=${!!currentRetention.newUsers}, activeUsers=${!!currentRetention.activeUsers}`);
                  break;
                }
              }
            }
            
            // 如果找到了，也查找上期数据
            if (currentRetention && previousPeriod && !previousRetention) {
              for (const period of obj.periods) {
                if (period.retention && isPeriodMatch(period, previousPeriod)) {
                  previousRetention = period.retention;
                  console.log(`✅ 找到上期retention数据`);
                  break;
                }
              }
              break; // 找到了当前期数据，退出外层循环
            }
            
            if (currentRetention) break; // 找到了，退出对象循环
          }
        }
      } else {
        // 单个对象的情况
        if (item.periods && Array.isArray(item.periods)) {
          console.log(`  输入[${inputIdx}]是单个对象，periods数量: ${item.periods.length}`);
          for (const period of item.periods) {
            if (period.retention && isPeriodMatch(period, currentPeriod)) {
              currentRetention = period.retention;
              console.log(`✅ 从输入[${inputIdx}]中找到当前期retention数据`);
              break;
            }
          }
        }
      }
      
      if (currentRetention) break; // 找到了，退出输入循环
    }
  }
}

// 如果仍然没有找到retention数据，输出警告
if (!currentRetention) {
  console.warn(`⚠️ 未找到当前期retention数据，周期: ${currentPeriod.period || currentPeriod.periodDisplay}`);
  // 设置为空对象，避免后续处理出错
  currentRetention = {};
} else {
  console.log(`✅ 当前期retention数据已找到`);
  console.log(`  newUsers存在: ${!!currentRetention.newUsers}`);
  console.log(`  activeUsers存在: ${!!currentRetention.activeUsers}`);
  if (currentRetention.newUsers) {
    console.log(`  newUsers.top20D1数量: ${currentRetention.newUsers.top20D1?.length || 0}`);
    console.log(`  newUsers.top20D7数量: ${currentRetention.newUsers.top20D7?.length || 0}`);
  }
  if (currentRetention.activeUsers) {
    console.log(`  activeUsers.top20D1数量: ${currentRetention.activeUsers.top20D1?.length || 0}`);
    console.log(`  activeUsers.top20D7数量: ${currentRetention.activeUsers.top20D7?.length || 0}`);
  }
}

// 确保previousRetention也是对象
if (!previousRetention) {
  previousRetention = {};
}

const retentionData = {
  newUserD1: [],
  newUserD7: [],
  activeUserD1: [],
  activeUserD7: []
};

// 工具函数：根据留存率倒推用户数
// 留存率 = 留存用户数 / 当日用户数
// 所以：留存用户数 = 当日用户数 * 留存率
function calculateRetainedUsers(dailyUsers, retentionRate) {
  if (!dailyUsers || !retentionRate || retentionRate <= 0) return 0;
  return Math.round(dailyUsers * (retentionRate / 100));
}

// 处理新用户次日留存
if (currentRetention.newUsers?.top20D1) {
  retentionData.newUserD1 = currentRetention.newUsers.top20D1
    .filter(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      return dailyUsers >= 50; // 只保留当日用户数 >= 50 的记录
    })
    .map(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      const retentionRate = extractPercentageFromFormatted(item.d1RetentionFormatted);
      const retainedUsers = calculateRetainedUsers(dailyUsers, retentionRate);
      
      return {
        rank: item.rank,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: dailyUsers,
        retention: retentionRate,
        retentionFormatted: item.d1RetentionFormatted || '0%',
        retainedUsers: retainedUsers // 根据留存率倒推的留存用户数
      };
    });
  console.log(`✅ 处理新用户次日留存: ${retentionData.newUserD1.length} 条记录`);
}

// 处理新用户7日留存
if (currentRetention.newUsers?.top20D7) {
  retentionData.newUserD7 = currentRetention.newUsers.top20D7
    .filter(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      return dailyUsers >= 50; // 只保留当日用户数 >= 50 的记录
    })
    .map(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      const retentionRate = extractPercentageFromFormatted(item.d7RetentionFormatted);
      const retainedUsers = calculateRetainedUsers(dailyUsers, retentionRate);
      
      return {
        rank: item.rank,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: dailyUsers,
        retention: retentionRate,
        retentionFormatted: item.d7RetentionFormatted || '0%',
        retainedUsers: retainedUsers // 根据留存率倒推的留存用户数
      };
    });
  console.log(`✅ 处理新用户7日留存: ${retentionData.newUserD7.length} 条记录`);
}

// 处理活跃用户次日留存
if (currentRetention.activeUsers?.top20D1) {
  retentionData.activeUserD1 = currentRetention.activeUsers.top20D1
    .filter(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      return dailyUsers >= 50; // 只保留当日用户数 >= 50 的记录
    })
    .map(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      const retentionRate = extractPercentageFromFormatted(item.d1RetentionFormatted);
      const retainedUsers = calculateRetainedUsers(dailyUsers, retentionRate);
      
      return {
        rank: item.rank,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: dailyUsers,
        retention: retentionRate,
        retentionFormatted: item.d1RetentionFormatted || '0%',
        retainedUsers: retainedUsers // 根据留存率倒推的留存用户数
      };
    });
  console.log(`✅ 处理活跃用户次日留存: ${retentionData.activeUserD1.length} 条记录`);
}

// 处理活跃用户7日留存
if (currentRetention.activeUsers?.top20D7) {
  retentionData.activeUserD7 = currentRetention.activeUsers.top20D7
    .filter(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      return dailyUsers >= 50; // 只保留当日用户数 >= 50 的记录
    })
    .map(item => {
      const dailyUsers = parseNumber(item.dailyUsers);
      const retentionRate = extractPercentageFromFormatted(item.d7RetentionFormatted);
      const retainedUsers = calculateRetainedUsers(dailyUsers, retentionRate);
      
      return {
        rank: item.rank,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: dailyUsers,
        retention: retentionRate,
        retentionFormatted: item.d7RetentionFormatted || '0%',
        retainedUsers: retainedUsers // 根据留存率倒推的留存用户数
      };
    });
  console.log(`✅ 处理活跃用户7日留存: ${retentionData.activeUserD7.length} 条记录`);
}

// 步骤9：构建最终输出结构
const output = {
  periodInfo: {
    currentPeriod: currentPeriod.period || currentPeriod.periodDisplay,
    previousPeriod: previousPeriod ? (previousPeriod.period || previousPeriod.periodDisplay) : null,
    periodType: currentPeriod.period && currentPeriod.period.includes('-') ? 'weekly' : 'monthly',
    currentPeriodFull: currentPeriod.periodFull,
    previousPeriodFull: previousPeriod?.periodFull || null
  },
  overall: overall,
  newGames: newGamesData,
  merchants: {
    current: merchantsWithChange,
    // Top 3增长商户（按GGR变化量）
    topGrowthGGR: merchantsWithChange
      .filter(m => m.ggrChangeAmount !== null && m.ggrChangeAmount > 0)
      .sort((a, b) => b.ggrChangeAmount - a.ggrChangeAmount)
      .slice(0, 3),
    // Top 3下滑商户（按GGR变化量）
    topDeclineGGR: merchantsWithChange
      .filter(m => m.ggrChangeAmount !== null && m.ggrChangeAmount < 0)
      .sort((a, b) => a.ggrChangeAmount - b.ggrChangeAmount)
      .slice(0, 3),
    // Top 3增长商户（按投注额变化量）
    topGrowthBet: merchantsWithChange
      .filter(m => m.betChangeAmount !== null && m.betChangeAmount > 0)
      .sort((a, b) => b.betChangeAmount - a.betChangeAmount)
      .slice(0, 3),
    // Top 3下滑商户（按投注额变化量）
    topDeclineBet: merchantsWithChange
      .filter(m => m.betChangeAmount !== null && m.betChangeAmount < 0)
      .sort((a, b) => a.betChangeAmount - b.betChangeAmount)
      .slice(0, 3),
    // Top 3增长商户（按人均投注变化量）
    topGrowthAvgBet: merchantsWithChange
      .filter(m => m.avgBetChangeAmount !== null && m.avgBetChangeAmount > 0)
      .sort((a, b) => b.avgBetChangeAmount - a.avgBetChangeAmount)
      .slice(0, 3),
    // Top 3下滑商户（按人均投注变化量）
    topDeclineAvgBet: merchantsWithChange
      .filter(m => m.avgBetChangeAmount !== null && m.avgBetChangeAmount < 0)
      .sort((a, b) => a.avgBetChangeAmount - b.avgBetChangeAmount)
      .slice(0, 3)
  },
  games: {
    current: gamesWithChange,
    // Top 3增长游戏（按GGR变化量）
    topGrowthGGR: gamesWithChange
      .filter(g => g.ggrChangeAmount !== null && g.ggrChangeAmount > 0)
      .sort((a, b) => b.ggrChangeAmount - a.ggrChangeAmount)
      .slice(0, 3),
    // Top 3下滑游戏（按GGR变化量）
    topDeclineGGR: gamesWithChange
      .filter(g => g.ggrChangeAmount !== null && g.ggrChangeAmount < 0)
      .sort((a, b) => a.ggrChangeAmount - b.ggrChangeAmount)
      .slice(0, 3),
    // Top 3增长游戏（按投注额变化量）
    topGrowthBet: gamesWithChange
      .filter(g => g.betChangeAmount !== null && g.betChangeAmount > 0)
      .sort((a, b) => b.betChangeAmount - a.betChangeAmount)
      .slice(0, 3),
    // Top 3下滑游戏（按投注额变化量）
    topDeclineBet: gamesWithChange
      .filter(g => g.betChangeAmount !== null && g.betChangeAmount < 0)
      .sort((a, b) => a.betChangeAmount - b.betChangeAmount)
      .slice(0, 3),
    // Top 3增长游戏（按人均投注变化量）
    topGrowthAvgBet: gamesWithChange
      .filter(g => g.avgBetChangeAmount !== null && g.avgBetChangeAmount > 0)
      .sort((a, b) => b.avgBetChangeAmount - a.avgBetChangeAmount)
      .slice(0, 3),
    // Top 3下滑游戏（按人均投注变化量）
    topDeclineAvgBet: gamesWithChange
      .filter(g => g.avgBetChangeAmount !== null && g.avgBetChangeAmount < 0)
      .sort((a, b) => a.avgBetChangeAmount - b.avgBetChangeAmount)
      .slice(0, 3),
    // Top 3增长游戏（按局数变化量）
    topGrowthRounds: gamesWithChange
      .filter(g => g.roundsChangeAmount !== null && g.roundsChangeAmount > 0)
      .sort((a, b) => b.roundsChangeAmount - a.roundsChangeAmount)
      .slice(0, 3),
    // Top 3下滑游戏（按局数变化量）
    topDeclineRounds: gamesWithChange
      .filter(g => g.roundsChangeAmount !== null && g.roundsChangeAmount < 0)
      .sort((a, b) => a.roundsChangeAmount - b.roundsChangeAmount)
      .slice(0, 3),
    // Top 3增长游戏（按RTP变化量 - 注意：RTP增长可能是负数，需要按变化量排序）
    topGrowthRTP: gamesWithChange
      .filter(g => g.rtpChange !== null && g.rtpChange > 0)
      .sort((a, b) => b.rtpChange - a.rtpChange)
      .slice(0, 3),
    // Top 3下滑游戏（按RTP变化量 - 注意：RTP下滑可能是正数，需要按变化量排序）
    topDeclineRTP: gamesWithChange
      .filter(g => g.rtpChange !== null && g.rtpChange < 0)
      .sort((a, b) => a.rtpChange - b.rtpChange)
      .slice(0, 3)
  },
  currencies: {
    current: currenciesWithChange,
    // Top 3增长币种（按GGR变化量）
    topGrowth: currenciesWithChange
      .filter(c => c.ggrChangeAmount !== null && c.ggrChangeAmount > 0)
      .sort((a, b) => b.ggrChangeAmount - a.ggrChangeAmount)
      .slice(0, 3),
    // Top 3下滑币种（按GGR变化量）
    topDecline: currenciesWithChange
      .filter(c => c.ggrChangeAmount !== null && c.ggrChangeAmount < 0)
      .sort((a, b) => a.ggrChangeAmount - b.ggrChangeAmount)
      .slice(0, 3)
  },
  retention: retentionData
};

console.log(`✅ 数据清洗完成`);
console.log(`  总体GGR: $${overall.current.totalGGRUSD.toLocaleString('en-US')}`);
console.log(`  商户数: ${merchantsWithChange.length}`);
console.log(`  游戏数: ${gamesWithChange.length}`);
console.log(`  币种数: ${currenciesWithChange.length}`);
console.log(`  新游戏数: ${newGamesData.length}`);
console.log(`  留存数据: 新用户D1=${retentionData.newUserD1.length}, 新用户D7=${retentionData.newUserD7.length}, 活跃用户D1=${retentionData.activeUserD1.length}, 活跃用户D7=${retentionData.activeUserD7.length}`);

return [{
  json: output
}];

