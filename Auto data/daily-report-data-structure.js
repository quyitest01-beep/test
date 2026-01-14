// 日度报告精简数据（今日 + 昨日 + 环比）
// 输出：report_type = 'daily_final_for_ai'
// 平台：今日 vs 昨日
// 商户 / 游戏 / 币种 DoD 榜单：按「今日 Top 榜」对比「昨日」
// 新增：游戏 TOP20 排行榜、贡献分解分析、Hold 归因分析

// 获取输入数据 - 兼容 n8n 和直接调用
const inputs = (typeof $input !== 'undefined' && $input.all) 
    ? $input.all().map(i => i.json || {})
    : (Array.isArray(arguments[0]) ? arguments[0] : []);
if (inputs.length < 2) {
    throw new Error(`❌ 需要至少 2 个 daily 清洗结果（昨日、今日），本次只有 ${inputs.length} 个`);
}

// 工具函数
const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const dodPct = (todayVal, yesterdayVal) => {
    const t = num(todayVal);
    const y = num(yesterdayVal);
    if (!y) return null;
    return Number(((t - y) / y * 100).toFixed(2)); // 百分比
};

const dodDiff = (todayVal, yesterdayVal) => {
    if (todayVal === null || todayVal === undefined ||
        yesterdayVal === null || yesterdayVal === undefined) return null;
    const t = Number(todayVal);
    const y = Number(yesterdayVal);
    if (!Number.isFinite(t) || !Number.isFinite(y)) return null;
    return Number((t - y).toFixed(2)); // 差值，pp 或绝对值
};

const sortDesc = (arr, getVal) =>
    [...arr].sort((a, b) => num(getVal(b)) - num(getVal(a)));

// 1. 识别今日 & 昨日（按 period.start 排序）
const dailyItems = inputs.filter(i => i.report_type === 'daily' && i.period);
if (dailyItems.length < 2) {
    throw new Error(`❌ 找到的 daily 结果不足 2 个，当前为 ${dailyItems.length} 个`);
}

dailyItems.sort((a, b) => String(a.period.start).localeCompare(String(b.period.start)));
const yesterday = dailyItems[dailyItems.length - 2]; // 昨日
const today = dailyItems[dailyItems.length - 1]; // 今日

console.log('📅 昨日  :', yesterday.period);
console.log('📅 今日  :', today.period);

// 2. 平台层（今日 vs 昨日）+ 贡献分解分析
const pToday = today.platform || {};
const pYesterday = yesterday.platform || {};

const platform = {
    today: {
        total_bet_users: num(pToday.total_bet_users),
        new_users: num(pToday.new_users),
        active_d1_ret_pct: pToday.active_d1_ret_pct ?? null,
        new_d1_ret_pct: pToday.new_d1_ret_pct ?? null,
        total_bet_amount_usd: num(pToday.total_bet_amount_usd),
        total_payout_usd: num(pToday.total_payout_usd),
        total_ggr_usd: num(pToday.total_ggr_usd),
        rtp_pct: pToday.rtp_pct ?? null,
        hold_pct: pToday.hold_pct ?? null, // Hold = 1 - RTP
        avg_bet_per_user: pToday.avg_bet_per_user ?? null,
        bet_frequency: pToday.bet_frequency ?? null, // 平均投注频次
    },
    yesterday: {
        total_bet_users: num(pYesterday.total_bet_users),
        new_users: num(pYesterday.new_users),
        active_d1_ret_pct: pYesterday.active_d1_ret_pct ?? null,
        new_d1_ret_pct: pYesterday.new_d1_ret_pct ?? null,
        total_bet_amount_usd: num(pYesterday.total_bet_amount_usd),
        total_payout_usd: num(pYesterday.total_payout_usd),
        total_ggr_usd: num(pYesterday.total_ggr_usd),
        rtp_pct: pYesterday.rtp_pct ?? null,
        hold_pct: pYesterday.hold_pct ?? null,
        avg_bet_per_user: pYesterday.avg_bet_per_user ?? null,
        bet_frequency: pYesterday.bet_frequency ?? null,
    },
};

platform.dod = {
    bet_users_pct: dodPct(platform.today.total_bet_users, platform.yesterday.total_bet_users),
    new_users_pct: dodPct(platform.today.new_users, platform.yesterday.new_users),
    total_ggr_usd_pct: dodPct(platform.today.total_ggr_usd, platform.yesterday.total_ggr_usd),
    total_bet_amount_usd_pct: dodPct(platform.today.total_bet_amount_usd, platform.yesterday.total_bet_amount_usd),
    rtp_pp: dodDiff(platform.today.rtp_pct, platform.yesterday.rtp_pct),
    hold_pp: dodDiff(platform.today.hold_pct, platform.yesterday.hold_pct),
};

// 新增：贡献分解分析 ΔNGR = ΔTurnover + ΔHold
const turnover_contribution = (platform.today.total_bet_amount_usd - platform.yesterday.total_bet_amount_usd) * (platform.yesterday.hold_pct / 100);
const hold_contribution = platform.today.total_bet_amount_usd * (platform.today.hold_pct - platform.yesterday.hold_pct) / 100;
const total_ngr_change = platform.today.total_ggr_usd - platform.yesterday.total_ggr_usd;

platform.contribution_analysis = {
    total_ngr_change: total_ngr_change,
    turnover_contribution: turnover_contribution,
    hold_contribution: hold_contribution,
    // 进一步分解到 Active/Freq/Size
    active_contribution: (platform.today.total_bet_users - platform.yesterday.total_bet_users) * platform.yesterday.avg_bet_per_user * platform.yesterday.bet_frequency * (platform.yesterday.hold_pct / 100),
    frequency_contribution: platform.today.total_bet_users * (platform.today.bet_frequency - platform.yesterday.bet_frequency) * platform.yesterday.avg_bet_per_user * (platform.yesterday.hold_pct / 100),
    size_contribution: platform.today.total_bet_users * platform.today.bet_frequency * (platform.today.avg_bet_per_user - platform.yesterday.avg_bet_per_user) * (platform.yesterday.hold_pct / 100),
};

// 3. 商户维度：从排名 → 贡献分析
const mToday = today.merchants || {};
const mYesterday = yesterday.merchants || {};
const merchantsAllToday = Array.isArray(mToday.all) ? mToday.all : [];
const merchantsAllYesterday = Array.isArray(mYesterday.all) ? mYesterday.all : [];

// 构建商户映射
const mTodayMap = new Map();
merchantsAllToday.forEach(m => {
    if (!m.merchant_name) return;
    mTodayMap.set(m.merchant_name, m);
});

const mYesterdayMap = new Map();
merchantsAllYesterday.forEach(m => {
    if (!m.merchant_name) return;
    mYesterdayMap.set(m.merchant_name, m);
});

// 计算每个商户对 ΔNGR 的贡献
const buildMerchantContribution = () => {
    const contributions = [];
    const allMerchantNames = new Set([...mTodayMap.keys(), ...mYesterdayMap.keys()]);
    
    allMerchantNames.forEach(name => {
        const t = mTodayMap.get(name) || {};
        const y = mYesterdayMap.get(name) || {};
        
        const todayGGR = num(t.rev_total_ggr_usd);
        const yesterdayGGR = num(y.rev_total_ggr_usd);
        const ggrContribution = todayGGR - yesterdayGGR;
        
        const row = {
            merchant_name: name,
            today: {
                user_total_bet_users: num(t.user_total_bet_users),
                user_new_users: num(t.user_new_users),
                rev_total_ggr_usd: todayGGR,
                total_bet_amount_usd: num(t.total_bet_amount_usd),
                hold_pct: t.hold_pct ?? null,
            },
            yesterday: {
                user_total_bet_users: num(y.user_total_bet_users),
                user_new_users: num(y.user_new_users),
                rev_total_ggr_usd: yesterdayGGR,
                total_bet_amount_usd: num(y.total_bet_amount_usd),
                hold_pct: y.hold_pct ?? null,
            },
            contribution: {
                ggr_contribution: ggrContribution,
                ggr_contribution_pct: total_ngr_change !== 0 ? (ggrContribution / Math.abs(total_ngr_change) * 100) : 0,
                turnover_contribution: (num(t.total_bet_amount_usd) - num(y.total_bet_amount_usd)) * ((y.hold_pct || 0) / 100),
                hold_contribution: num(t.total_bet_amount_usd) * ((t.hold_pct || 0) - (y.hold_pct || 0)) / 100,
            },
            dod: {
                user_total_bet_users_pct: dodPct(todayGGR, yesterdayGGR),
                user_new_users_pct: dodPct(num(t.user_new_users), num(y.user_new_users)),
                rev_total_ggr_usd_pct: dodPct(todayGGR, yesterdayGGR),
            },
        };
        
        contributions.push(row);
    });
    
    return contributions;
};

const merchantContributions = buildMerchantContribution();

// 按贡献排序
const topPositiveContributors = sortDesc(
    merchantContributions.filter(m => m.contribution.ggr_contribution > 0),
    m => m.contribution.ggr_contribution
).slice(0, 10);

const topNegativeContributors = sortDesc(
    merchantContributions.filter(m => m.contribution.ggr_contribution < 0),
    m => -m.contribution.ggr_contribution
).slice(0, 10);

const merchants = {
    today_top: {
        top_bet_users: Array.isArray(mToday.top_bet_users) ? mToday.top_bet_users.slice(0, 10) : [],
        top_new_users: Array.isArray(mToday.top_new_users) ? mToday.top_new_users.slice(0, 10) : [],
        top_ggr: Array.isArray(mToday.top_ggr) ? mToday.top_ggr.slice(0, 10) : [],
    },
    contribution_analysis: {
        top_positive_contributors: topPositiveContributors,
        top_negative_contributors: topNegativeContributors,
        all_contributions: merchantContributions,
    },
};

// 4. 游戏维度：新增 TOP20 排行榜 + Hold 变化归因分析
const gToday = today.games || {};
const gYesterday = yesterday.games || {};
const gamesAllToday = Array.isArray(gToday.all) ? gToday.all : [];
const gamesAllYesterday = Array.isArray(gYesterday.all) ? gYesterday.all : [];

const gTodayMap = new Map();
gamesAllToday.forEach(g => {
    if (!g.game_name) return;
    gTodayMap.set(g.game_name, g);
});

const gYesterdayMap = new Map();
gamesAllYesterday.forEach(g => {
    if (!g.game_name) return;
    gYesterdayMap.set(g.game_name, g);
});

// 游戏 TOP20 排行榜
const gamesTop20ByGGR = Array.isArray(gToday.top_ggr) ? gToday.top_ggr.slice(0, 20) : [];
const gamesTop20ByUsers = Array.isArray(gToday.top_bet_users) ? gToday.top_bet_users.slice(0, 20) : [];

// Hold 变化归因分析
const buildGameHoldAnalysis = () => {
    const holdAnalysis = [];
    const allGameNames = new Set([...gTodayMap.keys(), ...gYesterdayMap.keys()]);
    
    allGameNames.forEach(name => {
        const t = gTodayMap.get(name) || {};
        const y = gYesterdayMap.get(name) || {};
        
        const todayHold = t.hold_pct || 0;
        const yesterdayHold = y.hold_pct || 0;
        const holdChange = todayHold - yesterdayHold;
        
        if (Math.abs(holdChange) > 0.5) { // 只分析 Hold 变化超过 0.5% 的游戏
            const todayGGRShare = num(t.rev_total_ggr_usd) / platform.today.total_ggr_usd * 100;
            const yesterdayGGRShare = num(y.rev_total_ggr_usd) / platform.yesterday.total_ggr_usd * 100;
            const shareChange = todayGGRShare - yesterdayGGRShare;
            
            const row = {
                game_name: name,
                hold_change: holdChange,
                ggr_share_change: shareChange,
                attribution: {
                    // Mix 效应：游戏曝光占比变化的影响
                    mix_effect: shareChange * yesterdayHold,
                    // Within 效应：游戏自身表现变化的影响
                    within_effect: todayGGRShare * holdChange,
                },
                today: {
                    hold_pct: todayHold,
                    ggr_share_pct: todayGGRShare,
                    rev_total_ggr_usd: num(t.rev_total_ggr_usd),
                },
                yesterday: {
                    hold_pct: yesterdayHold,
                    ggr_share_pct: yesterdayGGRShare,
                    rev_total_ggr_usd: num(y.rev_total_ggr_usd),
                },
            };
            
            holdAnalysis.push(row);
        }
    });
    
    return holdAnalysis.sort((a, b) => Math.abs(b.hold_change) - Math.abs(a.hold_change));
};

const gameHoldAnalysis = buildGameHoldAnalysis();

const games = {
    today_top: {
        top20_ggr: gamesTop20ByGGR,
        top20_bet_users: gamesTop20ByUsers,
        top_new_users: Array.isArray(gToday.top_new_users) ? gToday.top_new_users.slice(0, 10) : [],
        top_new_d1_ret: Array.isArray(gToday.top_new_d1_ret) ? gToday.top_new_d1_ret.slice(0, 10) : [],
        low_new_d1_ret: Array.isArray(gToday.low_new_d1_ret) ? gToday.low_new_d1_ret.slice(0, 10) : [],
    },
    hold_analysis: {
        significant_changes: gameHoldAnalysis.slice(0, 15), // Top 15 Hold 变化最大的游戏
        mix_driven: gameHoldAnalysis.filter(g => Math.abs(g.attribution.mix_effect) > Math.abs(g.attribution.within_effect)).slice(0, 10),
        within_driven: gameHoldAnalysis.filter(g => Math.abs(g.attribution.within_effect) > Math.abs(g.attribution.mix_effect)).slice(0, 10),
    },
};

// 5. 币种维度（保持原有逻辑，调整为日度对比）
const cToday = today.currencies || {};
const cYesterday = yesterday.currencies || {};

const currencies = {
    today_top: {
        top3_ggr: Array.isArray(cToday.top3_ggr) ? cToday.top3_ggr.slice(0, 3) : [],
    },
    dod_analysis: {
        // 这里可以添加币种的日度对比分析
    },
};

// 6. 最终输出
const out = {
    report_type: 'daily_final_for_ai',
    period: {
        today: today.period,     // 今日区间
        yesterday: yesterday.period, // 昨日区间
    },
    platform,
    merchants,
    games,
    currencies,
    meta: {
        generated_at: new Date().toISOString(),
        analysis_focus: ['contribution_decomposition', 'hold_attribution', 'top20_rankings'],
    },
};

console.log('✅ daily_final_for_ai 生成完成（今日 vs 昨日，包含贡献分解、Hold归因、TOP20排行榜）');
return [{ json: out }];