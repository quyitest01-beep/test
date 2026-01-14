// n8n Code节点：游戏评级分析器
// 功能：
// 1. 读取上游游戏数据（来自 game-rating-fact-table-generator.js）
// 2. 按照游戏评级规则计算各项指标和得分
// 3. 输出 JSON 数据以便后续 AI 分析

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
const parsePercentage = (value) => {
  if (value === null || value === undefined || value === "") return null;
  
  // 检查原始值是否包含 % 符号
  const originalStr = String(value).trim();
  const hasPercentSign = originalStr.includes('%');
  
  // 去掉 % 符号并解析数字
  const str = originalStr.replace(/%/g, "").trim();
  const num = tryParseNumber(str);
  if (num === null) return null;
  
  // 如果原始值包含 % 符号，说明是百分比格式，需要除以100转换为小数
  // 例如："0.43%" -> 0.0043, "43%" -> 0.43
  if (hasPercentSign) {
    return num / 100;
  }
  
  // 如果原始值不包含 %，判断是否需要转换：
  // 如果数值大于1，可能是百分比格式（如 43 表示 43%），需要除以100
  // 如果数值 <= 1，可能是已经转换为小数的格式（如 0.43 表示 43% 或 0.0043 表示 0.43%）
  // 但为了安全起见，如果数值 > 1 且没有 %，也除以100（更可能是百分比格式）
  if (num > 1) {
    return num / 100;
  }
  
  // 如果数值 <= 1 且没有 %，假设已经是小数格式，直接返回
  return num;
};

// --- 解析 Lark 表格数据 --------------------------------------------------------

/**
 * 从 Lark 表格的 valueRange.values 中解析游戏级评分表
 */
const parseGameLevelTableFromLark = (values) => {
  if (!values || !Array.isArray(values)) return null;
  
  // 查找游戏级评分表（第一段：游戏代码、游戏名称、总投注、总派奖）
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    // 查找表头：游戏代码、游戏名称、总投注(USDT)、总派奖(USDT)
    const header = row[0];
    if (header === "游戏代码" || header === "游戏名称") {
      // 找到表头，下一行是数据
      if (i + 1 < values.length) {
        const dataRow = values[i + 1];
        if (dataRow && Array.isArray(dataRow) && dataRow.length >= 4) {
          const gameCode = String(dataRow[0] || "").trim();
          const gameName = String(dataRow[1] || "").trim();
          const revenue = tryParseNumber(dataRow[2]);
          const payout = tryParseNumber(dataRow[3]);
          
          // 跳过 "ALL_GAMES" 行
          if (gameCode === "ALL_GAMES") continue;
          
          if (gameCode && gameName && revenue !== null && payout !== null) {
            return {
              game_code: gameCode,
              game_name: gameName,
              revenue_total_usdt: revenue,
              payout_total_usdt: payout,
              net_usdt: revenue - payout,
              unique_users: 0, // 需要从其他地方获取
              arpu_usdt: 0,
              d1_retention: null,
              d7_retention: null,
            };
          }
        }
      }
    }
  }
  return null;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析全平台游戏级评分表
 */
const parsePlatformGameLevelTableFromLark = (values) => {
  if (!values || !Array.isArray(values)) return null;
  
  // 查找全平台游戏级评分表（包含 "ALL_GAMES" 的行）
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const gameCode = String(row[0] || "").trim();
    if (gameCode === "ALL_GAMES") {
      const gameName = String(row[1] || "").trim();
      const revenue = tryParseNumber(row[2]);
      const payout = tryParseNumber(row[3]);
      
      if (revenue !== null && payout !== null) {
        return {
          game_code: "ALL_GAMES",
          game_name: gameName || "全平台所有游戏",
          revenue_total_usdt: revenue,
          payout_total_usdt: payout,
          net_usdt: revenue - payout,
          unique_users: 0, // 需要从游戏占平台比值表中获取
          arpu_usdt: 0,
          d1_retention: null,
          d7_retention: null,
        };
      }
    }
  }
  return null;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析平台级切片表（每个平台的数据）
 */
const parsePlatformLevelTableFromLarkValues = (values, gameCode) => {
  if (!values || !Array.isArray(values)) return [];
  
  const platformTable = [];
  
  console.log(`🔍 开始解析 Lark 表格平台级数据，gameCode: ${gameCode}`);
  
  // 查找平台级切片表（游戏代码、平台ID、平台名称、币种）
  let foundTable = false;
  let rowIndex = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const header = String(row[0] || "").trim();
    // 查找表头：游戏代码、平台ID、平台名称、币种
    if (header === "游戏代码" || header === "平台ID") {
      foundTable = true;
      console.log(`✅ 找到平台级切片表表头（行 ${i + 1}）: ${header}`);
      rowIndex = i;
      continue;
    }
    
    if (foundTable && row[0] && row[1] && row[2]) {
      const rowGameCode = String(row[0] || "").trim();
      
      // 只处理目标游戏的数据
      if (rowGameCode === gameCode) {
        const platformId = String(row[1] || "").trim();
        const platformName = String(row[2] || "").trim();
        const currency = String(row[3] || "USDT").trim();
        
        // 检查是否是有效的平台数据（不是空行或表头）
        if (platformId && platformName && platformId !== "平台ID" && platformId !== "null") {
          // 从 Lark 表格中提取完整数据
          // 列顺序：游戏代码[0], 平台ID[1], 平台名称[2], 币种[3], 统计日期[4], 
          // 投注额(USDT)[5], 派奖额(USDT)[6], 净收入(USDT)[7], 唯一用户数[8], 
          // ARPU(USDT)[9], D1留存率[10], D7留存率[11], 留存得分[12], 游戏内排名[13], 健康度颜色[14]
          
          const revenueUsdt = tryParseNumber(row[5]) || 0;
          const payoutUsdt = tryParseNumber(row[6]) || 0;
          const netUsdt = tryParseNumber(row[7]) || 0;
          const uniqueUsers = tryParseNumber(row[8]) || 0;
          const arpuUsdt = tryParseNumber(row[9]) || 0;
          const d1RetentionStr = String(row[10] || "").trim();
          const d7RetentionStr = String(row[11] || "").trim();
          
          // 解析留存率（可能是百分比格式，如 "1.63%"）
          const d1Retention = parsePercentage(d1RetentionStr);
          const d7Retention = parsePercentage(d7RetentionStr);
          
          console.log(`   - 找到平台数据（行 ${i + 1}）: ${platformId} (${platformName}) - ${currency}, revenue=${revenueUsdt}, users=${uniqueUsers}, d1=${d1RetentionStr}`);
          
          platformTable.push({
            game_code: rowGameCode,
            platform_id: platformId,
            platform_name: platformName,
            currency: currency,
            stat_date: String(row[4] || "").trim(),
            revenue_usdt: revenueUsdt,
            payout_usdt: payoutUsdt,
            net_usdt: netUsdt,
            unique_users: uniqueUsers,
            arpu_usdt: arpuUsdt,
            d1_retention: d1Retention,
            d7_retention: d7Retention,
            retention_score: tryParseNumber(row[12]) || 0,
            rank_in_game: tryParseNumber(row[13]) || null,
            health_color: String(row[14] || "").trim(),
          });
        }
      } else if (rowGameCode && rowGameCode !== gameCode && rowGameCode !== "ALL_GAMES" && rowGameCode !== "游戏代码" && rowGameCode !== "指标" && rowGameCode !== "null") {
        // 如果遇到其他游戏的数据，停止解析
        console.log(`⚠️ 遇到其他游戏的数据（行 ${i + 1}）: ${rowGameCode}，停止解析`);
        break;
      } else if (!rowGameCode || rowGameCode === "" || rowGameCode === "null") {
        // 空行，可能表示表格结束
        if (platformTable.length > 0) {
          console.log(`✅ 遇到空行（行 ${i + 1}），已解析 ${platformTable.length} 个平台，停止解析`);
          break;
        }
      }
    }
  }
  
  console.log(`📊 解析完成，共解析到 ${platformTable.length} 个平台`);
  return platformTable;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析游戏占平台比值表（用于提取更多指标）
 */
const parseRatioTableFromLark = (values) => {
  if (!values || !Array.isArray(values)) return null;
  
  const result = {
    game: {},
    platform: {},
  };
  
  // 查找游戏占平台比值表（指标对比表）
  let foundTable = false;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const indicator = String(row[0] || "").trim();
    if (indicator === "指标") {
      foundTable = true;
      continue;
    }
    
    if (foundTable && indicator) {
      const gameValue = row[1];
      const platformValue = row[2];
      
      if (indicator === "唯一用户数") {
        result.game.unique_users = tryParseNumber(gameValue) || 0;
        result.platform.unique_users = tryParseNumber(platformValue) || 0;
      } else if (indicator === "D1留存率") {
        result.game.d1_retention = parsePercentage(gameValue);
        result.platform.d1_retention = parsePercentage(platformValue);
      } else if (indicator === "D7留存率") {
        result.game.d7_retention = parsePercentage(gameValue);
        result.platform.d7_retention = parsePercentage(platformValue);
      } else if (indicator === "净收入(USDT)") {
        result.game.net_usdt = tryParseNumber(gameValue) || 0;
        result.platform.net_usdt = tryParseNumber(platformValue) || 0;
      } else if (indicator === "ARPU(USDT)") {
        result.game.arpu_usdt = tryParseNumber(gameValue) || 0;
        result.platform.arpu_usdt = tryParseNumber(platformValue) || 0;
      }
    }
  }
  
  return result;
};

// --- 提取上游数据 ----------------------------------------------------------------

let inputData = null;
let gameInfo = null;
let weekStart = null;
let weekEnd = null;
let larkTableValues = null;

// 遍历所有输入项，查找主要数据和游戏信息
for (const input of inputs) {
  if (input?.json) {
    // 查找包含 game_level_table 的主要数据
    if (input.json.game_level_table && !inputData) {
      inputData = input.json;
    }
    
    // 查找包含 Lark 表格数据（valueRange.values）
    if (input.json.data?.valueRange?.values && !larkTableValues) {
      larkTableValues = input.json.data.valueRange.values;
      if (!inputData) {
        // 如果没有找到结构化数据，使用 Lark 表格数据
        inputData = input.json;
      }
    }
    
    // 查找包含 game、WeekStart、WeekEnd 的游戏信息
    if (input.json.game || input.json.WeekStart || input.json.WeekEnd) {
      gameInfo = input.json;
      if (input.json.game) {
        gameInfo.gameName = input.json.game;
      }
      if (input.json.WeekStart) {
        weekStart = input.json.WeekStart;
      }
      if (input.json.WeekEnd) {
        weekEnd = input.json.WeekEnd;
      }
    }
  }
}

// 如果没有找到主要数据，使用第一个输入项
if (!inputData && inputs.length > 0 && inputs[0]?.json) {
  inputData = inputs[0].json;
  // 检查是否是 Lark API 响应格式
  if (inputData.data?.valueRange?.values) {
    larkTableValues = inputData.data.valueRange.values;
  }
}

if (!inputData) {
  throw new Error("❌ 未找到有效的输入数据");
}

const {
  tenant_token,
  table_name,
  target_game,
  game_level_table,
  platform_game_level_table,
  platform_level_table,
  metrics,
  meta,
} = inputData;

// 提取游戏信息：优先使用 gameInfo，其次使用 target_game，最后从 game_level_table 兜底
const resolvedGame = target_game && target_game.game_code ? target_game : {};
const extractPrimaryGameCodeFromMetrics = (metricsData) => {
  if (!metricsData || !metricsData.target) return null;
  const sources = [
    metricsData.target.users,
    metricsData.target.revenue,
    metricsData.target.retention_new,
    metricsData.target.retention_active,
  ];
  for (const collection of sources) {
    if (!collection) continue;
    const list = Array.isArray(collection) ? collection : [collection];
    for (const item of list) {
      if (item && item.game_code) {
        return item.game_code;
      }
    }
  }
  return null;
};

// 如果找到了 Lark 表格数据，先解析它来获取游戏信息
let larkGameCode = null;
let larkGameName = null;
if (larkTableValues) {
  const parsed = parseGameLevelTableFromLark(larkTableValues);
  if (parsed) {
    larkGameCode = parsed.game_code; // 这是真正的游戏代码，如 "gp_lottery_76"
    larkGameName = parsed.game_name; // 这是游戏名称，如 "Golazo Win"
    console.log(`📊 从 Lark 表格解析到游戏代码: ${larkGameCode}, 游戏名称: ${larkGameName}`);
  }
}

// 提取游戏代码：优先使用 Lark 表格解析的游戏代码（真正的代码），其次使用其他来源
const fallbackGameCode =
  larkGameCode || // 从 Lark 表格解析的游戏代码（优先，因为这是真正的代码）
  resolvedGame.game_code ||
  game_level_table?.game_code ||
  platform_game_level_table?.game_code ||
  inputData?.target_game_code ||
  extractPrimaryGameCodeFromMetrics(metrics) ||
  gameInfo?.gameName; // 如果都没有，使用 game 字段（可能是名称或代码）

const fallbackGameName =
  gameInfo?.gameName || // 从 game 字段获取
  larkGameName || // 从 Lark 表格解析的游戏名称
  resolvedGame.english_name ||
  resolvedGame.game_name ||
  game_level_table?.game_name ||
  platform_game_level_table?.game_name ||
  inputData?.target_game_name ||
  fallbackGameCode;

// 提取统计周期：优先使用 gameInfo，其次使用 meta
const resolvedWeekStart = weekStart || gameInfo?.WeekStart || meta?.week_start || meta?.WeekStart;
const resolvedWeekEnd = weekEnd || gameInfo?.WeekEnd || meta?.week_end || meta?.WeekEnd;

if (!fallbackGameCode) {
  throw new Error("❌ 未找到目标游戏信息");
}

const gameCode = fallbackGameCode;
const gameName = fallbackGameName;

console.log("=== 游戏评级分析器开始 ===");
console.log("游戏:", gameName, "(" + gameCode + ")");
if (resolvedWeekStart && resolvedWeekEnd) {
  console.log("统计周期:", resolvedWeekStart, "-", resolvedWeekEnd);
}

// --- 游戏评级规则计算函数 -----------------------------------------------------

/**
 * 计算单项得分（0-100）
 * @param {number} value - 实际值
 * @param {number} minValue - 最小值（得分0）
 * @param {number} maxValue - 最大值（得分100）
 * @returns {number} 得分（0-100）
 */
const calculateSingleScore = (value, minValue, maxValue) => {
  if (value === null || value === undefined || value === "") return 0;
  if (minValue === maxValue) return value >= minValue ? 100 : 0;
  const score = ((value - minValue) / (maxValue - minValue)) * 100;
  return Math.max(0, Math.min(100, score));
};

/**
 * D1 得分（35%权重）
 * D1 得分 = max(0, min(100, (D1−3%) ÷ (15%−3%) × 100))
 */
const calculateD1Score = (d1Rate) => {
  const d1 = parsePercentage(d1Rate);
  if (d1 === null) return 0;
  return calculateSingleScore(d1, 0.03, 0.15); // 3% -> 0分, 15% -> 100分
};

/**
 * D7 得分（25%权重）
 * D7 得分 = max(0, min(100, (D7−0.5%) ÷ (3%−0.5%) × 100))
 */
const calculateD7Score = (d7Rate) => {
  const d7 = parsePercentage(d7Rate);
  if (d7 === null) return 0;
  return calculateSingleScore(d7, 0.005, 0.03); // 0.5% -> 0分, 3% -> 100分
};

/**
 * 规模得分（20%权重）
 * 规模得分 = max(0, min(100, (占比−0.2%) ÷ (45%−0.2%) × 100))
 */
const calculateScaleScore = (ratio) => {
  const ratioValue = parsePercentage(ratio);
  if (ratioValue === null) return 0;
  return calculateSingleScore(ratioValue, 0.002, 0.45); // 0.2% -> 0分, 45% -> 100分
};

/**
 * 价值得分（15%权重）
 * 价值得分 = max(0, min(100, (人均GGR−0) ÷ (0.6−0) × 100))
 */
const calculateValueScore = (ggrPerUser) => {
  const ggr = tryParseNumber(ggrPerUser);
  if (ggr === null || ggr < 0) return 0;
  return calculateSingleScore(ggr, 0, 0.6); // 0 -> 0分, 0.6 -> 100分
};

/**
 * 风险得分（10%权重）
 * 风险得分 = max(0, min(100, (102%−派彩下注比) ÷ (102%−95%) × 100))
 */
const calculateRiskScore = (payoutRatio) => {
  const ratio = parsePercentage(payoutRatio);
  if (ratio === null) return 0;
  // 102% -> 0分, 95% -> 100分
  // score = (102% - ratio) / (102% - 95%) * 100
  // 如果 ratio > 102%, score = 0
  // 如果 ratio < 95%, score = 100
  if (ratio > 1.02) return 0;
  if (ratio < 0.95) return 100;
  return calculateSingleScore(1.02 - ratio, 0, 0.07); // 反向计算：102%-ratio, 0 -> 100分, 0.07 -> 0分
};

/**
 * 小样本惩罚
 * - 新用户数 <1000：总分 ×0.8
 * - 新用户数 <500：总分 ×0.5
 */
const applySmallSamplePenalty = (totalScore, newUserCount) => {
  if (!newUserCount || newUserCount < 500) {
    return totalScore * 0.5;
  }
  if (newUserCount < 1000) {
    return totalScore * 0.8;
  }
  return totalScore;
};

/**
 * 根据得分确定档位
 * - S：≥80
 * - A：65–79
 * - B：50–64
 * - C：<50
 */
const getTier = (score) => {
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  return "C";
};

// --- 数据兜底工具 --------------------------------------------------------------

const ensureSingleObject = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  if (typeof value === "object") return value;
  return null;
};

const safeNumber = (value) => {
  const num = tryParseNumber(value);
  return Number.isFinite(num) ? num : 0;
};

const aggregateRetentionTotals = (entries, targetCode) => {
  if (!entries) return null;
  const list = Array.isArray(entries) ? entries : [entries];
  const totals = { d0: 0, d1: 0, d7: 0 };
  let matched = false;
  list.forEach((item) => {
    if (!item) return;
    if (targetCode && item.game_code && item.game_code !== targetCode) return;
    const d0 = safeNumber(item.d0_users ?? item.d0);
    const d1 = safeNumber(item.d1_users ?? item.d1);
    const d7 = safeNumber(item.d7_users ?? item.d7);
    if (d0 || d1 || d7) {
      totals.d0 += d0;
      totals.d1 += d1;
      totals.d7 += d7;
      matched = true;
    }
  });
  if (!matched || totals.d0 <= 0) return null;
  return totals;
};

const buildGameLevelFromMetrics = (metricsData, targetCode) => {
  if (!metricsData || !metricsData.target) return null;
  const targetUsers = metricsData.target.users || [];
  const targetRevenue = metricsData.target.revenue || [];
  const targetRetentionNew = metricsData.target.retention_new || [];
  const targetRetentionActive = metricsData.target.retention_active || [];

  let uniqueUsers = 0;
  if (Array.isArray(targetUsers)) {
    targetUsers.forEach((user) => {
      if (targetCode && user.game_code && user.game_code !== targetCode) return;
      const value =
        safeNumber(user.unique_users) ||
        safeNumber(user.unique_users_total) ||
        safeNumber(user.daily_unique_users);
      uniqueUsers += value;
    });
  }

  let revenueTotal = 0;
  let payoutTotal = 0;
  if (Array.isArray(targetRevenue)) {
    targetRevenue.forEach((rev) => {
      if (targetCode && rev.game_code && rev.game_code !== targetCode) return;
      revenueTotal += safeNumber(
        rev.total_amount_usdt ?? rev.total_amount ?? rev.revenue_usdt
      );
      payoutTotal += safeNumber(
        rev.total_pay_out_usdt ?? rev.total_pay_out ?? rev.payout_usdt
      );
    });
  }

  const retentionTotalsNew = aggregateRetentionTotals(targetRetentionNew, targetCode);
  const retentionTotalsActive = aggregateRetentionTotals(targetRetentionActive, targetCode);
  let retentionTotals = retentionTotalsNew || retentionTotalsActive;

  if (!retentionTotals && metricsData.global) {
    retentionTotals =
      aggregateRetentionTotals(metricsData.global.retention_new, null) ||
      aggregateRetentionTotals(metricsData.global.retention_active, null);
  }

  const net = revenueTotal - payoutTotal;
  const arpu = uniqueUsers > 0 ? net / uniqueUsers : 0;
  const d1Retention =
    retentionTotals && retentionTotals.d0 > 0
      ? retentionTotals.d1 / retentionTotals.d0
      : null;
  const d7Retention =
    retentionTotals && retentionTotals.d0 > 0
      ? retentionTotals.d7 / retentionTotals.d0
      : null;

  return {
    game_code: targetCode,
    game_name: targetCode,
    unique_users: uniqueUsers,
    revenue_total_usdt: Number(revenueTotal.toFixed?.(2) ?? revenueTotal),
    payout_total_usdt: Number(payoutTotal.toFixed?.(2) ?? payoutTotal),
    net_usdt: Number(net.toFixed?.(2) ?? net),
    arpu_usdt: Number(arpu.toFixed?.(4) ?? arpu),
    d1_retention: d1Retention,
    d7_retention: d7Retention,
  };
};

const buildPlatformGameLevelFromMetrics = (metricsData) => {
  if (!metricsData || !metricsData.global) return null;
  const globalUsers = metricsData.global.users;
  const globalRevenue = metricsData.global.revenue || {};
  const globalRetentionNew = metricsData.global.retention_new;
  const globalRetentionActive = metricsData.global.retention_active;

  let uniqueUsers = 0;
  if (Array.isArray(globalUsers)) {
    globalUsers.forEach((item) => {
      uniqueUsers += safeNumber(
        item.unique_users_total ?? item.unique_users ?? item.count
      );
    });
  } else if (globalUsers && typeof globalUsers === "object") {
    uniqueUsers =
      safeNumber(globalUsers.unique_users_total) ||
      safeNumber(globalUsers.unique_users_by_game) ||
      0;
  }

  const revenueTotal =
    safeNumber(globalRevenue.total_amount_usdt) ||
    safeNumber(globalRevenue.total_amount) ||
    safeNumber(globalRevenue.revenue_usdt);
  const payoutTotal =
    safeNumber(globalRevenue.total_pay_out_usdt) ||
    safeNumber(globalRevenue.total_pay_out) ||
    safeNumber(globalRevenue.payout_usdt);
  const net = revenueTotal - payoutTotal;
  const arpu = uniqueUsers > 0 ? net / uniqueUsers : 0;

  const retentionTotals =
    aggregateRetentionTotals(globalRetentionNew, null) ||
    aggregateRetentionTotals(globalRetentionActive, null);
  const d1Retention =
    retentionTotals && retentionTotals.d0 > 0
      ? retentionTotals.d1 / retentionTotals.d0
      : null;
  const d7Retention =
    retentionTotals && retentionTotals.d0 > 0
      ? retentionTotals.d7 / retentionTotals.d0
      : null;

  return {
    game_code: "ALL_GAMES",
    game_name: "全平台所有游戏",
    unique_users: uniqueUsers,
    revenue_total_usdt: Number(revenueTotal.toFixed?.(2) ?? revenueTotal),
    payout_total_usdt: Number(payoutTotal.toFixed?.(2) ?? payoutTotal),
    net_usdt: Number(net.toFixed?.(2) ?? net),
    arpu_usdt: Number(arpu.toFixed?.(4) ?? arpu),
    d1_retention: d1Retention,
    d7_retention: d7Retention,
  };
};

// --- 解析 Lark 表格数据（如果存在）-------------------------------------------

let parsedLarkGameLevel = null;
let parsedLarkPlatformGameLevel = null;
let parsedLarkRatio = null;

if (larkTableValues) {
  console.log("📊 检测到 Lark 表格数据，开始解析...");
  parsedLarkGameLevel = parseGameLevelTableFromLark(larkTableValues);
  parsedLarkPlatformGameLevel = parsePlatformGameLevelTableFromLark(larkTableValues);
  parsedLarkRatio = parseRatioTableFromLark(larkTableValues);
  
  if (parsedLarkGameLevel) {
    console.log("✅ 从 Lark 表格解析到游戏级数据:", parsedLarkGameLevel.game_code, parsedLarkGameLevel.game_name);
  }
  if (parsedLarkPlatformGameLevel) {
    console.log("✅ 从 Lark 表格解析到全平台游戏级数据");
  }
  if (parsedLarkRatio) {
    console.log("✅ 从 Lark 表格解析到游戏占平台比值数据");
    // 补充游戏级数据的缺失信息
    if (parsedLarkGameLevel && parsedLarkRatio.game) {
      if (parsedLarkRatio.game.unique_users) {
        parsedLarkGameLevel.unique_users = parsedLarkRatio.game.unique_users;
      }
      if (parsedLarkRatio.game.d1_retention !== null && parsedLarkRatio.game.d1_retention !== undefined) {
        parsedLarkGameLevel.d1_retention = parsedLarkRatio.game.d1_retention;
      }
      if (parsedLarkRatio.game.d7_retention !== null && parsedLarkRatio.game.d7_retention !== undefined) {
        parsedLarkGameLevel.d7_retention = parsedLarkRatio.game.d7_retention;
      }
      if (parsedLarkRatio.game.net_usdt) {
        parsedLarkGameLevel.net_usdt = parsedLarkRatio.game.net_usdt;
      }
      if (parsedLarkRatio.game.arpu_usdt) {
        parsedLarkGameLevel.arpu_usdt = parsedLarkRatio.game.arpu_usdt;
      }
    }
    // 补充全平台游戏级数据的缺失信息
    if (parsedLarkPlatformGameLevel && parsedLarkRatio.platform) {
      if (parsedLarkRatio.platform.unique_users) {
        parsedLarkPlatformGameLevel.unique_users = parsedLarkRatio.platform.unique_users;
      }
      if (parsedLarkRatio.platform.d1_retention !== null && parsedLarkRatio.platform.d1_retention !== undefined) {
        parsedLarkPlatformGameLevel.d1_retention = parsedLarkRatio.platform.d1_retention;
      }
      if (parsedLarkRatio.platform.d7_retention !== null && parsedLarkRatio.platform.d7_retention !== undefined) {
        parsedLarkPlatformGameLevel.d7_retention = parsedLarkRatio.platform.d7_retention;
      }
      if (parsedLarkRatio.platform.net_usdt) {
        parsedLarkPlatformGameLevel.net_usdt = parsedLarkRatio.platform.net_usdt;
      }
      if (parsedLarkRatio.platform.arpu_usdt) {
        parsedLarkPlatformGameLevel.arpu_usdt = parsedLarkRatio.platform.arpu_usdt;
      }
    }
  }
}

// --- 提取游戏全局数据 --------------------------------------------------------

let gameLevelTableResolved = ensureSingleObject(game_level_table);
if (!gameLevelTableResolved) {
  // 优先使用从 Lark 表格解析的数据
  if (parsedLarkGameLevel) {
    gameLevelTableResolved = parsedLarkGameLevel;
  } else {
    gameLevelTableResolved = buildGameLevelFromMetrics(metrics, gameCode);
  }
}

let platformGameLevelTableResolved = ensureSingleObject(platform_game_level_table);
if (!platformGameLevelTableResolved) {
  // 优先使用从 Lark 表格解析的数据
  if (parsedLarkPlatformGameLevel) {
    platformGameLevelTableResolved = parsedLarkPlatformGameLevel;
  } else {
    platformGameLevelTableResolved = buildPlatformGameLevelFromMetrics(metrics);
  }
}

if (!gameLevelTableResolved) {
  throw new Error("❌ 未找到游戏级评分表数据");
}

if (!platformGameLevelTableResolved) {
  throw new Error("❌ 未找到全平台游戏级评分表数据");
}

// 游戏全局指标
// 确保留存率是百分比形式（0-100）
// 问题：需要区分以下情况：
// 1. 如果输入是字符串且包含 %（如 "0.43%"），parsePercentage 应该已经转换为小数（0.0043）
// 2. 如果输入是数值且 <= 1，可能是小数形式（0-1之间），需要乘以 100
//    但要注意：0.43 可能表示 0.43%（应该是 0.0043），也可能表示 43%（应该是 0.43）
// 3. 如果输入是数值且 > 1，应该是百分比形式，直接返回
// 
// 为了解决这个问题，我们假设：
// - 如果数值 <= 0.1（即 <= 10%），可能是小数形式，乘以 100 转换为百分比
// - 如果数值 > 0.1 且 <= 1，可能是百分比形式（如 0.43 表示 0.43%），不需要再乘以 100
// - 如果数值 > 1，肯定是百分比形式，直接返回
// 
// 但实际上，根据游戏留存率的特点，0.43 更可能表示 0.43%（小数形式），而不是 43%
// 所以我们采用保守策略：如果数值 <= 1，乘以 100
const normalizeRetentionToPercentage = (retentionValue) => {
  if (retentionValue === null || retentionValue === undefined) return null;
  const num = tryParseNumber(retentionValue);
  if (num === null) return null;
  // 如果数值 <= 1，认为是小数形式，乘以 100 转换为百分比
  // 例如：0.0043 -> 0.43%, 0.43 -> 43%
  // 如果数值 > 1，认为是百分比形式，直接返回
  // 例如：43 -> 43%
  if (num <= 1) {
    return num * 100;
  }
  return num;
};

// 调试：输出原始留存率数据
console.log(`📊 游戏级留存率原始数据:`);
console.log(`   - d1_retention 原始值: ${gameLevelTableResolved.d1_retention} (类型: ${typeof gameLevelTableResolved.d1_retention})`);
console.log(`   - d7_retention 原始值: ${gameLevelTableResolved.d7_retention} (类型: ${typeof gameLevelTableResolved.d7_retention})`);

const gameD1Retention = normalizeRetentionToPercentage(gameLevelTableResolved.d1_retention);
const gameD7Retention = normalizeRetentionToPercentage(gameLevelTableResolved.d7_retention);

// 调试：输出标准化后的留存率数据
console.log(`📊 游戏级留存率标准化后:`);
console.log(`   - d1_retention 百分比: ${gameD1Retention !== null ? gameD1Retention.toFixed(2) + '%' : 'null'}`);
console.log(`   - d7_retention 百分比: ${gameD7Retention !== null ? gameD7Retention.toFixed(2) + '%' : 'null'}`);

// 新用户数（从游戏级数据中获取，如果没有则从平台级数据汇总）
let gameNewUserCount = gameLevelTableResolved.unique_users || 0;

// 平台全局数据（用于计算占比）
const platformTotalNewUsers = platformGameLevelTableResolved.unique_users || 0;

// 新用户下注人数占比 = 游戏新用户下注人数 ÷ 平台新用户总数
const newUserBetRatio = platformTotalNewUsers > 0 
  ? (gameNewUserCount / platformTotalNewUsers) * 100 
  : 0;

// 派彩下注比 = 累计派彩 ÷ 累计下注
const payoutBetRatio = gameLevelTableResolved.revenue_total_usdt > 0
  ? (gameLevelTableResolved.payout_total_usdt / gameLevelTableResolved.revenue_total_usdt) * 100
  : null;

// 人均 GGR（USDT）= 累计 GGR ÷ 新用户数
const ggrPerUser = gameNewUserCount > 0
  ? gameLevelTableResolved.net_usdt / gameNewUserCount
  : 0;

// 计算游戏全局得分
const gameD1Score = calculateD1Score(gameD1Retention);
const gameD7Score = calculateD7Score(gameD7Retention);
const gameScaleScore = calculateScaleScore(newUserBetRatio);
const gameValueScore = calculateValueScore(ggrPerUser);
const gameRiskScore = calculateRiskScore(payoutBetRatio);

// 加权总分
let gameTotalScore = 
  gameD1Score * 0.35 +
  gameD7Score * 0.25 +
  gameScaleScore * 0.20 +
  gameValueScore * 0.15 +
  gameRiskScore * 0.10;

// 应用小样本惩罚
gameTotalScore = applySmallSamplePenalty(gameTotalScore, gameNewUserCount);

// 确定档位
const gameTier = getTier(gameTotalScore);

console.log("📊 游戏全局指标:");
console.log({
  d1_retention: gameD1Retention !== null ? gameD1Retention.toFixed(2) + "%" : "null",
  d7_retention: gameD7Retention !== null ? gameD7Retention.toFixed(2) + "%" : "null",
  new_user_bet_ratio: newUserBetRatio.toFixed(2) + "%",
  payout_bet_ratio: payoutBetRatio !== null ? payoutBetRatio.toFixed(2) + "%" : "null",
  new_user_count: gameNewUserCount,
  ggr_per_user: ggrPerUser.toFixed(4),
});

console.log("📊 游戏全局得分:");
console.log({
  d1_score: gameD1Score.toFixed(2),
  d7_score: gameD7Score.toFixed(2),
  scale_score: gameScaleScore.toFixed(2),
  value_score: gameValueScore.toFixed(2),
  risk_score: gameRiskScore.toFixed(2),
  total_score: gameTotalScore.toFixed(2),
  tier: gameTier,
});

// --- 处理平台级数据 -----------------------------------------------------------

const platformRatings = [];

// 准备平台级数据源：优先使用 platform_level_table，其次从 Lark 表格解析，最后从 metrics 构建
console.log(`📊 开始处理平台级数据...`);
console.log(`   - platform_level_table 是否存在: ${!!platform_level_table}`);
console.log(`   - platform_level_table 是否为数组: ${Array.isArray(platform_level_table)}`);
console.log(`   - platform_level_table 长度: ${Array.isArray(platform_level_table) ? platform_level_table.length : 'N/A'}`);
console.log(`   - larkTableValues 是否存在: ${!!larkTableValues}`);
console.log(`   - gameCode: ${gameCode}`);
console.log(`   - metrics 是否存在: ${!!metrics}`);

let platformLevelTableResolved = platform_level_table;
if (!platformLevelTableResolved || !Array.isArray(platformLevelTableResolved) || platformLevelTableResolved.length === 0) {
  console.log("⚠️ platform_level_table 不存在或为空，尝试从 Lark 表格解析...");
  // 尝试从 Lark 表格解析
  if (larkTableValues && gameCode) {
    console.log(`   尝试从 Lark 表格解析平台级数据，gameCode: ${gameCode}`);
    const parsedLarkPlatformLevel = parsePlatformLevelTableFromLarkValues(larkTableValues, gameCode);
    console.log(`   解析结果: ${parsedLarkPlatformLevel ? parsedLarkPlatformLevel.length : 0} 个平台`);
    if (parsedLarkPlatformLevel && parsedLarkPlatformLevel.length > 0) {
      console.log(`✅ 从 Lark 表格解析到平台级数据: ${parsedLarkPlatformLevel.length} 个平台`);
      parsedLarkPlatformLevel.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.platform_id} (${p.platform_name}) - ${p.currency}`);
      });
      platformLevelTableResolved = parsedLarkPlatformLevel;
      // Lark 表格已经包含完整数据（收入、用户、留存等），无需从 metrics 补充
    } else {
      console.log("⚠️ 从 Lark 表格未解析到平台级数据");
    }
  } else {
    console.log("⚠️ 无法从 Lark 表格解析：缺少 larkTableValues 或 gameCode");
  }
  
  // 如果还是没有，尝试从 metrics 构建
  if ((!platformLevelTableResolved || !Array.isArray(platformLevelTableResolved) || platformLevelTableResolved.length === 0) && metrics) {
    console.log("⚠️ 尝试从 metrics 构建平台级数据...");
    // 从 metrics 中提取平台级数据
    const platformDataFromMetrics = [];
    
    // 从 revenue breakdown 中提取（按平台ID和币种分组）
    const revenuePlatformMap = new Map(); // key: "platformId_currency"
    
    if (metrics.target && metrics.target.revenue) {
      metrics.target.revenue.forEach((revenue) => {
        if (revenue.game_code === gameCode && revenue.breakdown) {
          revenue.breakdown.forEach((item) => {
            const platformId = String(item.merchant_id || item.platform || "");
            const currency = item.currency || "USDT";
            const platformName = item.platform || item.main_merchant_name || String(platformId);
            const key = `${platformId}_${currency}`;
            
            if (!revenuePlatformMap.has(key)) {
              revenuePlatformMap.set(key, {
                game_code: gameCode,
                platform_id: platformId,
                platform_name: platformName,
                currency: currency,
                revenue_usdt: 0,
                payout_usdt: 0,
                net_usdt: 0,
                unique_users: 0,
                d1_retention: null,
                d7_retention: null,
              });
            }
            
            const platformData = revenuePlatformMap.get(key);
            platformData.revenue_usdt += tryParseNumber(item.total_amount_usdt) || 0;
            platformData.payout_usdt += tryParseNumber(item.total_pay_out_usdt) || 0;
            platformData.net_usdt = platformData.revenue_usdt - platformData.payout_usdt;
          });
        }
      });
    }
    
    // 将 revenue 数据添加到 platformDataFromMetrics
    revenuePlatformMap.forEach((platformData) => {
      platformDataFromMetrics.push(platformData);
    });
    
    // 从用户数据中汇总用户数（按 (平台ID, 币种) 匹配，如果没有币种则匹配第一个相同平台ID的记录）
    if (metrics.target && metrics.target.users) {
      metrics.target.users.forEach((user) => {
        if (user.game_code === gameCode) {
          const platformId = String(user.merchant_id || user.platform || "");
          const platformName = user.platform_name || user.main_merchant_name || String(platformId);
          const currency = user.currency || null; // 用户数据可能没有币种
          const userCount = tryParseNumber(user.unique_users) || 0;
          
          if (!platformId || userCount === 0) return;
          
          // 如果有币种，优先匹配相同平台ID和币种的记录
          let platformData = null;
          if (currency) {
            platformData = platformDataFromMetrics.find(
              (p) => p.platform_id === platformId && p.currency === currency
            );
          }
          
          // 如果没找到或没有币种，查找第一个匹配平台ID的记录（按币种优先级：优先匹配有收入的币种）
          if (!platformData) {
            // 先查找有收入的记录
            platformData = platformDataFromMetrics.find(
              (p) => p.platform_id === platformId && p.revenue_usdt > 0
            );
          }
          
          // 如果还是没找到，查找任意匹配平台ID的记录
          if (!platformData) {
            platformData = platformDataFromMetrics.find(
              (p) => p.platform_id === platformId
            );
          }
          
          if (platformData) {
            platformData.unique_users += userCount;
          } else {
            // 如果不存在，创建新记录
            platformDataFromMetrics.push({
              game_code: gameCode,
              platform_id: platformId,
              platform_name: platformName,
              currency: currency || "USDT",
              revenue_usdt: 0,
              payout_usdt: 0,
              net_usdt: 0,
              unique_users: userCount,
              d1_retention: null,
              d7_retention: null,
            });
          }
        }
      });
    }
    
    // 从留存数据中获取留存率（按 (平台ID, 币种) 匹配，如果没有币种则匹配第一个相同平台ID的记录）
    const targetRetentionNew = metrics.target?.retention_new || [];
    const targetRetentionActive = metrics.target?.retention_active || [];
    
    [...targetRetentionNew, ...targetRetentionActive].forEach((retention) => {
      if (retention.game_code === gameCode) {
        const platformId = String(retention.merchant_id || retention.platform || "");
        const platformName = retention.platform_name || retention.main_merchant_name || String(platformId);
        const currency = retention.currency || null; // 留存数据可能没有币种
        
        if (!platformId) return;
        
        // 如果有币种，优先匹配相同平台ID和币种的记录
        let platformData = null;
        if (currency) {
          platformData = platformDataFromMetrics.find(
            (p) => p.platform_id === platformId && p.currency === currency
          );
        }
        
        // 如果没找到或没有币种，查找第一个匹配平台ID的记录（优先使用新用户留存）
        if (!platformData) {
          // 先查找有留存数据的记录（但还没有d1_retention）
          platformData = platformDataFromMetrics.find(
            (p) => p.platform_id === platformId && p.d1_retention === null
          );
        }
        
        // 如果还是没找到，查找任意匹配平台ID的记录
        if (!platformData) {
          platformData = platformDataFromMetrics.find(
            (p) => p.platform_id === platformId
          );
        }
        
        if (platformData) {
          // 优先使用新用户留存
          if (retention.metric_type === "new" || !platformData.d1_retention) {
            platformData.d1_retention = parsePercentage(retention.d1_retention_rate);
            platformData.d7_retention = parsePercentage(retention.d7_retention_rate);
          }
        } else {
          // 如果不存在，创建新记录
          platformDataFromMetrics.push({
            game_code: gameCode,
            platform_id: platformId,
            platform_name: platformName,
            currency: currency || "USDT",
            revenue_usdt: 0,
            payout_usdt: 0,
            net_usdt: 0,
            unique_users: 0,
            d1_retention: parsePercentage(retention.d1_retention_rate),
            d7_retention: parsePercentage(retention.d7_retention_rate),
          });
        }
      }
    });
    
    if (platformDataFromMetrics.length > 0) {
      console.log(`✅ 从 metrics 构建到平台级数据: ${platformDataFromMetrics.length} 个平台`);
      platformLevelTableResolved = platformDataFromMetrics;
    }
  }
}

if (platformLevelTableResolved && Array.isArray(platformLevelTableResolved) && platformLevelTableResolved.length > 0) {
  // 按 (平台ID, 币种) 分组
  const platformMap = new Map();
  
  platformLevelTableResolved.forEach((platform) => {
    const platformId = platform.platform_id || platform.platformId || "";
    const currency = platform.currency || "USDT";
    const key = `${platformId}_${currency}`;
    
    if (!platformMap.has(key)) {
      platformMap.set(key, {
        platform_id: platformId,
        platform_name: platform.platform_name || platform.platformName || "",
        currency: currency,
        revenue_usdt: 0,
        payout_usdt: 0,
        net_usdt: 0,
        unique_users: 0,
        d1_retention: null,
        d7_retention: null,
      });
    }
    
    const data = platformMap.get(key);
    data.revenue_usdt += tryParseNumber(platform.revenue_usdt) || 0;
    data.payout_usdt += tryParseNumber(platform.payout_usdt) || 0;
    data.net_usdt += tryParseNumber(platform.net_usdt) || 0;
    data.unique_users += tryParseNumber(platform.unique_users) || 0;
    
    // 留存率（优先使用已有的，如果有多个则取平均值）
    // 如果 platform.d1_retention 是字符串（如 "0.43%" 或 "43%"），使用 parsePercentage 解析
    // 如果已经是数值，直接使用（假设已经是小数形式，0-1之间）
    if (platform.d1_retention !== null && platform.d1_retention !== undefined) {
      let d1 = null;
      if (typeof platform.d1_retention === 'string') {
        // 如果是字符串，使用 parsePercentage 解析
        d1 = parsePercentage(platform.d1_retention);
      } else {
        // 如果已经是数值，直接使用（假设已经是小数形式）
        d1 = tryParseNumber(platform.d1_retention);
        // 如果数值 > 1，可能是百分比形式，需要除以 100 转换为小数
        if (d1 !== null && d1 > 1) {
          d1 = d1 / 100;
        }
      }
      if (d1 !== null) {
        if (data.d1_retention === null) {
          data.d1_retention = d1;
        } else {
          // 如果有多个，取平均值
          data.d1_retention = (data.d1_retention + d1) / 2;
        }
      }
    }
    
    if (platform.d7_retention !== null && platform.d7_retention !== undefined) {
      let d7 = null;
      if (typeof platform.d7_retention === 'string') {
        // 如果是字符串，使用 parsePercentage 解析
        d7 = parsePercentage(platform.d7_retention);
      } else {
        // 如果已经是数值，直接使用（假设已经是小数形式）
        d7 = tryParseNumber(platform.d7_retention);
        // 如果数值 > 1，可能是百分比形式，需要除以 100 转换为小数
        if (d7 !== null && d7 > 1) {
          d7 = d7 / 100;
        }
      }
      if (d7 !== null) {
        if (data.d7_retention === null) {
          data.d7_retention = d7;
        } else {
          // 如果有多个，取平均值
          data.d7_retention = (data.d7_retention + d7) / 2;
        }
      }
    }
  });
  
  // 为每个 (平台, 币种) 组合计算评级
  platformMap.forEach((platformData) => {
    // 计算指标
    // 确保留存率是百分比形式（0-100）
    // 使用与全局评级相同的标准化函数
    const platformD1Retention = normalizeRetentionToPercentage(platformData.d1_retention);
    const platformD7Retention = normalizeRetentionToPercentage(platformData.d7_retention);
    
    // 新用户下注人数占比 = 平台新用户下注人数 ÷ 平台新用户总数
    const platformNewUserBetRatio = platformTotalNewUsers > 0
      ? (platformData.unique_users / platformTotalNewUsers) * 100
      : 0;
    
    // 派彩下注比 = 累计派彩 ÷ 累计下注
    const platformPayoutBetRatio = platformData.revenue_usdt > 0
      ? (platformData.payout_usdt / platformData.revenue_usdt) * 100
      : null;
    
    // 人均 GGR（USDT）= 累计 GGR ÷ 新用户数
    const platformGgrPerUser = platformData.unique_users > 0
      ? platformData.net_usdt / platformData.unique_users
      : 0;
    
    // 计算得分
    const platformD1Score = calculateD1Score(platformD1Retention);
    const platformD7Score = calculateD7Score(platformD7Retention);
    const platformScaleScore = calculateScaleScore(platformNewUserBetRatio);
    const platformValueScore = calculateValueScore(platformGgrPerUser);
    const platformRiskScore = calculateRiskScore(platformPayoutBetRatio);
    
    // 加权总分
    let platformTotalScore =
      platformD1Score * 0.35 +
      platformD7Score * 0.25 +
      platformScaleScore * 0.20 +
      platformValueScore * 0.15 +
      platformRiskScore * 0.10;
    
    // 应用小样本惩罚
    platformTotalScore = applySmallSamplePenalty(platformTotalScore, platformData.unique_users);
    
    // 确定档位
    const platformTier = getTier(platformTotalScore);
    
    // 判断是否为红色渠道（档位为 C）
    const isRedChannel = platformTier === "C";
    
    platformRatings.push({
      platform_id: platformData.platform_id,
      platform_name: platformData.platform_name,
      currency: platformData.currency,
      metrics: {
        d1_retention: platformD1Retention !== null ? Number(platformD1Retention.toFixed(2)) : null,
        d7_retention: platformD7Retention !== null ? Number(platformD7Retention.toFixed(2)) : null,
        new_user_bet_ratio: Number(platformNewUserBetRatio.toFixed(2)),
        payout_bet_ratio: platformPayoutBetRatio !== null ? Number(platformPayoutBetRatio.toFixed(2)) : null,
        new_user_count: platformData.unique_users,
        ggr_per_user: Number(platformGgrPerUser.toFixed(4)),
      },
      scores: {
        d1_score: Number(platformD1Score.toFixed(2)),
        d7_score: Number(platformD7Score.toFixed(2)),
        scale_score: Number(platformScaleScore.toFixed(2)),
        value_score: Number(platformValueScore.toFixed(2)),
        risk_score: Number(platformRiskScore.toFixed(2)),
        total_score: Number(platformTotalScore.toFixed(2)),
      },
      tier: platformTier,
      is_red_channel: isRedChannel,
    });
  });
  
  // 按总分降序排序
  platformRatings.sort((a, b) => b.scores.total_score - a.scores.total_score);
}

console.log(`📊 平台级评级: 共 ${platformRatings.length} 个平台`);
const redChannels = platformRatings.filter(p => p.is_red_channel);
console.log(`   - 红色渠道数量: ${redChannels.length}`);
if (redChannels.length > 0) {
  console.log(`   - 红色渠道列表:`);
  redChannels.forEach((channel, index) => {
    console.log(`     ${index + 1}. ${channel.platform_name} (${channel.currency}) - 得分: ${channel.scores.total_score.toFixed(2)}, 档位: ${channel.tier}`);
  });
}

// --- 输出结果 ----------------------------------------------------------------

const output = {
  game: {
    code: gameCode,
    name: gameName,
  },
  period: {
    start: resolvedWeekStart || meta?.week_start || meta?.WeekStart || null,
    end: resolvedWeekEnd || meta?.week_end || meta?.WeekEnd || null,
    days_range: "游戏上线后第1-14日（包括当日）",
  },
  global_rating: {
    metrics: {
      d1_retention: gameD1Retention !== null ? Number(gameD1Retention.toFixed(2)) : null,
      d7_retention: gameD7Retention !== null ? Number(gameD7Retention.toFixed(2)) : null,
      new_user_bet_ratio: Number(newUserBetRatio.toFixed(2)),
      payout_bet_ratio: payoutBetRatio !== null ? Number(payoutBetRatio.toFixed(2)) : null,
      new_user_count: gameNewUserCount,
      ggr_per_user: Number(ggrPerUser.toFixed(4)),
    },
    scores: {
      d1_score: Number(gameD1Score.toFixed(2)),
      d7_score: Number(gameD7Score.toFixed(2)),
      scale_score: Number(gameScaleScore.toFixed(2)),
      value_score: Number(gameValueScore.toFixed(2)),
      risk_score: Number(gameRiskScore.toFixed(2)),
      total_score: Number(gameTotalScore.toFixed(2)),
    },
    tier: gameTier,
    weights: {
      d1: 0.35,
      d7: 0.25,
      scale: 0.20,
      value: 0.15,
      risk: 0.10,
    },
  },
  platform_ratings: platformRatings,
  summary: {
    global_tier: gameTier,
    global_score: Number(gameTotalScore.toFixed(2)),
    platform_count: platformRatings.length,
    red_channel_count: redChannels.length,
    can_increase_budget: gameTier >= "B" && redChannels.length === 0,
  },
  meta: {
    generated_at: new Date().toISOString(),
    data_source: table_name || "unknown",
  },
};

console.log("=== 游戏评级分析完成 ===");
console.log("全局等级:", gameTier, "(" + gameTotalScore.toFixed(2) + "分)");
console.log("是否可以加预算放量:", output.summary.can_increase_budget ? "是" : "否");
console.log("红色渠道数量:", redChannels.length);

return [
  {
    json: output,
  },
];

