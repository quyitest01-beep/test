// n8n Code节点：业务数据报告数据清洗器（完整版）
// 功能：处理SQL查询结果，格式化为AI可理解的结构化数据
// 支持：新游戏、商户、游戏、币种、留存等所有维度

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

// 工具函数：格式化货币
function formatCurrency(value) {
  if (!value || value === 0) return '0';
  return Math.round(value).toLocaleString('en-US');
}

// 工具函数：格式化百分比
function formatPercentage(value) {
  if (!value || value === 0) return '0%';
  return `${value.toFixed(2)}%`;
}

// 工具函数：计算环比
function calculateChangeRate(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// 工具函数：计算RTP
function calculateRTP(payout, bet) {
  if (!bet || bet === 0) return 0;
  return (payout / bet) * 100;
}

// 步骤1：解析输入数据
// 假设输入数据来自SQL查询结果，格式为数组
const rawData = {
  currentPeriod: {
    overall: null,
    merchants: [],
    games: [],
    currencies: [],
    newGames: [],
    retention: []
  },
  previousPeriod: {
    overall: null,
    merchants: [],
    games: [],
    currencies: []
  }
};

// 从输入中提取数据
// 注意：实际使用时，需要根据SQL查询结果的格式调整
inputs.forEach((input, index) => {
  const item = input.json;
  
  // 假设SQL查询结果包含以下字段：
  // data_type: 'current_period_overall', 'merchants', 'games', 'currencies', 'retention'
  // category: 'merchant', 'game', 'currency', 'new_user', 'active_user'
  // name: 商户名/游戏名/币种名
  // current_value: 当前期数值
  // previous_value: 上期数值
  // change_amount: 变化量
  // change_rate: 变化率
  // additional_data: 额外数据（Map格式）
  
  const dataType = item.data_type;
  const category = item.category;
  const name = item.name;
  
  if (dataType === 'current_period_overall') {
    rawData.currentPeriod.overall = {
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds),
      totalActiveUsers: parseNumber(item.additional_data?.total_active_users)
    };
  } else if (dataType === 'merchants' && category === 'merchant') {
    rawData.currentPeriod.merchants.push({
      merchantName: name,
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds),
      totalUsers: parseNumber(item.additional_data?.total_users),
      avgBetPerUser: parseNumber(item.additional_data?.avg_bet_per_user)
    });
  } else if (dataType === 'games' && category === 'game') {
    rawData.currentPeriod.games.push({
      gameName: name,
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds),
      totalUsers: parseNumber(item.additional_data?.total_users),
      rtp: parseNumber(item.additional_data?.rtp),
      avgBetPerUser: parseNumber(item.additional_data?.avg_bet_per_user)
    });
  } else if (dataType === 'currencies' && category === 'currency') {
    rawData.currentPeriod.currencies.push({
      currency: name,
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds)
    });
  } else if (dataType === 'retention') {
    const [merchantName, gameName] = name.split('|');
    rawData.currentPeriod.retention.push({
      merchantName: merchantName,
      gameName: gameName,
      date: item.additional_data?.date,
      dailyUsers: parseNumber(item.current_value),
      d1Retention: parseNumber(item.previous_value),  // 使用previous_value存储d1_retention
      d7Retention: parseNumber(item.change_amount),  // 使用change_amount存储d7_retention
      retentionType: category  // 'new_user' 或 'active_user'
    });
  }
});

// 步骤2：处理新游戏数据
// 假设新游戏列表从外部输入或配置中获取
const newGameList = []; // 需要从输入中提取或配置

// 步骤3：计算环比和排序
function calculateComparisons(currentItems, previousItems, keyField, compareField = 'totalGGRUSD') {
  return currentItems.map(current => {
    const previous = previousItems.find(p => p[keyField] === current[keyField]);
    
    if (previous) {
      const currentValue = current[compareField] || 0;
      const previousValue = previous[compareField] || 0;
      const changeAmount = currentValue - previousValue;
      const changeRate = calculateChangeRate(currentValue, previousValue);
      
      return {
        ...current,
        [`previous${compareField.charAt(0).toUpperCase() + compareField.slice(1)}`]: previousValue,
        [`${compareField}ChangeAmount`]: changeAmount,
        [`${compareField}ChangeRate`]: changeRate
      };
    }
    
    return {
      ...current,
      [`previous${compareField.charAt(0).toUpperCase() + compareField.slice(1)}`]: null,
      [`${compareField}ChangeAmount`]: current[compareField] || 0,
      [`${compareField}ChangeRate`]: null
    };
  });
}

// 步骤4：处理新游戏数据（需要从原始明细数据中提取）
function processNewGames(newGameList, currentPeriodGames, currentPeriodMerchants, currentPeriodCurrencies, rawTransactions) {
  // 这里需要根据实际的原始明细数据来处理
  // 简化版本：假设新游戏数据已经包含在currentPeriodGames中
  const newGameMap = new Map();
  newGameList.forEach(game => {
    newGameMap.set(game.english_name.toLowerCase(), game);
  });
  
  const newGamesData = [];
  
  // 筛选新游戏
  currentPeriodGames.forEach(game => {
    const gameKey = game.gameName.toLowerCase();
    if (!newGameMap.has(gameKey)) return;
    
    // 从原始明细数据中提取新游戏的商户和币种数据
    // 这里需要根据实际数据源调整
    const newGameTransactions = rawTransactions ? rawTransactions.filter(t => {
      const tGameName = String(t.game_name || t.游戏名 || '').toLowerCase().trim();
      return tGameName === gameKey && parseNumber(t.ggr_usd || t['GGR-USD'] || 0) > 0;
    }) : [];
    
    // 按商户聚合
    const merchantGGR = {};
    newGameTransactions.forEach(t => {
      const merchant = String(t.merchant_name || t.商户名 || '').trim();
      const ggr = parseNumber(t.ggr_usd || t['GGR-USD'] || 0);
      if (merchant && ggr > 0) {
        merchantGGR[merchant] = (merchantGGR[merchant] || 0) + ggr;
      }
    });
    
    // 按币种聚合
    const currencyGGR = {};
    newGameTransactions.forEach(t => {
      const currency = String(t.currency_code || t.货币 || '').trim();
      const ggr = parseNumber(t.ggr_usd || t['GGR-USD'] || 0);
      if (currency && ggr > 0) {
        currencyGGR[currency] = (currencyGGR[currency] || 0) + ggr;
      }
    });
    
    const totalNewGameGGR = game.totalGGRUSD;
    
    const topMerchants = Object.entries(merchantGGR)
      .map(([name, ggr]) => ({ name, ggr }))
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        merchantName: item.name,
        ggrUSD: item.ggr,
        ggrUSDFormatted: formatCurrency(item.ggr),
        percentage: totalNewGameGGR > 0 ? ((item.ggr / totalNewGameGGR) * 100).toFixed(1) : '0'
      }));
    
    const topCurrencies = Object.entries(currencyGGR)
      .map(([name, ggr]) => ({ name, ggr }))
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        currency: item.name,
        ggrUSD: item.ggr,
        ggrUSDFormatted: formatCurrency(item.ggr),
        percentage: totalNewGameGGR > 0 ? ((item.ggr / totalNewGameGGR) * 100).toFixed(1) : '0'
      }));
    
    newGamesData.push({
      gameName: game.gameName,
      totalGGRUSD: game.totalGGRUSD,
      totalBetUSD: game.totalBetUSD,
      totalPayoutUSD: game.totalPayoutUSD,
      totalRounds: game.totalRounds,
      totalUsers: game.totalUsers,
      rtp: game.rtp,
      topMerchants: topMerchants,
      topCurrencies: topCurrencies
    });
  });
  
  return newGamesData;
}

// 步骤5：处理留存数据
function processRetentionData(retentionData) {
  const result = {
    newUserD1: [],
    newUserD7: [],
    activeUserD1: [],
    activeUserD7: []
  };
  
  // 按类型分组
  const grouped = {
    new_user: { d1: [], d7: [] },
    active_user: { d1: [], d7: [] }
  };
  
  retentionData.forEach(item => {
    if (item.retentionType === 'new_user') {
      grouped.new_user.d1.push({ ...item, retention: item.d1Retention });
      grouped.new_user.d7.push({ ...item, retention: item.d7Retention });
    } else if (item.retentionType === 'active_user') {
      grouped.active_user.d1.push({ ...item, retention: item.d1Retention });
      grouped.active_user.d7.push({ ...item, retention: item.d7Retention });
    }
  });
  
  // 排序并取Top 20
  result.newUserD1 = grouped.new_user.d1
    .filter(item => item.dailyUsers >= 50)
    .sort((a, b) => b.retention - a.retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      retention: item.retention,
      retentionFormatted: formatPercentage(item.retention)
    }));
  
  result.newUserD7 = grouped.new_user.d7
    .filter(item => item.dailyUsers >= 50)
    .sort((a, b) => b.retention - a.retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      retention: item.retention,
      retentionFormatted: formatPercentage(item.retention)
    }));
  
  result.activeUserD1 = grouped.active_user.d1
    .filter(item => item.dailyUsers >= 50)
    .sort((a, b) => b.retention - a.retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      retention: item.retention,
      retentionFormatted: formatPercentage(item.retention)
    }));
  
  result.activeUserD7 = grouped.active_user.d7
    .filter(item => item.dailyUsers >= 50)
    .sort((a, b) => b.retention - a.retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      retention: item.retention,
      retentionFormatted: formatPercentage(item.retention)
    }));
  
  return result;
}

// 步骤6：构建最终输出结构
function buildOutputStructure(rawData, newGameList, currentPeriod, previousPeriod, rawTransactions) {
  const current = rawData.currentPeriod;
  const previous = rawData.previousPeriod;
  
  // 计算总体数据
  const overallChangeRate = current.overall && previous.overall
    ? calculateChangeRate(current.overall.totalGGRUSD, previous.overall.totalGGRUSD)
    : null;
  
  const overallBetChangeRate = current.overall && previous.overall
    ? calculateChangeRate(current.overall.totalBetUSD, previous.overall.totalBetUSD)
    : null;
  
  const overallRoundsChangeRate = current.overall && previous.overall
    ? calculateChangeRate(current.overall.totalRounds, previous.overall.totalRounds)
    : null;
  
  const overallUsersChangeRate = current.overall && previous.overall
    ? calculateChangeRate(current.overall.totalActiveUsers, previous.overall.totalActiveUsers)
    : null;
  
  // 处理商户数据（带环比）
  const merchantsWithChange = calculateComparisons(
    current.merchants,
    previous.merchants,
    'merchantName',
    'totalGGRUSD'
  );
  
  // 处理商户投注数据（带环比）
  const merchantsWithBetChange = calculateComparisons(
    current.merchants,
    previous.merchants,
    'merchantName',
    'totalBetUSD'
  );
  
  // 处理商户人均投注数据（带环比）
  const merchantsWithAvgBetChange = calculateComparisons(
    current.merchants,
    previous.merchants,
    'merchantName',
    'avgBetPerUser'
  );
  
  // 处理游戏数据（带环比 - GGR）
  const gamesWithGGRChange = calculateComparisons(
    current.games,
    previous.games,
    'gameName',
    'totalGGRUSD'
  );
  
  // 处理游戏数据（带环比 - 投注）
  const gamesWithBetChange = calculateComparisons(
    current.games,
    previous.games,
    'gameName',
    'totalBetUSD'
  );
  
  // 处理游戏数据（带环比 - 人均投注）
  const gamesWithAvgBetChange = calculateComparisons(
    current.games,
    previous.games,
    'gameName',
    'avgBetPerUser'
  );
  
  // 处理游戏数据（带环比 - 局数）
  const gamesWithRoundsChange = calculateComparisons(
    current.games,
    previous.games,
    'gameName',
    'totalRounds'
  );
  
  // 处理游戏数据（带环比 - RTP）
  const gamesWithRTPChange = current.games.map(game => {
    const previous = previous.games.find(p => p.gameName === game.gameName);
    if (previous) {
      const currentRTP = game.rtp || 0;
      const previousRTP = previous.rtp || 0;
      const rtpChange = currentRTP - previousRTP;
      return {
        ...game,
        previousRTP: previousRTP,
        rtpChange: rtpChange
      };
    }
    return {
      ...game,
      previousRTP: null,
      rtpChange: game.rtp || 0
    };
  });
  
  // 处理币种数据（带环比）
  const currenciesWithChange = calculateComparisons(
    current.currencies,
    previous.currencies,
    'currency',
    'totalGGRUSD'
  );
  
  // 处理新游戏数据
  const newGamesData = processNewGames(
    newGameList,
    current.games,
    current.merchants,
    current.currencies,
    rawTransactions
  );
  
  // 处理留存数据
  const retentionData = processRetentionData(current.retention);
  
  return {
    periodInfo: {
      currentPeriod: currentPeriod,
      previousPeriod: previousPeriod,
      periodType: currentPeriod.includes('-') ? 'weekly' : 'monthly'
    },
    overall: {
      current: {
        totalGGRUSD: current.overall?.totalGGRUSD || 0,
        totalBetUSD: current.overall?.totalBetUSD || 0,
        totalPayoutUSD: current.overall?.totalPayoutUSD || 0,
        totalRounds: current.overall?.totalRounds || 0,
        totalRTP: current.overall?.totalBetUSD > 0
          ? calculateRTP(current.overall.totalPayoutUSD, current.overall.totalBetUSD)
          : 0,
        totalActiveUsers: current.overall?.totalActiveUsers || 0
      },
      previous: previous.overall ? {
        totalGGRUSD: previous.overall.totalGGRUSD,
        totalBetUSD: previous.overall.totalBetUSD,
        totalPayoutUSD: previous.overall.totalPayoutUSD,
        totalRounds: previous.overall.totalRounds,
        totalRTP: previous.overall.totalBetUSD > 0
          ? calculateRTP(previous.overall.totalPayoutUSD, previous.overall.totalBetUSD)
          : 0,
        totalActiveUsers: previous.overall.totalActiveUsers || 0
      } : null,
      ggrChangeRate: overallChangeRate,
      ggrChangeAmount: current.overall && previous.overall
        ? current.overall.totalGGRUSD - previous.overall.totalGGRUSD
        : null,
      betChangeRate: overallBetChangeRate,
      betChangeAmount: current.overall && previous.overall
        ? current.overall.totalBetUSD - previous.overall.totalBetUSD
        : null,
      roundsChangeRate: overallRoundsChangeRate,
      roundsChangeAmount: current.overall && previous.overall
        ? current.overall.totalRounds - previous.overall.totalRounds
        : null,
      usersChangeRate: overallUsersChangeRate,
      usersChangeAmount: current.overall && previous.overall
        ? current.overall.totalActiveUsers - previous.overall.totalActiveUsers
        : null,
      rtpChange: current.overall && previous.overall
        ? (current.overall.totalBetUSD > 0 ? calculateRTP(current.overall.totalPayoutUSD, current.overall.totalBetUSD) : 0) -
          (previous.overall.totalBetUSD > 0 ? calculateRTP(previous.overall.totalPayoutUSD, previous.overall.totalBetUSD) : 0)
        : null
    },
    newGames: newGamesData,
    merchants: {
      current: merchantsWithChange,
      // Top 3增长商户（按GGR变化量）
      topGrowthGGR: merchantsWithChange
        .filter(m => m.totalGGRUSDChangeAmount > 0)
        .sort((a, b) => b.totalGGRUSDChangeAmount - a.totalGGRUSDChangeAmount)
        .slice(0, 3),
      // Top 3下滑商户（按GGR变化量）
      topDeclineGGR: merchantsWithChange
        .filter(m => m.totalGGRUSDChangeAmount < 0)
        .sort((a, b) => a.totalGGRUSDChangeAmount - b.totalGGRUSDChangeAmount)
        .slice(0, 3),
      // Top 3增长商户（按投注额变化量）
      topGrowthBet: merchantsWithBetChange
        .filter(m => m.totalBetUSDChangeAmount > 0)
        .sort((a, b) => b.totalBetUSDChangeAmount - a.totalBetUSDChangeAmount)
        .slice(0, 3),
      // Top 3下滑商户（按投注额变化量）
      topDeclineBet: merchantsWithBetChange
        .filter(m => m.totalBetUSDChangeAmount < 0)
        .sort((a, b) => a.totalBetUSDChangeAmount - b.totalBetUSDChangeAmount)
        .slice(0, 3),
      // Top 3增长商户（按人均投注变化量）
      topGrowthAvgBet: merchantsWithAvgBetChange
        .filter(m => m.avgBetPerUserChangeAmount > 0)
        .sort((a, b) => b.avgBetPerUserChangeAmount - a.avgBetPerUserChangeAmount)
        .slice(0, 3),
      // Top 3下滑商户（按人均投注变化量）
      topDeclineAvgBet: merchantsWithAvgBetChange
        .filter(m => m.avgBetPerUserChangeAmount < 0)
        .sort((a, b) => a.avgBetPerUserChangeAmount - b.avgBetPerUserChangeAmount)
        .slice(0, 3)
    },
    games: {
      current: gamesWithGGRChange,
      // Top 3增长游戏（按GGR变化量）
      topGrowthGGR: gamesWithGGRChange
        .filter(g => g.totalGGRUSDChangeAmount > 0)
        .sort((a, b) => b.totalGGRUSDChangeAmount - a.totalGGRUSDChangeAmount)
        .slice(0, 3),
      // Top 3下滑游戏（按GGR变化量）
      topDeclineGGR: gamesWithGGRChange
        .filter(g => g.totalGGRUSDChangeAmount < 0)
        .sort((a, b) => a.totalGGRUSDChangeAmount - b.totalGGRUSDChangeAmount)
        .slice(0, 3),
      // Top 3增长游戏（按投注额变化量）
      topGrowthBet: gamesWithBetChange
        .filter(g => g.totalBetUSDChangeAmount > 0)
        .sort((a, b) => b.totalBetUSDChangeAmount - a.totalBetUSDChangeAmount)
        .slice(0, 3),
      // Top 3下滑游戏（按投注额变化量）
      topDeclineBet: gamesWithBetChange
        .filter(g => g.totalBetUSDChangeAmount < 0)
        .sort((a, b) => a.totalBetUSDChangeAmount - b.totalBetUSDChangeAmount)
        .slice(0, 3),
      // Top 3增长游戏（按人均投注变化量）
      topGrowthAvgBet: gamesWithAvgBetChange
        .filter(g => g.avgBetPerUserChangeAmount > 0)
        .sort((a, b) => b.avgBetPerUserChangeAmount - a.avgBetPerUserChangeAmount)
        .slice(0, 3),
      // Top 3下滑游戏（按人均投注变化量）
      topDeclineAvgBet: gamesWithAvgBetChange
        .filter(g => g.avgBetPerUserChangeAmount < 0)
        .sort((a, b) => a.avgBetPerUserChangeAmount - b.avgBetPerUserChangeAmount)
        .slice(0, 3),
      // Top 3增长游戏（按局数变化量）
      topGrowthRounds: gamesWithRoundsChange
        .filter(g => g.totalRoundsChangeAmount > 0)
        .sort((a, b) => b.totalRoundsChangeAmount - a.totalRoundsChangeAmount)
        .slice(0, 3),
      // Top 3下滑游戏（按局数变化量）
      topDeclineRounds: gamesWithRoundsChange
        .filter(g => g.totalRoundsChangeAmount < 0)
        .sort((a, b) => a.totalRoundsChangeAmount - b.totalRoundsChangeAmount)
        .slice(0, 3),
      // Top 3增长游戏（按RTP变化量 - 注意：RTP增长可能是负数，需要按变化量排序）
      topGrowthRTP: gamesWithRTPChange
        .filter(g => g.rtpChange > 0)
        .sort((a, b) => b.rtpChange - a.rtpChange)
        .slice(0, 3),
      // Top 3下滑游戏（按RTP变化量 - 注意：RTP下滑可能是正数，需要按变化量排序）
      topDeclineRTP: gamesWithRTPChange
        .filter(g => g.rtpChange < 0)
        .sort((a, b) => a.rtpChange - b.rtpChange)
        .slice(0, 3)
    },
    currencies: {
      current: currenciesWithChange,
      // Top 3增长币种（按GGR变化量）
      topGrowth: currenciesWithChange
        .filter(c => c.totalGGRUSDChangeAmount > 0)
        .sort((a, b) => b.totalGGRUSDChangeAmount - a.totalGGRUSDChangeAmount)
        .slice(0, 3),
      // Top 3下滑币种（按GGR变化量）
      topDecline: currenciesWithChange
        .filter(c => c.totalGGRUSDChangeAmount < 0)
        .sort((a, b) => a.totalGGRUSDChangeAmount - b.totalGGRUSDChangeAmount)
        .slice(0, 3)
    },
    retention: retentionData
  };
}

// 主处理逻辑
// 注意：需要从输入中提取周期信息和新游戏列表
const currentPeriod = '20251027-1102'; // 需要从输入中提取
const previousPeriod = '20251020-1026'; // 需要从输入中提取
const rawTransactions = []; // 需要从输入中提取原始明细数据（用于新游戏分析）

const output = buildOutputStructure(
  rawData,
  newGameList,
  currentPeriod,
  previousPeriod,
  rawTransactions
);

console.log(`✅ 数据清洗完成`);
console.log(`  总体GGR: $${formatCurrency(output.overall.current.totalGGRUSD)}`);
console.log(`  商户数: ${output.merchants.current.length}`);
console.log(`  游戏数: ${output.games.current.length}`);
console.log(`  币种数: ${output.currencies.current.length}`);
console.log(`  新游戏数: ${output.newGames.length}`);

return [{
  json: output
}];












