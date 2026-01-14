// 周报数据处理器（优化版）- 直接输出报告需要的数据结构
// 输入：「计算评分数据」节点的完整输出
// 输出：精简且完整的数据（去掉 daily 明细、只保留 Top N、确保字段有值）

const inputs = $input.all();
if (!inputs || !inputs.length) {
  throw new Error('❌ 未收到任何输入数据');
}

const src = inputs[0].json || {};

const period = src.period || {};
const platform = src.platform || {};
const merchants = Array.isArray(src.merchants) ? src.merchants : [];
const games = Array.isArray(src.games) ? src.games : [];
const gameRetention = Array.isArray(src.game_retention) ? src.game_retention : [];

// 工具：安全数字（null/undefined/空字符串 → null，否则转数字）
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ========== 1. 平台层：只保留汇总指标，去掉 daily_trend ==========
const platformSummary = {
  total_bet_users: num(platform.total_bet_users) ?? 0,
  avg_bet_users_per_day: num(platform.avg_bet_users_per_day) ?? 0,
  total_bet_amount_usd: num(platform.total_bet_amount_usd) ?? 0,
  total_payout_usd: num(platform.total_payout_usd) ?? 0,
  total_ggr_usd: num(platform.total_ggr_usd) ?? 0,
  // 不传 daily_trend，报告不需要每日明细
};

// ========== 2. 商户层：Top 30（按 GGR 排序），去掉 daily 明细 ==========
const merchantsTop30 = [...merchants]
  .filter(m => m.merchant_name) // 过滤掉没有商户名的
  .sort((a, b) => {
    const ag = num(a.rev_total_ggr_usd) || 0;
    const bg = num(b.rev_total_ggr_usd) || 0;
    return bg - ag; // 降序
  })
  .slice(0, 30)
  .map(m => ({
    merchant_name: m.merchant_name || '',
    // 用户维度（确保有值）
    user_total_bet_users: num(m.user_total_bet_users) ?? 0,
    user_avg_bet_users_per_day: num(m.user_avg_bet_users_per_day) ?? 0,
    user_share_of_platform: num(m.user_share_of_platform) ?? 0,
    // 营收维度（确保有值）
    rev_total_bet_usd: num(m.rev_total_bet_usd) ?? 0,
    rev_total_payout_usd: num(m.rev_total_payout_usd) ?? 0,
    rev_total_ggr_usd: num(m.rev_total_ggr_usd) ?? 0,
    rev_game_count: num(m.rev_game_count) ?? 0,
    // 不传：max_bet_users, min_bet_users, daily 等明细
  }));

// 商户汇总统计（用于报告中的“其他商户”）
const merchantsOthers = merchants.length > 30 ? {
  merchant_count: merchants.length - 30,
  total_bet_users: merchants.slice(30).reduce((sum, m) => sum + (num(m.user_total_bet_users) || 0), 0),
  total_ggr_usd: merchants.slice(30).reduce((sum, m) => sum + (num(m.rev_total_ggr_usd) || 0), 0),
} : null;

// ========== 3. 游戏层：Top 30（按投注用户数排序），去掉 daily 明细 ==========
const gamesTop30 = [...games]
  .filter(g => g.game_name) // 过滤掉没有游戏名的
  .sort((a, b) => {
    const au = num(a.user_total_bet_users) || 0;
    const bu = num(b.user_total_bet_users) || 0;
    return bu - au; // 降序
  })
  .slice(0, 30)
  .map(g => ({
    game_name: g.game_name || '',
    // 用户维度（确保有值）
    user_total_bet_users: num(g.user_total_bet_users) ?? 0,
    user_avg_bet_users_per_day: num(g.user_avg_bet_users_per_day) ?? 0,
    user_share_of_platform_users: num(g.user_share_of_platform_users) ?? 0,
    // 营收维度（确保有值）
    rev_total_bet_usd: num(g.rev_total_bet_usd) ?? 0,
    rev_total_payout_usd: num(g.rev_total_payout_usd) ?? 0,
    rev_total_ggr_usd: num(g.rev_total_ggr_usd) ?? 0,
    rev_merchant_count: num(g.rev_merchant_count) ?? 0,
    // 不传：daily 明细
  }));

// 游戏汇总统计
const gamesOthers = games.length > 30 ? {
  game_count: games.length - 30,
  total_bet_users: games.slice(30).reduce((sum, g) => sum + (num(g.user_total_bet_users) || 0), 0),
  total_ggr_usd: games.slice(30).reduce((sum, g) => sum + (num(g.rev_total_ggr_usd) || 0), 0),
} : null;

// ========== 4. 留存数据：Top 20（按用户数排序），去掉 daily 明细 ==========
const retentionTop20 = [...gameRetention]
  .filter(r => r.game_name && r.merchant_name && r.type) // 过滤掉不完整的
  .sort((a, b) => {
    const au = num(a.total_users) || 0;
    const bu = num(b.total_users) || 0;
    return bu - au; // 降序
  })
  .slice(0, 20)
  .map(r => ({
    game_name: r.game_name || '',
    merchant_name: r.merchant_name || '',
    type: r.type || '', // 新用户留存 / 活跃用户留存
    total_users: num(r.total_users) ?? 0,
    avg_users_per_day: num(r.avg_users_per_day) ?? 0,
    avg_d1_retention_rate: num(r.avg_d1_retention_rate) ?? null, // 可能为 null
    avg_d3_retention_rate: num(r.avg_d3_retention_rate) ?? null,
    avg_d7_retention_rate: num(r.avg_d7_retention_rate) ?? null,
    // 不传：daily 明细数组
  }));

// ========== 5. 组装最终输出 ==========
const out = {
  report_type: 'weekly',
  
  period: {
    start: period.start || '',
    end: period.end || '',
    key: period.key || '',
  },
  
  platform: platformSummary,
  
  merchants: {
    top_30: merchantsTop30,
    others: merchantsOthers, // 其他商户汇总（如果有）
    total_count: merchants.length,
  },
  
  games: {
    top_30: gamesTop30,
    others: gamesOthers, // 其他游戏汇总（如果有）
    total_count: games.length,
  },
  
  retention: {
    top_20: retentionTop20,
    total_count: gameRetention.length,
  },
  
  meta: {
    generated_at: new Date().toISOString(),
    original_merchant_count: merchants.length,
    original_game_count: games.length,
    original_retention_count: gameRetention.length,
    optimized: true,
  },
};

console.log('📊 周报数据预处理完成:');
console.log(`   周期: ${period.key || `${period.start || ''}-${period.end || ''}`}`);
console.log(`   平台指标: ${Object.keys(platformSummary).length} 个字段`);
console.log(`   商户: Top ${merchantsTop30.length} / 总计 ${merchants.length}`);
console.log(`   游戏: Top ${gamesTop30.length} / 总计 ${games.length}`);
console.log(`   留存: Top ${retentionTop20.length} / 总计 ${gameRetention.length}`);
console.log(`   ✅ 已移除: daily 明细、完整列表等冗余数据`);

return [{ json: out }];

