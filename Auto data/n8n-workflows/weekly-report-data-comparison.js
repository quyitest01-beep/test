// 双周对比 + 生成报告数据节点
// 输入：本周数据（from 单周数据清洗） + 上周数据（from 单周数据清洗）
// 输出：对比后的数据 + Top3/Tail3 榜单 + 最终给 AI 的报告数据

const inputs = $input.all();

console.log('=== 双周对比 + 报告数据生成开始 ===');
console.log('📊 输入项数量:', inputs.length);

// ========== 1. 识别本周和上周数据 ==========
let thisWeekData = null;
let lastWeekData = null;

inputs.forEach((input, idx) => {
  const data = input.json || {};
  
  if (data.period && data.game_base && data.mcht_base) {
    // 判断是本周还是上周（简单逻辑：period.key 更晚的是本周）
    if (!thisWeekData || !lastWeekData) {
      if (!thisWeekData) {
        thisWeekData = data;
        console.log(`✅ 识别为本周数据 #${idx + 1}: ${data.period.key}`);
      } else {
        // 比较 period.key，更晚的是本周
        const thisKey = thisWeekData.period.key || '';
        const thatKey = data.period.key || '';
        if (thatKey > thisKey) {
          lastWeekData = thisWeekData;
          thisWeekData = data;
          console.log(`✅ 更新：本周=${data.period.key}, 上周=${lastWeekData.period.key}`);
        } else {
          lastWeekData = data;
          console.log(`✅ 识别为上周数据 #${idx + 1}: ${data.period.key}`);
        }
      }
    }
  }
});

if (!thisWeekData) {
  throw new Error('❌ 未找到本周数据，请确保上游「单周数据清洗」节点已执行');
}

// 如果没有上周数据，创建一个空的上周数据结构（用于单周报告）
if (!lastWeekData) {
  console.log('⚠️ 未找到上周数据，将生成单周报告（无对比）');
  lastWeekData = {
    period: { key: '', start: '', end: '' },
    game_base: [],
    mcht_base: [],
    curr_base: [],
    game_ret: [],
    mcht_ret: [],
    game_idle: [],
  };
}

// ========== 2. 工具函数 ==========
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 环比计算（百分比）
const calcWowPercent = (thisVal, lastVal) => {
  if (lastVal === null || lastVal === undefined || lastVal === 0) return null;
  const thisNum = num(thisVal) || 0;
  const lastNum = num(lastVal) || 0;
  if (lastNum === 0) return null;
  return Number(((thisNum - lastNum) / lastNum * 100).toFixed(1));
};

// 环比计算（百分点，用于留存率）
const calcWowPP = (thisVal, lastVal) => {
  const thisNum = num(thisVal);
  const lastNum = num(lastVal);
  if (thisNum === null || lastNum === null) return null;
  return Number((thisNum - lastNum).toFixed(1));
};

// ========== 3. 游戏级对比（G01-G06 榜单） ==========
const gameBaseMap = new Map();

// 建立上周数据索引
lastWeekData.game_base.forEach(g => {
  gameBaseMap.set(g.game_name, { last: g });
});

// 合并本周数据并计算环比
thisWeekData.game_base.forEach(g => {
  const key = g.game_name;
  if (!gameBaseMap.has(key)) {
    gameBaseMap.set(key, { this: g, last: null });
  } else {
    gameBaseMap.get(key).this = g;
  }
});

const game_comparison = Array.from(gameBaseMap.entries())
  .map(([game_name, { this: thisG, last: lastG }]) => {
    const thisGgr = num(thisG?.ggr_usd) || 0;
    const lastGgr = num(lastG?.ggr_usd) || 0;
    const thisUsers = num(thisG?.betting_users) || 0;
    const lastUsers = num(lastG?.betting_users) || 0;
    const thisRounds = num(thisG?.total_rounds) || 0;
    const lastRounds = num(lastG?.total_rounds) || 0;
    
    return {
      game_name,
      // 本周值
      this_ggr_usd: thisGgr,
      this_betting_users: thisUsers,
      this_total_rounds: thisRounds,
      this_rtp: num(thisG?.rtp),
      // 上周值
      last_ggr_usd: lastGgr,
      last_betting_users: lastUsers,
      last_total_rounds: lastRounds,
      last_rtp: num(lastG?.rtp),
      // 环比
      wow_ggr_percent: calcWowPercent(thisGgr, lastGgr),
      wow_users_percent: calcWowPercent(thisUsers, lastUsers),
      wow_rounds_percent: calcWowPercent(thisRounds, lastRounds),
    };
  })
  .filter(g => g.this_ggr_usd > 0 || g.this_betting_users > 0); // 只保留有数据的游戏

// Top3 / Tail3 榜单
const game_top3_ggr = [...game_comparison]
  .sort((a, b) => (b.this_ggr_usd || 0) - (a.this_ggr_usd || 0))
  .slice(0, 3);

const game_tail3_ggr = [...game_comparison]
  .sort((a, b) => (a.this_ggr_usd || 0) - (b.this_ggr_usd || 0))
  .slice(0, 3);

const game_top3_users = [...game_comparison]
  .sort((a, b) => (b.this_betting_users || 0) - (a.this_betting_users || 0))
  .slice(0, 3);

console.log(`✅ 游戏级对比完成: ${game_comparison.length} 个游戏`);

// ========== 4. 商户级对比（M01-M04 榜单） ==========
const mchtBaseMap = new Map();

lastWeekData.mcht_base.forEach(m => {
  mchtBaseMap.set(m.merchant_name, { last: m });
});

thisWeekData.mcht_base.forEach(m => {
  const key = m.merchant_name;
  if (!mchtBaseMap.has(key)) {
    mchtBaseMap.set(key, { this: m, last: null });
  } else {
    mchtBaseMap.get(key).this = m;
  }
});

const mcht_comparison = Array.from(mchtBaseMap.entries())
  .map(([merchant_name, { this: thisM, last: lastM }]) => {
    const thisGgr = num(thisM?.ggr_usd) || 0;
    const lastGgr = num(lastM?.ggr_usd) || 0;
    const thisUsers = num(thisM?.betting_users) || 0;
    const lastUsers = num(lastM?.betting_users) || 0;
    
    return {
      merchant_name,
      this_ggr_usd: thisGgr,
      this_betting_users: thisUsers,
      last_ggr_usd: lastGgr,
      last_betting_users: lastUsers,
      wow_ggr_percent: calcWowPercent(thisGgr, lastGgr),
      wow_users_percent: calcWowPercent(thisUsers, lastUsers),
    };
  })
  .filter(m => m.this_ggr_usd > 0 || m.this_betting_users > 0);

const mcht_top3_ggr = [...mcht_comparison]
  .sort((a, b) => (b.this_ggr_usd || 0) - (a.this_ggr_usd || 0))
  .slice(0, 3);

const mcht_tail3_ggr = [...mcht_comparison]
  .sort((a, b) => (a.this_ggr_usd || 0) - (b.this_ggr_usd || 0))
  .slice(0, 3);

console.log(`✅ 商户级对比完成: ${mcht_comparison.length} 个商户`);

// ========== 5. 币种级对比（C01 榜单） ==========
const currBaseMap = new Map();

lastWeekData.curr_base.forEach(c => {
  currBaseMap.set(c.currency, { last: c });
});

thisWeekData.curr_base.forEach(c => {
  const key = c.currency;
  if (!currBaseMap.has(key)) {
    currBaseMap.set(key, { this: c, last: null });
  } else {
    currBaseMap.get(key).this = c;
  }
});

const curr_comparison = Array.from(currBaseMap.entries())
  .map(([currency, { this: thisC, last: lastC }]) => {
    const thisGgr = num(thisC?.ggr_usd) || 0;
    const lastGgr = num(lastC?.ggr_usd) || 0;
    
    return {
      currency,
      this_ggr_usd: thisGgr,
      last_ggr_usd: lastGgr,
      wow_ggr_percent: calcWowPercent(thisGgr, lastGgr),
    };
  })
  .filter(c => c.this_ggr_usd > 0);

console.log(`✅ 币种级对比完成: ${curr_comparison.length} 个币种`);

// ========== 6. 留存对比 ==========
// 游戏留存对比
const gameRetMap = new Map();

lastWeekData.game_ret.forEach(r => {
  const key = `${r.game_name}||${r.retention_type || ''}`;
  gameRetMap.set(key, { last: r });
});

thisWeekData.game_ret.forEach(r => {
  const key = `${r.game_name}||${r.retention_type || ''}`;
  if (!gameRetMap.has(key)) {
    gameRetMap.set(key, { this: r, last: null });
  } else {
    gameRetMap.get(key).this = r;
  }
});

const game_ret_comparison = Array.from(gameRetMap.entries())
  .map(([key, { this: thisR, last: lastR }]) => {
    const [game_name, retention_type] = key.split('||');
    return {
      game_name,
      retention_type,
      this_day0_users: num(thisR?.day0_users) || 0,
      this_day1_ret: num(thisR?.day1_ret),
      this_day7_ret: num(thisR?.day7_ret),
      last_day0_users: num(lastR?.day0_users) || 0,
      last_day1_ret: num(lastR?.day1_ret),
      last_day7_ret: num(lastR?.day7_ret),
      wow_day1_pp: calcWowPP(thisR?.day1_ret, lastR?.day1_ret),
      wow_day7_pp: calcWowPP(thisR?.day7_ret, lastR?.day7_ret),
    };
  });

// 商户留存对比
const mchtRetMap = new Map();

lastWeekData.mcht_ret.forEach(r => {
  const key = `${r.merchant_name}||${r.retention_type || ''}`;
  mchtRetMap.set(key, { last: r });
});

thisWeekData.mcht_ret.forEach(r => {
  const key = `${r.merchant_name}||${r.retention_type || ''}`;
  if (!mchtRetMap.has(key)) {
    mchtRetMap.set(key, { this: r, last: null });
  } else {
    mchtRetMap.get(key).this = r;
  }
});

const mcht_ret_comparison = Array.from(mchtRetMap.entries())
  .map(([key, { this: thisR, last: lastR }]) => {
    const [merchant_name, retention_type] = key.split('||');
    return {
      merchant_name,
      retention_type,
      this_day0_users: num(thisR?.day0_users) || 0,
      this_day1_ret: num(thisR?.day1_ret),
      this_day7_ret: num(thisR?.day7_ret),
      last_day0_users: num(lastR?.day0_users) || 0,
      last_day1_ret: num(lastR?.day1_ret),
      last_day7_ret: num(lastR?.day7_ret),
      wow_day1_pp: calcWowPP(thisR?.day1_ret, lastR?.day1_ret),
      wow_day7_pp: calcWowPP(thisR?.day7_ret, lastR?.day7_ret),
    };
  });

console.log(`✅ 留存对比完成: 游戏 ${game_ret_comparison.length} 条, 商户 ${mcht_ret_comparison.length} 条`);

// ========== 7. 组装最终输出（给 AI 生成报告用） ==========
const output = {
  report_type: thisWeekData.period.type || 'weekly',
  
  period: {
    this_week: thisWeekData.period.key,
    last_week: lastWeekData.period.key || '',
    this_start: thisWeekData.period.start,
    this_end: thisWeekData.period.end,
    last_start: lastWeekData.period.start || '',
    last_end: lastWeekData.period.end || '',
  },
  
  // 游戏维度（对比数据 + Top3/Tail3）
  games: {
    all: game_comparison,
    top3_ggr: game_top3_ggr,
    tail3_ggr: game_tail3_ggr,
    top3_users: game_top3_users,
  },
  
  // 商户维度
  merchants: {
    all: mcht_comparison,
    top3_ggr: mcht_top3_ggr,
    tail3_ggr: mcht_tail3_ggr,
  },
  
  // 币种维度
  currencies: {
    all: curr_comparison,
  },
  
  // 留存维度
  retention: {
    games: game_ret_comparison,
    merchants: mcht_ret_comparison,
  },
  
  // 游戏空转指数（本周）
  game_idle: thisWeekData.game_idle || [],
  
  meta: {
    generated_at: new Date().toISOString(),
    has_comparison: !!lastWeekData.period.key,
    game_count: game_comparison.length,
    merchant_count: mcht_comparison.length,
    currency_count: curr_comparison.length,
  },
};

console.log(`\n✅ 双周对比 + 报告数据生成完成！`);
console.log(`   本周: ${thisWeekData.period.key}`);
console.log(`   上周: ${lastWeekData.period.key || '无'}`);
console.log(`   游戏对比: ${game_comparison.length} 个`);
console.log(`   商户对比: ${mcht_comparison.length} 个`);

return [{ json: output }];

