// 周报数据聚合节点（适配CSV格式的原始数据）
// 修复：CSV所有值都是字符串，需要更严格的类型检查
// 输入：无合计行的原始数据（仅包含每日明细）
// 输出：全平台/商户/游戏的「自动计算合计行」+「每日明细行」

const inputs = $input.all();

console.log('=== 周报数据聚合开始（CSV模式）===');
console.log('📊 输入项数量:', inputs.length);

// ========== 工具函数：CSV数据清洗 ==========

// 检查值是否为空（CSV特有）
const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  const str = String(value).trim();
  return str === '' || str === 'null' || str === 'undefined';
};

// 检查值是否有效（非空且有意义）
const isValid = (value) => !isEmpty(value);

// 检查是否是有效的数字字段
const hasValidNumber = (value) => {
  if (isEmpty(value)) return false;
  const num = Number(value);
  return Number.isFinite(num) && num !== 0;
};

// ========== 1. 数据分类（仅保留每日明细，无合计行） ==========
const merchantBetUsers = [];      // 商户投注用户数据
const gameBetUsers = [];          // 游戏投注用户数据
const merchantNewRetention = [];  // 商户新用户留存
const merchantActiveRetention = []; // 商户活跃用户留存
const gameNewRetention = [];      // 游戏新用户留存
const gameActiveRetention = [];   // 游戏活跃用户留存

// 归一化工具：去空格、统一格式
const normalizeMerchantName = (name) => String(name || '').trim();
const merchantKey = (name) => normalizeMerchantName(name).toLowerCase();
const normalizeGameName = (name) => String(name || '').trim();

const normalizeDate = (dateStr) => {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  // 仅保留合法日期格式（如20251124、2025-11-24），过滤无效值
  return /^\d{8}$|^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed.replace(/-/g, '') : null;
};

// 调试：记录前几条数据
if (inputs.length > 0) {
  console.log('\n📋 前3条数据示例:');
  inputs.slice(0, 3).forEach((input, idx) => {
    const row = input.json || {};
    console.log(`\n  [${idx + 1}]:`);
    console.log(`    日期: "${row['日期']}" (isEmpty: ${isEmpty(row['日期'])})`);
    console.log(`    商户名: "${row['商户名']}" (isEmpty: ${isEmpty(row['商户名'])})`);
    console.log(`    游戏名: "${row['游戏名']}" (isEmpty: ${isEmpty(row['游戏名'])})`);
    console.log(`    投注用户数: "${row['投注用户数']}" (hasValidNumber: ${hasValidNumber(row['投注用户数'])})`);
    console.log(`    数据类型: "${row['数据类型']}" (isEmpty: ${isEmpty(row['数据类型'])})`);
  });
}

inputs.forEach((input, idx) => {
  const row = input.json || {};
  
  const date = normalizeDate(row['日期']);
  if (!date) {
    // console.log(`⚠️ 跳过行 [${idx + 1}]: 无有效日期`);
    return; // 过滤无有效日期的行
  }

  // 🔧 修复：使用更严格的条件判断（CSV模式）
  
  // 1. 商户投注用户数据（有商户名、无游戏名、有投注用户数）
  if (isValid(row['商户名']) && isEmpty(row['游戏名']) && hasValidNumber(row['投注用户数'])) {
    merchantBetUsers.push({
      ...row,
      _merchantName: normalizeMerchantName(row['商户名']),
      _merchantKey: merchantKey(row['商户名']),
      _date: date
    });
  }
  // 2. 游戏投注用户数据（有游戏名、有投注用户数）
  else if (isValid(row['游戏名']) && hasValidNumber(row['投注用户数'])) {
    gameBetUsers.push({
      ...row,
      _gameName: normalizeGameName(row['游戏名']),
      _date: date
    });
  }
  // 3. 商户留存数据（有商户名、无游戏名、有数据类型）
  else if (isValid(row['商户名']) && isEmpty(row['游戏名']) && isValid(row['数据类型'])) {
    const type = String(row['数据类型']).trim();
    if (type.includes('新用户留存')) {
      merchantNewRetention.push({ ...row, _merchantKey: merchantKey(row['商户名']), _date: date });
    } else if (type.includes('活跃用户留存')) {
      merchantActiveRetention.push({ ...row, _merchantKey: merchantKey(row['商户名']), _date: date });
    }
  }
  // 4. 游戏留存数据（有游戏名、有数据类型）
  else if (isValid(row['游戏名']) && isValid(row['数据类型'])) {
    const type = String(row['数据类型']).trim();
    if (type.includes('新用户留存')) {
      gameNewRetention.push({ ...row, _gameName: normalizeGameName(row['游戏名']), _date: date });
    } else if (type.includes('活跃用户留存')) {
      gameActiveRetention.push({ ...row, _gameName: normalizeGameName(row['游戏名']), _date: date });
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

const calcRetentionRate = (retentionData, dayField) => {
  let totalDay0 = 0;
  let totalDayN = 0;
  
  retentionData.forEach(r => {
    totalDay0 += num(r['当日用户数']);
    totalDayN += num(r[dayField]);
  });
  
  return totalDay0 === 0 ? '0%' : formatPercent((totalDayN / totalDay0) * 100);
};

// ========== 3. 全平台汇总（自动计算所有商户的累加值） ==========
const platformBetUsers = merchantBetUsers.reduce((sum, r) => sum + num(r['投注用户数']), 0);
const platformNewUsers = merchantNewRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0);
const platformActiveD1Ret = calcRetentionRate(merchantActiveRetention, '次日用户数');
const platformNewD1Ret = calcRetentionRate(merchantNewRetention, '次日用户数');

const platformSummary = {
  类型: '全平台',
  日期: '合计',
  投注用户数: platformBetUsers,
  新用户数: platformNewUsers,
  活跃用户次日留存: platformActiveD1Ret,
  新用户次日留存: platformNewD1Ret
};

console.log(`\n✅ 全平台汇总完成`);

// ========== 4. 商户维度聚合（自动计算合计+明细） ==========
const merchantMap = new Map();

// 第一步：聚合商户的所有日期数据
merchantBetUsers.forEach(r => {
  const key = r._merchantKey;
  if (!key) return;
  
  if (!merchantMap.has(key)) {
    merchantMap.set(key, {
      name: r._merchantName,
      totalBetUsers: 0,
      dates: new Set(),
      dailyData: new Map() // 存储每日数据
    });
  }
  
  const merchant = merchantMap.get(key);
  
  // 累加合计投注用户数
  merchant.totalBetUsers += num(r['投注用户数']);
  
  // 记录日期
  merchant.dates.add(r._date);
  
  // 记录每日数据
  if (!merchant.dailyData.has(r._date)) {
    merchant.dailyData.set(r._date, { betUsers: 0 });
  }
  merchant.dailyData.get(r._date).betUsers += num(r['投注用户数']);
});

// 第二步：生成商户的合计+明细行
const merchantResults = [];

merchantMap.forEach((merchant, key) => {
  // 合计行
  const totalRow = {
    类型: '商户',
    商户名: merchant.name,
    日期: '合计',
    投注用户数: merchant.totalBetUsers,
    新用户数: 0,
    活跃用户次日留存: '0%',
    新用户次日留存: '0%'
  };
  
  // 补充留存数据
  const newRetention = merchantNewRetention.filter(r => r._merchantKey === key);
  const activeRetention = merchantActiveRetention.filter(r => r._merchantKey === key);
  
  totalRow.新用户数 = newRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0);
  totalRow.活跃用户次日留存 = calcRetentionRate(activeRetention, '次日用户数');
  totalRow.新用户次日留存 = calcRetentionRate(newRetention, '次日用户数');
  
  merchantResults.push(totalRow);
  
  // 明细行
  Array.from(merchant.dates).sort().forEach(date => {
    const daily = merchant.dailyData.get(date) || { betUsers: 0 };
    const dailyNewRetention = newRetention.filter(r => r._date === date);
    const dailyActiveRetention = activeRetention.filter(r => r._date === date);
    
    merchantResults.push({
      类型: '商户',
      商户名: merchant.name,
      日期: date,
      投注用户数: daily.betUsers,
      新用户数: dailyNewRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0),
      活跃用户次日留存: calcRetentionRate(dailyActiveRetention, '次日用户数'),
      新用户次日留存: calcRetentionRate(dailyNewRetention, '次日用户数')
    });
  });
});

console.log(`✅ 商户维度聚合完成: ${merchantMap.size} 个商户`);

// ========== 5. 游戏维度聚合（自动计算合计+明细） ==========
const gameMap = new Map();

// 第一步：聚合游戏的所有日期数据
gameBetUsers.forEach(r => {
  const key = r._gameName;
  if (!key) return;
  
  if (!gameMap.has(key)) {
    gameMap.set(key, {
      name: key,
      totalBetUsers: 0,
      dates: new Set(),
      dailyData: new Map()
    });
  }
  
  const game = gameMap.get(key);
  game.totalBetUsers += num(r['投注用户数']);
  game.dates.add(r._date);
  
  if (!game.dailyData.has(r._date)) {
    game.dailyData.set(r._date, { betUsers: 0 });
  }
  game.dailyData.get(r._date).betUsers += num(r['投注用户数']);
});

// 第二步：生成游戏的合计+明细行
const gameResults = [];

gameMap.forEach((game, key) => {
  // 合计行
  const totalRow = {
    类型: '游戏',
    游戏名: game.name,
    日期: '合计',
    投注用户数: game.totalBetUsers,
    新用户数: 0,
    活跃用户次日留存: '0%',
    新用户次日留存: '0%'
  };
  
  // 补充留存数据
  const newRetention = gameNewRetention.filter(r => r._gameName === key);
  const activeRetention = gameActiveRetention.filter(r => r._gameName === key);
  
  totalRow.新用户数 = newRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0);
  totalRow.活跃用户次日留存 = calcRetentionRate(activeRetention, '次日用户数');
  totalRow.新用户次日留存 = calcRetentionRate(newRetention, '次日用户数');
  
  gameResults.push(totalRow);
  
  // 明细行
  Array.from(game.dates).sort().forEach(date => {
    const daily = game.dailyData.get(date) || { betUsers: 0 };
    const dailyNewRetention = newRetention.filter(r => r._date === date);
    const dailyActiveRetention = activeRetention.filter(r => r._date === date);
    
    gameResults.push({
      类型: '游戏',
      游戏名: game.name,
      日期: date,
      投注用户数: daily.betUsers,
      新用户数: dailyNewRetention.reduce((sum, r) => sum + num(r['当日用户数']), 0),
      活跃用户次日留存: calcRetentionRate(dailyActiveRetention, '次日用户数'),
      新用户次日留存: calcRetentionRate(dailyNewRetention, '次日用户数')
    });
  });
});

console.log(`✅ 游戏维度聚合完成: ${gameMap.size} 个游戏`);

// ========== 6. 输出结果 ==========
const output = [platformSummary, ...merchantResults, ...gameResults];

console.log(`\n✅ 数据聚合完成！总计: ${output.length} 条`);
console.log(`   全平台: 1 条`);
console.log(`   商户: ${merchantResults.length} 条`);
console.log(`   游戏: ${gameResults.length} 条`);

return output.map(row => ({ json: row }));
