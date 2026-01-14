// 整理数据-谷歌表格节点
// 将"计算评分数据"节点的输出转换为适合写入 Google Sheets 的格式

const inputData = $input.first().json;

if (!inputData) {
  throw new Error('❌ 未收到输入数据');
}

const period = inputData.period || {};
const platform = inputData.platform || {};
const merchants = inputData.merchants || {};
const games = inputData.games || {};
const currencies = inputData.currencies || {};

// 工具函数：数值安全转换
const num = (v, def = 0) => {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// 工具函数：格式化数值
const formatNum = (v, decimals = 2) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(decimals)) : '';
};

const formatPercent = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '';
};

// ========== 1. 平台总览数据 ==========
const platformRow = {
  数据类型: '平台总览',
  名称: '平台',
  报告周期: period.key || '',
  周期开始: period.start || '',
  周期结束: period.end || '',
  商户名称: '', // 平台总览没有商户名称
  游戏名称: '', // 平台总览没有游戏名称
  币种: '', // 平台总览没有币种
  投注用户数: formatNum(platform.total_bet_users, 0),
  新用户数: formatNum(platform.new_users, 0),
  活跃用户次日留存: formatPercent(platform.active_d1_ret_pct),
  活跃用户3日留存: formatPercent(platform.active_d3_ret_pct),
  新用户次日留存: formatPercent(platform.new_d1_ret_pct),
  新用户3日留存: formatPercent(platform.new_d3_ret_pct),
  总投注USD: formatNum(platform.total_bet_amount_usd),
  总派奖USD: formatNum(platform.total_payout_usd),
  总GGR_USD: formatNum(platform.total_ggr_usd),
  人均GGR_USD: '', // 平台总览没有人均GGR
  RTP: formatPercent(platform.rtp_pct),
  总局数: '', // 平台总览没有总局数
  空转指数: '', // 平台总览没有空转指数
  占比: '', // 平台总览没有占比
  生成时间: new Date().toISOString().split('T')[0],
};

// ========== 2. 商户全量数据 ==========
const merchantRows = [];
const merchantsAll = Array.isArray(merchants.all) ? merchants.all : [];
const totalMerchantGgr = merchantsAll.reduce((sum, m) => sum + num(m.rev_total_ggr_usd), 0);

merchantsAll.forEach((m) => {
  const ggrShare = totalMerchantGgr > 0 ? num((num(m.rev_total_ggr_usd) / totalMerchantGgr) * 100) : '';
  const perUserGgr = num(m.rev_total_ggr_usd) > 0 && num(m.user_total_bet_users) > 0
    ? num(m.rev_total_ggr_usd / m.user_total_bet_users)
    : '';

  merchantRows.push({
    数据类型: '商户',
    名称: m.merchant_name || '',
    报告周期: period.key || '',
    周期开始: period.start || '',
    周期结束: period.end || '',
    商户名称: m.merchant_name || '',
    游戏名称: '',
    币种: '',
    投注用户数: formatNum(m.user_total_bet_users, 0),
    新用户数: formatNum(m.user_new_users, 0),
    活跃用户次日留存: formatPercent(m.user_active_d1_ret_pct),
    活跃用户3日留存: formatPercent(m.user_active_d3_ret_pct),
    新用户次日留存: formatPercent(m.user_new_d1_ret_pct),
    新用户3日留存: formatPercent(m.user_new_d3_ret_pct),
    总投注USD: formatNum(m.rev_total_bet_usd),
    总派奖USD: formatNum(m.rev_total_payout_usd),
    总GGR_USD: formatNum(m.rev_total_ggr_usd),
    人均GGR_USD: formatNum(perUserGgr),
    RTP: '',
    总局数: '', // 商户没有总局数
    空转指数: '',
    占比: formatPercent(ggrShare),
    生成时间: new Date().toISOString().split('T')[0],
  });
});

// ========== 3. 游戏全量数据 ==========
const gameRows = [];
const gamesAll = Array.isArray(games.all) ? games.all : [];
const totalGameGgr = gamesAll.reduce((sum, g) => sum + num(g.rev_total_ggr_usd), 0);

gamesAll.forEach((g) => {
  const ggrShare = totalGameGgr > 0 ? num((num(g.rev_total_ggr_usd) / totalGameGgr) * 100) : '';
  const perUserGgr = num(g.rev_total_ggr_usd) > 0 && num(g.user_total_bet_users) > 0
    ? num(g.rev_total_ggr_usd / g.user_total_bet_users)
    : '';

  gameRows.push({
    数据类型: '游戏',
    名称: g.game_name || '',
    报告周期: period.key || '',
    周期开始: period.start || '',
    周期结束: period.end || '',
    商户名称: '',
    游戏名称: g.game_name || '',
    币种: '',
    投注用户数: formatNum(g.user_total_bet_users, 0),
    新用户数: formatNum(g.user_new_users, 0),
    活跃用户次日留存: formatPercent(g.user_active_d1_ret_pct),
    活跃用户3日留存: formatPercent(g.user_active_d3_ret_pct),
    新用户次日留存: formatPercent(g.user_new_d1_ret_pct),
    新用户3日留存: formatPercent(g.user_new_d3_ret_pct),
    总投注USD: formatNum(g.rev_total_bet_usd),
    总派奖USD: formatNum(g.rev_total_payout_usd),
    总GGR_USD: formatNum(g.rev_total_ggr_usd),
    人均GGR_USD: formatNum(perUserGgr),
    RTP: '',
    总局数: formatNum(g.total_rounds, 0),
    空转指数: formatNum(g.idle_index),
    占比: formatPercent(ggrShare),
    生成时间: new Date().toISOString().split('T')[0],
  });
});

// ========== 4. 币种全量数据 ==========
const currencyRows = [];
const currenciesAll = Array.isArray(currencies.all) ? currencies.all : [];
const totalCurrencyGgr = currenciesAll.reduce((sum, c) => sum + num(c.total_ggr_usd), 0);

currenciesAll.forEach((c) => {
  const bet = num(c.total_bet_usd ?? c.rev_total_bet_usd, 0);
  const payout = num(c.total_payout_usd ?? c.rev_total_payout_usd, 0);
  const ggr = num(c.total_ggr_usd);
  const share = c.share_pct ?? (totalCurrencyGgr > 0 ? num((ggr / totalCurrencyGgr) * 100) : 0);

  currencyRows.push({
    数据类型: '币种',
    名称: c.currency || '',
    报告周期: period.key || '',
    周期开始: period.start || '',
    周期结束: period.end || '',
    商户名称: '',
    游戏名称: '',
    币种: c.currency || '',
    投注用户数: '',
    新用户数: '',
    活跃用户次日留存: '',
    活跃用户3日留存: '',
    新用户次日留存: '',
    新用户3日留存: '',
    总投注USD: formatNum(bet),
    总派奖USD: formatNum(payout),
    总GGR_USD: formatNum(ggr),
    人均GGR_USD: '',
    RTP: '',
    总局数: '',
    空转指数: '',
    占比: formatPercent(share),
    生成时间: new Date().toISOString().split('T')[0],
  });
});

// ========== 5. 合并所有数据 ==========
const allRows = [
  platformRow,
  ...merchantRows,
  ...gameRows,
  ...currencyRows,
];

console.log(`✅ 数据整理完成，共 ${allRows.length} 行数据`);
console.log(`   - 平台总览: 1 行`);
console.log(`   - 商户榜单: ${merchantRows.length} 行`);
console.log(`   - 游戏榜单: ${gameRows.length} 行`);
console.log(`   - 币种数据: ${currencyRows.length} 行`);

// 返回多行数据，每行一个 item
return allRows.map(row => ({ json: row }));

