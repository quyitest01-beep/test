// n8n Code节点：Lark周期数据统计处理器（含新游戏分析）- 优化版
// 功能：基于Lark表格数据，从每个sheet首行提取周期信息，按周期分组统计各类数据，并分析新游戏
// 优化：支持月度格式、改进周期提取、增强错误处理、提升性能

const inputs = $input.all();
console.log("=== Lark周期数据统计处理器开始（优化版） ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 步骤0：检测并提取新游戏列表（第一个元素）
let newGameList = [];
let dataStartIndex = 0;

if (inputs.length > 0 && inputs[0].json) {
  const firstItem = inputs[0].json;
  // 检查是否是新游戏列表格式（包含 english_name 和 release_date）
  if (firstItem.english_name && firstItem.release_date) {
    // 单个新游戏对象
    newGameList.push({
      english_name: String(firstItem.english_name).trim(),
      release_date: String(firstItem.release_date).trim()
    });
    dataStartIndex = 1;
    console.log(`🎮 检测到新游戏列表: ${newGameList[0].english_name} (${newGameList[0].release_date})`);
  } else if (Array.isArray(firstItem) && firstItem.length > 0 && firstItem[0].english_name && firstItem[0].release_date) {
    // 新游戏列表数组
    newGameList = firstItem.map(game => ({
      english_name: String(game.english_name || '').trim(),
      release_date: String(game.release_date || '').trim()
    })).filter(game => game.english_name && game.release_date);
    dataStartIndex = 1;
    console.log(`🎮 检测到新游戏列表: ${newGameList.length} 个新游戏`);
    newGameList.forEach(game => {
      console.log(`  - ${game.english_name} (${game.release_date})`);
    });
  }
}

// 创建新游戏名称映射（小写，用于匹配）
const newGameNameMap = new Map();
newGameList.forEach(game => {
  const lowerName = game.english_name.toLowerCase().trim();
  if (lowerName) {
    newGameNameMap.set(lowerName, game.english_name.trim());
  }
});

// 工具函数：解析数值（增强版）
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (typeof value === 'string') {
    // 移除常见的格式化字符（千分位、货币符号等）
    const cleaned = value.toString().replace(/[$,，\s]/g, '');
    const num = parseFloat(cleaned);
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

// 工具函数：格式化货币（千分位）
function formatCurrency(value) {
  if (!value || value === 0) return '0';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// 工具函数：获取月份的最后一天
function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 工具函数：从首行提取周期信息（增强版，支持周度和月度格式）
// 支持的格式：
// 1. 周度格式："20251020-1026游戏活跃用户数" -> "20251020-1026"
// 2. 月度格式："202510月游戏活跃用户数" -> "202510"
// 3. 月度格式："202510月" -> "202510"
function extractPeriodFromFirstRow(firstRow) {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length === 0) {
    return null;
  }
  
  // 检查第一个单元格
  const firstCell = firstRow[0];
  if (!firstCell || typeof firstCell !== 'string') {
    return null;
  }
  
  const cellStr = firstCell.trim();
  
  // 模式1：周度格式 - 20251020-1026 或 20251020-1102
  // 格式：8位数字-4位数字（可能后面还有文字）
  const weeklyMatch = cellStr.match(/(\d{8})[-\s]+(\d{4})/);
  if (weeklyMatch) {
    const startStr = weeklyMatch[1]; // "20251020"
    const endStr = weeklyMatch[2]; // "1026" 或 "1102"
    
    // 解析开始日期
    const startYear = parseInt(startStr.substring(0, 4));
    const startMonth = parseInt(startStr.substring(4, 6));
    const startDay = parseInt(startStr.substring(6, 8));
    
    // 解析结束日期（4位数字，前2位是月份，后2位是日期）
    const endMonth = parseInt(endStr.substring(0, 2));
    const endDay = parseInt(endStr.substring(2, 4));
    
    // 判断是否跨月或跨年
    let endYear = startYear;
    if (endMonth < startMonth) {
      // 跨年（如12月到1月）
      endYear = startYear + 1;
    } else if (endMonth === startMonth && endDay < startDay) {
      // 同月但结束日期小于开始日期，可能是跨年
      endYear = startYear + 1;
    }
    
    const period = `${startStr}-${endStr}`;
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    // 格式化显示：10.20-10.26
    const startDisplay = `${String(startMonth).padStart(2, '0')}.${String(startDay).padStart(2, '0')}`;
    const endDisplay = `${String(endMonth).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`;
    
    return {
      period: period,
      periodType: 'weekly',
      startDate: startDate,
      endDate: endDate,
      display: `${startDate} 至 ${endDate}`,
      displayShort: `${startDisplay}-${endDisplay}`
    };
  }
  
  // 模式2：月度格式 - 202510月 或 202510
  // 格式：6位数字（YYYYMM）或 6位数字+月
  const monthlyMatch = cellStr.match(/(\d{4})(\d{2})月?/);
  if (monthlyMatch) {
    const year = parseInt(monthlyMatch[1]);
    const month = parseInt(monthlyMatch[2]);
    
    // 计算月份的开始和结束日期
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = getLastDayOfMonth(year, month);
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const period = `${year}${String(month).padStart(2, '0')}`;
    const displayShort = `${year}${String(month).padStart(2, '0')}月`;
    
    return {
      period: period,
      periodType: 'monthly',
      startDate: startDate,
      endDate: endDate,
      display: `${startDate} 至 ${endDate}`,
      displayShort: displayShort
    };
  }
  
  // 模式3：尝试匹配纯数字格式 YYYYMM
  const pureNumberMatch = cellStr.match(/^(\d{4})(\d{2})/);
  if (pureNumberMatch) {
    const year = parseInt(pureNumberMatch[1]);
    const month = parseInt(pureNumberMatch[2]);
    
    if (month >= 1 && month <= 12) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = getLastDayOfMonth(year, month);
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const period = `${year}${String(month).padStart(2, '0')}`;
      const displayShort = `${year}${String(month).padStart(2, '0')}月`;
      
      return {
        period: period,
        periodType: 'monthly',
        startDate: startDate,
        endDate: endDate,
        display: `${startDate} 至 ${endDate}`,
        displayShort: displayShort
      };
    }
  }
  
  return null;
}

// 工具函数：智能检测表头行（增强版）
// 注意：首行通常是周期信息（如"20251020-1026游戏活跃用户数"或"202510月游戏活跃用户数"），表头通常在第二行或第三行
function detectHeaderRow(values) {
  if (!values || values.length === 0) return null;
  
  const commonHeaderFields = ['游戏名', '日期', '商户名', 'GGR-USD', '总投注USD', '总局数', '货币', '总派奖USD', '投注用户数'];
  const commonHeaderFieldsEn = ['game_name', 'date', 'merchant_name', 'ggr', 'bet_amount', 'rounds', 'currency', 'payout', 'users', 'active_users'];
  
  // 检查第一行（可能是周期信息行）
  if (values.length > 0 && Array.isArray(values[0])) {
    const row0Str = values[0].map(cell => String(cell || '')).join('|').toLowerCase();
    
    // 如果第一行包含周期格式（周度或月度），则跳过
    const hasWeeklyFormat = /\d{8}[-\s]+\d{4}/.test(row0Str);
    const hasMonthlyFormat = /\d{4}\d{2}月?/.test(row0Str);
    
    if (!hasWeeklyFormat && !hasMonthlyFormat) {
      // 第一行不包含周期格式，检查是否是表头
      const hasHeaderFields0 = commonHeaderFields.some(field => row0Str.includes(field.toLowerCase())) ||
                               commonHeaderFieldsEn.some(field => row0Str.includes(field.toLowerCase()));
      
      if (hasHeaderFields0) {
        return { headerRowIndex: 0, dataStartIndex: 1 };
      }
    }
  }
  
  // 检查第二行（通常是表头）
  if (values.length > 1 && Array.isArray(values[1])) {
    const row1Str = values[1].map(cell => String(cell || '')).join('|').toLowerCase();
    const hasHeaderFields1 = commonHeaderFields.some(field => row1Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row1Str.includes(field.toLowerCase()));
    
    if (hasHeaderFields1) {
      return { headerRowIndex: 1, dataStartIndex: 2 };
    }
  }
  
  // 检查第三行（如果前两行都不是表头）
  if (values.length > 2 && Array.isArray(values[2])) {
    const row2Str = values[2].map(cell => String(cell || '')).join('|').toLowerCase();
    const hasHeaderFields2 = commonHeaderFields.some(field => row2Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row2Str.includes(field.toLowerCase()));
    
    if (hasHeaderFields2) {
      return { headerRowIndex: 2, dataStartIndex: 3 };
    }
  }
  
  // 默认第二行为表头（如果第一行是周期信息）
  return { headerRowIndex: 1, dataStartIndex: 2 };
}

// 步骤1：解析Lark数据，提取周期信息并解析数据
const periodData = {};
let processedSheets = 0;
let skippedSheets = 0;

// 从 dataStartIndex 开始处理（跳过新游戏列表）
for (let index = dataStartIndex; index < inputs.length; index++) {
  const input = inputs[index];
  const item = input.json;
  
  // 检查是否有Lark表格原始数据（values数组）
  if (!item || !item.data || !item.data.valueRange || !item.data.valueRange.values || !Array.isArray(item.data.valueRange.values)) {
    console.warn(`⚠️ [Sheet ${index}] 跳过非Lark表格数据`);
    skippedSheets++;
    continue;
  }
  
  const values = item.data.valueRange.values;
  if (values.length === 0) {
    console.warn(`⚠️ [Sheet ${index}] 跳过空表格`);
    skippedSheets++;
    continue;
  }
  
  // 从首行提取周期信息
  const periodInfo = extractPeriodFromFirstRow(values[0]);
  if (!periodInfo) {
    console.warn(`⚠️ [Sheet ${index}] 无法从首行提取周期信息: ${values[0] ? String(values[0][0] || '').substring(0, 50) : '空'}`);
    skippedSheets++;
    continue;
  }
  
  const periodKey = periodInfo.period;
  console.log(`📅 [Sheet ${index}] 识别周期: ${periodKey} (${periodInfo.displayShort}, ${periodInfo.periodType})`);
  
  // 初始化周期数据
  if (!periodData[periodKey]) {
    periodData[periodKey] = {
      periodInfo: periodInfo,
      items: []
    };
  }
  
  // 检测表头行
  const headerInfo = detectHeaderRow(values);
  if (!headerInfo) {
    console.warn(`⚠️ [Sheet ${index}] 无法检测表头行`);
    skippedSheets++;
    continue;
  }
  
  const headers = values[headerInfo.headerRowIndex];
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    console.warn(`⚠️ [Sheet ${index}] 表头行为空`);
    skippedSheets++;
    continue;
  }
  
  // 解析数据行
  let rowCount = 0;
  for (let i = headerInfo.dataStartIndex; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row) || row.length === 0) {
      continue;
    }
    
    // 跳过空行（第一列为空）
    if (row[0] === null || row[0] === undefined || row[0] === '') {
      continue;
    }
    
    // 构建数据对象
    const rowObj = {};
    headers.forEach((header, colIndex) => {
      if (header && typeof header === 'string' && header.trim()) {
        const value = row[colIndex];
        if (value !== null && value !== undefined && value !== '') {
          rowObj[header.trim()] = value;
        }
      }
    });
    
    // 只保留有商户名或游戏名的记录
    if (rowObj['商户名'] || rowObj['游戏名'] || rowObj['merchant_name'] || rowObj['game_name']) {
      periodData[periodKey].items.push(rowObj);
      rowCount++;
    }
  }
  
  console.log(`  ✅ 解析出 ${rowCount} 条数据记录`);
  processedSheets++;
}

console.log(`\n📊 共识别 ${Object.keys(periodData).length} 个周期`);
console.log(`📊 成功处理 ${processedSheets} 个sheet，跳过 ${skippedSheets} 个sheet`);

// 步骤2：按周期统计各类数据（包含新游戏分析）
function calculateStatistics(items, newGameNameMap) {
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
    // 5. 各商户总投注用户数（日期="合计"）
    merchantUsers: {},
    // 6. 各游戏总投注用户数（日期="合计"）
    gameUsers: {},
    // 7. 新游戏分析数据
    newGames: {}
  };
  
  // 优化：使用 Map 来存储临时数据，提高性能
  const merchantMap = new Map();
  const gameMap = new Map();
  const currencyMap = new Map();
  const merchantUserMap = new Map();
  const gameUserMap = new Map();
  
  items.forEach(item => {
    const gameName = String(item.游戏名 || item.game_name || '').trim();
    const merchantName = String(item.商户名 || item.merchant_name || '').trim();
    const currency = String(item.货币 || item.currency || item.currency_code || '').trim();
    const date = String(item.日期 || item.date || item.report_date || '').trim();
    
    // 解析数值（优化：支持更多字段名变体）
    const ggrUSD = parseNumber(item['GGR-USD'] || item['GGR_USD'] || item['ggr-usd'] || item['ggr_usd'] || item.GGR || item.ggr || 0);
    const betUSD = parseNumber(item['总投注USD'] || item['总投注'] || item['bet_amount'] || item['total_bet'] || item.bet || 0);
    const payoutUSD = parseNumber(item['总派奖USD'] || item['总派奖'] || item['payout_amount'] || item['total_payout'] || item.payout || 0);
    const rounds = parseNumber(item.总局数 || item.rounds || item.round_count || 0);
    const users = parseNumber(item['投注用户数'] || item['投注用户'] || item.users || item.active_users || item.total_users || 0);
    
    // 处理投注用户数（日期="合计"）
    if (date === '合计' || date === 'Total' || date === '总计') {
      // 各商户总投注用户数（日期="合计"，有商户名）
      if (merchantName) {
        if (!merchantUserMap.has(merchantName)) {
          merchantUserMap.set(merchantName, 0);
        }
        merchantUserMap.set(merchantName, merchantUserMap.get(merchantName) + users);
      }
      
      // 各游戏总投注用户数（日期="合计"，有游戏名）
      if (gameName && gameName !== '合计' && gameName !== 'Total') {
        if (!gameUserMap.has(gameName)) {
          gameUserMap.set(gameName, 0);
        }
        gameUserMap.set(gameName, gameUserMap.get(gameName) + users);
      }
    }
    
    // 1. 总体数据（只统计游戏名="合计"）
    if (gameName === '合计' || gameName === 'Total') {
      result.overall.totalGGRUSD += ggrUSD;
      result.overall.totalBetUSD += betUSD;
      result.overall.totalPayoutUSD += payoutUSD;
      result.overall.totalRounds += rounds;
      
      // 2. 各商户数据（游戏名="合计"）
      if (merchantName) {
        if (!merchantMap.has(merchantName)) {
          merchantMap.set(merchantName, {
            merchantName: merchantName,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          });
        }
        const merchant = merchantMap.get(merchantName);
        merchant.totalGGRUSD += ggrUSD;
        merchant.totalBetUSD += betUSD;
        merchant.totalPayoutUSD += payoutUSD;
        merchant.totalRounds += rounds;
      }
    } else {
      // 3. 各游戏数据（游戏名!="合计"）
      if (gameName) {
        if (!gameMap.has(gameName)) {
          gameMap.set(gameName, {
            gameName: gameName,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          });
        }
        const game = gameMap.get(gameName);
        game.totalGGRUSD += ggrUSD;
        game.totalBetUSD += betUSD;
        game.totalPayoutUSD += payoutUSD;
        game.totalRounds += rounds;
      }
      
      // 4. 各币种数据（游戏名!="合计"）
      if (currency) {
        if (!currencyMap.has(currency)) {
          currencyMap.set(currency, {
            currency: currency,
            totalGGRUSD: 0,
            totalBetUSD: 0,
            totalPayoutUSD: 0,
            totalRounds: 0,
            totalRTP: 0
          });
        }
        const curr = currencyMap.get(currency);
        curr.totalGGRUSD += ggrUSD;
        curr.totalBetUSD += betUSD;
        curr.totalPayoutUSD += payoutUSD;
        curr.totalRounds += rounds;
      }
      
      // 7. 新游戏分析（只统计正GGR）
      if (gameName && ggrUSD > 0 && newGameNameMap && newGameNameMap.size > 0) {
        const gameNameLower = gameName.toLowerCase().trim();
        // 检查是否匹配新游戏列表中的游戏名（大小写不敏感）
        if (newGameNameMap.has(gameNameLower)) {
          const newGameKey = newGameNameMap.get(gameNameLower);
          
          if (!result.newGames[newGameKey]) {
            result.newGames[newGameKey] = {
              gameName: newGameKey,
              merchantGGR: {}, // 按商户聚合GGR
              currencyGGR: {}  // 按币种聚合GGR
            };
          }
          
          // 按商户聚合新游戏GGR
          if (merchantName) {
            if (!result.newGames[newGameKey].merchantGGR[merchantName]) {
              result.newGames[newGameKey].merchantGGR[merchantName] = 0;
            }
            result.newGames[newGameKey].merchantGGR[merchantName] += ggrUSD;
          }
          
          // 按币种聚合新游戏GGR
          if (currency) {
            if (!result.newGames[newGameKey].currencyGGR[currency]) {
              result.newGames[newGameKey].currencyGGR[currency] = 0;
            }
            result.newGames[newGameKey].currencyGGR[currency] += ggrUSD;
          }
        }
      }
    }
  });
  
  // 计算总体RTP
  result.overall.totalRTP = calculateRTP(result.overall.totalPayoutUSD, result.overall.totalBetUSD);
  
  // 将 Map 转换为数组并计算RTP
  result.merchants = Array.from(merchantMap.values()).map(merchant => {
    merchant.totalRTP = calculateRTP(merchant.totalPayoutUSD, merchant.totalBetUSD);
    return merchant;
  });
  
  result.games = Array.from(gameMap.values()).map(game => {
    game.totalRTP = calculateRTP(game.totalPayoutUSD, game.totalBetUSD);
    return game;
  });
  
  result.currencies = Array.from(currencyMap.values()).map(curr => {
    curr.totalRTP = calculateRTP(curr.totalPayoutUSD, curr.totalBetUSD);
    return curr;
  });
  
  result.merchantUsers = Array.from(merchantUserMap.entries()).map(([name, users]) => ({
    merchantName: name,
    totalUsers: users
  }));
  
  result.gameUsers = Array.from(gameUserMap.entries()).map(([name, users]) => ({
    gameName: name,
    totalUsers: users
  }));
  
  // 处理新游戏分析：生成Top 5排行
  Object.keys(result.newGames).forEach(gameName => {
    const newGame = result.newGames[gameName];
    
    // 生成商户Top 5排行
    const merchantEntries = Object.entries(newGame.merchantGGR)
      .map(([name, ggr]) => ({ name, ggr }))
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5);
    
    newGame.topMerchants = merchantEntries.map(item => ({
      merchantName: item.name,
      ggrUSD: item.ggr,
      ggrUSDFormatted: formatCurrency(item.ggr)
    }));
    
    // 生成币种Top 5排行
    const currencyEntries = Object.entries(newGame.currencyGGR)
      .map(([name, ggr]) => ({ name, ggr }))
      .sort((a, b) => b.ggr - a.ggr)
      .slice(0, 5);
    
    newGame.topCurrencies = currencyEntries.map(item => ({
      currency: item.name,
      ggrUSD: item.ggr,
      ggrUSDFormatted: formatCurrency(item.ggr)
    }));
    
    // 删除临时聚合数据
    delete newGame.merchantGGR;
    delete newGame.currencyGGR;
  });
  
  result.newGames = Object.values(result.newGames);
  
  return result;
}

// 步骤3：为每个周期生成统计结果
const output = {
  newGameList: newGameList, // 输出新游戏列表
  periods: []
};

// 按周期排序（周度优先，然后按时间排序）
const sortedPeriods = Object.keys(periodData).sort((a, b) => {
  const periodA = periodData[a].periodInfo;
  const periodB = periodData[b].periodInfo;
  
  // 周度格式优先
  if (periodA.periodType === 'weekly' && periodB.periodType === 'monthly') return -1;
  if (periodA.periodType === 'monthly' && periodB.periodType === 'weekly') return 1;
  
  // 按开始日期排序
  return periodA.startDate.localeCompare(periodB.startDate);
});

sortedPeriods.forEach(periodKey => {
  const periodInfo = periodData[periodKey].periodInfo;
  const items = periodData[periodKey].items;
  
  console.log(`\n📊 处理周期: ${periodKey} (${periodInfo.periodType})`);
  console.log(`  数据条数: ${items.length}`);
  
  // 计算统计数据（传入新游戏名称映射）
  const stats = calculateStatistics(items, newGameNameMap);
  
  // 构建输出
  const periodOutput = {
    period: periodKey,
    periodType: periodInfo.periodType,
    periodDisplay: periodInfo.displayShort,
    periodFull: periodInfo.display,
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate,
    // 1. 总体数据
    overall: {
      totalGGRUSD: stats.overall.totalGGRUSD,
      totalBetUSD: stats.overall.totalBetUSD,
      totalPayoutUSD: stats.overall.totalPayoutUSD,
      totalRounds: stats.overall.totalRounds,
      totalRTP: stats.overall.totalRTP,
      totalRTPFormatted: formatPercentage(stats.overall.totalRTP)
    },
    // 2. 各商户数据
    merchants: stats.merchants.map(m => ({
      ...m,
      totalRTPFormatted: formatPercentage(m.totalRTP)
    })),
    // 3. 各游戏数据
    games: stats.games.map(g => ({
      ...g,
      totalRTPFormatted: formatPercentage(g.totalRTP)
    })),
    // 4. 各币种数据
    currencies: stats.currencies.map(c => ({
      ...c,
      totalRTPFormatted: formatPercentage(c.totalRTP)
    })),
    // 5. 各商户总投注用户数
    merchantUsers: stats.merchantUsers,
    // 6. 各游戏总投注用户数
    gameUsers: stats.gameUsers,
    // 7. 新游戏分析
    newGames: stats.newGames.map(ng => ({
      gameName: ng.gameName,
      topMerchants: ng.topMerchants, // Top 5商户排行
      topCurrencies: ng.topCurrencies // Top 5币种排行
    }))
  };
  
  output.periods.push(periodOutput);
  
  console.log(`  总体GGR-USD: ${stats.overall.totalGGRUSD.toFixed(2)}`);
  console.log(`  商户数: ${stats.merchants.length}`);
  console.log(`  游戏数: ${stats.games.length}`);
  console.log(`  币种数: ${stats.currencies.length}`);
  console.log(`  商户用户数统计: ${stats.merchantUsers.length} 个商户`);
  console.log(`  游戏用户数统计: ${stats.gameUsers.length} 个游戏`);
  
  // 输出新游戏分析结果
  if (stats.newGames.length > 0) {
    console.log(`  🎮 新游戏分析: ${stats.newGames.length} 个新游戏`);
    stats.newGames.forEach(ng => {
      console.log(`    - ${ng.gameName}:`);
      if (ng.topMerchants.length > 0) {
        console.log(`      主要平台: ${ng.topMerchants.map(m => `${m.merchantName}(${m.ggrUSDFormatted})`).join(', ')}`);
      }
      if (ng.topCurrencies.length > 0) {
        console.log(`      主要币种: ${ng.topCurrencies.map(c => `${c.currency}(${c.ggrUSDFormatted})`).join(', ')}`);
      }
    });
  }
});

console.log(`\n✅ 处理完成，共 ${output.periods.length} 个周期`);

// 返回输出结果
return [{
  json: output
}];

