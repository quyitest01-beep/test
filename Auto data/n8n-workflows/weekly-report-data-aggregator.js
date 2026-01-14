// 周报数据聚合节点（全平台/商户/游戏维度）
// 输入：shangyou.json 格式的原始数据（每个 item 是一行）
// 输出：按全平台/商户/游戏维度聚合的数据，包含合计行和每日明细行

const inputs = $input.all();

console.log('=== 周报数据聚合开始 ===');
console.log('📊 输入项数量:', inputs.length);

// ========== 1. 数据分类 ==========
const merchantBetUsers = [];      // 商户投注用户数据（file1）
const gameBetUsers = [];          // 游戏投注用户数据（file2）
const merchantNewRetention = []; // 商户新用户留存（file3）
const merchantActiveRetention = []; // 商户活跃用户留存（file4）
const gameNewRetention = [];      // 游戏新用户留存（file5）
const gameActiveRetention = [];  // 游戏活跃用户留存（file6）

// 统一商户名：去首尾空格 + 小写 key，解决大小写/尾随空格匹配问题
const normalizeMerchantName = (name) => String(name || '').trim();
const merchantKey = (name) => normalizeMerchantName(name).toLowerCase();
const normalizeGameName = (name) => String(name || '').trim();

inputs.forEach((input, idx) => {
  const row = input.json || {};
  
  // 识别商户投注用户数据（有商户名、日期、投注用户数，但没有游戏名）
  if (row['商户名'] && row['日期'] && row['投注用户数'] !== undefined && !row['游戏名']) {
    row._merchantName = normalizeMerchantName(row['商户名']);
    row._merchantKey = merchantKey(row['商户名']);
    merchantBetUsers.push(row);
  }
  // 识别游戏投注用户数据（有游戏名、日期、投注用户数）
  else if (row['游戏名'] && row['日期'] && row['投注用户数'] !== undefined) {
    row._gameName = normalizeGameName(row['游戏名']);
    gameBetUsers.push(row);
  }
  // 识别留存数据
  else if (row['数据类型'] && row['当日用户数'] !== undefined) {
    const retentionType = String(row['数据类型'] || '').trim();
    const hasMerchant = !!row['商户名'];
    const hasGame = !!row['游戏名'];
    
    if (retentionType.includes('新用户留存')) {
      if (hasMerchant && !hasGame) {
        row._merchantName = normalizeMerchantName(row['商户名']);
        row._merchantKey = merchantKey(row['商户名']);
        merchantNewRetention.push(row);
      } else if (hasGame) {
        row._gameName = normalizeGameName(row['游戏名']);
        gameNewRetention.push(row);
      }
    } else if (retentionType.includes('活跃用户留存')) {
      if (hasMerchant && !hasGame) {
        row._merchantName = normalizeMerchantName(row['商户名']);
        row._merchantKey = merchantKey(row['商户名']);
        merchantActiveRetention.push(row);
      } else if (hasGame) {
        row._gameName = normalizeGameName(row['游戏名']);
        gameActiveRetention.push(row);
      }
    }
  }
});

console.log(`\n📊 数据分类结果:`);
console.log(`   商户投注用户: ${merchantBetUsers.length} 条`);
console.log(`   游戏投注用户: ${gameBetUsers.length} 条`);
console.log(`   商户新用户留存: ${merchantNewRetention.length} 条`);
console.log(`   商户活跃用户留存: ${merchantActiveRetention.length} 条`);
console.log(`   游戏新用户留存: ${gameNewRetention.length} 条`);
console.log(`   游戏活跃用户留存: ${gameActiveRetention.length} 条`);

// ========== 2. 工具函数 ==========
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Number(value.toFixed(2))}%`;
};

// 计算留存率（用户数之和 ÷ 当日用户数之和）
const calcRetentionRate = (retentionData, dayField) => {
  let totalDay0 = 0;
  let totalDayN = 0;
  
  retentionData.forEach(r => {
    totalDay0 += num(r['当日用户数'] || r.day0_users || 0);
    totalDayN += num(r[dayField] || 0);
  });
  
  if (totalDay0 === 0) return '0%';
  return formatPercent((totalDayN / totalDay0) * 100);
};

// 归一化日期格式（"2025-11-24" → "20251124"）
const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '合计') return dateStr;
  return String(dateStr).trim().replace(/-/g, '');
};

// ========== 3. 全平台汇总 ==========
// 3.1 投注用户数：所有商户日期="合计"的投注用户数之和
const platformBetUsers = merchantBetUsers
  .filter(r => r['日期'] === '合计')
  .reduce((sum, r) => sum + num(r['投注用户数']), 0);

// 3.2 新用户数：所有商户所有日期的新用户留存类数据的当日用户数之和
const platformNewUsers = merchantNewRetention
  .reduce((sum, r) => sum + num(r['当日用户数']), 0);

// 3.3 留存率计算
const platformActiveD1Ret = calcRetentionRate(merchantActiveRetention, '次日用户数');
const platformActiveD3Ret = calcRetentionRate(merchantActiveRetention, '3日用户数');
const platformNewD1Ret = calcRetentionRate(merchantNewRetention, '次日用户数');
const platformNewD3Ret = calcRetentionRate(merchantNewRetention, '3日用户数');

const platformSummary = {
  类型: '全平台',
  投注用户数: platformBetUsers,
  新用户数: platformNewUsers,
  活跃用户次日留存: platformActiveD1Ret,
  活跃用户3日留存: platformActiveD3Ret,
  新用户次日留存: platformNewD1Ret,
  新用户3日留存: platformNewD3Ret,
};

console.log(`\n✅ 全平台汇总完成`);

// ========== 4. 商户维度聚合 ==========
const merchantMap = new Map();

// 4.1 收集所有商户名（从投注用户数据）
merchantBetUsers.forEach(r => {
  const merchantName = r._merchantName || normalizeMerchantName(r['商户名']);
  const key = r._merchantKey || merchantKey(r['商户名']);
  if (!key) return;
  
  if (!merchantMap.has(key)) {
    merchantMap.set(key, {
      merchant_name: merchantName, // 用投注用户表的展示名
      bet_users_total: 0, // 合计行的投注用户数
      dates: new Set(), // 该商户有数据的日期
    });
  }
  
  const date = r['日期'];
  if (date === '合计') {
    merchantMap.get(key).bet_users_total += num(r['投注用户数']);
  } else {
    merchantMap.get(key).dates.add(normalizeDate(date));
  }
});

const merchantResults = [];

merchantMap.forEach((info, merchantKeyVal) => {
  const merchantName = info.merchant_name;
  const key = merchantKeyVal;

  // 合计行
  const totalRow = {
    类型: '商户',
    商户名: merchantName,
    日期: '合计',
    投注用户数: info.bet_users_total || 0,
  };
  
  // 计算该商户的新用户数（所有日期的新用户留存当日用户数之和）
  const mNewRetention = merchantNewRetention.filter(r => (r._merchantKey || merchantKey(r['商户名'])) === key);
  const mActiveRetention = merchantActiveRetention.filter(r => (r._merchantKey || merchantKey(r['商户名'])) === key);
  
  totalRow.新用户数 = mNewRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0);
  totalRow.活跃用户次日留存 = calcRetentionRate(mActiveRetention, '次日用户数');
  totalRow.活跃用户3日留存 = calcRetentionRate(mActiveRetention, '3日用户数');
  totalRow.新用户次日留存 = calcRetentionRate(mNewRetention, '次日用户数');
  totalRow.新用户3日留存 = calcRetentionRate(mNewRetention, '3日用户数');
  
  merchantResults.push(totalRow);
  
  // 每日明细行
  const sortedDates = Array.from(info.dates).sort();
  sortedDates.forEach(date => {
    const dailyRow = {
      类型: '商户',
      商户名: merchantName,
      日期: date,
      投注用户数: 0,
    };
    
    // 该商户该日期的投注用户数
    const betUserRows = merchantBetUsers.filter(r => 
      (r._merchantKey || merchantKey(r['商户名'])) === key && normalizeDate(r['日期']) === date
    );
    dailyRow.投注用户数 = betUserRows.reduce((sum, r) => sum + num(r['投注用户数']), 0);
    
    // 该商户该日期的新用户留存数据
    const mNewRetentionDaily = mNewRetention.filter(r => normalizeDate(r['日期']) === date);
    const mActiveRetentionDaily = mActiveRetention.filter(r => normalizeDate(r['日期']) === date);
    
    dailyRow.新用户数 = mNewRetentionDaily.reduce((sum, r) => sum + num(r['当日用户数']), 0);
    dailyRow.活跃用户次日留存 = calcRetentionRate(mActiveRetentionDaily, '次日用户数');
    dailyRow.活跃用户3日留存 = calcRetentionRate(mActiveRetentionDaily, '3日用户数');
    dailyRow.新用户次日留存 = calcRetentionRate(mNewRetentionDaily, '次日用户数');
    dailyRow.新用户3日留存 = calcRetentionRate(mNewRetentionDaily, '3日用户数');
    
    merchantResults.push(dailyRow);
  });
});

console.log(`✅ 商户维度聚合完成: ${merchantMap.size} 个商户`);

// ========== 5. 游戏维度聚合 ==========
const gameMap = new Map();

// 5.1 收集所有游戏名（从投注用户数据）
gameBetUsers.forEach(r => {
  const gameName = String(r['游戏名'] || '').trim();
  if (!gameName) return;
  
  if (!gameMap.has(gameName)) {
    gameMap.set(gameName, {
      game_name: gameName,
      bet_users_total: null, // 合计行的投注用户数
      dates: new Set(), // 该游戏有数据的日期
    });
  }
  
  const date = r['日期'];
  if (date === '合计') {
    gameMap.get(gameName).bet_users_total = num(r['投注用户数']);
  } else {
    gameMap.get(gameName).dates.add(normalizeDate(date));
  }
});

const gameResults = [];

gameMap.forEach((info, gameName) => {
  // 合计行
  const totalRow = {
    类型: '游戏',
    游戏名: gameName,
    日期: '合计',
    投注用户数: info.bet_users_total || 0,
  };
  
  // 计算该游戏的新用户数（所有商户&所有日期的新用户留存当日用户数之和）
  const gNewRetention = gameNewRetention.filter(r => r['游戏名'] === gameName);
  const gActiveRetention = gameActiveRetention.filter(r => r['游戏名'] === gameName);
  
  totalRow.新用户数 = gNewRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0);
  totalRow.活跃用户次日留存 = calcRetentionRate(gActiveRetention, '次日用户数');
  totalRow.活跃用户3日留存 = calcRetentionRate(gActiveRetention, '3日用户数');
  totalRow.新用户次日留存 = calcRetentionRate(gNewRetention, '次日用户数');
  totalRow.新用户3日留存 = calcRetentionRate(gNewRetention, '3日用户数');
  
  gameResults.push(totalRow);
  
  // 每日明细行
  const sortedDates = Array.from(info.dates).sort();
  sortedDates.forEach(date => {
    const dailyRow = {
      类型: '游戏',
      游戏名: gameName,
      日期: date,
      投注用户数: 0,
    };
    
    // 该游戏该日期的投注用户数（需要聚合所有商户）
    const betUserRows = gameBetUsers.filter(r => 
      r['游戏名'] === gameName && normalizeDate(r['日期']) === date
    );
    // 如果有多条（不同商户），求和
    dailyRow.投注用户数 = betUserRows.reduce((sum, r) => sum + num(r['投注用户数']), 0);
    
    // 该游戏该日期下所有商户的新用户留存数据
    const gNewRetentionDaily = gNewRetention.filter(r => normalizeDate(r['日期']) === date);
    const gActiveRetentionDaily = gActiveRetention.filter(r => normalizeDate(r['日期']) === date);
    
    dailyRow.新用户数 = gNewRetentionDaily.reduce((sum, r) => sum + num(r['当日用户数']), 0);
    dailyRow.活跃用户次日留存 = calcRetentionRate(gActiveRetentionDaily, '次日用户数');
    dailyRow.活跃用户3日留存 = calcRetentionRate(gActiveRetentionDaily, '3日用户数');
    dailyRow.新用户次日留存 = calcRetentionRate(gNewRetentionDaily, '次日用户数');
    dailyRow.新用户3日留存 = calcRetentionRate(gNewRetentionDaily, '3日用户数');
    
    gameResults.push(dailyRow);
  });
});

console.log(`✅ 游戏维度聚合完成: ${gameMap.size} 个游戏`);

// ========== 6. 组装最终输出 ==========
const output = [
  platformSummary,
  ...merchantResults,
  ...gameResults,
];

console.log(`\n✅ 数据聚合完成！`);
console.log(`   全平台: 1 条`);
console.log(`   商户: ${merchantResults.length} 条（${merchantMap.size} 个商户）`);
console.log(`   游戏: ${gameResults.length} 条（${gameMap.size} 个游戏）`);
console.log(`   总计: ${output.length} 条`);

// 输出：每个 item 一条记录
return output.map(row => ({ json: row }));

