// n8n Code节点：Lark周期数据统计处理器（修复版）
// 功能：基于Lark表格数据，从每个sheet首行提取周期信息，按周期分组统计各类数据

const inputs = $input.all();
console.log("=== Lark周期数据统计处理器开始 ===");
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

// 工具函数：从首行提取周期信息（支持周度与月度）
function extractPeriodFromFirstRow(firstRow) {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length === 0) {
    return null;
  }
  
  const firstCell = firstRow[0];
  if (!firstCell || typeof firstCell !== 'string') {
    return null;
  }
  
  // 1) 周度匹配：20251020-1026 或 20251020-1102 等
  const weeklyMatch = firstCell.match(/(\d{8})[-\s]+(\d{4})/);
  if (weeklyMatch) {
    const startStr = weeklyMatch[1];
    const endStr = weeklyMatch[2];
    
    const startYear = parseInt(startStr.substring(0, 4));
    const startMonth = parseInt(startStr.substring(4, 6));
    const startDay = parseInt(startStr.substring(6, 8));
    
    const endMonth = parseInt(endStr.substring(0, 2));
    const endDay = parseInt(endStr.substring(2, 4));
    
    let endYear = startYear;
    if (endMonth < startMonth) {
      endYear = startYear + 1;
    } else if (endMonth === startMonth && endDay < startDay) {
      endYear = startYear + 1;
    }
    
    const period = `${startStr}-${endStr}`;
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    const startDisplay = `${String(startMonth).padStart(2, '0')}.${String(startDay).padStart(2, '0')}`;
    const endDisplay = `${String(endMonth).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`;
    
    return {
      period: period,
      startDate: startDate,
      endDate: endDate,
      display: `${startDate} 至 ${endDate}`,
      displayShort: `${startDisplay}-${endDisplay}`
    };
  }
  
  // 2) 月度匹配：YYYY/MM 或 YYYY-MM 或 YYYYMM 或 YYYY年MM月
  let y, m;
  let monthMatch = firstCell.match(/(\d{4})[\/\-](\d{1,2})/);
  if (monthMatch) {
    y = parseInt(monthMatch[1], 10);
    m = parseInt(monthMatch[2], 10);
  }
  if (!y) {
    const yyyymm = firstCell.match(/(\d{4})(\d{2})/);
    if (yyyymm) {
      y = parseInt(yyyymm[1], 10);
      m = parseInt(yyyymm[2], 10);
    }
  }
  if (!y) {
    const zh = firstCell.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (zh) {
      y = parseInt(zh[1], 10);
      m = parseInt(zh[2], 10);
    }
  }
  if (y && m && m >= 1 && m <= 12) {
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const period = `${y}${String(m).padStart(2, '0')}01-${y}${String(m).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    const startDisplay = `${String(m).padStart(2, '0')}.01`;
    const endDisplay = `${String(m).padStart(2, '0')}.${String(lastDay).padStart(2, '0')}`;
    return {
      period: period,
      startDate: startDate,
      endDate: endDate,
      display: `${startDate} 至 ${endDate}`,
      displayShort: `${startDisplay}-${endDisplay}`
    };
  }
  
  return null;
}

// 工具函数：智能检测表头行
function detectHeaderRow(values) {
  if (!values || values.length === 0) return null;
  
  const commonHeaderFields = ['游戏名', '日期', '商户名', 'GGR-USD', '总投注USD', '总局数', '货币', '总派奖USD', '投注用户数'];
  const commonHeaderFieldsEn = ['game_name', 'date', 'merchant_name', 'ggr', 'bet_amount', 'rounds', 'currency', 'payout', 'users'];
  
  // 检查第一行
  if (values.length > 0 && Array.isArray(values[0])) {
    const row0Str = values[0].map(cell => String(cell || '')).join('|').toLowerCase();
    const hasPeriodFormat = /\d{8}[-\s]+\d{4}/.test(row0Str) || /\d{4}年\d{1,2}月/.test(row0Str) || /\d{4}[\/\-]\d{1,2}/.test(row0Str);
    
    if (!hasPeriodFormat) {
      const hasHeaderFields0 = commonHeaderFields.some(field => row0Str.includes(field.toLowerCase())) ||
                               commonHeaderFieldsEn.some(field => row0Str.includes(field.toLowerCase()));
      
      if (hasHeaderFields0) {
        return { headerRowIndex: 0, dataStartIndex: 1 };
      }
    }
  }
  
  // 检查第二行
  if (values.length > 1 && Array.isArray(values[1])) {
    const row1Str = values[1].map(cell => String(cell || '')).join('|').toLowerCase();
    const hasHeaderFields1 = commonHeaderFields.some(field => row1Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row1Str.includes(field.toLowerCase()));
    
    if (hasHeaderFields1) {
      return { headerRowIndex: 1, dataStartIndex: 2 };
    }
  }
  
  // 检查第三行
  if (values.length > 2 && Array.isArray(values[2])) {
    const row2Str = values[2].map(cell => String(cell || '')).join('|').toLowerCase();
    const hasHeaderFields2 = commonHeaderFields.some(field => row2Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row2Str.includes(field.toLowerCase()));
    
    if (hasHeaderFields2) {
      return { headerRowIndex: 2, dataStartIndex: 3 };
    }
  }
  
  return { headerRowIndex: 1, dataStartIndex: 2 };
}

// 步骤1：解析Lark数据，提取周期信息并解析数据
const periodData = {};

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 检查是否有Lark表格原始数据
  if (!item.data || !item.data.valueRange || !item.data.valueRange.values || !Array.isArray(item.data.valueRange.values)) {
    console.warn(`⚠️ 跳过非Lark表格数据: ${index}`);
    return;
  }
  
  const values = item.data.valueRange.values;
  if (values.length === 0) {
    console.warn(`⚠️ 跳过空表格: ${index}`);
    return;
  }
  
  // 从首行提取周期信息
  const periodInfo = extractPeriodFromFirstRow(values[0]);
  if (!periodInfo) {
    console.warn(`⚠️ 无法从首行提取周期信息: ${values[0] ? values[0][0] : '空'}`);
    return;
  }
  
  const periodKey = periodInfo.period;
  console.log(`📅 识别周期: ${periodKey} (${periodInfo.display})`);
  
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
    console.warn(`⚠️ 无法检测表头行: ${index}`);
    return;
  }
  
  const headers = values[headerInfo.headerRowIndex];
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    console.warn(`⚠️ 表头行为空: ${index}`);
    return;
  }
  
  // 🔍 调试：打印表头字段
  console.log(`  📋 表头字段: ${headers.filter(h => h && typeof h === 'string').join(', ')}`);
  
  // 解析数据行
  let dataCount = 0;
  for (let i = headerInfo.dataStartIndex; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row) || row.length === 0) {
      continue;
    }
    
    // 跳过空行（第一列为空）
    if (!row[0]) {
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
      dataCount++;
      
      // 🔍 调试：打印前3条数据的所有字段
      if (dataCount <= 3) {
        console.log(`  🔍 示例数据 ${dataCount}:`, Object.keys(rowObj).join(', '));
      }
    }
  }
  
  console.log(`  ✅ 解析出 ${periodData[periodKey].items.length} 条数据记录`);
});

console.log(`\n📊 共识别 ${Object.keys(periodData).length} 个周期`);

// 步骤2：按周期统计各类数据
function calculateStatistics(items) {
  const result = {
    overall: {
      totalGGRUSD: 0,
      totalBetUSD: 0,
      totalPayoutUSD: 0,
      totalRounds: 0,
      totalRTP: 0
    },
    merchants: {},
    games: {},
    currencies: {},
    merchantUsers: {},
    gameUsers: {}
  };
  
  // 🔍 调试：统计字段出现情况
  const fieldStats = {
    hasGGR: 0,
    hasBet: 0,
    hasPayout: 0,
    hasRounds: 0,
    hasUsers: 0,
    totalItems: items.length
  };
  
  items.forEach((item, idx) => {
    const gameName = String(item.游戏名 || item.game_name || '').trim();
    const merchantName = String(item.商户名 || item.merchant_name || '').trim();
    const currency = String(item.货币 || item.currency || item.currency_code || '').trim();
    const date = String(item.日期 || item.date || item.report_date || '').trim();
    
    // 🔍 调试：检查字段是否存在
    const allKeys = Object.keys(item);
    if (idx < 3) {
      console.log(`  🔍 数据项 ${idx + 1} 的所有字段:`, allKeys.join(', '));
    }
    
    // 解析数值 - 尝试多种字段名变体
    const ggrUSD = parseNumber(
      item['GGR-USD'] || item['GGR_USD'] || item['ggr-usd'] || item['ggr_usd'] || 
      item['GGR'] || item['ggr'] || item['GGR USD'] || item['GGR(USD)'] || 0
    );
    const betUSD = parseNumber(
      item['总投注USD'] || item['总投注'] || item['bet_amount'] || item['bet-amount'] ||
      item['total_bet'] || item['totalBet'] || item['总投注(USD)'] || item['投注USD'] || 0
    );
    const payoutUSD = parseNumber(
      item['总派奖USD'] || item['总派奖'] || item['payout_amount'] || item['payout-amount'] ||
      item['total_payout'] || item['totalPayout'] || item['总派奖(USD)'] || item['派奖USD'] || 0
    );
    const rounds = parseNumber(
      item.总局数 || item['rounds'] || item['round_count'] || item['total_rounds'] || 
      item['总局'] || item['round'] || 0
    );
    const users = parseNumber(
      item['投注用户数'] || item['投注用户'] || item['users'] || item['active_users'] || 
      item['total_users'] || item['user_count'] || item['用户数'] || 0
    );
    
    // 统计字段出现情况
    if (ggrUSD > 0) fieldStats.hasGGR++;
    if (betUSD > 0) fieldStats.hasBet++;
    if (payoutUSD > 0) fieldStats.hasPayout++;
    if (rounds > 0) fieldStats.hasRounds++;
    if (users > 0) fieldStats.hasUsers++;
    
    // 处理投注用户数（日期="合计"）
    if (date === '合计' || date === 'Total' || date === '总计') {
      if (merchantName) {
        if (!result.merchantUsers[merchantName]) {
          result.merchantUsers[merchantName] = {
            merchantName: merchantName,
            totalUsers: 0
          };
        }
        result.merchantUsers[merchantName].totalUsers += users;
      }
      
      if (gameName && gameName !== '合计' && gameName !== 'Total') {
        if (!result.gameUsers[gameName]) {
          result.gameUsers[gameName] = {
            gameName: gameName,
            totalUsers: 0
          };
        }
        result.gameUsers[gameName].totalUsers += users;
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
      // 3. 各游戏数据（游戏名!="合计"）- 只统计有GGR或投注数据的游戏
      if (gameName && (ggrUSD > 0 || betUSD > 0 || payoutUSD > 0 || rounds > 0)) {
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
      
      // 4. 各币种数据（游戏名!="合计"）- 只统计有GGR或投注数据的币种
      if (currency && (ggrUSD > 0 || betUSD > 0 || payoutUSD > 0 || rounds > 0)) {
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
  
  // 🔍 调试：打印字段统计
  console.log(`  📊 字段统计: GGR=${fieldStats.hasGGR}, 投注=${fieldStats.hasBet}, 派奖=${fieldStats.hasPayout}, 局数=${fieldStats.hasRounds}, 用户=${fieldStats.hasUsers}, 总记录=${fieldStats.totalItems}`);
  
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
  
  // 转换为数组
  result.merchants = Object.values(result.merchants);
  result.games = Object.values(result.games);
  result.currencies = Object.values(result.currencies);
  result.merchantUsers = Object.values(result.merchantUsers);
  result.gameUsers = Object.values(result.gameUsers);
  
  return result;
}

// 步骤3：为每个周期生成统计结果
const output = {
  periods: []
};

Object.keys(periodData).sort().forEach(periodKey => {
  const periodInfo = periodData[periodKey].periodInfo;
  const items = periodData[periodKey].items;
  
  console.log(`\n📊 处理周期: ${periodKey}`);
  console.log(`  数据条数: ${items.length}`);
  
  // 计算统计数据
  const stats = calculateStatistics(items);
  
  // 构建输出
  output.periods.push({
    period: periodKey,
    periodDisplay: periodInfo.displayShort,
    periodFull: periodInfo.display,
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate,
    overall: {
      totalGGRUSD: stats.overall.totalGGRUSD,
      totalBetUSD: stats.overall.totalBetUSD,
      totalPayoutUSD: stats.overall.totalPayoutUSD,
      totalRounds: stats.overall.totalRounds,
      totalRTP: stats.overall.totalRTP,
      totalRTPFormatted: formatPercentage(stats.overall.totalRTP)
    },
    merchants: stats.merchants.map(m => ({
      ...m,
      totalRTPFormatted: formatPercentage(m.totalRTP)
    })),
    games: stats.games.map(g => ({
      ...g,
      totalRTPFormatted: formatPercentage(g.totalRTP)
    })),
    currencies: stats.currencies.map(c => ({
      ...c,
      totalRTPFormatted: formatPercentage(c.totalRTP)
    })),
    merchantUsers: stats.merchantUsers,
    gameUsers: stats.gameUsers
  });
  
  console.log(`  总体GGR-USD: ${stats.overall.totalGGRUSD.toFixed(2)}`);
  console.log(`  商户数: ${stats.merchants.length}`);
  console.log(`  游戏数: ${stats.games.length}`);
  console.log(`  币种数: ${stats.currencies.length}`);
  console.log(`  商户用户数统计: ${stats.merchantUsers.length} 个商户`);
  console.log(`  游戏用户数统计: ${stats.gameUsers.length} 个游戏`);
});

console.log(`\n✅ 处理完成，共 ${output.periods.length} 个周期`);

// 返回输出结果
return [{
  json: output
}];

