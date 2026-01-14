// n8n Code 节点：周度/月度数据聚合器
// 功能：聚合用户数据和营收数据，计算汇总指标，支持周度/月度两种模式

const inputs = $input.all();
if (!inputs || !inputs.length) {
  throw new Error('❌ 未收到任何输入数据');
}

// 从环境变量或上游获取报告类型（weekly/monthly）
const reportType = inputs[0]?.json?.report_type || 
                   inputs[0]?.json?.mode || 
                   'monthly'; // 默认月度

console.log(`📊 报告类型: ${reportType === 'weekly' ? '周度' : '月度'}`);

// 工具函数
function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parsePercent(v) {
  if (v === null || v === undefined || v === '') return null;
  const str = String(v).replace(/%/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num / 100; // 转换为0-1浮点
}

// 数据结构
const gameDataMap = new Map(); // 游戏名 -> 数据
const merchantDataMap = new Map(); // 商户名 -> 数据
const currencyDataMap = new Map(); // 货币 -> 数据
let globalSummary = {
  totalNewUsers: 0,
  totalBetUSD: 0,
  totalPayoutUSD: 0,
  totalGgrUSD: 0,
  totalD1Retention: 0,
  totalD7Retention: 0,
  d1RetentionCount: 0, // 用于计算平均留存率
  d7RetentionCount: 0,
};

// 处理输入数据
inputs.forEach((input, idx) => {
  const data = input.json || {};
  
  // 营收数据格式：{ "游戏名": "...", "时间": "...", "汇总": {...}, "商户数据": [...] }
  if (data['游戏名'] && data['汇总']) {
    const gameName = data['游戏名'];
    const time = data['时间'] || '';
    const summary = data['汇总'] || {};
    const merchants = data['商户数据'] || [];
    
    // 初始化游戏数据
    if (!gameDataMap.has(gameName)) {
      gameDataMap.set(gameName, {
        gameName,
        totalNewUsers: 0,
        totalBetUSD: 0,
        totalPayoutUSD: 0,
        totalGgrUSD: 0,
        d1RetentionSum: 0,
        d7RetentionSum: 0,
        retentionCount: 0,
        merchants: new Map(),
      });
    }
    
    const gameData = gameDataMap.get(gameName);
    
    // 累加游戏数据
    gameData.totalNewUsers += toNum(summary['唯一用户数'] || summary['新用户数']);
    gameData.totalBetUSD += toNum(summary['总投注USD']);
    gameData.totalPayoutUSD += toNum(summary['总派奖USD']);
    gameData.totalGgrUSD += toNum(summary['GGR-USD']);
    
    const d1Retention = parsePercent(summary['新用户D1留存率']);
    const d7Retention = parsePercent(summary['新用户D7留存率']);
    if (d1Retention !== null) {
      gameData.d1RetentionSum += d1Retention;
      gameData.retentionCount++;
    }
    if (d7Retention !== null) {
      gameData.d7RetentionSum += d7Retention;
      gameData.retentionCount++;
    }
    
    // 处理商户数据
    merchants.forEach(merchant => {
      const merchantName = merchant['商户名'] || '';
      if (!merchantName) return;
      
      if (!gameData.merchants.has(merchantName)) {
        gameData.merchants.set(merchantName, {
          merchantName,
          currencies: new Set(),
          totalBetUSD: 0,
          totalPayoutUSD: 0,
          totalGgrUSD: 0,
          newUsers: 0,
        });
      }
      
      const merchantData = gameData.merchants.get(merchantName);
      const currencies = String(merchant['货币'] || '').split('、').filter(c => c.trim());
      currencies.forEach(c => merchantData.currencies.add(c.trim()));
      
      merchantData.totalBetUSD += toNum(merchant['总投注USD']);
      merchantData.totalPayoutUSD += toNum(merchant['总派奖USD']);
      merchantData.totalGgrUSD += toNum(merchant['GGR-USD']);
      merchantData.newUsers += toNum(merchant['唯一用户数'] || merchant['新用户数']);
      
      // 累加到商户汇总
      if (!merchantDataMap.has(merchantName)) {
        merchantDataMap.set(merchantName, {
          merchantName,
          totalNewUsers: 0,
          totalBetUSD: 0,
          totalPayoutUSD: 0,
          totalGgrUSD: 0,
          games: new Set(),
        });
      }
      
      const merchantSummary = merchantDataMap.get(merchantName);
      merchantSummary.totalNewUsers += merchantData.newUsers;
      merchantSummary.totalBetUSD += merchantData.totalBetUSD;
      merchantSummary.totalPayoutUSD += merchantData.totalPayoutUSD;
      merchantSummary.totalGgrUSD += merchantData.totalGgrUSD;
      merchantSummary.games.add(gameName);
    });
    
    // 累加到全局汇总
    globalSummary.totalNewUsers += gameData.totalNewUsers;
    globalSummary.totalBetUSD += gameData.totalBetUSD;
    globalSummary.totalPayoutUSD += gameData.totalPayoutUSD;
    globalSummary.totalGgrUSD += gameData.totalGgrUSD;
    if (d1Retention !== null) {
      globalSummary.totalD1Retention += d1Retention;
      globalSummary.d1RetentionCount++;
    }
    if (d7Retention !== null) {
      globalSummary.totalD7Retention += d7Retention;
      globalSummary.d7RetentionCount++;
    }
  }
  
  // 处理全局汇总数据（格式：{ "汇总": "2025/11", ... }）
  if (data['汇总'] && typeof data['汇总'] === 'string' && !data['游戏名']) {
    globalSummary.totalNewUsers += toNum(data['唯一用户数']);
    globalSummary.totalBetUSD += toNum(data['总投注USD']);
    globalSummary.totalPayoutUSD += toNum(data['总派奖USD']);
    globalSummary.totalGgrUSD += toNum(data['GGR-USD']);
    
    const d1Retention = parsePercent(data['新用户D1留存率']);
    const d7Retention = parsePercent(data['新用户D7留存率']);
    if (d1Retention !== null) {
      globalSummary.totalD1Retention += d1Retention;
      globalSummary.d1RetentionCount++;
    }
    if (d7Retention !== null) {
      globalSummary.totalD7Retention += d7Retention;
      globalSummary.d7RetentionCount++;
    }
  }
});

// 计算平均留存率
globalSummary.avgD1Retention = globalSummary.d1RetentionCount > 0
  ? globalSummary.totalD1Retention / globalSummary.d1RetentionCount
  : null;
globalSummary.avgD7Retention = globalSummary.d7RetentionCount > 0
  ? globalSummary.totalD7Retention / globalSummary.d7RetentionCount
  : null;

// 构建输出
const output = {
  report_type: reportType,
  period: reportType === 'weekly' 
    ? getLastWeekRange() 
    : getLastMonthLabel(),
  global_summary: {
    total_new_users: globalSummary.totalNewUsers,
    total_bet_usd: Number(globalSummary.totalBetUSD.toFixed(2)),
    total_payout_usd: Number(globalSummary.totalPayoutUSD.toFixed(2)),
    total_ggr_usd: Number(globalSummary.totalGgrUSD.toFixed(2)),
    avg_d1_retention: globalSummary.avgD1Retention !== null
      ? Number((globalSummary.avgD1Retention * 100).toFixed(2))
      : null,
    avg_d7_retention: globalSummary.avgD7Retention !== null
      ? Number((globalSummary.avgD7Retention * 100).toFixed(2))
      : null,
    avg_ggr_per_user: globalSummary.totalNewUsers > 0
      ? Number((globalSummary.totalGgrUSD / globalSummary.totalNewUsers).toFixed(4))
      : 0,
  },
  games: Array.from(gameDataMap.values())
    .map(game => ({
      game_name: game.gameName,
      total_new_users: game.totalNewUsers,
      total_bet_usd: Number(game.totalBetUSD.toFixed(2)),
      total_payout_usd: Number(game.totalPayoutUSD.toFixed(2)),
      total_ggr_usd: Number(game.totalGgrUSD.toFixed(2)),
      avg_d1_retention: game.retentionCount > 0 && game.d1RetentionSum > 0
        ? Number((game.d1RetentionSum / game.retentionCount * 100).toFixed(2))
        : null,
      avg_d7_retention: game.retentionCount > 0 && game.d7RetentionSum > 0
        ? Number((game.d7RetentionSum / game.retentionCount * 100).toFixed(2))
        : null,
      avg_ggr_per_user: game.totalNewUsers > 0
        ? Number((game.totalGgrUSD / game.totalNewUsers).toFixed(4))
        : 0,
      merchant_count: game.merchants.size,
      merchants: Array.from(game.merchants.values())
        .map(m => ({
          merchant_name: m.merchantName,
          currencies: Array.from(m.currencies).join('、'),
          total_bet_usd: Number(m.totalBetUSD.toFixed(2)),
          total_payout_usd: Number(m.totalPayoutUSD.toFixed(2)),
          total_ggr_usd: Number(m.totalGgrUSD.toFixed(2)),
          new_users: m.newUsers,
        }))
        .sort((a, b) => b.total_ggr_usd - a.total_ggr_usd), // 按GGR降序
    }))
    .sort((a, b) => b.total_ggr_usd - a.total_ggr_usd), // 按GGR降序
  merchants: Array.from(merchantDataMap.values())
    .map(merchant => ({
      merchant_name: merchant.merchantName,
      total_new_users: merchant.totalNewUsers,
      total_bet_usd: Number(merchant.totalBetUSD.toFixed(2)),
      total_payout_usd: Number(merchant.totalPayoutUSD.toFixed(2)),
      total_ggr_usd: Number(merchant.totalGgrUSD.toFixed(2)),
      game_count: merchant.games.size,
      avg_ggr_per_user: merchant.totalNewUsers > 0
        ? Number((merchant.totalGgrUSD / merchant.totalNewUsers).toFixed(4))
        : 0,
    }))
    .sort((a, b) => b.total_ggr_usd - a.total_ggr_usd), // 按GGR降序
  meta: {
    generated_at: new Date().toISOString(),
    game_count: gameDataMap.size,
    merchant_count: merchantDataMap.size,
  },
};

console.log(`✅ 数据聚合完成:`);
console.log(`   游戏数: ${output.meta.game_count}`);
console.log(`   商户数: ${output.meta.merchant_count}`);
console.log(`   全局新用户数: ${output.global_summary.total_new_users}`);
console.log(`   全局GGR: ${output.global_summary.total_ggr_usd} USD`);

return [{ json: output }];

// 工具函数：计算上周时间范围
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToSubtract);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  return `${formatDate(lastMonday)}-${formatDate(lastSunday)}`;
}

// 工具函数：计算上月标签
function getLastMonthLabel() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${year}年${month}月`;
}






