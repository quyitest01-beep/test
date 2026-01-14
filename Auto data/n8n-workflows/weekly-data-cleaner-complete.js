// 周报一体化清洗节点（基于 shangyou.json 当前结构）
// 目标：一次性产出周报所需的所有核心数据结构：
// 1) 平台总览（用户 + 营收）
// 2) 商户规模 & 质量榜（含 GGR 和人均 GGR）
// 3) 游戏规模 & 留存 & 营收 & 空转 & 游戏-平台主力商户
// 4) 币种 GGR Top3 + 占比
// 输入：shangyou.json 每行一个 item（类型：全平台 / 商户 / 游戏 / 游戏-平台数据 / 币种）
// 输出：一个 json，用于下游 AI 节点直接生成周报

const items = $input.all().map(i => i.json || {});

if (!items.length) {
  throw new Error('❌ 未收到任何输入数据');
}

// ========== 工具函数 ==========

const num = (v, def = 0) => {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const parsePercent = (str) => {
  if (!str) return null;
  const s = String(str).replace('%', '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const sortDesc = (arr, key) =>
  [...arr].sort((a, b) => num(b[key]) - num(a[key]));

const sortAsc = (arr, key) =>
  [...arr].sort((a, b) => num(a[key]) - num(b[key]));

// ========== 1. 基础拆分 ==========

const platformUserRow = items.find(r =>
  r['类型'] === '全平台' &&
  r['投注用户数'] !== undefined
) || null;

const platformRevenueRow = items.find(r =>
  r['类型'] === '全平台' &&
  (r['总投注USD'] !== undefined || r['总GGR_USD'] !== undefined)
) || null;

// 商户：用户侧 + 营收侧
const merchantUserRows = items.filter(r =>
  r['类型'] === '商户' &&
  r['日期'] === '合计' &&
  r['投注用户数'] !== undefined
);

const merchantRevenueRows = items.filter(r =>
  r['类型'] === '商户' &&
  (r['总投注USD'] !== undefined || r['总GGR_USD'] !== undefined || r['GGR-USD'] !== undefined)
);

// 游戏：用户侧 + 营收侧
const gameUserRows = items.filter(r =>
  r['类型'] === '游戏' &&
  r['日期'] === '合计' &&
  r['投注用户数'] !== undefined
);

const gameRevenueRows = items.filter(r =>
  r['类型'] === '游戏' &&
  (r['总投注USD'] !== undefined || r['总GGR_USD'] !== undefined || r['GGR-USD'] !== undefined)
);

// 游戏-平台结构（主力商户）
const gamePlatformRows = items.filter(r => r['类型'] === '游戏-平台数据');

// 币种营收
const currencyRows = items.filter(r =>
  r['类型'] === '币种' &&
  (r['总GGR_USD'] !== undefined || r['GGR-USD'] !== undefined)
);

// ========== 2. 推断周期 ==========

const dateStrings = items
  .map(r => r['日期'])
  .filter(d => d && d !== '合计' && /^\d{8}$/.test(String(d)))
  .sort();

const period = {
  start: dateStrings[0] || '',
  end: dateStrings[dateStrings.length - 1] || '',
  key: dateStrings.length ? `${dateStrings[0]}-${dateStrings[dateStrings.length - 1]}` : ''
};

// ========== 3. 平台总览 ==========

const platform = (() => {
  const u = platformUserRow || {};
  const rv = platformRevenueRow || {};

  const totalBetUsd = num(rv['总投注USD']);
  const totalPayoutUsd = num(rv['总派奖USD']);
  const totalGgrUsd = num(rv['总GGR_USD'] || rv['GGR-USD']);

  const rtp = totalBetUsd > 0
    ? Number(((totalPayoutUsd / totalBetUsd) * 100).toFixed(2))
    : null;

  return {
    // 用户侧
    total_bet_users: num(u['投注用户数']),
    new_users: num(u['新用户数']),
    active_d1_ret_pct: parsePercent(u['活跃用户次日留存']),
    active_d3_ret_pct: parsePercent(u['活跃用户3日留存']),
    new_d1_ret_pct: parsePercent(u['新用户次日留存']),
    new_d3_ret_pct: parsePercent(u['新用户3日留存']),
    // 营收侧
    total_bet_amount_usd: totalBetUsd,
    total_payout_usd: totalPayoutUsd,
    total_ggr_usd: totalGgrUsd,
    rtp_pct: rtp, // 百分比数值，如 103.14 表示 103.14%
  };
})();

// ========== 4. 商户维度：用户 + 营收（修复大小写问题） ==========

const merchantRevenueMap = new Map();
merchantRevenueRows.forEach(r => {
  const name = String(r['商户名'] || '').trim();
  if (!name) return;
  // 统一转换为小写作为 key，但保留原始名称
  const key = name.toLowerCase();
  const existing = merchantRevenueMap.get(key);
  if (existing) {
    // 如果已存在，累加数据（处理同一商户多条记录的情况）
    existing.rev_total_bet_usd += num(r['总投注USD']);
    existing.rev_total_payout_usd += num(r['总派奖USD']);
    existing.rev_total_ggr_usd += num(r['总GGR_USD'] || r['GGR-USD']);
  } else {
    merchantRevenueMap.set(key, {
      merchant_name: name, // 保留原始名称（使用第一个遇到的）
      rev_total_bet_usd: num(r['总投注USD']),
      rev_total_payout_usd: num(r['总派奖USD']),
      rev_total_ggr_usd: num(r['总GGR_USD'] || r['GGR-USD']),
    });
  }
});

const merchantsAll = merchantUserRows.map(u => {
  const name = String(u['商户名'] || '').trim();
  if (!name) return null;

  // 使用小写 key 查找营收数据
  const key = name.toLowerCase();
  const rv = merchantRevenueMap.get(key) || {};
  
  // 如果找到了营收数据但名称大小写不同，使用营收数据中的名称
  const finalName = rv.merchant_name || name;
  
  const betUsers = num(u['投注用户数']);

  return {
    merchant_name: finalName,
    // 用户侧
    user_total_bet_users: betUsers,
    user_new_users: num(u['新用户数']),
    user_active_d1_ret_pct: parsePercent(u['活跃用户次日留存']),
    user_active_d3_ret_pct: parsePercent(u['活跃用户3日留存']),
    user_new_d1_ret_pct: parsePercent(u['新用户次日留存']),
    user_new_d3_ret_pct: parsePercent(u['新用户3日留存']),
    // 营收侧
    rev_total_bet_usd: rv.rev_total_bet_usd || 0,
    rev_total_payout_usd: rv.rev_total_payout_usd || 0,
    rev_total_ggr_usd: rv.rev_total_ggr_usd || 0,
    // 派生：人均 GGR（美元）
    ggr_per_user_usd:
      betUsers > 0 && rv.rev_total_ggr_usd !== undefined
        ? Number((rv.rev_total_ggr_usd / betUsers).toFixed(4))
        : null,
  };
}).filter(Boolean);

// 商户榜单
const TOP_MCHT = 5;

const merchantsTopBetUsers = sortDesc(merchantsAll, 'user_total_bet_users').slice(0, TOP_MCHT);
const merchantsTopNewUsers = sortDesc(merchantsAll, 'user_new_users').slice(0, TOP_MCHT);
const merchantsTopGgr = sortDesc(merchantsAll, 'rev_total_ggr_usd').slice(0, TOP_MCHT);

const merchantsTopNewD3Ret = sortDesc(
  merchantsAll.filter(m => m.user_new_d3_ret_pct !== null && m.user_new_users >= 50),
  'user_new_d3_ret_pct'
).slice(0, TOP_MCHT);

const merchantsTopActiveD3Ret = sortDesc(
  merchantsAll.filter(m => m.user_active_d3_ret_pct !== null && m.user_total_bet_users >= 50),
  'user_active_d3_ret_pct'
).slice(0, TOP_MCHT);

const merchantsLowNewD3Ret = sortAsc(
  merchantsAll.filter(m => m.user_new_d3_ret_pct !== null && m.user_new_users >= 50),
  'user_new_d3_ret_pct'
).slice(0, TOP_MCHT);

// ========== 5. 游戏维度：用户 + 营收 + 空转 ==========

const gameRevenueMap = new Map();
gameRevenueRows.forEach(r => {
  const name = String(r['游戏名'] || '').trim();
  if (!name) return;

  const prev = gameRevenueMap.get(name) || {
    rev_total_bet_usd: 0,
    rev_total_payout_usd: 0,
    rev_total_ggr_usd: 0,
    total_rounds: 0,
  };
  prev.rev_total_bet_usd += num(r['总投注USD']);
  prev.rev_total_payout_usd += num(r['总派奖USD']);
  prev.rev_total_ggr_usd += num(r['总GGR_USD'] || r['GGR-USD']);
  prev.total_rounds += num(r['总局数']);
  gameRevenueMap.set(name, prev);
});

const gamesAll = gameUserRows.map(u => {
  const name = String(u['游戏名'] || '').trim();
  if (!name) return null;

  const rv = gameRevenueMap.get(name) || {
    rev_total_bet_usd: 0,
    rev_total_payout_usd: 0,
    rev_total_ggr_usd: 0,
    total_rounds: 0,
  };

  const idleIndex =
    rv.total_rounds > 0
      ? Number((rv.total_rounds / (Math.abs(rv.rev_total_ggr_usd) + 0.01)).toFixed(2))
      : null;

  return {
    game_name: name,
    // 用户侧
    user_total_bet_users: num(u['投注用户数']),
    user_new_users: num(u['新用户数']),
    user_active_d1_ret_pct: parsePercent(u['活跃用户次日留存']),
    user_active_d3_ret_pct: parsePercent(u['活跃用户3日留存']),
    user_new_d1_ret_pct: parsePercent(u['新用户次日留存']),
    user_new_d3_ret_pct: parsePercent(u['新用户3日留存']),
    // 营收侧
    rev_total_bet_usd: rv.rev_total_bet_usd,
    rev_total_payout_usd: rv.rev_total_payout_usd,
    rev_total_ggr_usd: rv.rev_total_ggr_usd,
    total_rounds: rv.total_rounds,
    idle_index: idleIndex,
  };
}).filter(Boolean);

const TOP_GAME = 10;

// 游戏规模榜
const gamesTopBetUsers = sortDesc(gamesAll, 'user_total_bet_users').slice(0, TOP_GAME);
const gamesTopNewUsers = sortDesc(gamesAll, 'user_new_users').slice(0, TOP_GAME);
const gamesTopGgr = sortDesc(gamesAll, 'rev_total_ggr_usd').slice(0, TOP_GAME);

// 游戏留存榜
const gamesTopNewD3Ret = sortDesc(
  gamesAll.filter(g => g.user_new_d3_ret_pct !== null && g.user_new_users >= 50),
  'user_new_d3_ret_pct'
).slice(0, TOP_GAME);

const gamesLowNewD3Ret = sortAsc(
  gamesAll.filter(g => g.user_new_d3_ret_pct !== null && g.user_new_users >= 50),
  'user_new_d3_ret_pct'
).slice(0, TOP_GAME);

const gamesTopActiveD3Ret = sortDesc(
  gamesAll.filter(g => g.user_active_d3_ret_pct !== null && g.user_total_bet_users >= 50),
  'user_active_d3_ret_pct'
).slice(0, TOP_GAME);

// 游戏空转榜
const gamesIdleTop = sortDesc(
  gamesAll.filter(g => g.idle_index !== null),
  'idle_index'
).slice(0, TOP_GAME);

const gamesIdleLow = sortAsc(
  gamesAll.filter(g => g.idle_index !== null),
  'idle_index'
).slice(0, TOP_GAME);

// ========== 6. 游戏-平台结构（主力商户 Top5 已在上游算好） ==========

const gamesPlatformStruct = gamePlatformRows.map(r => ({ ...r }));

// ========== 7. 币种 GGR Top3 ==========

const currenciesAll = currencyRows.map(r => ({
  currency: String(r['币种'] || r['货币'] || '').trim(),
  total_ggr_usd: num(r['总GGR_USD'] || r['GGR-USD']),
})).filter(c => c.currency);

const totalGgrAllCurrencies = currenciesAll.reduce((s, c) => s + c.total_ggr_usd, 0);

const currenciesWithShare = currenciesAll.map(c => ({
  ...c,
  share_pct: totalGgrAllCurrencies > 0
    ? Number(((c.total_ggr_usd / totalGgrAllCurrencies) * 100).toFixed(2))
    : null,
}));

const currenciesTop3Ggr = sortDesc(currenciesWithShare, 'total_ggr_usd').slice(0, 3);

// ========== 8. 最终输出结构 ==========

const out = {
  report_type: 'weekly',
  period,
  platform,
  merchants: {
    all: merchantsAll,
    top_bet_users: merchantsTopBetUsers,
    top_new_users: merchantsTopNewUsers,
    top_ggr: merchantsTopGgr,
    top_new_d3_ret: merchantsTopNewD3Ret,
    top_active_d3_ret: merchantsTopActiveD3Ret,
    low_new_d3_ret: merchantsLowNewD3Ret,
  },
  games: {
    all: gamesAll,
    top_bet_users: gamesTopBetUsers,
    top_new_users: gamesTopNewUsers,
    top_ggr: gamesTopGgr,
    top_new_d3_ret: gamesTopNewD3Ret,
    low_new_d3_ret: gamesLowNewD3Ret,
    top_active_d3_ret: gamesTopActiveD3Ret,
    idle_top: gamesIdleTop,
    idle_low: gamesIdleLow,
    platform_struct: gamesPlatformStruct,
  },
  currencies: {
    all: currenciesWithShare,
    top3_ggr: currenciesTop3Ggr,
  },
  meta: {
    generated_at: new Date().toISOString(),
    merchant_count: merchantsAll.length,
    game_count: gamesAll.length,
    currency_count: currenciesAll.length,
  },
};

console.log('✅ 周报一体化清洗完成');
console.log('   商户数:', merchantsAll.length);
console.log('   游戏数:', gamesAll.length);
console.log('   币种数:', currenciesAll.length);

return [{ json: out }];

