// n8n Code节点：游戏评级事实表生成器
// 功能：
// 1. 读取上游处理后的游戏指标数据
// 2. 生成游戏级评分表（事实表）
// 3. 生成平台级切片表（维度+指标）
// 4. 计算留存得分、排名、健康度等指标

const inputs = $input.all();
if (!inputs?.length) {
  throw new Error("❌ 未收到任何输入数据");
}

// --- 通用工具 ----------------------------------------------------------------

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const tryParseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/[,，\s%]/g, ""));
  return Number.isFinite(num) ? num : null;
};

// 解析百分比字符串为小数
const parseRetentionRate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).replace(/%/g, "").trim();
  const num = tryParseNumber(str);
  if (num === null) return null;
  // 如果大于1，认为是百分比，需要除以100
  if (num > 1) return num / 100;
  return num;
};

// 规范化日期
const normalizeDate = (value) => {
  if (value === null || value === undefined) return null;
  const str = cleanString(value);
  if (!str) return null;
  // 支持 YYYYMMDD 格式
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6)}`;
  }
  // 支持 YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  return null;
};

// 计算留存得分 (0.7*d1 + 0.3*d7) * 100
const calculateRetentionScore = (d1Rate, d7Rate) => {
  const d1 = parseRetentionRate(d1Rate);
  const d7 = parseRetentionRate(d7Rate);
  if (d1 === null && d7 === null) return null;
  const d1Val = d1 !== null ? d1 : 0;
  const d7Val = d7 !== null ? d7 : 0;
  const score = (0.7 * d1Val + 0.3 * d7Val) * 100;
  return Number(score.toFixed(2));
};

// 判断健康度颜色
const getHealthColor = (d1Rate) => {
  const d1 = parseRetentionRate(d1Rate);
  if (d1 === null) return "gray";
  const d1Val = d1 > 1 ? d1 / 100 : d1;
  if (d1Val < 0.05) return "red"; // < 5%
  if (d1Val < 0.10) return "yellow"; // 5% - 10%
  return "green"; // >= 10%
};

// --- 提取上游数据 ----------------------------------------------------------------

let inputData = null;
for (const input of inputs) {
  if (input?.json) {
    inputData = input.json;
    break;
  }
}

if (!inputData) {
  throw new Error("❌ 未找到有效的输入数据");
}

const {
  tenant_token,
  table_name,
  target_game,
  mapped_games,
  metrics,
  exchange_rates,
} = inputData;

if (!tenant_token) {
  throw new Error("❌ 未找到 tenant_token");
}

if (!target_game || !target_game.game_code) {
  throw new Error("❌ 未找到目标游戏信息");
}

const gameCode = target_game.game_code;
const gameName = target_game.english_name || gameCode;

// --- 提取时间范围（如果有） ----------------------------------------------------

let statDate = null;
let weekStart = null;
let weekEnd = null;

// 尝试从输入数据中提取时间范围
const extractDateRange = (obj, path = []) => {
  if (!obj || typeof obj !== "object") return;
  
  if (obj.WeekStart && obj.WeekEnd) {
    weekStart = obj.WeekStart;
    weekEnd = obj.WeekEnd;
    return;
  }
  
  if (obj.weekStart && obj.weekEnd) {
    weekStart = obj.weekStart;
    weekEnd = obj.weekEnd;
    return;
  }
  
  if (obj.date_range) {
    const match = String(obj.date_range).match(/(\d{8})[-\s~]+(\d{8})/);
    if (match) {
      weekStart = match[1];
      weekEnd = match[2];
      return;
    }
  }
  
  Object.values(obj).forEach((value) => {
    if (value && typeof value === "object" && path.length < 5) {
      extractDateRange(value, path.concat("value"));
    }
  });
};

extractDateRange(inputData);

// 如果没有找到时间范围，使用当前日期
if (!statDate) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  statDate = `${year}-${month}-${day}`;
} else {
  statDate = normalizeDate(statDate) || statDate;
}

// --- 1. 生成游戏级评分表（事实表） ---------------------------------------------

// 提取目标游戏的用户数据
const targetUsers = metrics?.target?.users || [];
const totalUniqueUsers = targetUsers.reduce((sum, item) => {
  if (item.game_code === gameCode) {
    return sum + (tryParseNumber(item.unique_users) || 0);
  }
  return sum;
}, 0);
const globalUsersList = metrics?.global?.users || [];
// 注意：如果目标游戏没有用户数据，可以使用全平台用户数据作为后备
// 但这里我们优先使用目标游戏的用户数据
const useGlobalUsers = totalUniqueUsers === 0 && Array.isArray(globalUsersList) && globalUsersList.length > 0;
const userSource = useGlobalUsers ? globalUsersList : targetUsers;

// 提取目标游戏的收入数据
// 重要：指定游戏的收入数据应该始终从 metrics.target.revenue 中获取
// 不应该使用 metrics.global.revenue（这是全平台所有游戏的汇总）
const targetRevenue = metrics?.target?.revenue || [];
let totalRevenueUSDT = 0;
let totalPayoutUSDT = 0;

// 始终使用 targetRevenue 来计算指定游戏的收入
targetRevenue.forEach((revenue) => {
  if (revenue.game_code === gameCode) {
    totalRevenueUSDT += tryParseNumber(revenue.total_amount_usdt) || 0;
    totalPayoutUSDT += tryParseNumber(revenue.total_pay_out_usdt) || 0;
  }
});

const netUSDT = totalRevenueUSDT - totalPayoutUSDT;
const arpuUSDT = totalUniqueUsers > 0 ? netUSDT / totalUniqueUsers : 0;

// 提取目标游戏的留存数据（优先使用新用户留存，如果没有则使用活跃用户留存）
const targetRetentionNew = metrics?.target?.retention_new || [];
const targetRetentionActive = metrics?.target?.retention_active || [];
// 全局留存数据现在是数组格式，需要汇总所有平台的留存数据
const globalRetentionNewArray = Array.isArray(metrics?.global?.retention_new) 
  ? metrics.global.retention_new 
  : (metrics?.global?.retention_new ? [metrics.global.retention_new] : []);
const globalRetentionActiveArray = Array.isArray(metrics?.global?.retention_active) 
  ? metrics.global.retention_active 
  : (metrics?.global?.retention_active ? [metrics.global.retention_active] : []);

// 汇总目标游戏的留存数据（将所有平台的留存数据汇总）
let totalD0Users = 0;
let totalD1Users = 0;
let totalD7Users = 0;

// 优先使用新用户留存数据
const retentionDataToUse = targetRetentionNew.length > 0 ? targetRetentionNew : targetRetentionActive;

retentionDataToUse.forEach((retention) => {
  if (retention.game_code === gameCode) {
    totalD0Users += tryParseNumber(retention.d0_users) || 0;
    totalD1Users += tryParseNumber(retention.d1_users) || 0;
    totalD7Users += tryParseNumber(retention.d7_users) || 0;
  }
});

// 如果目标游戏没有留存数据，尝试使用全局留存数据（作为后备）
// 汇总所有平台的全局留存数据
if (totalD0Users === 0 && (globalRetentionNewArray.length > 0 || globalRetentionActiveArray.length > 0)) {
  const globalRetentionArray = globalRetentionNewArray.length > 0 ? globalRetentionNewArray : globalRetentionActiveArray;
  globalRetentionArray.forEach((retention) => {
    totalD0Users += tryParseNumber(retention.d0_users) || 0;
    totalD1Users += tryParseNumber(retention.d1_users) || 0;
    totalD7Users += tryParseNumber(retention.d7_users) || 0;
  });
  if (totalD0Users > 0) {
    console.log(`ℹ️ 目标游戏 ${gameCode} 没有留存数据，使用全局留存数据（汇总了 ${globalRetentionArray.length} 个平台）`);
  }
}

// 计算留存率
const d1Retention = totalD0Users > 0 ? totalD1Users / totalD0Users : null;
const d7Retention = totalD0Users > 0 ? totalD7Users / totalD0Users : null;

// 计算留存得分
const retentionScore = calculateRetentionScore(
  d1Retention !== null ? d1Retention * 100 : null,
  d7Retention !== null ? d7Retention * 100 : null
);

console.log(`📊 游戏级留存数据汇总:`, {
  game_code: gameCode,
  total_d0_users: totalD0Users,
  total_d1_users: totalD1Users,
  total_d7_users: totalD7Users,
  d1_retention: d1Retention,
  d7_retention: d7Retention,
  retention_score: retentionScore,
});

// 计算全游戏排名（需要与其他游戏对比，这里暂时设为 null，需要后续计算）
const rankGlobal = null; // 需要全游戏数据才能计算

// 趋势标签（需要历史数据，暂时设为 null）
const tagTrend = null; // 需要历史数据才能计算

// 生成游戏级评分表
const gameLevelTable = {
  game_code: gameCode,
  game_name: gameName,
  revenue_total_usdt: Number(totalRevenueUSDT.toFixed(2)),
  payout_total_usdt: Number(totalPayoutUSDT.toFixed(2)),
  net_usdt: Number(netUSDT.toFixed(2)),
  unique_users: totalUniqueUsers,
  arpu_usdt: Number(arpuUSDT.toFixed(2)),
  d1_retention: d1Retention !== null ? Number(d1Retention.toFixed(4)) : null,
  d7_retention: d7Retention !== null ? Number(d7Retention.toFixed(4)) : null,
  retention_score: retentionScore,
  rank_global: rankGlobal,
  tag_trend: tagTrend,
};

// --- 1.5. 生成全平台游戏级评分表（用于计算游戏占平台的比值） -------------------

// 提取全平台用户数据
let globalUniqueUsers = 0;
const globalUsers = metrics?.global?.users || null;
if (Array.isArray(globalUsers)) {
  // 如果是数组，汇总所有平台的用户数
  globalUniqueUsers = globalUsers.reduce((sum, item) => {
    return sum + (tryParseNumber(item.unique_users_total) || 0);
  }, 0);
} else if (globalUsers && typeof globalUsers === "object") {
  // 如果是对象，使用 unique_users_total
  globalUniqueUsers = tryParseNumber(globalUsers.unique_users_total) || 0;
}

// 提取全平台收入数据
let globalRevenueUSDT = 0;
let globalPayoutUSDT = 0;
const globalRevenue = metrics?.global?.revenue || null;

if (globalRevenue) {
  globalRevenueUSDT = tryParseNumber(globalRevenue.total_amount_usdt) || 0;
  globalPayoutUSDT = tryParseNumber(globalRevenue.total_pay_out_usdt) || 0;
}

const globalNetUSDT = globalRevenueUSDT - globalPayoutUSDT;
const globalArpuUSDT = globalUniqueUsers > 0 ? globalNetUSDT / globalUniqueUsers : 0;

// 提取全平台留存数据（优先使用新用户留存，如果没有则使用活跃用户留存）
// 汇总所有平台的全局留存数据
const globalRetentionArray = globalRetentionNewArray.length > 0 ? globalRetentionNewArray : globalRetentionActiveArray;

let globalD0Users = 0;
let globalD1Users = 0;
let globalD7Users = 0;

globalRetentionArray.forEach((retention) => {
  globalD0Users += tryParseNumber(retention.d0_users) || 0;
  globalD1Users += tryParseNumber(retention.d1_users) || 0;
  globalD7Users += tryParseNumber(retention.d7_users) || 0;
});

// 计算全平台留存率
const globalD1Retention = globalD0Users > 0 ? globalD1Users / globalD0Users : null;
const globalD7Retention = globalD0Users > 0 ? globalD7Users / globalD0Users : null;

// 计算全平台留存得分
const globalRetentionScore = calculateRetentionScore(
  globalD1Retention !== null ? globalD1Retention * 100 : null,
  globalD7Retention !== null ? globalD7Retention * 100 : null
);

console.log(`📊 全平台游戏级数据汇总:`, {
  unique_users: globalUniqueUsers,
  revenue_total_usdt: globalRevenueUSDT,
  net_usdt: globalNetUSDT,
  arpu_usdt: globalArpuUSDT,
  d1_retention: globalD1Retention,
  d7_retention: globalD7Retention,
  retention_score: globalRetentionScore,
});

// 生成全平台游戏级评分表
const platformGameLevelTable = {
  game_code: "ALL_GAMES",
  game_name: "全平台所有游戏",
  revenue_total_usdt: Number(globalRevenueUSDT.toFixed(2)),
  payout_total_usdt: Number(globalPayoutUSDT.toFixed(2)),
  net_usdt: Number(globalNetUSDT.toFixed(2)),
  unique_users: globalUniqueUsers,
  arpu_usdt: Number(globalArpuUSDT.toFixed(2)),
  d1_retention: globalD1Retention !== null ? Number(globalD1Retention.toFixed(4)) : null,
  d7_retention: globalD7Retention !== null ? Number(globalD7Retention.toFixed(4)) : null,
  retention_score: globalRetentionScore,
  rank_global: null,
  tag_trend: null,
};

// --- 2. 生成平台级切片表（维度+指标） -------------------------------------------

const platformLevelTable = [];

// 收集所有平台的数据
const platformDataMap = new Map();

console.log(`📊 开始收集平台数据...`);
console.log(`   - 目标游戏代码: ${gameCode}`);
console.log(`   - 用户数据数量: ${userSource.length} (useGlobal=${useGlobalUsers})`);
console.log(`   - 目标游戏收入数据数量: ${targetRevenue.length}`);
console.log(`   - 新用户留存数据数量: ${targetRetentionNew.length}`);
console.log(`   - 活跃用户留存数据数量: ${targetRetentionActive.length}`);

// 1. 收集用户数据
// 注意：上游数据中，如果匹配成功：user.platform 是商户名称（字符串），user.merchant_id 是商户ID（数字），user.platform_name 是商户名称
// 如果匹配失败：user.platform 是商户ID（数字或字符串），user.merchant_id 是商户ID（数字）
let userDataCount = 0;
let userDataSkipped = 0;
userSource.forEach((user) => {
  if (!useGlobalUsers && user.game_code !== gameCode) {
    userDataSkipped++;
    return;
  }
  
  // 优先使用 merchant_id（始终是商户ID，无论匹配成功或失败）
  // 如果没有 merchant_id，检查 platform 是否是数字（商户ID）
  let platformId = user.merchant_id || null;
  if (!platformId && user.platform !== undefined && user.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(user.platform);
    if (platformNum !== null) {
      // platform 是数字，可以作为商户ID
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      console.warn(`⚠️ 用户数据 platform 是字符串（商户名称），但缺少 merchant_id，无法匹配平台:`, user);
      return;
    }
  }
  
  if (!platformId) {
    console.warn(`⚠️ 用户数据缺少 merchant_id 和有效的 platform，无法匹配平台:`, user);
    return;
  }
  
  const platformIdStr = String(platformId);
  // 优先使用 platform（如果是商户名称）或 platform_name（商户名称），如果没有则使用 main_merchant_name
  // 注意：如果匹配成功，platform 是商户名称；如果匹配失败，platform 是商户ID
  const platformName = user.platform_name || 
                       (user.platform && tryParseNumber(user.platform) === null ? user.platform : null) || 
                       user.main_merchant_name || 
                       platformIdStr;
  
  if (!platformDataMap.has(platformIdStr)) {
    platformDataMap.set(platformIdStr, {
      game_code: gameCode,
      platform_id: platformIdStr,
      platform_name: platformName,
      currency: null,
      currency_set: new Set(),
      stat_date: statDate,
      revenue_usdt: 0,
      payout_usdt: 0,
      net_usdt: 0,
      unique_users: 0,
      arpu_usdt: 0,
      d1_retention: null,
      d7_retention: null,
      retention_score: null,
      rank_in_game: null,
      health_color: null,
    });
  }
  
  const platformData = platformDataMap.get(platformIdStr);
  // 更新平台名称（优先使用 platform_name，如果不存在则使用 platform（如果它是商户名称））
  if (user.platform_name) {
    platformData.platform_name = user.platform_name;
  } else if (user.platform && tryParseNumber(user.platform) === null) {
    // platform 是字符串（商户名称），使用它
    platformData.platform_name = user.platform;
  } else if (user.main_merchant_name && !platformData.platform_name) {
    platformData.platform_name = user.main_merchant_name;
  }
  const uniqueUsersValue = useGlobalUsers
    ? tryParseNumber(user.unique_users_total)
    : tryParseNumber(user.unique_users);
  platformData.unique_users += uniqueUsersValue || 0;
  userDataCount++;
});

console.log(`✅ 用户数据收集完成: 处理了 ${userDataCount} 条, 跳过了 ${userDataSkipped} 条`);
console.log(`   - platformDataMap 大小: ${platformDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(platformDataMap.keys()).join(", ")}`);

// 2. 收集收入数据（从 breakdown 中提取）
// 重要：平台级切片表应该使用指定游戏的平台级收入数据（targetRevenue.breakdown）
// 不应该使用全平台收入数据（globalRevenue.breakdown）
// 注意：上游数据中 breakdown 里的 platform 是商户名称（映射后的名称），merchant_id 是商户ID
const targetRevenueBreakdown = [];
targetRevenue.forEach((revenue) => {
  if (revenue.game_code === gameCode) {
    targetRevenueBreakdown.push(...(revenue.breakdown || []));
  }
});
// 始终使用 targetRevenueBreakdown（指定游戏的平台级数据）
const revenueBreakdownSource = targetRevenueBreakdown;
let revenueDataCount = 0;

revenueBreakdownSource.forEach((item) => {
  const platformId = item.merchant_id || null;
  if (!platformId) {
    console.warn(`⚠️ 收入数据缺少 merchant_id，无法匹配平台:`, item);
    return;
  }
  
  const platformIdStr = String(platformId);
  const platformName = item.platform || item.main_merchant_name || platformIdStr;
  const currency = item.currency || "USDT";
  
  if (!platformDataMap.has(platformIdStr)) {
    platformDataMap.set(platformIdStr, {
      game_code: gameCode,
      platform_id: platformIdStr,
      platform_name: platformName,
      currency: currency,
      currency_set: new Set(),
      stat_date: statDate,
      revenue_usdt: 0,
      payout_usdt: 0,
      net_usdt: 0,
      unique_users: 0,
      arpu_usdt: 0,
      d1_retention: null,
      d7_retention: null,
      retention_score: null,
      rank_in_game: null,
      health_color: null,
    });
  }
  
  const platformData = platformDataMap.get(platformIdStr);
  if (item.platform) {
    platformData.platform_name = item.platform;
  } else if (item.main_merchant_name && !platformData.platform_name) {
    platformData.platform_name = item.main_merchant_name;
  }
  if (!platformData.currency_set) {
    platformData.currency_set = new Set();
  }
  if (currency) {
    platformData.currency_set.add(currency);
  }
  if (!platformData.currency) {
    platformData.currency = currency;
  }
  platformData.revenue_usdt += tryParseNumber(item.total_amount_usdt) || 0;
  platformData.payout_usdt += tryParseNumber(item.total_pay_out_usdt) || 0;
  revenueDataCount++;
});

console.log(`✅ 收入数据收集完成: 处理了 ${revenueDataCount} 条 breakdown 项（指定游戏数据）`);
console.log(`   - platformDataMap 大小: ${platformDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(platformDataMap.keys()).join(", ")}`);
console.log(`   - 平台详情:`);
platformDataMap.forEach((platformData, platformIdStr) => {
  console.log(`     - ${platformIdStr} (${platformData.platform_name}): revenue=${platformData.revenue_usdt}, payout=${platformData.payout_usdt}, users=${platformData.unique_users}`);
});

// 3. 收集留存数据
// 注意：targetRetentionNew 和 targetRetentionActive 已在上面声明

// 合并活跃用户和新用户留存数据（优先使用新用户留存）
const retentionDataMap = new Map();

let retentionNewCount = 0;
let retentionNewSkipped = 0;
let retentionActiveCount = 0;
let retentionActiveSkipped = 0;

// 先收集新用户留存数据
// 注意：上游数据中，如果匹配成功：retention.platform 是商户名称（字符串），retention.merchant_id 是商户ID（数字），retention.platform_name 是商户名称
// 如果匹配失败：retention.platform 是商户ID（数字或字符串），retention.merchant_id 是商户ID（数字）
targetRetentionNew.forEach((retention) => {
  if (retention.game_code !== gameCode) {
    retentionNewSkipped++;
    return;
  }
  
  // 优先使用 merchant_id（始终是商户ID，无论匹配成功或失败）
  // 如果没有 merchant_id，检查 platform 是否是数字（商户ID）
  let platformId = retention.merchant_id || null;
  if (!platformId && retention.platform !== undefined && retention.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(retention.platform);
    if (platformNum !== null) {
      // platform 是数字，可以作为商户ID
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      console.warn(`⚠️ 留存数据 platform 是字符串（商户名称），但缺少 merchant_id，无法匹配平台:`, retention);
      return;
    }
  }
  
  if (!platformId) {
    console.warn(`⚠️ 留存数据缺少 merchant_id 和有效的 platform，无法匹配平台:`, retention);
    return;
  }
  
  const platformIdStr = String(platformId);
  const metricType = retention.metric_type || "new";
  
  if (!retentionDataMap.has(platformIdStr)) {
    retentionDataMap.set(platformIdStr, {
      active: null,
      new: null,
    });
  }
  
  const retentionData = retentionDataMap.get(platformIdStr);
  if (metricType === "new") {
    retentionData.new = retention;
    retentionNewCount++;
  }
});

console.log(`✅ 新用户留存数据收集完成: 处理了 ${retentionNewCount} 条, 跳过了 ${retentionNewSkipped} 条`);
console.log(`   - retentionDataMap 大小: ${retentionDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(retentionDataMap.keys()).join(", ")}`);

// 再收集活跃用户留存数据（如果没有新用户留存数据）
targetRetentionActive.forEach((retention) => {
  if (retention.game_code !== gameCode) {
    retentionActiveSkipped++;
    return;
  }
  
  // 优先使用 merchant_id（始终是商户ID，无论匹配成功或失败）
  // 如果没有 merchant_id，检查 platform 是否是数字（商户ID）
  let platformId = retention.merchant_id || null;
  if (!platformId && retention.platform !== undefined && retention.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(retention.platform);
    if (platformNum !== null) {
      // platform 是数字，可以作为商户ID
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      console.warn(`⚠️ 留存数据 platform 是字符串（商户名称），但缺少 merchant_id，无法匹配平台:`, retention);
      return;
    }
  }
  
  if (!platformId) {
    console.warn(`⚠️ 留存数据缺少 merchant_id 和有效的 platform，无法匹配平台:`, retention);
    return;
  }
  
  const platformIdStr = String(platformId);
  const metricType = retention.metric_type || "active";
  
  if (!retentionDataMap.has(platformIdStr)) {
    retentionDataMap.set(platformIdStr, {
      active: null,
      new: null,
    });
  }
  
  const retentionData = retentionDataMap.get(platformIdStr);
  // 只有当没有新用户留存数据时，才使用活跃用户留存数据
  if (metricType === "active" && !retentionData.new) {
    retentionData.active = retention;
    retentionActiveCount++;
  }
});

console.log(`✅ 活跃用户留存数据收集完成: 处理了 ${retentionActiveCount} 条, 跳过了 ${retentionActiveSkipped} 条`);
console.log(`   - retentionDataMap 大小: ${retentionDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(retentionDataMap.keys()).join(", ")}`);

// 处理全局留存数据（game_code 为 null 的留存数据）
// 这些数据需要按 merchant_id 匹配到对应的平台
let globalRetentionNewCount = 0;
let globalRetentionActiveCount = 0;

// 处理全局新用户留存数据
globalRetentionNewArray.forEach((retention) => {
  // 优先使用 merchant_id（始终是商户ID）
  // 如果没有 merchant_id，检查 platform 是否是数字（商户ID）
  let platformId = retention.merchant_id || null;
  if (!platformId && retention.platform !== undefined && retention.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(retention.platform);
    if (platformNum !== null) {
      // platform 是数字，可以作为商户ID
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      console.warn(`⚠️ 全局留存数据 platform 是字符串（商户名称），但缺少 merchant_id，无法匹配平台:`, retention);
      return;
    }
  }
  
  if (!platformId) {
    console.warn(`⚠️ 全局留存数据缺少 merchant_id 和有效的 platform，无法匹配平台:`, retention);
    return;
  }
  
  const platformIdStr = String(platformId);
  const metricType = retention.metric_type || "new";
  
  if (!retentionDataMap.has(platformIdStr)) {
    retentionDataMap.set(platformIdStr, {
      active: null,
      new: null,
    });
  }
  
  const retentionData = retentionDataMap.get(platformIdStr);
  // 只有当目标游戏留存数据中没有该平台的新用户留存数据时，才使用全局留存数据
  if (metricType === "new" && !retentionData.new) {
    retentionData.new = retention;
    globalRetentionNewCount++;
  }
});

console.log(`✅ 全局新用户留存数据收集完成: 处理了 ${globalRetentionNewCount} 条`);

// 处理全局活跃用户留存数据
globalRetentionActiveArray.forEach((retention) => {
  // 优先使用 merchant_id（始终是商户ID）
  // 如果没有 merchant_id，检查 platform 是否是数字（商户ID）
  let platformId = retention.merchant_id || null;
  if (!platformId && retention.platform !== undefined && retention.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(retention.platform);
    if (platformNum !== null) {
      // platform 是数字，可以作为商户ID
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      console.warn(`⚠️ 全局留存数据 platform 是字符串（商户名称），但缺少 merchant_id，无法匹配平台:`, retention);
      return;
    }
  }
  
  if (!platformId) {
    console.warn(`⚠️ 全局留存数据缺少 merchant_id 和有效的 platform，无法匹配平台:`, retention);
    return;
  }
  
  const platformIdStr = String(platformId);
  const metricType = retention.metric_type || "active";
  
  if (!retentionDataMap.has(platformIdStr)) {
    retentionDataMap.set(platformIdStr, {
      active: null,
      new: null,
    });
  }
  
  const retentionData = retentionDataMap.get(platformIdStr);
  // 只有当目标游戏留存数据中没有该平台的新用户和活跃用户留存数据时，才使用全局留存数据
  if (metricType === "active" && !retentionData.new && !retentionData.active) {
    retentionData.active = retention;
    globalRetentionActiveCount++;
  }
});

console.log(`✅ 全局活跃用户留存数据收集完成: 处理了 ${globalRetentionActiveCount} 条`);
console.log(`   - retentionDataMap 总大小: ${retentionDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(retentionDataMap.keys()).join(", ")}`);

// 将留存数据合并到平台数据中（优先使用新用户留存）
let retentionMergedCount = 0;
retentionDataMap.forEach((retentionData, platformIdStr) => {
  // 如果平台数据不存在，创建新的平台数据
  if (!platformDataMap.has(platformIdStr)) {
    // 尝试从留存数据中获取平台名称
    const retention = retentionData.new || retentionData.active;
    // 优先使用 platform_name（商户名称），如果没有则使用 platform（如果是商户名称），最后使用 main_merchant_name
    // 注意：如果匹配成功，platform 是商户名称（字符串）；如果匹配失败，platform 是商户ID（数字或字符串）
    const platformName = retention?.platform_name || 
                         (retention?.platform && tryParseNumber(retention.platform) === null ? retention.platform : null) ||
                         retention?.main_merchant_name || 
                         platformIdStr;
    
    platformDataMap.set(platformIdStr, {
      game_code: gameCode,
      platform_id: platformIdStr,
      platform_name: platformName,
      currency: null,
      currency_set: new Set(),
      stat_date: statDate,
      revenue_usdt: 0,
      payout_usdt: 0,
      net_usdt: 0,
      unique_users: 0,
      arpu_usdt: 0,
      d1_retention: null,
      d7_retention: null,
      retention_score: null,
      rank_in_game: null,
      health_color: null,
    });
  }
  
  const platformData = platformDataMap.get(platformIdStr);
  // 优先使用新用户留存，如果没有则使用活跃用户留存
  const retention = retentionData.new || retentionData.active;
  if (retention) {
    // 更新平台名称（优先使用 platform_name，如果不存在则使用 platform（如果它是商户名称））
    if (retention.platform_name) {
      platformData.platform_name = retention.platform_name;
    } else if (retention.platform && tryParseNumber(retention.platform) === null) {
      // platform 是字符串（商户名称），使用它
      platformData.platform_name = retention.platform;
    } else if (retention.main_merchant_name && !platformData.platform_name) {
      platformData.platform_name = retention.main_merchant_name;
    } else if (retention.platform && !platformData.platform_name) {
      // platform 是数字（商户ID），不应该用作名称，但如果没有其他选择，暂时使用
      console.warn(`⚠️ 留存数据缺少 platform_name，使用 platform (ID) 作为名称: platform_id=${platformIdStr}, platform=${retention.platform}`);
      platformData.platform_name = String(retention.platform);
    }
    
    platformData.d1_retention = parseRetentionRate(retention.d1_retention_rate);
    platformData.d7_retention = parseRetentionRate(retention.d7_retention_rate);
    platformData.retention_score = calculateRetentionScore(
      retention.d1_retention_rate,
      retention.d7_retention_rate
    );
    platformData.health_color = getHealthColor(retention.d1_retention_rate);
    retentionMergedCount++;
  }
});

console.log(`✅ 留存数据合并完成: 合并了 ${retentionMergedCount} 个平台的留存数据`);
console.log(`   - platformDataMap 大小: ${platformDataMap.size}`);
console.log(`   - 已收集的平台: ${Array.from(platformDataMap.keys()).join(", ")}`);

// 统一处理平台名称（合并来自不同数据源的平台信息）
// 优先级：收入数据 > 用户数据 > 留存数据 > main_merchant_name
const platformNameMap = new Map();

// 从收入数据中收集平台名称（优先级最高，因为这是映射后的商户名称）
targetRevenue.forEach((revenue) => {
  if (revenue.game_code !== gameCode) return;
  const breakdown = revenue.breakdown || [];
  breakdown.forEach((item) => {
    const platformId = item.merchant_id;
    if (!platformId) return;
    const platformIdStr = String(platformId);
    // 收入数据中的 platform 是映射后的商户名称，优先级最高
    if (item.platform && !platformNameMap.has(platformIdStr)) {
      platformNameMap.set(platformIdStr, item.platform);
    }
  });
});

// 从用户数据中收集平台名称（优先级次之）
targetUsers.forEach((user) => {
  if (user.game_code !== gameCode) return;
  
  // 优先使用 merchant_id（始终是商户ID）
  let platformId = user.merchant_id || null;
  if (!platformId && user.platform !== undefined && user.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(user.platform);
    if (platformNum !== null) {
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      return;
    }
  }
  
  if (!platformId) return;
  const platformIdStr = String(platformId);
  
  // 用户数据中的 platform_name 是映射后的商户名称
  // 如果 platform_name 不存在，但 platform 是字符串（商户名称），也可以使用
  const platformName = user.platform_name || 
                       (user.platform && tryParseNumber(user.platform) === null ? user.platform : null);
  if (platformName && !platformNameMap.has(platformIdStr)) {
    platformNameMap.set(platformIdStr, platformName);
  }
});

// 从留存数据中收集平台名称（优先级最低）
[...targetRetentionNew, ...targetRetentionActive].forEach((retention) => {
  if (retention.game_code !== gameCode) return;
  
  // 优先使用 merchant_id（始终是商户ID）
  let platformId = retention.merchant_id || null;
  if (!platformId && retention.platform !== undefined && retention.platform !== null) {
    // 检查 platform 是否是数字（商户ID）
    const platformNum = tryParseNumber(retention.platform);
    if (platformNum !== null) {
      platformId = platformNum;
    } else {
      // platform 是字符串（商户名称），不能用作商户ID，跳过
      return;
    }
  }
  
  if (!platformId) return;
  const platformIdStr = String(platformId);
  
  // 留存数据中的 platform_name 是映射后的商户名称
  // 如果 platform_name 不存在，但 platform 是字符串（商户名称），也可以使用
  const platformName = retention.platform_name || 
                       (retention.platform && tryParseNumber(retention.platform) === null ? retention.platform : null);
  if (platformName && !platformNameMap.has(platformIdStr)) {
    platformNameMap.set(platformIdStr, platformName);
  }
});

// 更新所有平台数据的平台名称
platformDataMap.forEach((platformData, platformIdStr) => {
  // 如果从映射表中找到了更好的平台名称，使用它
  if (platformNameMap.has(platformIdStr)) {
    const newPlatformName = platformNameMap.get(platformIdStr);
    if (platformData.platform_name !== newPlatformName) {
      console.log(`📝 更新平台名称: platform_id=${platformIdStr}, 旧名称=${platformData.platform_name || '(null)'}, 新名称=${newPlatformName}`);
      platformData.platform_name = newPlatformName;
    }
  } else if (!platformData.platform_name || platformData.platform_name === platformIdStr) {
    // 如果没有找到平台名称，输出警告
    console.warn(`⚠️ 平台 ${platformIdStr} 没有找到平台名称`);
  }
});

console.log(`📊 平台名称映射统计:`, {
  total_platforms: platformDataMap.size,
  platforms_with_name: Array.from(platformDataMap.values()).filter(p => p.platform_name && p.platform_name !== p.platform_id).length,
  platforms_without_name: Array.from(platformDataMap.values()).filter(p => !p.platform_name || p.platform_name === p.platform_id).length,
});

// 计算每个平台的 net_usdt 和 arpu_usdt
platformDataMap.forEach((platformData) => {
  if (platformData.currency_set instanceof Set) {
    const currencyList = Array.from(platformData.currency_set);
    if (currencyList.length > 0) {
      platformData.currency = currencyList.join("、");
    } else if (!platformData.currency) {
      platformData.currency = "-";
    }
    delete platformData.currency_set;
  } else if (!platformData.currency) {
    platformData.currency = "-";
  }
  platformData.net_usdt = platformData.revenue_usdt - platformData.payout_usdt;
  platformData.arpu_usdt =
    platformData.unique_users > 0
      ? platformData.net_usdt / platformData.unique_users
      : 0;
  
  // 格式化数值
  platformData.revenue_usdt = Number(platformData.revenue_usdt.toFixed(2));
  platformData.payout_usdt = Number(platformData.payout_usdt.toFixed(2));
  platformData.net_usdt = Number(platformData.net_usdt.toFixed(2));
  platformData.arpu_usdt = Number(platformData.arpu_usdt.toFixed(2));
  if (platformData.d1_retention !== null) {
    platformData.d1_retention = Number(platformData.d1_retention.toFixed(4));
  }
  if (platformData.d7_retention !== null) {
    platformData.d7_retention = Number(platformData.d7_retention.toFixed(4));
  }
});

console.log(`📊 平台数据收集完成: 共收集到 ${platformDataMap.size} 个平台`);
console.log(`   - 平台列表: ${Array.from(platformDataMap.keys()).join(", ")}`);
console.log(`   - 平台详情:`);
platformDataMap.forEach((platformData, platformIdStr) => {
  console.log(`     - ${platformIdStr} (${platformData.platform_name}): revenue=${platformData.revenue_usdt}, users=${platformData.unique_users}, retention=${platformData.d1_retention !== null ? platformData.d1_retention * 100 + '%' : 'null'}`);
});

// 过滤掉没有用户数的平台（指定游戏在该平台没有用户时不展示）
const allPlatformEntries = Array.from(platformDataMap.values());
const filteredPlatformEntries = allPlatformEntries.filter(
  (platform) => (platform.unique_users || 0) > 0
);
const removedPlatformEntries = allPlatformEntries.filter(
  (platform) => (platform.unique_users || 0) <= 0
);

if (removedPlatformEntries.length > 0) {
  console.log(`ℹ️ 因缺少用户数，跳过 ${removedPlatformEntries.length} 个平台:`,
    removedPlatformEntries.slice(0, 5).map((p) => ({
      platform_id: p.platform_id,
      platform_name: p.platform_name,
      revenue_usdt: p.revenue_usdt,
      unique_users: p.unique_users,
    }))
  );
}

if (filteredPlatformEntries.length === 0) {
  console.warn("⚠️ 指定游戏没有任何包含用户数的平台数据，平台级切片表将为空");
}

// 计算平台排名（按 revenue_usdt 排序）
const sortedPlatforms = filteredPlatformEntries.sort(
  (a, b) => b.revenue_usdt - a.revenue_usdt
);

console.log(`📊 平台排序完成: 共 ${sortedPlatforms.length} 个平台`);
console.log(`   - 排序后的平台列表:`);
sortedPlatforms.forEach((platformData, index) => {
  console.log(`     ${index + 1}. ${platformData.platform_id} (${platformData.platform_name}): revenue=${platformData.revenue_usdt}, rank=${index + 1}`);
  platformData.rank_in_game = index + 1;
  platformLevelTable.push(platformData);
});

console.log(`✅ 平台级切片表生成完成: 共 ${platformLevelTable.length} 个平台`);
console.log(`   - 平台列表详情:`);
platformLevelTable.forEach((platform, index) => {
  console.log(`     ${index + 1}/${platformLevelTable.length}. ${platform.platform_id} (${platform.platform_name}): revenue=${platform.revenue_usdt}, users=${platform.unique_users}, retention=${platform.d1_retention !== null ? (platform.d1_retention * 100).toFixed(2) + '%' : 'null'}`);
});

// --- 3. 生成Lark表写入格式 ----------------------------------------------------

// 格式化数值显示
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  const numValue = Number(value);
  if (Number.isNaN(numValue)) return "-";
  return numValue.toFixed(decimals);
};

// 格式化百分比显示
const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  const numValue = Number(value);
  if (Number.isNaN(numValue)) return "-";
  return `${(numValue * 100).toFixed(decimals)}%`;
};

// 生成游戏级评分表的Lark格式
const buildGameLevelTableLarkFormat = (gameTable) => {
  const rows = [];
  // 表头
  rows.push([
    "游戏代码",
    "游戏名称",
    "总投注(USDT)",
    "总派奖(USDT)",
    "净收入(USDT)",
    "唯一用户数",
    "ARPU(USDT)",
    "D1留存率",
    "D7留存率",
    "留存得分",
    "全游戏排名",
    "趋势标签",
  ]);
  
  // 数据行
  rows.push([
    gameTable.game_code || "-",
    gameTable.game_name || "-",
    formatNumber(gameTable.revenue_total_usdt),
    formatNumber(gameTable.payout_total_usdt),
    formatNumber(gameTable.net_usdt),
    String(gameTable.unique_users || 0),
    formatNumber(gameTable.arpu_usdt),
    formatPercentage(gameTable.d1_retention, 2),
    formatPercentage(gameTable.d7_retention, 2),
    formatNumber(gameTable.retention_score, 2),
    gameTable.rank_global !== null ? String(gameTable.rank_global) : "-",
    gameTable.tag_trend || "-",
  ]);
  
  return rows;
};

// 生成全平台游戏级评分表的Lark格式
const buildPlatformGameLevelTableLarkFormat = (platformGameTable) => {
  const rows = [];
  // 表头
  rows.push([
    "游戏代码",
    "游戏名称",
    "总投注(USDT)",
    "总派奖(USDT)",
    "净收入(USDT)",
    "唯一用户数",
    "ARPU(USDT)",
    "D1留存率",
    "D7留存率",
    "留存得分",
  ]);
  
  // 数据行
  rows.push([
    platformGameTable.game_code || "-",
    platformGameTable.game_name || "-",
    formatNumber(platformGameTable.revenue_total_usdt),
    formatNumber(platformGameTable.payout_total_usdt),
    formatNumber(platformGameTable.net_usdt),
    String(platformGameTable.unique_users || 0),
    formatNumber(platformGameTable.arpu_usdt),
    formatPercentage(platformGameTable.d1_retention, 2),
    formatPercentage(platformGameTable.d7_retention, 2),
    formatNumber(platformGameTable.retention_score, 2),
  ]);
  
  return rows;
};

// 生成平台级切片表的Lark格式
const buildPlatformLevelTableLarkFormat = (platformTable) => {
  const rows = [];
  // 表头
  rows.push([
    "游戏代码",
    "平台ID",
    "平台名称",
    "币种",
    "统计日期",
    "投注额(USDT)",
    "派奖额(USDT)",
    "净收入(USDT)",
    "唯一用户数",
    "ARPU(USDT)",
    "D1留存率",
    "D7留存率",
    "留存得分",
    "游戏内排名",
    "健康度颜色",
  ]);
  
  console.log(`📊 开始生成平台级切片表 Lark 格式: 共 ${platformTable.length} 个平台`);
  
  // 数据行
  let rowCount = 0;
  platformTable.forEach((platform, index) => {
    rowCount++;
    // revenue_usdt 是投注额（total_amount_usdt），已换算为USDT
    // payout_usdt 是派奖额（total_pay_out_usdt），已换算为USDT
    const row = [
      platform.game_code || "-",
      platform.platform_id || "-",
      platform.platform_name || "-",
      platform.currency || "-",
      platform.stat_date || "-",
      formatNumber(platform.revenue_usdt), // 投注额(USDT)
      formatNumber(platform.payout_usdt), // 派奖额(USDT)
      formatNumber(platform.net_usdt),
      String(platform.unique_users || 0),
      formatNumber(platform.arpu_usdt),
      formatPercentage(platform.d1_retention, 2),
      formatPercentage(platform.d7_retention, 2),
      formatNumber(platform.retention_score, 2),
      platform.rank_in_game !== null ? String(platform.rank_in_game) : "-",
      platform.health_color || "-",
    ];
    rows.push(row);
    
    if (index < 5 || index >= platformTable.length - 2) {
      console.log(`   - 平台 ${index + 1}/${platformTable.length}: ${platform.platform_id} (${platform.platform_name}), 投注额=${platform.revenue_usdt}, 派奖额=${platform.payout_usdt}, users=${platform.unique_users}`);
    }
  });
  
  console.log(`✅ 平台级切片表 Lark 格式生成完成: 共 ${rowCount} 行数据（包含表头）`);
  console.log(`   - 表头: 1 行`);
  console.log(`   - 数据行: ${rowCount - 1} 行`);
  
  return rows;
};

// 生成游戏占平台比值的Lark格式
const buildGamePlatformRatioTableLarkFormat = (gameTable, platformGameTable) => {
  const rows = [];
  // 表头
  rows.push([
    "指标",
    "目标游戏",
    "全平台",
    "占比",
  ]);
  
  // 计算占比
  const revenueRatio = platformGameTable.revenue_total_usdt > 0
    ? (gameTable.revenue_total_usdt / platformGameTable.revenue_total_usdt * 100).toFixed(2) + "%"
    : "-";
  const userRatio = platformGameTable.unique_users > 0
    ? (gameTable.unique_users / platformGameTable.unique_users * 100).toFixed(2) + "%"
    : "-";
  const netRatio = platformGameTable.net_usdt > 0
    ? (gameTable.net_usdt / platformGameTable.net_usdt * 100).toFixed(2) + "%"
    : "-";
  
  // 数据行
  rows.push(["总投注(USDT)", formatNumber(gameTable.revenue_total_usdt), formatNumber(platformGameTable.revenue_total_usdt), revenueRatio]);
  rows.push(["总派奖(USDT)", formatNumber(gameTable.payout_total_usdt), formatNumber(platformGameTable.payout_total_usdt), "-"]);
  rows.push(["净收入(USDT)", formatNumber(gameTable.net_usdt), formatNumber(platformGameTable.net_usdt), netRatio]);
  rows.push(["唯一用户数", String(gameTable.unique_users || 0), String(platformGameTable.unique_users || 0), userRatio]);
  rows.push(["ARPU(USDT)", formatNumber(gameTable.arpu_usdt), formatNumber(platformGameTable.arpu_usdt), "-"]);
  rows.push(["D1留存率", formatPercentage(gameTable.d1_retention, 2), formatPercentage(platformGameTable.d1_retention, 2), "-"]);
  rows.push(["D7留存率", formatPercentage(gameTable.d7_retention, 2), formatPercentage(platformGameTable.d7_retention, 2), "-"]);
  rows.push(["留存得分", formatNumber(gameTable.retention_score, 2), formatNumber(platformGameTable.retention_score, 2), "-"]);
  
  return rows;
};

// 生成所有Lark表格式
const gameLevelTableLark = buildGameLevelTableLarkFormat(gameLevelTable);
const platformGameLevelTableLark = buildPlatformGameLevelTableLarkFormat(platformGameLevelTable);
const platformLevelTableLark = buildPlatformLevelTableLarkFormat(platformLevelTable);
const gamePlatformRatioTableLark = buildGamePlatformRatioTableLarkFormat(gameLevelTable, platformGameLevelTable);

// --- 输出结果 ----------------------------------------------------------------

const output = {
  tenant_token: tenant_token,
  table_name: table_name,
  target_game: target_game,
  game_level_table: gameLevelTable,
  platform_game_level_table: platformGameLevelTable,
  platform_level_table: platformLevelTable,
  // Lark表写入格式
  lark_tables: {
    game_level_table: {
      sheet_name: "游戏级评分表",
      values: gameLevelTableLark,
    },
    platform_game_level_table: {
      sheet_name: "全平台游戏级评分表",
      values: platformGameLevelTableLark,
    },
    platform_level_table: {
      sheet_name: "平台级切片表",
      values: platformLevelTableLark,
    },
    game_platform_ratio_table: {
      sheet_name: "游戏占平台比值表",
      values: gamePlatformRatioTableLark,
    },
  },
  meta: {
    stat_date: statDate,
    week_start: weekStart,
    week_end: weekEnd,
    total_platforms: platformLevelTable.length,
    generated_at: new Date().toISOString(),
  },
};

console.log("=== 游戏评级事实表生成完成 ===");
console.log("游戏:", gameName);
console.log("目标游戏级数据:", {
  unique_users: gameLevelTable.unique_users,
  revenue_total_usdt: gameLevelTable.revenue_total_usdt,
  net_usdt: gameLevelTable.net_usdt,
  arpu_usdt: gameLevelTable.arpu_usdt,
  d1_retention: gameLevelTable.d1_retention,
  d7_retention: gameLevelTable.d7_retention,
  retention_score: gameLevelTable.retention_score,
});
console.log("全平台游戏级数据:", {
  unique_users: platformGameLevelTable.unique_users,
  revenue_total_usdt: platformGameLevelTable.revenue_total_usdt,
  net_usdt: platformGameLevelTable.net_usdt,
  arpu_usdt: platformGameLevelTable.arpu_usdt,
  d1_retention: platformGameLevelTable.d1_retention,
  d7_retention: platformGameLevelTable.d7_retention,
  retention_score: platformGameLevelTable.retention_score,
});
console.log("平台级数据:", {
  total_platforms: platformLevelTable.length,
  sample_platforms: platformLevelTable.slice(0, 3).map((p) => ({
    platform_id: p.platform_id,
    platform_name: p.platform_name,
    revenue_usdt: p.revenue_usdt,
    unique_users: p.unique_users,
  })),
});
console.log("Lark表格式:", {
  game_level_table_rows: gameLevelTableLark.length,
  platform_game_level_table_rows: platformGameLevelTableLark.length,
  platform_level_table_rows: platformLevelTableLark.length,
  game_platform_ratio_table_rows: gamePlatformRatioTableLark.length,
});

// 验证数据完整性
console.log("\n📊 数据完整性验证:");
console.log(`   - platformLevelTable 数组长度: ${platformLevelTable.length}`);
console.log(`   - platformLevelTableLark 数组长度: ${platformLevelTableLark.length} (包含表头)`);
console.log(`   - 预期数据行数: ${platformLevelTable.length + 1} (1行表头 + ${platformLevelTable.length}行数据)`);
console.log(`   - 实际数据行数: ${platformLevelTableLark.length}`);

if (platformLevelTableLark.length !== platformLevelTable.length + 1) {
  console.error(`❌ 数据行数不匹配！`);
  console.error(`   - platformLevelTable 长度: ${platformLevelTable.length}`);
  console.error(`   - platformLevelTableLark 长度: ${platformLevelTableLark.length}`);
  console.error(`   - 预期长度: ${platformLevelTable.length + 1}`);
}

// 输出所有平台的详细信息
console.log("\n📋 所有平台数据详情:");
platformLevelTable.forEach((platform, index) => {
  console.log(`   ${index + 1}/${platformLevelTable.length}. ${platform.platform_id} (${platform.platform_name}):`);
  console.log(`      - revenue: ${platform.revenue_usdt}, payout: ${platform.payout_usdt}, net: ${platform.net_usdt}`);
  console.log(`      - users: ${platform.unique_users}, arpu: ${platform.arpu_usdt}`);
  console.log(`      - d1_retention: ${platform.d1_retention !== null ? (platform.d1_retention * 100).toFixed(2) + '%' : 'null'}`);
  console.log(`      - d7_retention: ${platform.d7_retention !== null ? (platform.d7_retention * 100).toFixed(2) + '%' : 'null'}`);
  console.log(`      - rank: ${platform.rank_in_game}, health: ${platform.health_color || 'null'}`);
});

// 输出 Lark 表格式的详细信息
console.log("\n📋 Lark 表格式详情:");
console.log(`   - platformLevelTableLark 行数: ${platformLevelTableLark.length}`);
console.log(`   - 前5行:`);
platformLevelTableLark.slice(0, 5).forEach((row, index) => {
  console.log(`     ${index + 1}. ${JSON.stringify(row).substring(0, 100)}...`);
});
console.log(`   - 后5行:`);
platformLevelTableLark.slice(-5).forEach((row, index) => {
  const actualIndex = platformLevelTableLark.length - 5 + index;
  console.log(`     ${actualIndex + 1}. ${JSON.stringify(row).substring(0, 100)}...`);
});

return [
  {
    json: output,
  },
];
