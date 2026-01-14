// n8n Code节点：游戏评级分析器（支持多游戏处理）
// 功能：
// 1. 读取上游游戏数据（来自 game-rating-fact-table-generator.js 或 Lark 表格）
// 2. 识别输入中的所有游戏
// 3. 为每个游戏分别计算评级
// 4. 输出每个游戏的 JSON 数据以便后续 AI 分析

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
  
  const originalStr = String(value).trim();
  const hasPercentSign = originalStr.includes('%');
  const str = originalStr.replace(/%/g, "").trim();
  const num = tryParseNumber(str);
  if (num === null) return null;
  
  if (hasPercentSign) {
    return num / 100;
  }
  
  if (num > 1) {
    return num / 100;
  }
  
  return num;
};

// --- 解析 Lark 表格数据 --------------------------------------------------------

/**
 * 从 Lark 表格的 valueRange.values 中解析所有游戏的数据
 * 返回一个数组，每个元素是一个游戏的数据
 */
const parseAllGamesFromLark = (values) => {
  if (!values || !Array.isArray(values)) return [];
  
  const games = [];
  let foundTable = false;
  let headerRowIndex = -1;
  
  // 查找游戏级评分表表头
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const header = String(row[0] || "").trim();
    if (header === "游戏代码" || header === "游戏名称") {
      foundTable = true;
      headerRowIndex = i;
      break;
    }
  }
  
  if (!foundTable || headerRowIndex < 0) {
    return [];
  }
  
  // 从表头下一行开始解析游戏数据
  for (let i = headerRowIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const gameCode = String(row[0] || "").trim();
    const gameName = String(row[1] || "").trim();
    
    // 跳过空行、表头行和 "ALL_GAMES" 行
    if (!gameCode || gameCode === "游戏代码" || gameCode === "ALL_GAMES" || gameCode === "指标") {
      // 如果遇到空行且已经解析到游戏数据，可能表示表格结束
      if (games.length > 0 && (!gameCode || gameCode === "")) {
        break;
      }
      continue;
    }
    
    const revenue = tryParseNumber(row[2]);
    const payout = tryParseNumber(row[3]);
    const netUsdt = tryParseNumber(row[4]) || (revenue !== null && payout !== null ? revenue - payout : null);
    const uniqueUsers = tryParseNumber(row[5]) || 0;
    const arpuUsdt = tryParseNumber(row[6]) || 0;
    const d1Retention = parsePercentage(row[7]);
    const d7Retention = parsePercentage(row[8]);
    
    if (gameCode && gameName && revenue !== null && payout !== null) {
      games.push({
        game_code: gameCode,
        game_name: gameName,
        revenue_total_usdt: revenue,
        payout_total_usdt: payout,
        net_usdt: netUsdt,
        unique_users: uniqueUsers,
        arpu_usdt: arpuUsdt,
        d1_retention: d1Retention,
        d7_retention: d7Retention,
        row_index: i, // 保存行索引，用于后续解析平台级数据
      });
    }
  }
  
  return games;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析全平台游戏级评分表
 */
const parsePlatformGameLevelTableFromLark = (values) => {
  if (!values || !Array.isArray(values)) return null;
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const gameCode = String(row[0] || "").trim();
    if (gameCode === "ALL_GAMES") {
      const gameName = String(row[1] || "").trim();
      const revenue = tryParseNumber(row[2]);
      const payout = tryParseNumber(row[3]);
      const netUsdt = tryParseNumber(row[4]) || (revenue !== null && payout !== null ? revenue - payout : null);
      const uniqueUsers = tryParseNumber(row[5]) || 0;
      const arpuUsdt = tryParseNumber(row[6]) || 0;
      const d1Retention = parsePercentage(row[7]);
      const d7Retention = parsePercentage(row[8]);
      
      if (revenue !== null && payout !== null) {
        return {
          game_code: "ALL_GAMES",
          game_name: gameName || "全平台所有游戏",
          revenue_total_usdt: revenue,
          payout_total_usdt: payout,
          net_usdt: netUsdt,
          unique_users: uniqueUsers,
          arpu_usdt: arpuUsdt,
          d1_retention: d1Retention,
          d7_retention: d7Retention,
        };
      }
    }
  }
  return null;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析指定游戏的平台级切片表
 */
const parsePlatformLevelTableFromLarkValues = (values, gameCode) => {
  if (!values || !Array.isArray(values)) return [];
  
  const platformTable = [];
  let foundTable = false;
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row || !Array.isArray(row)) continue;
    
    const header = String(row[0] || "").trim();
    if (header === "游戏代码" || header === "平台ID") {
      foundTable = true;
      continue;
    }
    
    if (foundTable && row[0] && row[1] && row[2]) {
      const rowGameCode = String(row[0] || "").trim();
      
      if (rowGameCode === gameCode) {
        const platformId = String(row[1] || "").trim();
        const platformName = String(row[2] || "").trim();
        const currency = String(row[3] || "USDT").trim();
        
        if (platformId && platformName && platformId !== "平台ID" && platformId !== "null") {
          const revenueUsdt = tryParseNumber(row[5]) || 0;
          const payoutUsdt = tryParseNumber(row[6]) || 0;
          const netUsdt = tryParseNumber(row[7]) || 0;
          const uniqueUsers = tryParseNumber(row[8]) || 0;
          const arpuUsdt = tryParseNumber(row[9]) || 0;
          const d1RetentionStr = String(row[10] || "").trim();
          const d7RetentionStr = String(row[11] || "").trim();
          
          const d1Retention = parsePercentage(d1RetentionStr);
          const d7Retention = parsePercentage(d7RetentionStr);
          
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
        if (platformTable.length > 0) {
          break;
        }
      } else if (!rowGameCode || rowGameCode === "" || rowGameCode === "null") {
        // 空行，可能表示表格结束
        if (platformTable.length > 0) {
          break;
        }
      }
    }
  }
  
  return platformTable;
};

/**
 * 从 Lark 表格的 valueRange.values 中解析游戏占平台比值表
 */
const parseRatioTableFromLark = (values) => {
  if (!values || !Array.isArray(values)) return null;
  
  const result = {
    game: {},
    platform: {},
  };
  
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

// --- 游戏评级规则计算函数 -----------------------------------------------------

const calculateSingleScore = (value, minValue, maxValue) => {
  if (value === null || value === undefined || value === "") return 0;
  if (minValue === maxValue) return value >= minValue ? 100 : 0;
  const score = ((value - minValue) / (maxValue - minValue)) * 100;
  return Math.max(0, Math.min(100, score));
};

const calculateD1Score = (d1Rate) => {
  const d1 = parsePercentage(d1Rate);
  if (d1 === null) return 0;
  return calculateSingleScore(d1, 0.03, 0.15);
};

const calculateD7Score = (d7Rate) => {
  const d7 = parsePercentage(d7Rate);
  if (d7 === null) return 0;
  return calculateSingleScore(d7, 0.005, 0.03);
};

const calculateScaleScore = (ratio) => {
  const ratioValue = parsePercentage(ratio);
  if (ratioValue === null) return 0;
  return calculateSingleScore(ratioValue, 0.002, 0.45);
};

const calculateValueScore = (ggrPerUser) => {
  const ggr = tryParseNumber(ggrPerUser);
  if (ggr === null || ggr < 0) return 0;
  return calculateSingleScore(ggr, 0, 0.6);
};

const calculateRiskScore = (payoutRatio) => {
  const ratio = parsePercentage(payoutRatio);
  if (ratio === null) return 0;
  if (ratio > 1.02) return 0;
  if (ratio < 0.95) return 100;
  return calculateSingleScore(1.02 - ratio, 0, 0.07);
};

const applySmallSamplePenalty = (totalScore, newUserCount) => {
  if (!newUserCount || newUserCount < 500) {
    return totalScore * 0.5;
  }
  if (newUserCount < 1000) {
    return totalScore * 0.8;
  }
  return totalScore;
};

const getTier = (score) => {
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  return "C";
};

const normalizeRetentionToPercentage = (retentionValue) => {
  if (retentionValue === null || retentionValue === undefined) return null;
  const num = tryParseNumber(retentionValue);
  if (num === null) return null;
  if (num <= 1) {
    return num * 100;
  }
  return num;
};

// --- 提取和分组输入数据 --------------------------------------------------------

console.log(`📥 开始处理 ${inputs.length} 个输入项`);

// 收集所有输入数据，按游戏分组
const gamesDataMap = new Map(); // key: gameCode, value: { gameCode, gameName, inputs: [], larkValues: null, weekStart, weekEnd }
let platformGameLevelTable = null; // 全平台游戏级数据（所有游戏共享）
let tenantToken = null;
let spreadsheetToken = null;
let tableName = null;

// 遍历所有输入项，收集数据
for (const input of inputs) {
  if (!input?.json) continue;
  
  const item = input.json;
  
  // 提取 token
  if (!tenantToken) {
    tenantToken = item.tenant_access_token || item.tenant_token || null;
  }
  if (!spreadsheetToken) {
    spreadsheetToken = item.spreadsheet_token || item.data?.spreadsheetToken || null;
  }
  if (!tableName) {
    tableName = item.table_name || null;
  }
  
  // 检查是否是 Lark 表格数据
  if (item.data?.valueRange?.values) {
    const larkValues = item.data.valueRange.values;
    
    // 解析所有游戏
    const games = parseAllGamesFromLark(larkValues);
    console.log(`📊 从 Lark 表格解析到 ${games.length} 个游戏`);
    
    games.forEach(game => {
      const gameCode = game.game_code;
      if (!gamesDataMap.has(gameCode)) {
        gamesDataMap.set(gameCode, {
          gameCode: gameCode,
          gameName: game.game_name,
          inputs: [],
          larkValues: larkValues,
          gameLevelTable: game,
          weekStart: item.WeekStart || null,
          weekEnd: item.WeekEnd || null,
        });
      } else {
        // 如果已存在，更新数据
        const existing = gamesDataMap.get(gameCode);
        existing.gameLevelTable = game;
        existing.larkValues = larkValues;
      }
    });
    
    // 解析全平台游戏级数据
    if (!platformGameLevelTable) {
      platformGameLevelTable = parsePlatformGameLevelTableFromLark(larkValues);
    }
  }
  
  // 检查是否包含结构化数据（来自 game-rating-fact-table-generator.js）
  if (item.game_level_table || item.target_game) {
    const gameCode = item.target_game?.game_code || 
                     item.game_level_table?.game_code ||
                     item.game_code ||
                     null;
    
    if (gameCode) {
      if (!gamesDataMap.has(gameCode)) {
        gamesDataMap.set(gameCode, {
          gameCode: gameCode,
          gameName: item.target_game?.game_name || 
                   item.game_level_table?.game_name ||
                   item.game_name ||
                   gameCode,
          inputs: [],
          larkValues: null,
          gameLevelTable: null,
          weekStart: item.WeekStart || null,
          weekEnd: item.WeekEnd || null,
        });
      }
      
      const gameData = gamesDataMap.get(gameCode);
      gameData.inputs.push(item);
      
      // 如果包含 game_level_table，使用它
      if (item.game_level_table) {
        gameData.gameLevelTable = item.game_level_table;
      }
      
      // 如果包含 platform_level_table，保存它
      if (item.platform_level_table) {
        gameData.platformLevelTable = item.platform_level_table;
      }
      
      // 如果包含 metrics，保存它
      if (item.metrics) {
        gameData.metrics = item.metrics;
      }
    }
  }
  
  // 检查是否包含 game 字段（可能是游戏名称）
  if (item.game && !item.target_game && !item.game_level_table) {
    const gameName = String(item.game).trim();
    // 尝试从其他字段推断游戏代码
    const gameCode = item.game_code || gameName;
    
    if (!gamesDataMap.has(gameCode)) {
      gamesDataMap.set(gameCode, {
        gameCode: gameCode,
        gameName: gameName,
        inputs: [],
        larkValues: null,
        gameLevelTable: null,
        weekStart: item.WeekStart || null,
        weekEnd: item.WeekEnd || null,
      });
    }
    
    gamesDataMap.get(gameCode).inputs.push(item);
  }
}

// 如果没有找到任何游戏数据，报错
if (gamesDataMap.size === 0) {
  throw new Error("❌ 未找到任何游戏数据");
}

console.log(`\n📊 识别到 ${gamesDataMap.size} 个游戏:`);
gamesDataMap.forEach((gameData, gameCode) => {
  console.log(`  - ${gameCode}: ${gameData.gameName} (${gameData.inputs.length} 个输入项)`);
});

// --- 为每个游戏计算评级 --------------------------------------------------------

const results = [];

gamesDataMap.forEach((gameData, gameCode) => {
  console.log(`\n=== 处理游戏: ${gameData.gameName} (${gameCode}) ===`);
  
  // 提取游戏级数据
  let gameLevelTable = gameData.gameLevelTable;
  let platformLevelTable = gameData.platformLevelTable;
  let larkValues = gameData.larkValues;
  let metrics = gameData.metrics;
  
  // 如果 Lark 表格数据存在，优先使用它
  if (larkValues) {
    // 解析游戏占平台比值表（用于补充数据）
    const ratioTable = parseRatioTableFromLark(larkValues);
    if (ratioTable && ratioTable.game) {
      if (!gameLevelTable) {
        gameLevelTable = {};
      }
      if (ratioTable.game.unique_users) {
        gameLevelTable.unique_users = ratioTable.game.unique_users;
      }
      if (ratioTable.game.d1_retention !== null && ratioTable.game.d1_retention !== undefined) {
        gameLevelTable.d1_retention = ratioTable.game.d1_retention;
      }
      if (ratioTable.game.d7_retention !== null && ratioTable.game.d7_retention !== undefined) {
        gameLevelTable.d7_retention = ratioTable.game.d7_retention;
      }
      if (ratioTable.game.net_usdt) {
        gameLevelTable.net_usdt = ratioTable.game.net_usdt;
      }
      if (ratioTable.game.arpu_usdt) {
        gameLevelTable.arpu_usdt = ratioTable.game.arpu_usdt;
      }
    }
    
    // 解析平台级数据
    if (!platformLevelTable || !Array.isArray(platformLevelTable) || platformLevelTable.length === 0) {
      const parsedPlatformLevel = parsePlatformLevelTableFromLarkValues(larkValues, gameCode);
      if (parsedPlatformLevel && parsedPlatformLevel.length > 0) {
        platformLevelTable = parsedPlatformLevel;
        console.log(`  ✅ 从 Lark 表格解析到 ${parsedPlatformLevel.length} 个平台数据`);
      }
    }
  }
  
  // 如果还是没有游戏级数据，尝试从 metrics 构建
  if (!gameLevelTable && metrics) {
    // 这里可以添加从 metrics 构建 gameLevelTable 的逻辑
    // 为了简化，暂时跳过
    console.log(`  ⚠️ 游戏 ${gameCode} 缺少游戏级数据，跳过`);
    return;
  }
  
  // 检查 gameLevelTable 是否有效
  if (!gameLevelTable || typeof gameLevelTable !== 'object') {
    console.log(`  ⚠️ 游戏 ${gameCode} 的游戏级数据无效，跳过`);
    return;
  }
  
  // 确保 gameLevelTable 有必要的属性
  if (!gameLevelTable.revenue_total_usdt && !gameLevelTable.payout_total_usdt) {
    console.log(`  ⚠️ 游戏 ${gameCode} 缺少收入和派彩数据，跳过`);
    return;
  }
  
  // 提取全平台游戏级数据（所有游戏共享）
  if (!platformGameLevelTable) {
    // 尝试从第一个输入项中获取
    for (const input of gameData.inputs) {
      if (input.platform_game_level_table) {
        platformGameLevelTable = input.platform_game_level_table;
        break;
      }
    }
  }
  
  if (!platformGameLevelTable) {
    console.log(`  ⚠️ 游戏 ${gameCode} 缺少全平台游戏级数据，使用默认值`);
    platformGameLevelTable = {
      unique_users: 0,
      revenue_total_usdt: 0,
      payout_total_usdt: 0,
      net_usdt: 0,
      arpu_usdt: 0,
      d1_retention: null,
      d7_retention: null,
    };
  }
  
  // 计算游戏全局指标（使用安全的属性访问）
  const gameD1Retention = normalizeRetentionToPercentage(gameLevelTable?.d1_retention);
  const gameD7Retention = normalizeRetentionToPercentage(gameLevelTable?.d7_retention);
  const gameNewUserCount = gameLevelTable?.unique_users || 0;
  const platformTotalNewUsers = platformGameLevelTable?.unique_users || 0;
  const newUserBetRatio = platformTotalNewUsers > 0 
    ? (gameNewUserCount / platformTotalNewUsers) * 100 
    : 0;
  const payoutBetRatio = gameLevelTable?.revenue_total_usdt > 0
    ? ((gameLevelTable?.payout_total_usdt || 0) / (gameLevelTable?.revenue_total_usdt || 1)) * 100
    : null;
  const ggrPerUser = gameNewUserCount > 0
    ? (gameLevelTable?.net_usdt || 0) / gameNewUserCount
    : 0;
  
  // 计算得分
  const gameD1Score = calculateD1Score(gameD1Retention);
  const gameD7Score = calculateD7Score(gameD7Retention);
  const gameScaleScore = calculateScaleScore(newUserBetRatio);
  const gameValueScore = calculateValueScore(ggrPerUser);
  const gameRiskScore = calculateRiskScore(payoutBetRatio);
  
  let gameTotalScore = 
    gameD1Score * 0.35 +
    gameD7Score * 0.25 +
    gameScaleScore * 0.20 +
    gameValueScore * 0.15 +
    gameRiskScore * 0.10;
  
  gameTotalScore = applySmallSamplePenalty(gameTotalScore, gameNewUserCount);
  const gameTier = getTier(gameTotalScore);
  
  // 处理平台级数据
  const platformRatings = [];
  
  if (platformLevelTable && Array.isArray(platformLevelTable) && platformLevelTable.length > 0) {
    const platformMap = new Map();
    
    platformLevelTable.forEach((platform) => {
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
      
      if (platform.d1_retention !== null && platform.d1_retention !== undefined) {
        let d1 = null;
        if (typeof platform.d1_retention === 'string') {
          d1 = parsePercentage(platform.d1_retention);
        } else {
          d1 = tryParseNumber(platform.d1_retention);
          if (d1 !== null && d1 > 1) {
            d1 = d1 / 100;
          }
        }
        if (d1 !== null) {
          if (data.d1_retention === null) {
            data.d1_retention = d1;
          } else {
            data.d1_retention = (data.d1_retention + d1) / 2;
          }
        }
      }
      
      if (platform.d7_retention !== null && platform.d7_retention !== undefined) {
        let d7 = null;
        if (typeof platform.d7_retention === 'string') {
          d7 = parsePercentage(platform.d7_retention);
        } else {
          d7 = tryParseNumber(platform.d7_retention);
          if (d7 !== null && d7 > 1) {
            d7 = d7 / 100;
          }
        }
        if (d7 !== null) {
          if (data.d7_retention === null) {
            data.d7_retention = d7;
          } else {
            data.d7_retention = (data.d7_retention + d7) / 2;
          }
        }
      }
    });
    
    platformMap.forEach((platformData) => {
      const platformD1Retention = normalizeRetentionToPercentage(platformData.d1_retention);
      const platformD7Retention = normalizeRetentionToPercentage(platformData.d7_retention);
      const platformNewUserBetRatio = platformTotalNewUsers > 0
        ? (platformData.unique_users / platformTotalNewUsers) * 100
        : 0;
      const platformPayoutBetRatio = platformData.revenue_usdt > 0
        ? (platformData.payout_usdt / platformData.revenue_usdt) * 100
        : null;
      const platformGgrPerUser = platformData.unique_users > 0
        ? platformData.net_usdt / platformData.unique_users
        : 0;
      
      const platformD1Score = calculateD1Score(platformD1Retention);
      const platformD7Score = calculateD7Score(platformD7Retention);
      const platformScaleScore = calculateScaleScore(platformNewUserBetRatio);
      const platformValueScore = calculateValueScore(platformGgrPerUser);
      const platformRiskScore = calculateRiskScore(platformPayoutBetRatio);
      
      let platformTotalScore =
        platformD1Score * 0.35 +
        platformD7Score * 0.25 +
        platformScaleScore * 0.20 +
        platformValueScore * 0.15 +
        platformRiskScore * 0.10;
      
      platformTotalScore = applySmallSamplePenalty(platformTotalScore, platformData.unique_users);
      const platformTier = getTier(platformTotalScore);
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
    
    platformRatings.sort((a, b) => b.scores.total_score - a.scores.total_score);
  }
  
  const redChannels = platformRatings.filter(p => p.is_red_channel);
  
  // 构建输出
  const output = {
    game: {
      code: gameCode,
      name: gameData.gameName,
    },
    period: {
      start: gameData.weekStart || null,
      end: gameData.weekEnd || null,
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
      data_source: tableName || "unknown",
    },
  };
  
  console.log(`  ✅ 游戏 ${gameCode} 评级完成: ${gameTier} (${gameTotalScore.toFixed(2)}分), ${platformRatings.length} 个平台, ${redChannels.length} 个红色渠道`);
  
  results.push({
    json: output,
  });
});

console.log(`\n=== 所有游戏评级分析完成 ===`);
console.log(`共处理 ${gamesDataMap.size} 个游戏，生成 ${results.length} 个结果`);

// 输出结果（每个游戏一个结果）
return results;

