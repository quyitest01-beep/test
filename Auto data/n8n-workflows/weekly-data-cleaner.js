// 单周/月数据清洗节点（适配已聚合的上游数据格式）
// 输入：已聚合的数据（全平台/商户/游戏维度，包含合计行和每日明细行）
// 输出：单周的基础数据表（game_base, mcht_base, curr_base, game_ret, mcht_ret, game_idle）

const inputs = $input.all();

console.log('=== 单周数据清洗开始 ===');
console.log('📊 输入项数量:', inputs.length);

// ========== 1. 解析输入数据 ==========
const allRows = inputs.map(input => input.json || {});

// 分类数据
const platformData = allRows.find(r => r['类型'] === '全平台');
const merchantRows = allRows.filter(r => r['类型'] === '商户');
const gameRows = allRows.filter(r => r['类型'] === '游戏');
const revenueRows = allRows.filter(r => r['类型'] === '币种' || r['总投注USD'] !== undefined);

// 识别周期（从第一个日期推断或从上游传入）
let targetPeriod = null;

// 尝试从上游传入的周期信息
const periodInput = allRows.find(r => r.period || r.target_period);
if (periodInput) {
  const period = periodInput.period || {};
  targetPeriod = {
    type: periodInput.report_type || 'weekly',
    start: period.start || periodInput.target_period?.split('-')[0] || '',
    end: period.end || periodInput.target_period?.split('-')[1] || '',
    key: period.key || periodInput.target_period || '',
  };
}

// 如果还没找到，从数据中推断（找第一个日期）
if (!targetPeriod) {
  const firstDateRow = allRows.find(r => r['日期'] && r['日期'] !== '合计' && r['日期'] !== '全平台');
  if (firstDateRow) {
    const dateStr = String(firstDateRow['日期']).replace(/-/g, '');
    if (dateStr.length === 8) {
      // 推断为包含该日期的一周
      const date = new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8))
      );
      const dayOfWeek = date.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(date);
      monday.setDate(date.getDate() - daysToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${dd}`;
      };
      
      targetPeriod = {
        type: 'weekly',
        start: fmt(monday),
        end: fmt(sunday),
        key: `${fmt(monday)}-${fmt(sunday)}`,
      };
    }
  }
}

if (!targetPeriod || !targetPeriod.start) {
  throw new Error('❌ 未找到目标周期信息，请确保上游节点传入 period 或 target_period 字段');
}

console.log(`\n📅 目标周期: ${targetPeriod.key} (${targetPeriod.type})`);

// ========== 2. 工具函数 ==========
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 解析百分比字符串（如 "28.95%" → 28.95）
const parsePercent = (str) => {
  if (!str) return null;
  const s = String(str).replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// 归一化日期格式
const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '合计') return dateStr;
  return String(dateStr).replace(/-/g, '');
};

// 判断日期是否在周期内
const isInPeriod = (dateStr) => {
  if (!dateStr || dateStr === '合计') return false;
  const normalized = normalizeDate(dateStr);
  return normalized >= targetPeriod.start && normalized <= targetPeriod.end;
};

// ========== 3. 步骤③：游戏级聚合（game_base） ==========
const gameBaseMap = new Map();

// 从游戏维度数据提取（合计行）
gameRows.forEach(row => {
  if (row['日期'] !== '合计') return;
  
  const gameName = String(row['游戏名'] || '').trim();
  if (!gameName) return;
  
  const bettingUsers = num(row['投注用户数']) || 0;
  
  if (!gameBaseMap.has(gameName)) {
    gameBaseMap.set(gameName, {
      game_name: gameName,
      ggr_usd: null, // 上游数据没有营收数据
      betting_users: 0,
      total_rounds: null, // 上游数据没有局数数据
      rtp: null, // 上游数据没有RTP数据
      merchant_count: 0, // 无法从当前数据获取
    });
  }
  
  const g = gameBaseMap.get(gameName);
  g.betting_users = bettingUsers;
});

// 从营收数据中尝试获取游戏级GGR和局数（如果有）
revenueRows.forEach(row => {
  const gameName = String(row['游戏名'] || '').trim();
  if (!gameName || gameName === '合计') return;
  
  if (gameBaseMap.has(gameName)) {
    const g = gameBaseMap.get(gameName);
    if (row['GGR-USD'] !== undefined) {
      g.ggr_usd = (g.ggr_usd || 0) + (num(row['GGR-USD']) || 0);
    }
    if (row['总局数'] !== undefined) {
      g.total_rounds = (g.total_rounds || 0) + (num(row['总局数']) || 0);
    }
    if (row['RTP'] !== undefined) {
      const rtp = parsePercent(row['RTP']);
      if (rtp !== null) {
        g.rtp = rtp;
      }
    }
  }
});

const game_base = Array.from(gameBaseMap.values())
  .filter(g => g.total_rounds === null || g.total_rounds >= 1000); // 如果有局数数据，过滤总局数<1000

console.log(`✅ 游戏级聚合完成: ${game_base.length} 个游戏`);

// ========== 4. 步骤④：商户级聚合（mcht_base） ==========
const mchtBaseMap = new Map();

// 从商户维度数据提取（合计行）
merchantRows.forEach(row => {
  if (row['日期'] !== '合计') return;
  
  const merchantName = String(row['商户名'] || '').trim();
  if (!merchantName) return;
  
  const bettingUsers = num(row['投注用户数']) || 0;
  
  if (!mchtBaseMap.has(merchantName)) {
    mchtBaseMap.set(merchantName, {
      merchant_name: merchantName,
      ggr_usd: null, // 上游数据没有营收数据
      betting_users: 0,
    });
  }
  
  const m = mchtBaseMap.get(merchantName);
  m.betting_users = bettingUsers;
});

// 从营收数据中尝试获取商户级GGR（如果有）
revenueRows.forEach(row => {
  const merchantName = String(row['商户名'] || '').trim();
  if (!merchantName || row['游戏名'] === '合计') return;
  
  if (mchtBaseMap.has(merchantName)) {
    const m = mchtBaseMap.get(merchantName);
    if (row['GGR-USD'] !== undefined) {
      m.ggr_usd = (m.ggr_usd || 0) + (num(row['GGR-USD']) || 0);
    }
  }
});

const mcht_base = Array.from(mchtBaseMap.values());

console.log(`✅ 商户级聚合完成: ${mcht_base.length} 个商户`);

// ========== 5. 步骤⑤：币种级聚合（curr_base） ==========
const currBaseMap = new Map();

// 从营收数据中提取币种级数据
revenueRows.forEach(row => {
  const currency = String(row['货币'] || row['币种'] || '').trim();
  if (!currency || row['游戏名'] === '合计') return;
  
  const ggrUsd = num(row['GGR-USD'] || row['总GGR_USD']) || 0;
  
  if (!currBaseMap.has(currency)) {
    currBaseMap.set(currency, {
      currency: currency,
      ggr_usd: 0,
    });
  }
  
  const c = currBaseMap.get(currency);
  c.ggr_usd += ggrUsd;
});

const curr_base = Array.from(currBaseMap.values());

console.log(`✅ 币种级聚合完成: ${curr_base.length} 个币种`);

// ========== 6. 步骤⑥：游戏留存聚合（game_ret） ==========
const gameRetMap = new Map();

// 从游戏维度数据提取留存信息（合计行）
gameRows.forEach(row => {
  if (row['日期'] !== '合计') return;
  
  const gameName = String(row['游戏名'] || '').trim();
  if (!gameName) return;
  
  const newUsers = num(row['新用户数']) || 0;
  if (newUsers < 50) return; // 过滤：day0_users≥50
  
  // 新用户留存
  const newD1Ret = parsePercent(row['新用户次日留存']);
  const newD3Ret = parsePercent(row['新用户3日留存']);
  
  // 活跃用户留存
  const activeD1Ret = parsePercent(row['活跃用户次日留存']);
  const activeD3Ret = parsePercent(row['活跃用户3日留存']);
  
  // 新用户留存记录
  if (newD1Ret !== null || newD3Ret !== null) {
    if (!gameRetMap.has(`${gameName}_新用户留存`)) {
      gameRetMap.set(`${gameName}_新用户留存`, {
        game_name: gameName,
        retention_type: '新用户留存',
        day0_users: 0,
        day1_ret: null,
        day3_ret: null,
      });
    }
    const r = gameRetMap.get(`${gameName}_新用户留存`);
    r.day0_users += newUsers;
    if (newD1Ret !== null) r.day1_ret = newD1Ret;
    if (newD3Ret !== null) r.day3_ret = newD3Ret;
  }
  
  // 活跃用户留存记录（需要从投注用户数中估算活跃用户数）
  // 由于上游数据没有明确的活跃用户当日用户数，这里用投注用户数作为近似
  const activeUsers = num(row['投注用户数']) || 0;
  if (activeUsers >= 50 && (activeD1Ret !== null || activeD3Ret !== null)) {
    if (!gameRetMap.has(`${gameName}_活跃用户留存`)) {
      gameRetMap.set(`${gameName}_活跃用户留存`, {
        game_name: gameName,
        retention_type: '活跃用户留存',
        day0_users: 0,
        day1_ret: null,
        day3_ret: null,
      });
    }
    const r = gameRetMap.get(`${gameName}_活跃用户留存`);
    r.day0_users += activeUsers;
    if (activeD1Ret !== null) r.day1_ret = activeD1Ret;
    if (activeD3Ret !== null) r.day3_ret = activeD3Ret;
  }
});

const game_ret = Array.from(gameRetMap.values())
  .filter(r => r.day0_users >= 50);

console.log(`✅ 游戏留存聚合完成: ${game_ret.length} 条`);

// ========== 7. 步骤⑦：商户留存聚合（mcht_ret） ==========
const mchtRetMap = new Map();

// 从商户维度数据提取留存信息（合计行）
merchantRows.forEach(row => {
  if (row['日期'] !== '合计') return;
  
  const merchantName = String(row['商户名'] || '').trim();
  if (!merchantName) return;
  
  const newUsers = num(row['新用户数']) || 0;
  if (newUsers < 50) return; // 过滤：day0_users≥50
  
  // 新用户留存
  const newD1Ret = parsePercent(row['新用户次日留存']);
  const newD3Ret = parsePercent(row['新用户3日留存']);
  
  // 活跃用户留存
  const activeD1Ret = parsePercent(row['活跃用户次日留存']);
  const activeD3Ret = parsePercent(row['活跃用户3日留存']);
  
  // 新用户留存记录
  if (newD1Ret !== null || newD3Ret !== null) {
    if (!mchtRetMap.has(`${merchantName}_新用户留存`)) {
      mchtRetMap.set(`${merchantName}_新用户留存`, {
        merchant_name: merchantName,
        retention_type: '新用户留存',
        day0_users: 0,
        day1_ret: null,
        day3_ret: null,
      });
    }
    const r = mchtRetMap.get(`${merchantName}_新用户留存`);
    r.day0_users += newUsers;
    if (newD1Ret !== null) r.day1_ret = newD1Ret;
    if (newD3Ret !== null) r.day3_ret = newD3Ret;
  }
  
  // 活跃用户留存记录
  const activeUsers = num(row['投注用户数']) || 0;
  if (activeUsers >= 50 && (activeD1Ret !== null || activeD3Ret !== null)) {
    if (!mchtRetMap.has(`${merchantName}_活跃用户留存`)) {
      mchtRetMap.set(`${merchantName}_活跃用户留存`, {
        merchant_name: merchantName,
        retention_type: '活跃用户留存',
        day0_users: 0,
        day1_ret: null,
        day3_ret: null,
      });
    }
    const r = mchtRetMap.get(`${merchantName}_活跃用户留存`);
    r.day0_users += activeUsers;
    if (activeD1Ret !== null) r.day1_ret = activeD1Ret;
    if (activeD3Ret !== null) r.day3_ret = activeD3Ret;
  }
});

const mcht_ret = Array.from(mchtRetMap.values())
  .filter(r => r.day0_users >= 50);

console.log(`✅ 商户留存聚合完成: ${mcht_ret.length} 条`);

// ========== 8. 步骤⑧：游戏空转指数（game_idle） ==========
const game_idle = game_base
  .filter(g => g.ggr_usd !== null && g.total_rounds !== null && g.total_rounds > 0)
  .map(g => ({
    game_name: g.game_name,
    ggr_usd: g.ggr_usd,
    total_rounds: g.total_rounds,
    idle_index: Number((g.total_rounds / (Math.abs(g.ggr_usd) + 0.01)).toFixed(2)),
  }));

console.log(`✅ 游戏空转指数计算完成: ${game_idle.length} 条（仅包含有营收数据的游戏）`);

// ========== 9. 组装最终输出 ==========
const output = {
  period: targetPeriod,
  game_base,
  mcht_base,
  curr_base,
  game_ret,
  mcht_ret,
  game_idle,
  meta: {
    generated_at: new Date().toISOString(),
    game_count: game_base.length,
    merchant_count: mcht_base.length,
    currency_count: curr_base.length,
    game_retention_count: game_ret.length,
    merchant_retention_count: mcht_ret.length,
    note: '部分字段（ggr_usd, total_rounds, rtp）可能为 null，因为上游数据不包含营收信息',
  },
};

console.log(`\n✅ 单周数据清洗完成！`);
console.log(`   周期: ${targetPeriod.key}`);
console.log(`   游戏: ${game_base.length} 个`);
console.log(`   商户: ${mcht_base.length} 个`);
console.log(`   币种: ${curr_base.length} 个`);
console.log(`   游戏留存: ${game_ret.length} 条`);
console.log(`   商户留存: ${mcht_ret.length} 条`);
console.log(`   游戏空转指数: ${game_idle.length} 条`);

return [{ json: output }];
