// n8n Code节点：基于统计数据生成业务分析报告
// 功能：处理来自lark-period-statistics-processor的统计数据，按照业务规则生成分析报告
// 输入格式：Google Docs内容（包含JSON数据）或直接的JSON数组

const inputs = $input.all();
console.log("=== 业务数据分析器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：从content中提取JSON数据
function extractJSONFromContent(content) {
  if (!content) return null;
  
  // 查找 "=== 完整JSON数据 ===" 标记
  const jsonStartMarker = "=== 完整JSON数据 ===";
  const jsonStartIndex = content.indexOf(jsonStartMarker);
  
  if (jsonStartIndex === -1) {
    // 如果没有标记，尝试直接解析整个content
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error("❌ 无法从content中提取JSON数据");
      return null;
    }
  }
  
  // 提取JSON部分
  const jsonContent = content.substring(jsonStartIndex + jsonStartMarker.length).trim();
  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    console.error("❌ 解析JSON数据失败:", e.message);
    return null;
  }
}

// 工具函数：计算环比
function calculateChangeRate(current, previous) {
  if (!previous || previous === 0) return null;
  const rate = ((current - previous) / previous * 100).toFixed(1);
  return {
    rate: parseFloat(rate),
    isPositive: rate > 0,
    display: `${rate > 0 ? '+' : ''}${rate}%`
  };
}

// 工具函数：格式化货币
function formatCurrency(amount, currency = 'USD') {
  if (typeof amount === 'string') {
    // 移除逗号和$符号
    amount = amount.replace(/[$,]/g, '');
    amount = parseFloat(amount);
  }
  if (isNaN(amount)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// 工具函数：计算占比
function calculatePercentage(part, total) {
  if (!total || total === 0) return '0';
  return ((part / total) * 100).toFixed(1);
}

// 工具函数：解析数值
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/[$,]/g, ''));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 步骤1：提取和解析数据
let jsonData = null;

console.log(`🔍 开始提取数据，输入项数: ${inputs.length}`);

// 收集所有可能的JSON数据
const allJsonItems = [];

inputs.forEach((input, index) => {
  const item = input.json;
  console.log(`📦 输入项 ${index + 1} 的键: ${Object.keys(item).join(', ')}`);
  
  // 如果直接是JSON数组
  if (Array.isArray(item)) {
    console.log(`  ✅ 发现JSON数组，长度: ${item.length}`);
    allJsonItems.push(...item);
  }
  // 如果有content字段（Google Docs格式）
  else if (item.content) {
    console.log(`  ✅ 发现content字段，尝试提取JSON`);
    const extracted = extractJSONFromContent(item.content);
    if (extracted && Array.isArray(extracted)) {
      console.log(`  ✅ 从content中提取到JSON数组，长度: ${extracted.length}`);
      allJsonItems.push(...extracted);
    } else if (extracted) {
      console.log(`  ✅ 从content中提取到JSON对象`);
      allJsonItems.push(extracted);
    }
  }
  // 如果直接是JSON对象（包含english_name或periods）
  else if (item.english_name || item.periods) {
    console.log(`  ✅ 发现JSON对象（新游戏或统计数据）`);
    allJsonItems.push(item);
  }
  // 其他情况，直接添加
  else {
    console.log(`  ⚠️ 未知格式，直接添加`);
    allJsonItems.push(item);
  }
});

jsonData = allJsonItems;

if (!jsonData || jsonData.length === 0) {
  console.error("❌ 无法提取有效的JSON数据");
  console.error(`   尝试的输入项数: ${inputs.length}`);
  if (inputs.length > 0) {
    console.error(`   第一个输入项的键: ${Object.keys(inputs[0].json).join(', ')}`);
  }
  return [];
}

console.log(`✅ 成功提取JSON数据，共 ${jsonData.length} 项`);
console.log(`   第一项键: ${Object.keys(jsonData[0] || {}).join(', ')}`);

// 步骤2：分离新游戏列表和统计数据
let newGameList = [];
let statsData = [];

jsonData.forEach((item, index) => {
  if (item.english_name && item.release_date) {
    // 新游戏列表项
    newGameList.push({
      english_name: item.english_name.trim(),
      release_date: item.release_date.trim()
    });
    console.log(`✅ 发现新游戏: ${item.english_name} (${item.release_date})`);
  } else if (item.periods && Array.isArray(item.periods)) {
    // 统计数据项
    statsData.push(item);
  }
});

console.log(`📊 新游戏数量: ${newGameList.length}`);
console.log(`📊 统计数据项数: ${statsData.length}`);

if (statsData.length === 0) {
  console.error("❌ 没有找到统计数据");
  return [];
}

// 步骤3：确定当前期和上期
let currentPeriod = null;
let previousPeriod = null;

// 合并所有periods
const allPeriods = [];
statsData.forEach((item, itemIndex) => {
  console.log(`📊 处理统计数据项 ${itemIndex + 1}`);
  if (item.periods && Array.isArray(item.periods)) {
    console.log(`  ✅ 发现 ${item.periods.length} 个周期`);
    item.periods.forEach((period, pIndex) => {
      console.log(`    周期 ${pIndex + 1}: ${period.periodDisplay || period.period || '未知'}`);
      console.log(`      有overall: ${!!period.overall}`);
      console.log(`      有merchants: ${!!period.merchants}`);
      console.log(`      有games: ${!!period.games}`);
      allPeriods.push(period);
    });
  } else {
    console.log(`  ⚠️ 没有periods字段`);
  }
});

console.log(`📅 总共找到 ${allPeriods.length} 个周期`);

// 按日期排序，最新的为当前期
allPeriods.sort((a, b) => {
  const dateA = a.startDate || a.period || '';
  const dateB = b.startDate || b.period || '';
  return dateB.localeCompare(dateA);
});

if (allPeriods.length > 0) {
  currentPeriod = allPeriods[0];
  console.log(`📅 当前期: ${currentPeriod.periodDisplay || currentPeriod.period}`);
  console.log(`   overall.totalGGRUSD: ${currentPeriod.overall?.totalGGRUSD || 0}`);
}

if (allPeriods.length > 1) {
  previousPeriod = allPeriods[1];
  console.log(`📅 上期: ${previousPeriod.periodDisplay || previousPeriod.period}`);
  console.log(`   overall.totalGGRUSD: ${previousPeriod.overall?.totalGGRUSD || 0}`);
}

if (!currentPeriod) {
  console.error("❌ 无法确定当前期");
  console.error(`   统计数据项数: ${statsData.length}`);
  if (statsData.length > 0) {
    console.error(`   第一个统计项键: ${Object.keys(statsData[0]).join(', ')}`);
  }
  return [];
}

// 步骤4：按照业务规则进行分析
// 格式化日期范围为YYYYMMDD格式
function formatDateRangeForTitle(startDate, endDate, period) {
  if (!startDate && !endDate && !period) return null;
  
  // 如果period是YYYYMMDD-YYYYMMDD格式
  if (period && period.length >= 17) {
    const start = period.substring(0, 8);
    const end = period.substring(9, 17);
    return {
      start: start,
      end: end,
      display: start + '-' + end
    };
  }
  
  // 如果有startDate和endDate
  if (startDate && endDate) {
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      // 如果已经是YYYYMMDD格式
      if (/^\d{8}$/.test(dateStr)) return dateStr;
      // 如果是YYYY-MM-DD格式，转换为YYYYMMDD
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return match[1] + match[2] + match[3];
      }
      return null;
    };
    
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    if (start && end) {
      return {
        start: start,
        end: end,
        display: start + '-' + end
      };
    }
  }
  
  return null;
}

const analysisResults = {
  reportType: 'weekly',
  timestamp: new Date().toISOString(),
  dateRanges: {
    current: currentPeriod ? formatDateRangeForTitle(
      currentPeriod.startDate,
      currentPeriod.endDate,
      currentPeriod.period
    ) : null,
    previous: previousPeriod ? formatDateRangeForTitle(
      previousPeriod.startDate,
      previousPeriod.endDate,
      previousPeriod.period
    ) : null
  },
  summary: {},
  analyses: {},
  overallConclusion: ''
};

console.log(`📅 日期范围 - 当前期: ${JSON.stringify(analysisResults.dateRanges.current)}`);
console.log(`📅 日期范围 - 上期: ${JSON.stringify(analysisResults.dateRanges.previous)}`);

// 4.1 总GGR分析（只统计正GGR）
const currentOverall = currentPeriod.overall || {};
const previousOverall = previousPeriod?.overall || {};

console.log(`📊 当前期overall:`, JSON.stringify(currentOverall).substring(0, 200));
console.log(`📊 上期overall:`, previousOverall ? JSON.stringify(previousOverall).substring(0, 200) : '无');

let totalGGRCurrent = parseNumber(currentOverall.totalGGRUSD || 0);
let totalGGRPrevious = parseNumber(previousOverall?.totalGGRUSD || 0);

// 只统计正GGR
if (totalGGRCurrent < 0) {
  totalGGRCurrent = 0;
}
if (totalGGRPrevious < 0) {
  totalGGRPrevious = 0;
}

console.log(`💰 总GGR当前期: ${totalGGRCurrent}, 上期: ${totalGGRPrevious}`);

analysisResults.summary.overallGGR = {
  current: totalGGRCurrent,
  previous: totalGGRPrevious,
  change: calculateChangeRate(totalGGRCurrent, totalGGRPrevious)
};

console.log(`💰 总GGR: ${formatCurrency(totalGGRCurrent)} (上期: ${formatCurrency(totalGGRPrevious)})`);

// 4.2 新游戏分析
if (newGameList.length > 0 && currentPeriod.games) {
  // 创建新游戏名称映射（小写）
  const newGameNameMap = new Map();
  newGameList.forEach(game => {
    const lowerName = game.english_name.toLowerCase().trim();
    newGameNameMap.set(lowerName, game.english_name.trim());
  });
  
  // 从当前期的games中筛选新游戏（只统计正GGR）
  const newGameGGRMap = new Map();
  let totalNewGameGGR = 0;
  let totalNewGameBet = 0;
  let totalNewGameUsers = 0;
  
  if (Array.isArray(currentPeriod.games)) {
    currentPeriod.games.forEach(game => {
      const gameName = (game.gameName || game.name || '').trim().toLowerCase();
      
      // 检查是否为新游戏
      if (gameName && newGameNameMap.has(gameName)) {
        // 只统计正GGR
        const ggr = parseNumber(game.totalGGRUSD || 0);
        if (ggr > 0) {
          newGameGGRMap.set(gameName, {
            name: newGameNameMap.get(gameName),
            ggr: ggr,
            bet: parseNumber(game.totalBetUSD || 0),
            users: parseNumber(game.totalUsers || 0)
          });
          totalNewGameGGR += ggr;
          totalNewGameBet += parseNumber(game.totalBetUSD || 0);
          totalNewGameUsers += parseNumber(game.totalUsers || 0);
        }
      }
    });
  }
  
  if (totalNewGameGGR > 0) {
    const newGameList = Array.from(newGameGGRMap.values())
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5);
    
    analysisResults.summary.newGameGGR = {
      total: totalNewGameGGR,
      contribution: calculatePercentage(totalNewGameGGR, totalGGRCurrent)
    };
    analysisResults.summary.newGameBet = {
      total: totalNewGameBet,
      contribution: calculatePercentage(totalNewGameBet, currentOverall.totalBetUSD || 0)
    };
    analysisResults.summary.newGameActiveUsers = {
      total: totalNewGameUsers,
      contribution: calculatePercentage(totalNewGameUsers, currentPeriod.gameUsers?.reduce((sum, g) => sum + (g.totalUsers || 0), 0) || 0)
    };
    
    analysisResults.analyses.newGame = {
      totalGGR: totalNewGameGGR,
      totalBet: totalNewGameBet,
      activeUsers: totalNewGameUsers,
      topGames: newGameList,
      contribution: calculatePercentage(totalNewGameGGR, totalGGRCurrent),
      conclusion: `本期新游戏GGR达 ${formatCurrency(totalNewGameGGR)}，占比 ${calculatePercentage(totalNewGameGGR, totalGGRCurrent)}%。`
    };
    
    console.log(`🎮 新游戏GGR: ${formatCurrency(totalNewGameGGR)}, 共 ${newGameList.length} 个新游戏`);
  }
}

// 4.3 商户分析（只统计正GGR）
if (currentPeriod.merchants && Array.isArray(currentPeriod.merchants)) {
  const merchantMap = new Map();
  
  // 处理当前期商户数据（只统计正GGR）
  currentPeriod.merchants.forEach(m => {
    const ggr = parseNumber(m.totalGGRUSD || 0);
    if (ggr > 0) {
      const merchantName = m.merchantName || m.name || 'Unknown';
      merchantMap.set(merchantName, {
        name: merchantName,
        current: ggr,
        previous: 0
      });
    }
  });
  
  // 处理上期商户数据（只统计正GGR）
  if (previousPeriod?.merchants && Array.isArray(previousPeriod.merchants)) {
    previousPeriod.merchants.forEach(m => {
      const ggr = parseNumber(m.totalGGRUSD || 0);
      if (ggr > 0) {
        const merchantName = m.merchantName || m.name || 'Unknown';
        if (merchantMap.has(merchantName)) {
          merchantMap.get(merchantName).previous = ggr;
        } else {
          merchantMap.set(merchantName, {
            name: merchantName,
            current: 0,
            previous: ggr
          });
        }
      }
    });
  }
  
  const merchantList = Array.from(merchantMap.values());
  merchantList.forEach(m => {
    m.change = calculateChangeRate(m.current, m.previous);
    m.changeAmount = m.current - m.previous;
  });
  
  const totalMerchantGGR = merchantList.reduce((sum, m) => sum + m.current, 0);
  const totalMerchantGGRPrevious = merchantList.reduce((sum, m) => sum + m.previous, 0);
  
  const topGrowth = merchantList
    .filter(m => m.change && m.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
  
  const topDecline = merchantList
    .filter(m => m.change && m.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
  
  const topMerchants = merchantList
    .sort((a, b) => b.current - a.current)
    .slice(0, 5);
  
  analysisResults.analyses.merchant = {
    total: {
      current: totalMerchantGGR,
      previous: totalMerchantGGRPrevious,
      change: calculateChangeRate(totalMerchantGGR, totalMerchantGGRPrevious),
      changeAmount: totalMerchantGGR - totalMerchantGGRPrevious
    },
    topGrowth,
    topDecline,
    topMerchants,
    totalCount: merchantList.length,
    conclusion: generateMerchantConclusion(totalMerchantGGR, totalMerchantGGRPrevious, topMerchants, merchantList.length)
  };
}

// 4.4 游戏分析（只统计正GGR）
if (currentPeriod.games && Array.isArray(currentPeriod.games)) {
  const gameMap = new Map();
  
  // 处理当前期游戏数据（只统计正GGR）
  currentPeriod.games.forEach(g => {
    const ggr = parseNumber(g.totalGGRUSD || 0);
    if (ggr > 0) {
      const gameName = g.gameName || g.name || 'Unknown';
      gameMap.set(gameName, {
        name: gameName,
        current: ggr,
        previous: 0
      });
    }
  });
  
  // 处理上期游戏数据（只统计正GGR）
  if (previousPeriod?.games && Array.isArray(previousPeriod.games)) {
    previousPeriod.games.forEach(g => {
      const ggr = parseNumber(g.totalGGRUSD || 0);
      if (ggr > 0) {
        const gameName = g.gameName || g.name || 'Unknown';
        if (gameMap.has(gameName)) {
          gameMap.get(gameName).previous = ggr;
        } else {
          gameMap.set(gameName, {
            name: gameName,
            current: 0,
            previous: ggr
          });
        }
      }
    });
  }
  
  const gameList = Array.from(gameMap.values());
  gameList.forEach(g => {
    g.change = calculateChangeRate(g.current, g.previous);
    g.changeAmount = g.current - g.previous;
  });
  
  const totalGameGGR = gameList.reduce((sum, g) => sum + g.current, 0);
  const totalGameGGRPrevious = gameList.reduce((sum, g) => sum + g.previous, 0);
  
  const topGrowth = gameList
    .filter(g => g.change && g.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
  
  const topDecline = gameList
    .filter(g => g.change && g.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
  
  analysisResults.analyses.game = {
    total: {
      current: totalGameGGR,
      previous: totalGameGGRPrevious,
      change: calculateChangeRate(totalGameGGR, totalGameGGRPrevious),
      changeAmount: totalGameGGR - totalGameGGRPrevious
    },
    topGrowth,
    topDecline,
    totalCount: gameList.length,
    conclusion: generateGameConclusion(totalGameGGR, totalGameGGRPrevious, topGrowth, topDecline)
  };
}

// 4.5 投注分析
const totalBetCurrent = parseNumber(currentOverall.totalBetUSD || 0);
const totalBetPrevious = parseNumber(previousOverall?.totalBetUSD || 0);

console.log(`💰 总投注当前期: ${totalBetCurrent}, 上期: ${totalBetPrevious}`);

// 按游戏统计投注变化（用于增长/下滑来源分析）
const gameBetMap = new Map(); // gameName -> { current, previous }

if (currentPeriod.games && Array.isArray(currentPeriod.games)) {
  currentPeriod.games.forEach(game => {
    const gameName = (game.gameName || game.name || 'Unknown').trim();
    const bet = parseNumber(game.totalBetUSD || 0);
    if (!isNaN(bet) && bet > 0) {
      if (!gameBetMap.has(gameName)) {
        gameBetMap.set(gameName, { name: gameName, current: 0, previous: 0 });
      }
      gameBetMap.get(gameName).current += bet;
    }
  });
}

if (previousPeriod?.games && Array.isArray(previousPeriod.games)) {
  previousPeriod.games.forEach(game => {
    const gameName = (game.gameName || game.name || 'Unknown').trim();
    const bet = parseNumber(game.totalBetUSD || 0);
    if (!isNaN(bet) && bet > 0) {
      if (!gameBetMap.has(gameName)) {
        gameBetMap.set(gameName, { name: gameName, current: 0, previous: 0 });
      }
      gameBetMap.get(gameName).previous += bet;
    }
  });
}

// 计算每个游戏的投注变化
const gameBetList = Array.from(gameBetMap.values())
  .map(g => ({
    ...g,
    changeAmount: g.current - g.previous
  }))
  .filter(g => g.changeAmount !== 0);

const topBetGrowth = gameBetList
  .filter(g => g.changeAmount > 0)
  .sort((a, b) => b.changeAmount - a.changeAmount)
  .slice(0, 10);

const topBetDecline = gameBetList
  .filter(g => g.changeAmount < 0)
  .sort((a, b) => a.changeAmount - b.changeAmount)
  .slice(0, 10);

analysisResults.summary.betTotal = {
  total: totalBetCurrent,
  previous: totalBetPrevious,
  change: calculateChangeRate(totalBetCurrent, totalBetPrevious),
  changeAmount: totalBetCurrent - totalBetPrevious,
  topGrowth: topBetGrowth,
  topDecline: topBetDecline,
  conclusion: generateBetConclusion(totalBetCurrent, totalBetPrevious, analysisResults.summary.overallGGR.change, topBetGrowth, topBetDecline)
};

analysisResults.analyses.bet = analysisResults.summary.betTotal;

// 4.6 币种分析（只统计正GGR）
if (currentPeriod.currencies && Array.isArray(currentPeriod.currencies)) {
  const currencyMap = new Map();
  
  // 处理当前期币种数据（只统计正GGR）
  currentPeriod.currencies.forEach(c => {
    const ggr = parseNumber(c.totalGGRUSD || 0);
    if (ggr > 0) {
      const currencyCode = c.currencyCode || c.currency || c.code || 'Unknown';
      currencyMap.set(currencyCode, {
        code: currencyCode,
        current: ggr,
        previous: 0
      });
    }
  });
  
  // 处理上期币种数据（只统计正GGR）
  if (previousPeriod?.currencies && Array.isArray(previousPeriod.currencies)) {
    previousPeriod.currencies.forEach(c => {
      const ggr = parseNumber(c.totalGGRUSD || 0);
      if (ggr > 0) {
        const currencyCode = c.currencyCode || c.currency || c.code || 'Unknown';
        if (currencyMap.has(currencyCode)) {
          currencyMap.get(currencyCode).previous = ggr;
        } else {
          currencyMap.set(currencyCode, {
            code: currencyCode,
            current: 0,
            previous: ggr
          });
        }
      }
    });
  }
  
  const currencyList = Array.from(currencyMap.values());
  currencyList.forEach(c => {
    c.change = calculateChangeRate(c.current, c.previous);
    c.changeAmount = c.current - c.previous;
  });
  
  const topGrowth = currencyList
    .filter(c => c.change && c.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
  
  const topDecline = currencyList
    .filter(c => c.change && c.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
  
  analysisResults.analyses.currency = {
    topGrowth,
    topDecline,
    totalCount: currencyList.length,
    conclusion: generateCurrencyConclusion(currencyList, topGrowth, topDecline)
  };
}

// 4.7 活跃用户数分析
let totalUsersCurrent = 0;
let totalUsersPrevious = 0;

if (currentPeriod.merchantUsers && Array.isArray(currentPeriod.merchantUsers)) {
  totalUsersCurrent = currentPeriod.merchantUsers.reduce((sum, m) => sum + parseNumber(m.totalUsers || 0), 0);
}

if (previousPeriod?.merchantUsers && Array.isArray(previousPeriod.merchantUsers)) {
  totalUsersPrevious = previousPeriod.merchantUsers.reduce((sum, m) => sum + parseNumber(m.totalUsers || 0), 0);
}

console.log(`👥 活跃用户当前期: ${totalUsersCurrent}, 上期: ${totalUsersPrevious}`);

analysisResults.summary.activeUsers = {
  total: totalUsersCurrent,
  previous: totalUsersPrevious,
  change: calculateChangeRate(totalUsersCurrent, totalUsersPrevious)
};

// 4.6.5 局数分析
const totalRoundsCurrent = parseNumber(currentOverall.totalRounds || 0);
const totalRoundsPrevious = parseNumber(previousOverall?.totalRounds || 0);

// 按游戏统计局数变化
const gameRoundsMap = new Map();

if (currentPeriod.games && Array.isArray(currentPeriod.games)) {
  currentPeriod.games.forEach(game => {
    const gameName = (game.gameName || game.name || 'Unknown').trim();
    const rounds = parseNumber(game.totalRounds || 0);
    if (!isNaN(rounds) && rounds > 0) {
      if (!gameRoundsMap.has(gameName)) {
        gameRoundsMap.set(gameName, { name: gameName, current: 0, previous: 0 });
      }
      gameRoundsMap.get(gameName).current += rounds;
    }
  });
}

if (previousPeriod?.games && Array.isArray(previousPeriod.games)) {
  previousPeriod.games.forEach(game => {
    const gameName = (game.gameName || game.name || 'Unknown').trim();
    const rounds = parseNumber(game.totalRounds || 0);
    if (!isNaN(rounds) && rounds > 0) {
      if (!gameRoundsMap.has(gameName)) {
        gameRoundsMap.set(gameName, { name: gameName, current: 0, previous: 0 });
      }
      gameRoundsMap.get(gameName).previous += rounds;
    }
  });
}

const gameRoundsList = Array.from(gameRoundsMap.values())
  .map(g => ({
    ...g,
    changeAmount: g.current - g.previous
  }))
  .filter(g => g.changeAmount !== 0);

const topRoundsGrowth = gameRoundsList
  .filter(g => g.changeAmount > 0)
  .sort((a, b) => b.changeAmount - a.changeAmount)
  .slice(0, 10);

const topRoundsDecline = gameRoundsList
  .filter(g => g.changeAmount < 0)
  .sort((a, b) => a.changeAmount - b.changeAmount)
  .slice(0, 10);

const avgBet = totalRoundsCurrent > 0 && totalBetCurrent > 0
  ? totalBetCurrent / totalRoundsCurrent
  : 0;

analysisResults.analyses.rounds = {
  total: totalRoundsCurrent,
  previous: totalRoundsPrevious,
  change: calculateChangeRate(totalRoundsCurrent, totalRoundsPrevious),
  changeAmount: totalRoundsCurrent - totalRoundsPrevious,
  avgBet: avgBet,
  topGrowth: topRoundsGrowth,
  topDecline: topRoundsDecline,
  conclusion: generateRoundsConclusion(totalRoundsCurrent, totalRoundsPrevious, topRoundsGrowth, topRoundsDecline, analysisResults.summary.betTotal.change)
};

// 4.8 留存数据分析
if (currentPeriod.retention) {
  const retention = currentPeriod.retention;
  analysisResults.analyses.retention = {
    newUsers: {
      top20D1: retention.newUsersTop20D1 || retention.newUsers?.slice(0, 20) || [],
      top20D7: retention.newUsersTop20D7 || []
    },
    activeUsers: {
      top20D1: retention.activeUsersTop20D1 || retention.activeUsers?.slice(0, 20) || [],
      top20D7: retention.activeUsersTop20D7 || []
    },
    conclusion: generateRetentionConclusion(retention)
  };
}

// 生成综合结论
analysisResults.overallConclusion = generateOverallConclusion(analysisResults);

console.log("\n✅ 分析完成");
console.log(`📄 总体GGR: ${formatCurrency(analysisResults.summary.overallGGR.current)}`);
console.log(`📄 总投注: ${formatCurrency(analysisResults.summary.betTotal.total)}`);
console.log(`📄 活跃用户: ${analysisResults.summary.activeUsers.total.toLocaleString()}`);

// 构建完整的输出结构（与business-report-analyzer.js保持一致）
const outputData = {
  reportType: analysisResults.reportType,
  timestamp: analysisResults.timestamp,
  dateRanges: analysisResults.dateRanges,
  summary: {
    overallGGR: analysisResults.summary.overallGGR,
    activeUsers: analysisResults.summary.activeUsers,
    betTotal: analysisResults.summary.betTotal
  },
  analyses: {
    merchant: analysisResults.analyses.merchant || {},
    game: analysisResults.analyses.game || {},
    bet: analysisResults.analyses.bet || {},
    rounds: analysisResults.analyses.rounds || {},
    currency: analysisResults.analyses.currency || {},
    retention: analysisResults.analyses.retention || {},
    activeUsers: analysisResults.summary.activeUsers
  },
  overallConclusion: analysisResults.overallConclusion,
  rawAnalysis: analysisResults
};

// 如果有新游戏数据，添加到summary中
if (analysisResults.analyses.newGame && analysisResults.analyses.newGame.totalGGR > 0) {
  outputData.summary.newGameGGR = {
    total: analysisResults.analyses.newGame.totalGGR,
    contribution: analysisResults.analyses.newGame.contribution
  };
  outputData.summary.newGameBet = {
    total: analysisResults.analyses.newGame.totalBet,
    contribution: analysisResults.analyses.newGame.betContribution || '0'
  };
  outputData.summary.newGameActiveUsers = {
    total: analysisResults.analyses.newGame.activeUsers,
    contribution: analysisResults.analyses.newGame.activeUsersContribution || '0'
  };
  outputData.analyses.newGame = analysisResults.analyses.newGame;
}

// 返回结果
return [{
  json: outputData
}];

// ========== 辅助函数 ==========

function generateMerchantConclusion(total, previous, topMerchants, count) {
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n';
  conclusion += `- 总 GGR 由 ${formatCurrency(previous)} → ${formatCurrency(total)}，`;
  const change = calculateChangeRate(total, previous);
  if (change) {
    conclusion += `环比 ${change.display}（${total - previous > 0 ? '+' : ''}${formatCurrency(total - previous)}）。\n\n`;
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topMerchants.length > 0) {
    const topMerchantNames = topMerchants.map(m => m.name).join('、');
    conclusion += `结论\n- 本期共 ${count} 个商户活跃，Top5商户为 ${topMerchantNames}。\n`;
  }
  
  return conclusion;
}

function generateGameConclusion(total, previous, topGrowth, topDecline) {
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n';
  conclusion += `- 总 GGR 由 ${formatCurrency(previous)} → ${formatCurrency(total)}，`;
  const change = calculateChangeRate(total, previous);
  if (change) {
    conclusion += `环比 ${change.display}。\n\n`;
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth.length > 0) {
    conclusion += '主要增长游戏\n';
    topGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：由 ${formatCurrency(g.previous)} → ${formatCurrency(g.current)}，`;
      if (g.change) {
        conclusion += `环比 ${g.change.display}（${g.changeAmount > 0 ? '+' : ''}${formatCurrency(g.changeAmount)}）。\n`;
      }
    });
    conclusion += '\n';
  }
  
  return conclusion;
}

function generateBetConclusion(total, previous, ggrChange, topGrowth, topDecline) {
  let conclusion = '整体情况\n';
  conclusion += `- 总投注由 ${formatCurrency(previous)} → ${formatCurrency(total)}，`;
  const change = calculateChangeRate(total, previous);
  if (change) {
    conclusion += `环比 ${change.display}（${change.isPositive ? '+' : ''}${formatCurrency(total - previous)}）。\n`;
    
    if (ggrChange && Math.abs(change.rate) < Math.abs(ggrChange.rate)) {
      conclusion += `- 投注降幅 小于 GGR 降幅（GGR ${ggrChange.display}），说明 RTP/中奖结构波动放大了 GGR 跌幅。\n`;
    }
    conclusion += '\n';
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth && topGrowth.length > 0) {
    conclusion += '主要增长来源（按游戏，环比新增投注额）\n';
    topGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount > 0 ? '+' : ''}${formatCurrency(g.changeAmount)}\n`;
    });
    conclusion += '\n';
  }
  
  if (topDecline && topDecline.length > 0) {
    conclusion += '主要下滑来源（按游戏，环比减少投注额）\n';
    topDecline.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${formatCurrency(g.changeAmount)}\n`;
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topDecline && topDecline.length > 0) {
    conclusion += `- 投注端的主要拖累来自 ${topDecline[0]?.name || ''}等老款游戏的显著回撤。\n`;
  }
  if (topGrowth && topGrowth.length > 0) {
    conclusion += `- ${topGrowth[0]?.name || ''}等少数项目对投注有正向拉动，但不足以对冲头部老游下滑。\n`;
  }
  
  return conclusion;
}

function generateRoundsConclusion(total, previous, topGrowth, topDecline, betChange) {
  let conclusion = '整体情况\n';
  conclusion += `- 总局数由 ${previous.toLocaleString()} 局 → ${total.toLocaleString()} 局，`;
  const change = calculateChangeRate(total, previous);
  if (change) {
    const changeAmount = total - previous;
    conclusion += `环比 ${change.display}（${change.isPositive ? '+' : ''}${changeAmount.toLocaleString()} 局）。\n`;
    
    if (betChange && Math.abs(change.rate) < Math.abs(betChange.rate)) {
      conclusion += `- 局数降幅 小于 投注降幅与 GGR 降幅，显示活跃度回落相对温和，单局平均投注与赔付结构的变化更影响产出。\n`;
    }
    conclusion += '\n';
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth && topGrowth.length > 0) {
    conclusion += '主要增长来源（按游戏，环比新增局数）\n';
    topGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount > 0 ? '+' : ''}${g.changeAmount.toLocaleString()}\n`;
    });
    conclusion += '\n';
  }
  
  if (topDecline && topDecline.length > 0) {
    conclusion += '主要下滑来源（按游戏，环比减少局数）\n';
    topDecline.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount.toLocaleString()}\n`;
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topDecline && topDecline.length > 0) {
    conclusion += `- 活跃度的主要下滑来自 ${topDecline[0]?.name || ''}${topDecline.length > 1 ? ` / ${topDecline[1]?.name || ''}` : ''}${topDecline.length > 2 ? ` / ${topDecline[2]?.name || ''}` : ''}。\n`;
  }
  if (topGrowth && topGrowth.length > 0) {
    const minesGames = topGrowth.filter(g => g.name.toLowerCase().includes('mines'));
    if (minesGames.length > 0) {
      conclusion += `- Mines 系列（${minesGames.map(g => g.name).join('、')}）局数逆势增长，表明矿类玩法仍具用户粘性。\n`;
    }
  }
  
  return conclusion;
}

function generateCurrencyConclusion(currencyList, topGrowth, topDecline) {
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n\n';
  
  if (topGrowth.length > 0) {
    conclusion += '主要增长币种\n';
    topGrowth.slice(0, 5).forEach(c => {
      conclusion += `- ${c.code}：由 ${formatCurrency(c.previous)} → ${formatCurrency(c.current)}，`;
      if (c.change) {
        conclusion += `环比 ${c.change.display}。\n`;
      }
    });
    conclusion += '\n';
  }
  
  if (topDecline.length > 0) {
    const coreCurrencies = topDecline.filter(c => 
      ['MXN', 'BRL', 'PHP', 'USD', 'EUR'].includes(c.code)
    );
    if (coreCurrencies.length > 0) {
      conclusion += `结论\n- 核心币种（${coreCurrencies.map(c => c.code).join('、')}）全面下滑，是总下跌主因。\n`;
    }
  }
  
  return conclusion;
}

function generateRetentionConclusion(retention) {
  let conclusion = '用户留存分析：';
  
  if (retention.newUsers && retention.newUsers.length > 0) {
    const avgD1 = retention.newUsers.reduce((sum, r) => sum + (r.d1Retention || 0), 0) / retention.newUsers.length;
    const avgD7 = retention.newUsers.reduce((sum, r) => sum + (r.d7Retention || 0), 0) / retention.newUsers.length;
    conclusion += `新用户次留达${avgD1.toFixed(1)}%，7日留存${avgD7.toFixed(1)}%，`;
  }
  
  conclusion += '初期吸引力足但长期粘性有待提升。';
  
  return conclusion;
}

function generateOverallConclusion(analysis) {
  let conclusion = `总体表现分析：\n\n`;
  conclusion += `本期整体GGR ${analysis.summary.overallGGR.change 
    ? analysis.summary.overallGGR.change.display 
    : formatCurrency(analysis.summary.overallGGR.current)}${analysis.summary.overallGGR.change && !analysis.summary.overallGGR.change.isPositive ? '，主要由老游戏下滑导致。' : '。'}\n\n`;
  
  if (analysis.analyses.newGame && analysis.analyses.newGame.totalGGR > 0) {
    conclusion += `新游戏贡献 ${formatCurrency(analysis.analyses.newGame.totalGGR)}（占比${analysis.analyses.newGame.contribution}%）。\n\n`;
  }
  
  if (analysis.analyses.merchant && analysis.analyses.merchant.conclusion) {
    conclusion += `${analysis.analyses.merchant.conclusion}\n\n`;
  }
  
  if (analysis.analyses.betTotal && analysis.analyses.betTotal.conclusion) {
    conclusion += `${analysis.analyses.betTotal.conclusion}\n\n`;
  }
  
  if (analysis.analyses.currency && analysis.analyses.currency.conclusion) {
    conclusion += `${analysis.analyses.currency.conclusion}\n\n`;
  }
  
  if (analysis.analyses.retention && analysis.analyses.retention.conclusion) {
    conclusion += `${analysis.analyses.retention.conclusion}\n\n`;
  }
  
  conclusion += `改进建议：优化高RTP区间控制、丰富新游戏长期循环机制、关注新兴市场导流。`;
  
  return conclusion;
}

