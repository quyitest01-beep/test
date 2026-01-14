// n8n Code节点：业务数据报告数据清洗器
// 功能：处理SQL查询结果，格式化为AI可理解的结构化数据

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
  },
  newGameList: []
};

// 解析SQL查询结果
inputs.forEach(input => {
  const item = input.json;
  const dataType = item.data_type;
  const category = item.category;
  
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
      merchantName: item.name,
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds),
      totalUsers: parseNumber(item.additional_data?.total_users),
      avgBetPerUser: parseNumber(item.additional_data?.avg_bet_per_user)
    });
  } else if (dataType === 'games' && category === 'game') {
    rawData.currentPeriod.games.push({
      gameName: item.name,
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
      currency: item.name,
      totalGGRUSD: parseNumber(item.current_value),
      totalBetUSD: parseNumber(item.additional_data?.total_bet_usd),
      totalPayoutUSD: parseNumber(item.additional_data?.total_payout_usd),
      totalRounds: parseNumber(item.additional_data?.total_rounds)
    });
  } else if (dataType === 'retention') {
    const [merchantName, gameName] = item.name.split('|');
    rawData.currentPeriod.retention.push({
      merchantName: merchantName,
      gameName: gameName,
      date: item.additional_data?.date,
      dailyUsers: parseNumber(item.current_value),
      d1Retention: parseNumber(item.previous_value),
      d7Retention: parseNumber(item.change_amount),
      retentionType: category  // 'new_user' 或 'active_user'
    });
  }
});

// 步骤2：匹配上期数据（如果需要）
// 这里假设上期数据也通过相同的方式传入，需要根据实际情况调整

// 步骤3：计算环比和排序
function calculateComparisons(currentItems, previousItems, keyField) {
  return currentItems.map(current => {
    const previous = previousItems.find(p => p[keyField] === current[keyField]);
    
    if (previous) {
      const changeAmount = current.totalGGRUSD - previous.totalGGRUSD;
      const changeRate = calculateChangeRate(current.totalGGRUSD, previous.totalGGRUSD);
      
      return {
        ...current,
        previousGGRUSD: previous.totalGGRUSD,
        changeAmount: changeAmount,
        changeRate: changeRate
      };
    }
    
    return {
      ...current,
      previousGGRUSD: null,
      changeAmount: current.totalGGRUSD,
      changeRate: null
    };
  });
}

// 步骤4：处理新游戏数据
function processNewGames(newGameList, currentPeriodGames, currentPeriodMerchants, currentPeriodCurrencies) {
  const newGameMap = new Map();
  newGameList.forEach(game => {
    newGameMap.set(game.english_name.toLowerCase(), game);
  });
  
  const newGamesData = [];
  const newGameRecords = currentPeriodGames.filter(game => 
    newGameMap.has(game.gameName.toLowerCase())
  );
  
  newGameRecords.forEach(game => {
    const gameKey = game.gameName.toLowerCase();
    if (!newGameMap.has(gameKey)) return;
    
    // 按商户聚合新游戏GGR
    const merchantGGR = {};
    const currencyGGR = {};
    
    // 这里需要从原始明细数据中获取新游戏的商户和币种数据
    // 简化版本：假设有额外的数据源
    
    const topMerchants = Object.entries(merchantGGR)
      .map(([name, ggr]) => ({ name, ggr }))
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        merchantName: item.name,
        ggrUSD: item.ggr,
        ggrUSDFormatted: formatCurrency(item.ggr),
        percentage: game.totalGGRUSD > 0 ? ((item.ggr / game.totalGGRUSD) * 100).toFixed(1) : '0'
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
        percentage: game.totalGGRUSD > 0 ? ((item.ggr / game.totalGGRUSD) * 100).toFixed(1) : '0'
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
  
  // 按类型和留存类型分组
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
function buildOutputStructure(rawData, newGameList, currentPeriod, previousPeriod) {
  const current = rawData.currentPeriod;
  const previous = rawData.previousPeriod;
  
  // 计算总体数据
  const overallChangeRate = current.overall && previous.overall
    ? calculateChangeRate(current.overall.totalGGRUSD, previous.overall.totalGGRUSD)
    : null;
  
  // 处理商户数据（带环比）
  const merchantsWithChange = calculateComparisons(
    current.merchants,
    previous.merchants,
    'merchantName'
  );
  
  // 处理游戏数据（带环比）
  const gamesWithChange = calculateComparisons(
    current.games,
    previous.games,
    'gameName'
  );
  
  // 处理币种数据（带环比）
  const currenciesWithChange = calculateComparisons(
    current.currencies,
    previous.currencies,
    'currency'
  );
  
  // 处理新游戏数据
  const newGamesData = processNewGames(
    newGameList,
    current.games,
    current.merchants,
    current.currencies
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
      changeRate: overallChangeRate,
      changeAmount: current.overall && previous.overall
        ? current.overall.totalGGRUSD - previous.overall.totalGGRUSD
        : null
    },
    newGames: newGamesData,
    merchants: {
      current: merchantsWithChange,
      topGrowth: merchantsWithChange
        .filter(m => m.changeAmount > 0)
        .sort((a, b) => b.changeAmount - a.changeAmount)
        .slice(0, 3),
      topDecline: merchantsWithChange
        .filter(m => m.changeAmount < 0)
        .sort((a, b) => a.changeAmount - b.changeAmount)
        .slice(0, 3)
    },
    games: {
      current: gamesWithChange,
      topGrowth: gamesWithChange
        .filter(g => g.changeAmount > 0)
        .sort((a, b) => b.changeAmount - a.changeAmount)
        .slice(0, 3),
      topDecline: gamesWithChange
        .filter(g => g.changeAmount < 0)
        .sort((a, b) => a.changeAmount - b.changeAmount)
        .slice(0, 3)
    },
    currencies: {
      current: currenciesWithChange,
      topGrowth: currenciesWithChange
        .filter(c => c.changeAmount > 0)
        .sort((a, b) => b.changeAmount - a.changeAmount)
        .slice(0, 3),
      topDecline: currenciesWithChange
        .filter(c => c.changeAmount < 0)
        .sort((a, b) => a.changeAmount - b.changeAmount)
        .slice(0, 3)
    },
    retention: retentionData
  };
}

// 主处理逻辑
const output = buildOutputStructure(
  rawData,
  [], // newGameList - 需要从输入中提取
  '20251027-1102', // currentPeriod - 需要从输入中提取
  '20251020-1026'  // previousPeriod - 需要从输入中提取
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












