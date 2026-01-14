// 终版周报精简数据（本周 + 上周 + 环比）
// 输出：report_type = 'weekly_final_for_ai'
// 平台：本周 vs 上周
// 商户 / 游戏 / 币种 WoW 榜单：按「本周 Top 榜」对比「上周」

const inputs = $input.all().map(i => i.json || {});

if (inputs.length < 2) {
  throw new Error(`❌ 需要至少 2 个 weekly 清洗结果（上周、本周），本次只有 ${inputs.length} 个`);
}

// 工具函数
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const wowPct = (thisVal, lastVal) => {
  const t = num(thisVal);
  const l = num(lastVal);
  if (!l) return null;
  return Number(((t - l) / l * 100).toFixed(2)); // 百分比
};

const wowDiff = (thisVal, lastVal) => {
  if (thisVal === null || thisVal === undefined ||
      lastVal === null || lastVal === undefined) return null;
  const t = Number(thisVal);
  const l = Number(lastVal);
  if (!Number.isFinite(t) || !Number.isFinite(l)) return null;
  return Number((t - l).toFixed(2)); // 差值，pp 或绝对值
};

const sortDesc = (arr, getVal) =>
  [...arr].sort((a, b) => num(getVal(b)) - num(getVal(a)));

// 名称归一化（去首尾空格 + 小写），避免大小写/空格导致匹配不到
const norm = (name) => String(name || '').trim().toLowerCase();

// 1. 识别本期 & 上期（按 period.start 排序）
const weeklyItems = inputs.filter(i => i.report_type === 'weekly' && i.period);
if (weeklyItems.length < 2) {
  throw new Error(`❌ 找到的 weekly 结果不足 2 个，当前为 ${weeklyItems.length} 个`);
}
weeklyItems.sort((a, b) => String(a.period.start).localeCompare(String(b.period.start)));
const lastWeek = weeklyItems[weeklyItems.length - 2]; // 上周
const thisWeek = weeklyItems[weeklyItems.length - 1]; // 本周
console.log('📅 上周  :', lastWeek.period);
console.log('📅 本周  :', thisWeek.period);

// 2. 平台层（本周 vs 上周）
const pThis = thisWeek.platform || {};
const pLast = lastWeek.platform || {};
const platform = {
  this: {
    total_bet_users: num(pThis.total_bet_users),
    new_users: num(pThis.new_users),
    active_d1_ret_pct: pThis.active_d1_ret_pct ?? null,
    active_d3_ret_pct: pThis.active_d3_ret_pct ?? null,
    new_d1_ret_pct: pThis.new_d1_ret_pct ?? null,
    new_d3_ret_pct: pThis.new_d3_ret_pct ?? null,
    total_bet_amount_usd: num(pThis.total_bet_amount_usd),
    total_payout_usd: num(pThis.total_payout_usd),
    total_ggr_usd: num(pThis.total_ggr_usd),
    rtp_pct: pThis.rtp_pct ?? null,
  },
  last: {
    total_bet_users: num(pLast.total_bet_users),
    new_users: num(pLast.new_users),
    active_d1_ret_pct: pLast.active_d1_ret_pct ?? null,
    active_d3_ret_pct: pLast.active_d3_ret_pct ?? null,
    new_d1_ret_pct: pLast.new_d1_ret_pct ?? null,
    new_d3_ret_pct: pLast.new_d3_ret_pct ?? null,
    total_bet_amount_usd: num(pLast.total_bet_amount_usd),
    total_payout_usd: num(pLast.total_payout_usd),
    total_ggr_usd: num(pLast.total_ggr_usd),
    rtp_pct: pLast.rtp_pct ?? null,
  },
};
platform.wow = {
  bet_users_pct: wowPct(platform.this.total_bet_users, platform.last.total_bet_users),
  new_users_pct: wowPct(platform.this.new_users, platform.last.new_users),
  total_ggr_usd_pct: wowPct(platform.this.total_ggr_usd, platform.last.total_ggr_usd),
  total_bet_amount_usd_pct: wowPct(platform.this.total_bet_amount_usd, platform.last.total_bet_amount_usd),
  rtp_pp: wowDiff(platform.this.rtp_pct, platform.last.rtp_pct),
};

// 3. 商户（wow_top：按「本周 Top5」对比「上周」）
const mThis = thisWeek.merchants || {};
const mLast = lastWeek.merchants || {};
const merchantsAllThis = Array.isArray(mThis.all) ? mThis.all : [];
const merchantsAllLast = Array.isArray(mLast.all) ? mLast.all : [];

// map：本周 all / 上周 all
const mThisMap = new Map();
merchantsAllThis.forEach(m => {
  if (!m.merchant_name) return;
  mThisMap.set(norm(m.merchant_name), m);
});
const mLastMap = new Map();
merchantsAllLast.forEach(m => {
  if (!m.merchant_name) return;
  mLastMap.set(norm(m.merchant_name), m);
});

// 给定「本周 Top 列表」，用本周 vs 上周算环比
const buildMerchantWoWFromThisTop = (thisTopList) => {
  const rows = [];
  (Array.isArray(thisTopList) ? thisTopList : []).forEach(tItem => {
    const name = tItem.merchant_name;
    if (!name) return;
    const key = norm(name);
    const t = mThisMap.get(key) || {};
    const l = mLastMap.get(key) || {};
    const row = {
      merchant_name: name,
      this: {   // 本周
        user_total_bet_users: num(t.user_total_bet_users),
        user_new_users: num(t.user_new_users),
        rev_total_ggr_usd: num(t.rev_total_ggr_usd),
        ggr_per_user_usd: t.ggr_per_user_usd ?? null,
        new_d1_ret_pct: t.user_new_d1_ret_pct ?? null,
        new_d3_ret_pct: t.user_new_d3_ret_pct ?? null,
        active_d1_ret_pct: t.user_active_d1_ret_pct ?? null,
        active_d3_ret_pct: t.user_active_d3_ret_pct ?? null,
      },
      last: {   // 上周
        user_total_bet_users: num(l.user_total_bet_users),
        user_new_users: num(l.user_new_users),
        rev_total_ggr_usd: num(l.rev_total_ggr_usd),
        ggr_per_user_usd: l.ggr_per_user_usd ?? null,
        new_d1_ret_pct: l.user_new_d1_ret_pct ?? null,
        new_d3_ret_pct: l.user_new_d3_ret_pct ?? null,
        active_d1_ret_pct: l.user_active_d1_ret_pct ?? null,
        active_d3_ret_pct: l.user_active_d3_ret_pct ?? null,
      },
    };
    row.wow = {
      user_total_bet_users_pct: wowPct(row.this.user_total_bet_users, row.last.user_total_bet_users),
      user_new_users_pct: wowPct(row.this.user_new_users, row.last.user_new_users),
      rev_total_ggr_usd_pct: wowPct(row.this.rev_total_ggr_usd, row.last.rev_total_ggr_usd),
      ggr_per_user_usd_diff: wowDiff(row.this.ggr_per_user_usd, row.last.ggr_per_user_usd),
      new_d1_ret_pp: wowDiff(row.this.new_d1_ret_pct, row.last.new_d1_ret_pct),
      new_d3_ret_pp: wowDiff(row.this.new_d3_ret_pct, row.last.new_d3_ret_pct),
      active_d1_ret_pp: wowDiff(row.this.active_d1_ret_pct, row.last.active_d1_ret_pct),
      active_d3_ret_pp: wowDiff(row.this.active_d3_ret_pct, row.last.active_d3_ret_pct),
    };
    rows.push(row);
  });
  return rows;
};

const M_TOP = 5;
// 本周 Top 榜
const thisTopBetUsers = Array.isArray(mThis.top_bet_users) ? mThis.top_bet_users.slice(0, M_TOP) : [];
const thisTopNewUsers = Array.isArray(mThis.top_new_users) ? mThis.top_new_users.slice(0, M_TOP) : [];
const thisTopGgr      = Array.isArray(mThis.top_ggr)       ? mThis.top_ggr.slice(0, M_TOP)       : [];

// 本周 GGR 为负的商户（按绝对值排序，取 3 个）
const merchantsNegThis = sortDesc(
  merchantsAllThis.filter(m => num(m.rev_total_ggr_usd) < 0),
  m => -num(m.rev_total_ggr_usd)
).slice(0, 3);

// 基于本周 Top 榜 + 本周 vs 上周计算环比
let merchantsWoW_GgrTop = buildMerchantWoWFromThisTop(thisTopGgr);
merchantsWoW_GgrTop = sortDesc(
  merchantsWoW_GgrTop.filter(m => m.wow.rev_total_ggr_usd_pct !== null),
  m => m.wow.rev_total_ggr_usd_pct
).slice(0, M_TOP);
let merchantsWoW_BetUsersTop = buildMerchantWoWFromThisTop(thisTopBetUsers);
merchantsWoW_BetUsersTop = sortDesc(
  merchantsWoW_BetUsersTop.filter(m => m.wow.user_total_bet_users_pct !== null),
  m => m.wow.user_total_bet_users_pct
).slice(0, M_TOP);
let merchantsWoW_NewUsersTop = buildMerchantWoWFromThisTop(thisTopNewUsers);
merchantsWoW_NewUsersTop = sortDesc(
  merchantsWoW_NewUsersTop.filter(m => m.wow.user_new_users_pct !== null),
  m => m.wow.user_new_users_pct
).slice(0, M_TOP);

// 本周 GGR 为负商户的环比
const merchantsWoW_GgrLow = buildMerchantWoWFromThisTop(merchantsNegThis);

// 输出给 AI 的商户结构：
// - this_top：本周 Top 榜
// - wow_top：本周 Top 榜在「本周 vs 上周」的环比表现
const merchants = {
  this_top: {
    top_bet_users: thisTopBetUsers,
    top_new_users: thisTopNewUsers,
    top_ggr: thisTopGgr,
    top_new_d1_ret: Array.isArray(mThis.top_new_d1_ret) ? mThis.top_new_d1_ret.slice(0, M_TOP) : [],
    top_new_d3_ret: Array.isArray(mThis.top_new_d3_ret) ? mThis.top_new_d3_ret.slice(0, M_TOP) : [],
    top_active_d1_ret: Array.isArray(mThis.top_active_d1_ret) ? mThis.top_active_d1_ret.slice(0, M_TOP) : [],
    top_active_d3_ret: Array.isArray(mThis.top_active_d3_ret) ? mThis.top_active_d3_ret.slice(0, M_TOP) : [],
    low_new_d3_ret: Array.isArray(mThis.low_new_d3_ret) ? mThis.low_new_d3_ret.slice(0, M_TOP) : [],
    low_active_d3_ret: Array.isArray(mThis.low_active_d3_ret) ? mThis.low_active_d3_ret.slice(0, M_TOP) : [],
    low_active_d1_ret: Array.isArray(mThis.low_active_d1_ret) ? mThis.low_active_d1_ret.slice(0, M_TOP) : [],
    low_ggr: merchantsNegThis.map(m => ({
      merchant_name: m.merchant_name,
      rev_total_ggr_usd: num(m.rev_total_ggr_usd),
      user_total_bet_users: num(m.user_total_bet_users),
      user_new_users: num(m.user_new_users),
      ggr_per_user_usd: m.ggr_per_user_usd ?? null,
    })),
  },
  wow_top: {
    ggr_top5: merchantsWoW_GgrTop,
    bet_users_top5: merchantsWoW_BetUsersTop,
    new_users_top5: merchantsWoW_NewUsersTop,
    ggr_low: merchantsWoW_GgrLow,
  },
};

// 4. 游戏（GGR wow_top：按「本周 GGR Top5 游戏」对比「上周」）
const gThis = thisWeek.games || {};
const gLast = lastWeek.games || {};
const gamesAllThis = Array.isArray(gThis.all) ? gThis.all : [];
const gamesAllLast = Array.isArray(gLast.all) ? gLast.all : [];
const gThisMap = new Map();
gamesAllThis.forEach(g => {
  if (!g.game_name) return;
  gThisMap.set(norm(g.game_name), g);
});
const gLastMap = new Map();
gamesAllLast.forEach(g => {
  if (!g.game_name) return;
  gLastMap.set(norm(g.game_name), g);
});

// 本周 GGR Top5 游戏
const thisTopGgrGames = Array.isArray(gThis.top_ggr) ? gThis.top_ggr.slice(0, 5) : [];
const gamesWoW_GgrRows = [];

// 本周 GGR 为负的游戏（按绝对值排序，取 3 个）
const gamesNegThis = sortDesc(
  gamesAllThis.filter(g => num(g.rev_total_ggr_usd) < 0),
  g => -num(g.rev_total_ggr_usd)
).slice(0, 3);

thisTopGgrGames.forEach(tItem => {
  const name = tItem.game_name;
  if (!name) return;
  const key = norm(name);
  const t = gThisMap.get(key) || {};
  const l = gLastMap.get(key) || {};
  const row = {
    game_name: name,
    this: {   // 本周
      user_total_bet_users: num(t.user_total_bet_users),
      user_new_users: num(t.user_new_users),
      rev_total_ggr_usd: num(t.rev_total_ggr_usd),
      new_d1_ret_pct: t.user_new_d1_ret_pct ?? null,
      new_d3_ret_pct: t.user_new_d3_ret_pct ?? null,
      active_d1_ret_pct: t.user_active_d1_ret_pct ?? null,
      active_d3_ret_pct: t.user_active_d3_ret_pct ?? null,
    },
    last: {  // 上周
      user_total_bet_users: num(l.user_total_bet_users),
      user_new_users: num(l.user_new_users),
      rev_total_ggr_usd: num(l.rev_total_ggr_usd),
      new_d1_ret_pct: l.user_new_d1_ret_pct ?? null,
      new_d3_ret_pct: l.user_new_d3_ret_pct ?? null,
      active_d1_ret_pct: l.user_active_d1_ret_pct ?? null,
      active_d3_ret_pct: l.user_active_d3_ret_pct ?? null,
    },
  };
  row.wow = {
    user_total_bet_users_pct: wowPct(row.this.user_total_bet_users, row.last.user_total_bet_users),
    user_new_users_pct: wowPct(row.this.user_new_users, row.last.user_new_users),
    rev_total_ggr_usd_pct: wowPct(row.this.rev_total_ggr_usd, row.last.rev_total_ggr_usd),
    new_d1_ret_pp: wowDiff(row.this.new_d1_ret_pct, row.last.new_d1_ret_pct),
    new_d3_ret_pp: wowDiff(row.this.new_d3_ret_pct, row.last.new_d3_ret_pct),
    active_d1_ret_pp: wowDiff(row.this.active_d1_ret_pct, row.last.active_d1_ret_pct),
    active_d3_ret_pp: wowDiff(row.this.active_d3_ret_pct, row.last.active_d3_ret_pct),
  };
  gamesWoW_GgrRows.push(row);
});

// 按 GGR 环比排序
const gamesWoW_GgrTop = sortDesc(
  gamesWoW_GgrRows.filter(g => g.wow.rev_total_ggr_usd_pct !== null),
  g => g.wow.rev_total_ggr_usd_pct
);

// 用户 wow_top：保持原逻辑（本周 vs 上周 + 全量游戏）
const gamesAllThisForUsers = gamesAllThis;
const gamesAllLastForUsers = gamesAllLast;
const gThisUsersMap = new Map();
gamesAllThisForUsers.forEach(g => {
  if (!g.game_name) return;
  gThisUsersMap.set(g.game_name, g);
});
const gLastUsersMap = new Map();
gamesAllLastForUsers.forEach(g => {
  if (!g.game_name) return;
  gLastUsersMap.set(g.game_name, g);
});
const allGameNamesForUsers = new Set([...gThisUsersMap.keys(), ...gLastUsersMap.keys()]);
const gamesCombinedLiteForUsers = [];
allGameNamesForUsers.forEach(name => {
  const key = norm(name);
  const t = gThisUsersMap.get(key) || {};
  const l = gLastUsersMap.get(key) || {};
  const row = {
    game_name: name,
    this: {
      user_total_bet_users: num(t.user_total_bet_users),
      user_new_users: num(t.user_new_users),
      rev_total_ggr_usd: num(t.rev_total_ggr_usd),
    },
    last: {
      user_total_bet_users: num(l.user_total_bet_users),
      user_new_users: num(l.user_new_users),
      rev_total_ggr_usd: num(l.rev_total_ggr_usd),
    },
  };
  row.wow = {
    user_total_bet_users_pct: wowPct(row.this.user_total_bet_users, row.last.user_total_bet_users),
    user_new_users_pct: wowPct(row.this.user_new_users, row.last.user_new_users),
    rev_total_ggr_usd_pct: wowPct(row.this.rev_total_ggr_usd, row.last.rev_total_ggr_usd),
  };
  gamesCombinedLiteForUsers.push(row);
});

const G_TOP = 10;
const gamesWoW_UsersTop = sortDesc(
  gamesCombinedLiteForUsers.filter(g => g.wow.user_total_bet_users_pct !== null),
  g => g.wow.user_total_bet_users_pct
).slice(0, G_TOP);

// 本周 GGR 为负游戏的环比
const gamesWoW_GgrLow = [];
gamesNegThis.forEach(tItem => {
  const name = tItem.game_name;
  if (!name) return;
  const key = norm(name);
  const t = gThisMap.get(key) || {};
  const l = gLastMap.get(key) || {};
  const row = {
    game_name: name,
    this: {
      user_total_bet_users: num(t.user_total_bet_users),
      user_new_users: num(t.user_new_users),
      rev_total_ggr_usd: num(t.rev_total_ggr_usd),
      new_d1_ret_pct: t.user_new_d1_ret_pct ?? null,
      new_d3_ret_pct: t.user_new_d3_ret_pct ?? null,
      active_d1_ret_pct: t.user_active_d1_ret_pct ?? null,
      active_d3_ret_pct: t.user_active_d3_ret_pct ?? null,
    },
    last: {
      user_total_bet_users: num(l.user_total_bet_users),
      user_new_users: num(l.user_new_users),
      rev_total_ggr_usd: num(l.rev_total_ggr_usd),
      new_d1_ret_pct: l.user_new_d1_ret_pct ?? null,
      new_d3_ret_pct: l.user_new_d3_ret_pct ?? null,
      active_d1_ret_pct: l.user_active_d1_ret_pct ?? null,
      active_d3_ret_pct: l.user_active_d3_ret_pct ?? null,
    },
  };
  row.wow = {
    user_total_bet_users_pct: wowPct(row.this.user_total_bet_users, row.last.user_total_bet_users),
    user_new_users_pct: wowPct(row.this.user_new_users, row.last.user_new_users),
    rev_total_ggr_usd_pct: wowPct(row.this.rev_total_ggr_usd, row.last.rev_total_ggr_usd),
    new_d1_ret_pp: wowDiff(row.this.new_d1_ret_pct, row.last.new_d1_ret_pct),
    new_d3_ret_pp: wowDiff(row.this.new_d3_ret_pct, row.last.new_d3_ret_pct),
    active_d1_ret_pp: wowDiff(row.this.active_d1_ret_pct, row.last.active_d1_ret_pct),
    active_d3_ret_pp: wowDiff(row.this.active_d3_ret_pct, row.last.active_d3_ret_pct),
  };
  gamesWoW_GgrLow.push(row);
});

// 本期 Top 榜（直接透传本周）
const games = {
  this_top: {
    top_bet_users: Array.isArray(gThis.top_bet_users) ? gThis.top_bet_users.slice(0, G_TOP) : [],
    top_new_users: Array.isArray(gThis.top_new_users) ? gThis.top_new_users.slice(0, G_TOP) : [],
    top_ggr: Array.isArray(gThis.top_ggr) ? gThis.top_ggr.slice(0, G_TOP) : [],
    top_new_d1_ret: Array.isArray(gThis.top_new_d1_ret) ? gThis.top_new_d1_ret.slice(0, G_TOP) : [],
    top_new_d3_ret: Array.isArray(gThis.top_new_d3_ret) ? gThis.top_new_d3_ret.slice(0, G_TOP) : [],
    top_active_d1_ret: Array.isArray(gThis.top_active_d1_ret) ? gThis.top_active_d1_ret.slice(0, G_TOP) : [],
    top_active_d3_ret: Array.isArray(gThis.top_active_d3_ret) ? gThis.top_active_d3_ret.slice(0, G_TOP) : [],
    low_new_d3_ret: Array.isArray(gThis.low_new_d3_ret) ? gThis.low_new_d3_ret.slice(0, G_TOP) : [],
    low_active_d3_ret: Array.isArray(gThis.low_active_d3_ret) ? gThis.low_active_d3_ret.slice(0, G_TOP) : [],
    low_active_d1_ret: Array.isArray(gThis.low_active_d1_ret) ? gThis.low_active_d1_ret.slice(0, G_TOP) : [],
    low_ggr: gamesNegThis.map(g => ({
      game_name: g.game_name,
      rev_total_ggr_usd: num(g.rev_total_ggr_usd),
      user_total_bet_users: num(g.user_total_bet_users),
      user_new_users: num(g.user_new_users),
    })),
    platform_struct: Array.isArray(gThis.platform_struct) ? gThis.platform_struct : [],
  },
  wow_top: {
    ggr_top5: gamesWoW_GgrTop.slice(0, 5),
    ggr_top10: gamesWoW_GgrTop.slice(0, G_TOP),
    users_top10: gamesWoW_UsersTop,
    ggr_low: gamesWoW_GgrLow,
  },
};

// 5. 币种（wow_top：按「本周 GGR Top3 币种」对比「上周」）
const cThis = thisWeek.currencies || {};
const cLast = lastWeek.currencies || {};
const currAllThis = Array.isArray(cThis.all) ? cThis.all : [];
const currAllLast = Array.isArray(cLast.all) ? cLast.all : [];
const cThisMap = new Map();
currAllThis.forEach(c => {
  if (!c.currency) return;
  cThisMap.set(c.currency, c);
});
const cLastMap = new Map();
currAllLast.forEach(c => {
  if (!c.currency) return;
  cLastMap.set(c.currency, c);
});

// 本周 GGR Top3 币种
const deriveTop3Currencies = () => {
  const explicit = Array.isArray(cThis.top3_ggr) ? cThis.top3_ggr.slice(0, 3) : [];
  if (explicit.length > 0) return explicit;
  // 当 top3_ggr 为空时，从 all 中按 GGR 取前 3
  const sorted = sortDesc(
    currAllThis.filter(c => c.currency && num(c.total_ggr_usd) !== 0),
    c => num(c.total_ggr_usd)
  );
  return sorted.slice(0, 3).map(c => ({
    currency: c.currency,
    total_ggr_usd: num(c.total_ggr_usd),
    share_pct: c.share_pct, // 可能为空，后续补算
  }));
};

const thisTop3Currencies = deriveTop3Currencies();

// 若缺少占比，基于本期总 GGR 自动补算 share_pct
const sumThisGgr = currAllThis.reduce((s, c) => s + num(c.total_ggr_usd), 0);
thisTop3Currencies.forEach(c => {
  if (c.share_pct === undefined || c.share_pct === null) {
    c.share_pct = sumThisGgr ? Number(((num(c.total_ggr_usd) / sumThisGgr) * 100).toFixed(2)) : null;
  }
});

const currenciesCombinedLite = [];
thisTop3Currencies.forEach(tItem => {
  const code = tItem.currency;
  if (!code) return;
  const t = cThisMap.get(code) || {};
  const l = cLastMap.get(code) || {};
  const row = {
    currency: code,
    this: {   // 本周
      total_ggr_usd: num(t.total_ggr_usd),
      share_pct: t.share_pct ?? null,
    },
    last: {   // 上周
      total_ggr_usd: num(l.total_ggr_usd),
      share_pct: l.share_pct ?? null,
    },
  };
  row.wow = {
    total_ggr_usd_pct: wowPct(row.this.total_ggr_usd, row.last.total_ggr_usd),
    share_pp: wowDiff(row.this.share_pct, row.last.share_pct),
  };
  currenciesCombinedLite.push(row);
});

const C_TOP = 3;
const currenciesWoW_GgrTop = sortDesc(
  currenciesCombinedLite.filter(c => c.wow.total_ggr_usd_pct !== null),
  c => c.wow.total_ggr_usd_pct
).slice(0, C_TOP);

const currencies = {
  this_top: {
    top3_ggr: thisTop3Currencies,
  },
  wow_top: {
    ggr_top3: currenciesWoW_GgrTop, // 本周 GGR Top3 币种，在本周 vs 上周的变化
  },
};

// 6. 最终输出
const out = {
  report_type: 'weekly_final_for_ai',
  period: {
    this: thisWeek.period,  // 本周区间
    last: lastWeek.period,  // 上周区间
  },
  platform,
  merchants,
  games,
  currencies,
  meta: {
    generated_at: new Date().toISOString(),
  },
};

console.log('✅ weekly_final_for_ai 生成完成（平台 & wow_top 均为本周 vs 上周，wow_top 基于本周 Top 榜，包含 GGR 负值榜单）');
return [{ json: out }];

