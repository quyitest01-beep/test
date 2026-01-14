// n8n Code节点：Merge13数据统计处理器
// 功能：基于Merge13.json数据，区分本周/上周，统计总体、商户、游戏、币种、留存数据

const inputs = $input.all();
console.log("=== Merge13数据统计处理器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：解析数值
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 工具函数：计算RTP（派奖/投注 * 100%）
function calculateRTP(payout, bet) {
  if (!bet || bet === 0) return 0;
  return (payout / bet) * 100;
}

// 工具函数：格式化百分比
function formatPercentage(value) {
  if (!value || value === 0) return '0%';
  return `${value.toFixed(2)}%`;
}

// 步骤1：收集和分类数据
const data = {
  current: {
    merchant_revenue: [],  // 商户营收数据
    retention: []          // 留存数据
  },
  previous: {
    merchant_revenue: [],
    retention: []
  }
};

// 处理输入数据
inputs.forEach((input) => {
  const item = input.json;
  
  // 跳过元数据
  if (item._metadata) {
    return;
  }
  
  // 判断周期
  const isPrevious = item.is_previous === true || item.period === 'previous' || item._period === 'previous';
  const period = isPrevious ? 'previous' : 'current';
  
  // 判断数据类型
  const dataType = item._dataType || 'unknown';
  
  if (dataType === 'merchant_revenue') {
    data[period].merchant_revenue.push(item);
  } else if (dataType === 'retention') {
    data[period].retention.push(item);
  }
});

console.log(`✅ 当前期商户营收数据: ${data.current.merchant_revenue.length} 条`);
console.log(`✅ 当前期留存数据: ${data.current.retention.length} 条`);
console.log(`✅ 上期商户营收数据: ${data.previous.merchant_revenue.length} 条`);
console.log(`✅ 上期留存数据: ${data.previous.retention.length} 条`);

// 步骤2：统计函数
function calculateStatistics(periodData) {
  const result = {
    // 1. 总体数据（游戏名="合计"）
    overall: {
      totalGGRUSD: 0,
      totalBetUSD: 0,
      totalPayoutUSD: 0,
      totalRounds: 0,
      totalRTP: 0
    },
    // 2. 各商户数据（游戏名="合计"）
    merchants: {},
    // 3. 各游戏数据（游戏名!="合计"）
    games: {},
    // 4. 各币种数据（游戏名!="合计"）
    currencies: {},
    // 5. 留存数据
    retention: {
      newUsers: [],
      activeUsers: []
    }
  };
  
  // 处理商户营收数据
  periodData.merchant_revenue.forEach(item => {
    const gameName = (item.游戏名 || item.game_name || '').trim();
    const merchantName = (item.商户名 || item.merchant_name || '').trim();
    const currency = (item.货币 || item.currency || item.currency_code || '').trim();
    
    // 解析数值
    const ggrUSD = parseNumber(item['GGR-USD'] || item['ggr-usd'] || item.ggr || 0);
    const betUSD = parseNumber(item['总投注USD'] || item['总投注'] || item.bet_amount || item.total_bet || 0);
    const payoutUSD = parseNumber(item['总派奖USD'] || item['总派奖'] || item.payout_amount || item.total_payout || 0);
    const rounds = parseNumber(item.总局数 || item.rounds || item.round_count || 0);
    
    // 1. 总体数据（只统计游戏名="合计"）
    if (gameName === '合计' || gameName === 'Total') {
      result.overall.totalGGRUSD += ggrUSD;
      result.overall.totalBetUSD += betUSD;
      result.overall.totalPayoutUSD += payoutUSD;
      result.overall.totalRounds += rounds;
      
      // 2. 各商户数据（游戏名="合计"）
      if (merchantName) {
        if (!result.merchants[merchantName]) {
          result.merchants[merchantName] = {
            merchantName: merchantName,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          };
        }
        result.merchants[merchantName].totalGGRUSD += ggrUSD;
        result.merchants[merchantName].totalBetUSD += betUSD;
        result.merchants[merchantName].totalPayoutUSD += payoutUSD;
        result.merchants[merchantName].totalRounds += rounds;
      }
    } else {
      // 3. 各游戏数据（游戏名!="合计"）
      if (gameName) {
        if (!result.games[gameName]) {
          result.games[gameName] = {
            gameName: gameName,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          };
        }
        result.games[gameName].totalGGRUSD += ggrUSD;
        result.games[gameName].totalBetUSD += betUSD;
        result.games[gameName].totalPayoutUSD += payoutUSD;
        result.games[gameName].totalRounds += rounds;
      }
      
      // 4. 各币种数据（游戏名!="合计"）
      if (currency) {
        if (!result.currencies[currency]) {
          result.currencies[currency] = {
            currency: currency,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          };
        }
        result.currencies[currency].totalGGRUSD += ggrUSD;
        result.currencies[currency].totalBetUSD += betUSD;
        result.currencies[currency].totalPayoutUSD += payoutUSD;
        result.currencies[currency].totalRounds += rounds;
      }
    }
  });
  
  // 计算总体RTP
  result.overall.totalRTP = calculateRTP(result.overall.totalPayoutUSD, result.overall.totalBetUSD);
  
  // 计算各商户RTP
  Object.keys(result.merchants).forEach(merchantName => {
    const merchant = result.merchants[merchantName];
    merchant.totalRTP = calculateRTP(merchant.totalPayoutUSD, merchant.totalBetUSD);
  });
  
  // 计算各游戏RTP
  Object.keys(result.games).forEach(gameName => {
    const game = result.games[gameName];
    game.totalRTP = calculateRTP(game.totalPayoutUSD, game.totalBetUSD);
  });
  
  // 计算各币种RTP
  Object.keys(result.currencies).forEach(currency => {
    const curr = result.currencies[currency];
    curr.totalRTP = calculateRTP(curr.totalPayoutUSD, curr.totalBetUSD);
  });
  
  // 5. 处理留存数据
  periodData.retention.forEach(item => {
    const merchantName = (item.商户名 || item.merchant_name || '').trim();
    const gameName = (item.游戏名 || item.game_name || item.game || '').trim();
    const dataType = item.数据类型 || item.data_type || '';
    const dailyUsers = parseNumber(item.当日用户数 || item.当日用户 || item.daily_users || item.users || 0);
    
    // 解析留存率（可能包含%符号）
    const parseRetentionRate = (value) => {
      if (!value) return 0;
      if (typeof value === 'string') {
        const cleaned = value.replace('%', '').trim();
        return parseFloat(cleaned) || 0;
      }
      return parseNumber(value);
    };
    
    const d1Retention = parseRetentionRate(item.次日留存率 || item.d1_retention_rate || item['1日留存率'] || 0);
    const d7Retention = parseRetentionRate(item['7日留存率'] || item.d7_retention_rate || 0);
    
    const retentionItem = {
      merchantName: merchantName,
      gameName: gameName,
      dailyUsers: dailyUsers,
      d1Retention: d1Retention,
      d7Retention: d7Retention,
      d1RetentionFormatted: formatPercentage(d1Retention),
      d7RetentionFormatted: formatPercentage(d7Retention)
    };
    
    // 区分新用户和活跃用户
    if (dataType === '新用户留存' || dataType === 'new_user_retention' || 
        dataType.includes('新用户') || dataType.includes('new')) {
      result.retention.newUsers.push(retentionItem);
    } else if (dataType === '活跃用户留存' || dataType === 'active_user_retention' || 
               dataType.includes('活跃用户') || dataType.includes('active')) {
      result.retention.activeUsers.push(retentionItem);
    } else {
      // 如果没有明确标记，默认作为新用户
      result.retention.newUsers.push(retentionItem);
    }
  });
  
  // 对留存数据排序（按次日留存率降序，取Top20）
  // 先创建副本用于7日留存率排序
  const allNewUsersForD7 = [...result.retention.newUsers];
  const allActiveUsersForD7 = [...result.retention.activeUsers];
  
  // 按次日留存率排序并取Top20
  result.retention.newUsers.sort((a, b) => b.d1Retention - a.d1Retention);
  const newUsersTop20D1 = result.retention.newUsers.slice(0, 20);
  
  result.retention.activeUsers.sort((a, b) => b.d1Retention - a.d1Retention);
  const activeUsersTop20D1 = result.retention.activeUsers.slice(0, 20);
  
  // 对7日留存率也排序（取Top20）- 使用原始数据排序
  const newUsersTop20D7 = allNewUsersForD7.sort((a, b) => b.d7Retention - a.d7Retention).slice(0, 20);
  const activeUsersTop20D7 = allActiveUsersForD7.sort((a, b) => b.d7Retention - a.d7Retention).slice(0, 20);
  
  // 将商户、游戏、币种转换为数组
  result.merchants = Object.values(result.merchants);
  result.games = Object.values(result.games);
  result.currencies = Object.values(result.currencies);
  
  // 保存Top20数据
  result.retention.newUsers = newUsersTop20D1;
  result.retention.activeUsers = activeUsersTop20D1;
  result.retention.newUsersTop20D7 = newUsersTop20D7;
  result.retention.activeUsersTop20D7 = activeUsersTop20D7;
  
  return result;
}

// 步骤3：计算本周和上周统计数据
const currentWeekStats = calculateStatistics(data.current);
const previousWeekStats = calculateStatistics(data.previous);

// 步骤4：构建输出结果
const output = {
  // 本周数据
  currentWeek: {
    // 1. 总体数据
    overall: {
      totalGGRUSD: currentWeekStats.overall.totalGGRUSD,
      totalBetUSD: currentWeekStats.overall.totalBetUSD,
      totalPayoutUSD: currentWeekStats.overall.totalPayoutUSD,
      totalRounds: currentWeekStats.overall.totalRounds,
      totalRTP: currentWeekStats.overall.totalRTP,
      totalRTPFormatted: formatPercentage(currentWeekStats.overall.totalRTP)
    },
    // 2. 各商户数据
    merchants: currentWeekStats.merchants.map(m => ({
      ...m,
      totalRTPFormatted: formatPercentage(m.totalRTP)
    })),
    // 3. 各游戏数据
    games: currentWeekStats.games.map(g => ({
      ...g,
      totalRTPFormatted: formatPercentage(g.totalRTP)
    })),
    // 4. 各币种数据
    currencies: currentWeekStats.currencies.map(c => ({
      ...c,
      totalRTPFormatted: formatPercentage(c.totalRTP)
    })),
    // 5. 留存数据
    retention: {
      newUsersTop20D1: currentWeekStats.retention.newUsers.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d1RetentionFormatted: item.d1RetentionFormatted
      })),
      newUsersTop20D7: currentWeekStats.retention.newUsersTop20D7.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d7RetentionFormatted: item.d7RetentionFormatted
      })),
      activeUsersTop20D1: currentWeekStats.retention.activeUsers.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d1RetentionFormatted: item.d1RetentionFormatted
      })),
      activeUsersTop20D7: currentWeekStats.retention.activeUsersTop20D7.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d7RetentionFormatted: item.d7RetentionFormatted
      }))
    }
  },
  // 上周数据
  previousWeek: {
    // 1. 总体数据
    overall: {
      totalGGRUSD: previousWeekStats.overall.totalGGRUSD,
      totalBetUSD: previousWeekStats.overall.totalBetUSD,
      totalPayoutUSD: previousWeekStats.overall.totalPayoutUSD,
      totalRounds: previousWeekStats.overall.totalRounds,
      totalRTP: previousWeekStats.overall.totalRTP,
      totalRTPFormatted: formatPercentage(previousWeekStats.overall.totalRTP)
    },
    // 2. 各商户数据
    merchants: previousWeekStats.merchants.map(m => ({
      ...m,
      totalRTPFormatted: formatPercentage(m.totalRTP)
    })),
    // 3. 各游戏数据
    games: previousWeekStats.games.map(g => ({
      ...g,
      totalRTPFormatted: formatPercentage(g.totalRTP)
    })),
    // 4. 各币种数据
    currencies: previousWeekStats.currencies.map(c => ({
      ...c,
      totalRTPFormatted: formatPercentage(c.totalRTP)
    })),
    // 5. 留存数据
    retention: {
      newUsersTop20D1: previousWeekStats.retention.newUsers.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d1RetentionFormatted: item.d1RetentionFormatted
      })),
      newUsersTop20D7: previousWeekStats.retention.newUsersTop20D7.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d7RetentionFormatted: item.d7RetentionFormatted
      })),
      activeUsersTop20D1: previousWeekStats.retention.activeUsers.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d1RetentionFormatted: item.d1RetentionFormatted
      })),
      activeUsersTop20D7: previousWeekStats.retention.activeUsersTop20D7.map((item, index) => ({
        rank: index + 1,
        merchantName: item.merchantName,
        gameName: item.gameName,
        dailyUsers: item.dailyUsers,
        d7RetentionFormatted: item.d7RetentionFormatted
      }))
    }
  }
};

// 步骤5：输出统计信息
console.log("\n=== 统计结果 ===");
console.log("\n📊 本周总体数据:");
console.log(`  总GGR-USD: ${output.currentWeek.overall.totalGGRUSD.toFixed(2)}`);
console.log(`  总投注USD: ${output.currentWeek.overall.totalBetUSD.toFixed(2)}`);
console.log(`  总派奖USD: ${output.currentWeek.overall.totalPayoutUSD.toFixed(2)}`);
console.log(`  总局数: ${output.currentWeek.overall.totalRounds.toLocaleString()}`);
console.log(`  总RTP: ${output.currentWeek.overall.totalRTPFormatted}`);

console.log(`\n📊 本周商户数: ${output.currentWeek.merchants.length}`);
console.log(`📊 本周游戏数: ${output.currentWeek.games.length}`);
console.log(`📊 本周币种数: ${output.currentWeek.currencies.length}`);

console.log(`\n📊 本周新用户留存Top20 (次日): ${output.currentWeek.retention.newUsersTop20D1.length}`);
console.log(`📊 本周新用户留存Top20 (7日): ${output.currentWeek.retention.newUsersTop20D7.length}`);
console.log(`📊 本周活跃用户留存Top20 (次日): ${output.currentWeek.retention.activeUsersTop20D1.length}`);
console.log(`📊 本周活跃用户留存Top20 (7日): ${output.currentWeek.retention.activeUsersTop20D7.length}`);

console.log("\n📉 上周总体数据:");
console.log(`  总GGR-USD: ${output.previousWeek.overall.totalGGRUSD.toFixed(2)}`);
console.log(`  总投注USD: ${output.previousWeek.overall.totalBetUSD.toFixed(2)}`);
console.log(`  总派奖USD: ${output.previousWeek.overall.totalPayoutUSD.toFixed(2)}`);
console.log(`  总局数: ${output.previousWeek.overall.totalRounds.toLocaleString()}`);
console.log(`  总RTP: ${output.previousWeek.overall.totalRTPFormatted}`);

console.log(`\n✅ 数据处理完成`);

// 返回输出结果
return [{
  json: output
}];

