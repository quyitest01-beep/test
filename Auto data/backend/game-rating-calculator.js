/* ========== n8n Code节点：游戏评分计算器 ==========
 * 功能：
 * 1. 接收清洗后的游戏指标数据（支持两种输入格式）
 * 2. 按照评级规则计算各项得分
 * 3. 输出标准化的评分数据供AI生成报告
 * 
 * 输入数据格式（格式1：原始指标数据）：
 * {
 *   "game_code": "gp_lottery_76",
 *   "game_name": "Golazo Win",
 *   "period": { "start": "20250731", "end": "20250814" },
 *   "metrics": {
 *     "d1_retention": 3.23,        // 百分比，例如 3.23 表示 3.23%
 *     "d7_retention": 43,
 *     "new_user_bet_ratio": 0.52,
 *     "payout_bet_ratio": 99.86,
 *     "new_user_count": 3219,
 *     "ggr_per_user": 0.0031
 *   },
 *   "platform_metrics": [ ... ]
 * }
 * 
 * 输入数据格式（格式2：已格式化数据，重新计算）：
 * {
 *   "game": { "code": "gp_crash_77", "name": "Aero Rush" },
 *   "period": { "start": "20251028", "end": "20251111", "days_range": "..." },
 *   "global_rating": { "metrics": { ... }, "scores": { ... } },
 *   "platform_ratings": [ ... ]
 * }
 */

const nestedArrayKeys = ["games", "items", "game_items", "game_list", "data", "results", "payloads"];

// 评分规则配置（来自上游 Set 节点），必须存在，否则报错
let scoringConfig = null;

const collectGamePayloadsFromValue = (value) => {
  const results = [];

  const visit = (candidate) => {
    if (candidate === null || candidate === undefined) {
      return;
    }

    // n8n 可能会输出 { json: {...} } 结构
    if (
      !Array.isArray(candidate) &&
      typeof candidate === "object" &&
      candidate.json &&
      typeof candidate.json === "object" &&
      !Array.isArray(candidate.json)
    ) {
      visit(candidate.json);
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => visit(entry?.json ?? entry));
      return;
    }

    if (typeof candidate !== "object") {
      return;
    }

    let nestedHandled = false;
    nestedArrayKeys.forEach((key) => {
      if (Array.isArray(candidate[key])) {
        nestedHandled = true;
        candidate[key].forEach((entry) => visit(entry?.json ?? entry));
      }
    });

    if (!nestedHandled) {
      results.push(candidate);
    }
  };

  visit(value);
  return results;
};

const inputs = $input.all() || [];
const rawGamePayloads = [];
let platformSummary = null; // 全平台汇总数据
const rtpMap = new Map(); // 游戏名 -> RTP数据

/* ---------- 工具函数（提前定义，供数据提取使用） ---------- */
const tryParseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/[,，\s%]/g, ""));
  return Number.isFinite(num) ? num : null;
};

inputs.forEach((item, idx) => {
  const payload = item?.json;
  if (payload === undefined || payload === null) {
    console.warn(`⚠️ 输入项 #${idx} 为空，已跳过`);
    return;
  }

  // 评分规则配置（来自 Set「评分规则」节点），只读取一次
  if (!scoringConfig && (payload.config_type === "game_rating_rules" || payload.scoring_config)) {
    scoringConfig = payload.scoring_config || payload;
    console.log("✅ 已加载评分规则配置：", JSON.stringify(scoringConfig));
    return; // 配置项本身不参与游戏数据解析
  }
  
  // 检查是否为全平台汇总数据（只有 "汇总" 字段且是字符串）
  if (payload["汇总"] && typeof payload["汇总"] === "string" && !payload["游戏名"]) {
    // 这是全平台汇总数据
    if (!platformSummary) {
      platformSummary = {};
    }
    // 提取留存数据
    if (payload["唯一用户数"] || payload["新用户D1留存率"] || payload["新用户D7留存率"]) {
      platformSummary.new_user_count = tryParseNumber(payload["唯一用户数"]) || platformSummary.new_user_count;
      const parsePercent = (val) => {
        if (val === null || val === undefined || val === "") return null;
        const str = String(val).replace(/%/g, "").trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num / 100;
      };
      platformSummary.d1_retention = parsePercent(payload["新用户D1留存率"]) || platformSummary.d1_retention;
      platformSummary.d7_retention = parsePercent(payload["新用户D7留存率"]) || platformSummary.d7_retention;
    }
    // 提取营收数据
    if (payload["总投注USD"] || payload["总派奖USD"] || payload["GGR-USD"]) {
      platformSummary.total_bet_usd = tryParseNumber(payload["总投注USD"]) || platformSummary.total_bet_usd;
      platformSummary.total_payout_usd = tryParseNumber(payload["总派奖USD"]) || platformSummary.total_payout_usd;
      platformSummary.ggr_usd = tryParseNumber(payload["GGR-USD"]) || platformSummary.ggr_usd;
    }
    return; // 跳过，不加入游戏数据
  }
  
  // 检查是否为RTP数据
  // 格式1：单个游戏对象 { "gamename": "...", "rtp_raw": "..." }
  if (payload.gamename && payload.rtp_raw) {
    rtpMap.set(payload.gamename, payload.rtp_raw);
    console.log(`✅ 提取RTP数据（单个）: ${payload.gamename} → ${payload.rtp_raw}`);
    return; // 跳过，不加入游戏数据
  }
  
  // 格式2：rules数组格式 { "rules": [ { "gamename": "...", "rtp_raw": "..." }, ... ] }
  if (Array.isArray(payload.rules)) {
    payload.rules.forEach(rule => {
      if (rule.gamename && rule.rtp_raw) {
        rtpMap.set(rule.gamename, rule.rtp_raw);
        console.log(`✅ 提取RTP数据（rules数组）: ${rule.gamename} → ${rule.rtp_raw}`);
      }
    });
    return; // 跳过，不加入游戏数据
  }
  
  // 格式3：包含多个游戏的RTP对象 { "游戏名1": { "gamename": "...", "rtp_raw": "..." }, ... }
  if (typeof payload === "object" && !Array.isArray(payload) && !payload["游戏名"] && !payload["汇总"] && !payload.rules) {
    // 检查是否是RTP数据对象（包含多个游戏，每个游戏有 gamename 和 rtp_raw）
    let isRtpDataObject = false;
    const rtpGames = [];
    
    Object.keys(payload).forEach(key => {
      const gameData = payload[key];
      if (gameData && typeof gameData === "object" && gameData.gamename && gameData.rtp_raw) {
        isRtpDataObject = true;
        rtpGames.push({
          name: gameData.gamename,
          rtp: gameData.rtp_raw
        });
      }
    });
    
    if (isRtpDataObject && rtpGames.length > 0) {
      // 将所有游戏的RTP数据添加到映射中
      rtpGames.forEach(game => {
        rtpMap.set(game.name, game.rtp);
        console.log(`✅ 提取RTP数据（对象格式）: ${game.name} → ${game.rtp}`);
      });
      return; // 跳过，不加入游戏数据
    }
  }
  
  const collected = collectGamePayloadsFromValue(payload);
  if (!collected.length) {
    console.warn(`⚠️ 输入项 #${idx} 未解析到有效游戏数据，已跳过`);
    return;
  }
  rawGamePayloads.push(...collected);
});

if (!scoringConfig) {
  throw new Error("❌ 未找到评分规则配置，请确认已连接 Set「评分规则」节点并包含 scoring_config 字段");
}

if (!rawGamePayloads.length) {
  throw new Error("❌ 缺少必要的输入数据（未解析到任何游戏指标对象）");
}

console.log(`📥 共解析到 ${rawGamePayloads.length} 条游戏指标数据，开始计算评分…`);

/* ---------- 其他工具函数 ---------- */

// 将可能是“百分比值”（例如 3.9 或 "3.9%"）统一转换为 0-1 浮点
// 配合 GAME_RATING_SCORING_CONFIG.md 中的公式：所有占比/比率按 0-1 浮点计算
const toFloat01 = (value) => {
  const v = tryParseNumber(value);
  if (v === null) return null;
  // 大于 1 基本可以认为是“百分比数值”，例如 3.9（3.9%）或 96（96%）
  return v > 1 ? v / 100 : v;
};

const clamp01 = (x) => {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
};

// 与配置表保持一致：rtp_diff_tolerance 默认 0.02
const RTP_DIFF_TOLERANCE = 0.02;

/* ---------- 评分计算函数 ---------- */

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
 * D1 得分
 * 使用 scoring_config.d1 中的 min/max/weight
 */
const calculateD1Score = (d1Rate) => {
  if (!scoringConfig || !scoringConfig.d1) {
    throw new Error("❌ 评分配置缺少 d1 字段");
  }
  const d1 = toFloat01(d1Rate);
  if (d1 === null) return 0;
  const { min, max } = scoringConfig.d1;
  const x = (d1 - min) / (max - min);
  return clamp01(x) * 100;
};

/**
 * D7 得分
 * 使用 scoring_config.d7 中的 min/max/weight
 */
const calculateD7Score = (d7Rate) => {
  if (!scoringConfig || !scoringConfig.d7) {
    throw new Error("❌ 评分配置缺少 d7 字段");
  }
  const d7 = toFloat01(d7Rate);
  if (d7 === null) return 0;
  const { min, max } = scoringConfig.d7;
  const x = (d7 - min) / (max - min);
  return clamp01(x) * 100;
};

/**
 * 规模得分
 * 使用 scoring_config.scale 中的 min_ratio / max_ratio / weight
 */
const calculateScaleScore = (ratio) => {
  if (!scoringConfig || !scoringConfig.scale) {
    throw new Error("❌ 评分配置缺少 scale 字段");
  }
  const r = toFloat01(ratio);
  if (r === null) return 0;
  const { min_ratio, max_ratio } = scoringConfig.scale;
  const x = (r - min_ratio) / (max_ratio - min_ratio);
  return clamp01(x) * 100;
};

/**
 * 价值得分
 * 使用 scoring_config.value.ggr_per_user_max
 */
const calculateValueScore = (ggrPerUser) => {
  if (!scoringConfig || !scoringConfig.value) {
    throw new Error("❌ 评分配置缺少 value 字段");
  }
  const ggr = tryParseNumber(ggrPerUser);
  if (ggr === null || ggr < 0) return 0;
  const maxGgr = scoringConfig.value.ggr_per_user_max;
  return calculateSingleScore(ggr, 0, maxGgr);
};

/**
 * 风险得分
 * 使用 scoring_config.risk.rtp_diff_tolerance
 */
const calculateRiskScore = (payoutRatio, rtpValue) => {
  if (!scoringConfig || !scoringConfig.risk) {
    throw new Error("❌ 评分配置缺少 risk 字段");
  }
  const payout = toFloat01(payoutRatio);
  const rtp = toFloat01(rtpValue);
  if (payout === null || rtp === null) return 0;
  const tol = scoringConfig.risk.rtp_diff_tolerance;
  const diff = Math.abs(payout - rtp);
  const x = 1 - diff / tol;
  return clamp01(x) * 100;
};

/**
 * 小样本惩罚
 * 使用 scoring_config.penalties.low/mid
 */
const applySmallSamplePenalty = (totalScore, newUserCount) => {
  if (!scoringConfig || !scoringConfig.penalties) {
    throw new Error("❌ 评分配置缺少 penalties 字段");
  }
  const count = tryParseNumber(newUserCount) || 0;
  const low = scoringConfig.penalties.low;
  const mid = scoringConfig.penalties.mid;
  if (!low || !mid) {
    throw new Error("❌ 评分配置 penalties.low / penalties.mid 不完整");
  }
  if (count < low.threshold) {
    return totalScore * low.multiplier;
  }
  if (count < mid.threshold) {
    return totalScore * mid.multiplier;
  }
  return totalScore;
};

/**
 * 根据得分确定档位
 * 使用 scoring_config.tiers 中的 S/A/B 阈值
 */
const getTier = (score) => {
  if (!scoringConfig || !scoringConfig.tiers) {
    throw new Error("❌ 评分配置缺少 tiers 字段");
  }
  const { S, A, B } = scoringConfig.tiers;
  if (score >= S) return "S";
  if (score >= A) return "A";
  if (score >= B) return "B";
  return "C";
};

// 按游戏名和时间分组，合并同一游戏的留存数据和营收数据
const gameDataMap = new Map();

rawGamePayloads.forEach((payload, index) => {
  const gameName = payload["游戏名"] || 
                   payload.game_name || 
                   payload.gameName || 
                   payload.name ||
                   payload.game?.name ||
                   "";
  const timeStr = payload["时间"] || 
                  payload.period?.days_range || 
                  "";
  
  if (!gameName) {
    console.warn(`⚠️ 跳过数据 #${index + 1}：缺少游戏名`);
    return;
  }
  
  const key = `${gameName}::${timeStr}`;
  
  if (!gameDataMap.has(key)) {
    gameDataMap.set(key, {
      payloads: [],
      gameName,
      timeStr,
    });
  }
  
  gameDataMap.get(key).payloads.push(payload);
});

console.log(`📊 共识别 ${gameDataMap.size} 个游戏，开始合并数据和计算评分…`);

const results = [];
let processedIndex = 0;

gameDataMap.forEach((gameData, key) => {
  const { payloads, gameName, timeStr } = gameData;
  
  // 合并同一游戏的多条记录
  const mergedPayload = mergeGamePayloads(payloads, gameName, timeStr);
  
  if (!mergedPayload) {
    console.warn(`⚠️ 跳过游戏 "${gameName}"：无法合并数据`);
    return;
  }
  
  const context = extractGameContext(mergedPayload, processedIndex);
  if (!context) {
    console.warn(`⚠️ 跳过游戏 "${gameName}"：无法提取上下文`);
    return;
  }
  
  const rating = calculateGameRating(context, processedIndex, gameDataMap.size);
  results.push(rating);
  processedIndex++;
});

if (!results.length) {
  throw new Error("❌ 所有输入项都缺少有效指标，未能生成评分结果");
}

console.log(`✅ 多游戏评分完成：共 ${results.length} 条记录可供下游AI使用`);

return results.map(result => ({
  json: result,
}));

// 合并同一游戏的多条记录（留存数据 + 营收数据）
function mergeGamePayloads(payloads, gameName, timeStr) {
  if (!payloads || payloads.length === 0) {
    return null;
  }
  
  // 如果只有一条记录，直接返回
  if (payloads.length === 1) {
    return payloads[0];
  }
  
  // 合并多条记录
  let merged = {
    "游戏名": gameName,
    "时间": timeStr,
    "汇总": {},
    "商户数据": []
  };
  
  const merchantMap = new Map(); // 商户名 -> 商户数据
  
  payloads.forEach(payload => {
    // 合并汇总数据
    if (payload["汇总"] && typeof payload["汇总"] === "object") {
      const summary = payload["汇总"];
      Object.keys(summary).forEach(key => {
        // 如果字段已存在
        if (merged["汇总"][key] !== undefined) {
          const existing = tryParseNumber(merged["汇总"][key]);
          const current = tryParseNumber(summary[key]);
          // 营收数据（USD相关）累加
          if (existing !== null && current !== null && 
              (key.includes("USD") || key.includes("投注") || key.includes("派奖") || key.includes("GGR"))) {
            merged["汇总"][key] = existing + current;
          } else {
            // 留存数据（用户数、留存率）取第一个非空值或累加（用户数）
            if (key === "唯一用户数") {
              // 用户数累加
              if (existing !== null && current !== null) {
                merged["汇总"][key] = existing + current;
              } else if (current !== null) {
                merged["汇总"][key] = current;
              }
            } else {
              // 留存率等取第一个非空值
              if (merged["汇总"][key] === null || merged["汇总"][key] === "" || merged["汇总"][key] === undefined) {
                merged["汇总"][key] = summary[key];
              }
            }
          }
        } else {
          merged["汇总"][key] = summary[key];
        }
      });
    }
    
    // 合并商户数据
    if (Array.isArray(payload["商户数据"])) {
      payload["商户数据"].forEach(merchant => {
        const merchantName = merchant["商户名"] || "";
        if (!merchantName) return;
        
        if (!merchantMap.has(merchantName)) {
          merchantMap.set(merchantName, {
            "商户名": merchantName,
            "货币": merchant["货币"] || "USDT",
          });
        }
        
        const mergedMerchant = merchantMap.get(merchantName);
        
        // 合并商户的各个字段
        Object.keys(merchant).forEach(key => {
          if (key === "商户名") return;
          
          if (mergedMerchant[key] !== undefined) {
            const existing = tryParseNumber(mergedMerchant[key]);
            const current = tryParseNumber(merchant[key]);
            // 营收数据（USD相关）累加
            if (existing !== null && current !== null && 
                (key.includes("USD") || key.includes("投注") || key.includes("派奖") || key.includes("GGR"))) {
              mergedMerchant[key] = existing + current;
            } else if (key === "唯一用户数") {
              // 用户数累加
              if (existing !== null && current !== null) {
                mergedMerchant[key] = existing + current;
              } else if (current !== null) {
                mergedMerchant[key] = current;
              }
            } else {
              // 留存率、货币等取第一个非空值
              if (mergedMerchant[key] === null || mergedMerchant[key] === "" || mergedMerchant[key] === undefined) {
                mergedMerchant[key] = merchant[key];
              } else if (key === "货币" && mergedMerchant[key] !== merchant[key]) {
                // 货币字段：如果不同，合并（用顿号分隔）
                const existingCurrencies = mergedMerchant[key].split("、").filter(c => c.trim());
                const currentCurrencies = String(merchant[key] || "").split("、").filter(c => c.trim());
                const allCurrencies = [...new Set([...existingCurrencies, ...currentCurrencies])];
                mergedMerchant[key] = allCurrencies.join("、");
              }
            }
          } else {
            mergedMerchant[key] = merchant[key];
          }
        });
      });
    }
  });
  
  // 将商户数据转换为数组
  merged["商户数据"] = Array.from(merchantMap.values());
  
  return merged;
}

function extractGameContext(payload, index) {
  let metrics = null;
  let platformMetrics = [];
  let period = payload.period || {};
  let dataSource = payload.data_source || "game-rating-calculator";
  
  // 提取原始营收数据（用于后续计算和输出）
  let revenueData = {
    total_bet_usd: null,
    total_payout_usd: null,
    ggr_usd: null,
    rtp_raw: null
  };

  let gameCode = payload.game_code ||
                 payload.gameCode ||
                 payload.code ||
                 payload.game?.code ||
                 payload.game?.game_code ||
                 "";
  let gameName = payload.game_name ||
                 payload.gameName ||
                 payload.name ||
                 payload.game?.name ||
                 gameCode ||
                 "游戏";

  // 跳过月份汇总数据（只有 "汇总" 字段且是字符串）
  if (payload["汇总"] && typeof payload["汇总"] === "string" && !payload["游戏名"]) {
    console.warn(`⚠️ 跳过月份汇总数据 #${index + 1}：${payload["汇总"]}`);
    return null;
  }

  // 格式1：标准格式（global_rating.metrics 或 metrics）
  if (payload.global_rating?.metrics) {
    metrics = payload.global_rating.metrics;
    if (payload.game?.code) {
      gameCode = payload.game.code;
    }
    if (payload.game?.name) {
      gameName = payload.game.name;
    }
    if (payload.global_rating.period && Object.keys(payload.global_rating.period).length > 0) {
      period = payload.global_rating.period;
    }
    if (Array.isArray(payload.platform_ratings)) {
      platformMetrics = payload.platform_ratings.map(p => ({
        platform_id: p.platform_id ?? p.platformId ?? p.id ?? "",
        platform_name: p.platform_name ?? p.platformName ?? p.name ?? "",
        currency: p.currency || "USDT",
        metrics: p.metrics || {},
      }));
    }
    
    // 提取营收数据（从payload顶层或game对象中）
    revenueData.total_bet_usd = tryParseNumber(payload.total_bet_usd || payload["总投注USD"] || payload.game?.total_bet_usd);
    revenueData.total_payout_usd = tryParseNumber(payload.total_payout_usd || payload["总派奖USD"] || payload.game?.total_payout_usd);
    revenueData.ggr_usd = tryParseNumber(payload.ggr_usd || payload["GGR-USD"] || payload.game?.ggr_usd);
    revenueData.rtp_raw = payload.rtp_raw || payload["RTP"] || payload.rtp_value || payload.game?.rtp_raw || null;
  } else if (payload.metrics) {
    metrics = payload.metrics;
    if (Array.isArray(payload.platform_metrics)) {
      platformMetrics = payload.platform_metrics;
    }
    
    // 提取营收数据
    revenueData.total_bet_usd = tryParseNumber(payload.total_bet_usd || payload["总投注USD"]);
    revenueData.total_payout_usd = tryParseNumber(payload.total_payout_usd || payload["总派奖USD"]);
    revenueData.ggr_usd = tryParseNumber(payload.ggr_usd || payload["GGR-USD"]);
    revenueData.rtp_raw = payload.rtp_raw || payload["RTP"] || payload.rtp_value || null;
  }
  // 格式2：留存数据格式（"游戏名"、"时间"、"汇总"、"商户数据"）
  else if (payload["游戏名"] && payload["汇总"] && typeof payload["汇总"] === "object") {
    gameName = payload["游戏名"];
    gameCode = gameName; // 如果没有 game_code，使用游戏名
    
    // 解析时间字段（"2025/11" 格式）
    const timeStr = payload["时间"] || "";
    if (timeStr) {
      const match = timeStr.match(/(\d{4})\/(\d{2})/);
      if (match) {
        const year = match[1];
        const month = match[2];
        period = {
          start: `${year}${month}01`,
          end: `${year}${month}31`, // 简化处理，实际应该根据月份计算最后一天
          days_range: `${year}年${month}月`
        };
      }
    }

    // 转换 "汇总" 对象为 metrics 格式
    const summary = payload["汇总"];
    const parsePercent = (val) => {
      if (val === null || val === undefined || val === "") return null;
      const str = String(val).replace(/%/g, "").trim();
      const num = parseFloat(str);
      return isNaN(num) ? null : num / 100; // 转换为 0-1 浮点
    };

    metrics = {
      d1_retention: parsePercent(summary["新用户D1留存率"]),
      d7_retention: parsePercent(summary["新用户D7留存率"]),
      new_user_count: tryParseNumber(summary["唯一用户数"]) || 0,
      // 缺失的指标设置为 null
      new_user_bet_ratio: null,
      payout_bet_ratio: null,
      ggr_per_user: null,
      rtp_value: null,
    };
    
    // 从"汇总"对象中提取营收数据（如果存在）
    revenueData.total_bet_usd = tryParseNumber(summary["总投注USD"]);
    revenueData.total_payout_usd = tryParseNumber(summary["总派奖USD"]);
    revenueData.ggr_usd = tryParseNumber(summary["GGR-USD"]);
    revenueData.rtp_raw = summary["RTP"] || summary["rtp_raw"] || null;

    // 转换 "商户数据" 为 platformMetrics 格式
    if (Array.isArray(payload["商户数据"])) {
      platformMetrics = payload["商户数据"].map(merchant => ({
        platform_name: merchant["商户名"] || "",
        currency: merchant["货币"] || "USDT", // 从商户数据中获取币种
        metrics: {
          d1_retention: parsePercent(merchant["新用户D1留存率"]),
          d7_retention: parsePercent(merchant["新用户D7留存率"]),
          new_user_count: tryParseNumber(merchant["唯一用户数"]) || 0,
          // 提取营收数据
          "总投注USD": tryParseNumber(merchant["总投注USD"]),
          "总派奖USD": tryParseNumber(merchant["总派奖USD"]),
          "GGR-USD": tryParseNumber(merchant["GGR-USD"]),
          // 缺失的指标设置为 null
          new_user_bet_ratio: null,
          payout_bet_ratio: null,
          ggr_per_user: null,
          rtp_value: null,
        },
      }));
    }

    dataSource = "retention-data-aggregator";
  }

  if (!metrics) {
    console.warn(`⚠️ 跳过游戏数据 #${index + 1}（${gameCode || "unknown"}）：缺少 metrics 或 global_rating.metrics 或游戏数据格式`);
    return null;
  }

  if (!Array.isArray(platformMetrics)) {
    platformMetrics = [];
  }

  // 从RTP映射中获取RTP值
  if (!revenueData.rtp_raw && gameName && rtpMap.has(gameName)) {
    revenueData.rtp_raw = rtpMap.get(gameName);
    console.log(`✅ 从RTP映射获取: ${gameName} → ${revenueData.rtp_raw}`);
  } else if (!revenueData.rtp_raw && gameName) {
    console.warn(`⚠️ 未找到游戏 ${gameName} 的RTP数据，RTP映射中有 ${rtpMap.size} 个游戏`);
    if (rtpMap.size > 0) {
      console.warn(`   RTP映射中的游戏列表: ${Array.from(rtpMap.keys()).slice(0, 10).join(', ')}${rtpMap.size > 10 ? '...' : ''}`);
    }
  }

  return {
    metrics,
    platformMetrics,
    gameCode,
    gameName,
    period,
    dataSource,
    revenueData, // 添加营收数据
    platformSummary, // 添加全平台汇总数据
  };
}

function calculateGameRating(context, index, totalCount) {
  const {
    metrics,
    platformMetrics,
    gameCode,
    gameName,
    period,
    dataSource,
    revenueData, // 接收营收数据
    platformSummary, // 接收全平台汇总数据
  } = context;

  const d1Retention = tryParseNumber(metrics.d1_retention);
  const d7Retention = tryParseNumber(metrics.d7_retention);
  const newUserCount = tryParseNumber(metrics.new_user_count) || 0;

  // 计算 new_user_bet_ratio（新用户下注占比）：
  // 如果 metrics 中没有配置，则按「当前游戏新用户数 ÷ 平台新用户总数」回填
  let newUserBetRatio = tryParseNumber(metrics.new_user_bet_ratio);
  if ((newUserBetRatio === null || newUserBetRatio === undefined) && platformSummary && platformSummary.new_user_count) {
    const totalNewUsers = tryParseNumber(platformSummary.new_user_count);
    if (totalNewUsers && totalNewUsers > 0 && newUserCount > 0) {
      newUserBetRatio = newUserCount / totalNewUsers;
    }
  }
  
  // 计算 payout_bet_ratio：总派奖USD ÷ 总投注USD
  let payoutBetRatio = null;
  if (revenueData.total_payout_usd !== null && revenueData.total_bet_usd !== null && revenueData.total_bet_usd > 0) {
    payoutBetRatio = revenueData.total_payout_usd / revenueData.total_bet_usd;
  } else {
    payoutBetRatio = tryParseNumber(metrics.payout_bet_ratio);
  }
  
  // 计算 ggr_per_user：GGR-USD ÷ 唯一用户数
  let ggrPerUser = null;
  if (revenueData.ggr_usd !== null && newUserCount > 0) {
    ggrPerUser = revenueData.ggr_usd / newUserCount;
  } else {
    ggrPerUser = tryParseNumber(metrics.ggr_per_user) || 0;
  }
  
  // 处理 RTP 值：从 rtp_raw 中提取（可能是范围字符串如 "93.79~97.16%"）
  let rtpValue = null;
  if (revenueData.rtp_raw) {
    const rtpStr = String(revenueData.rtp_raw);
    // 处理范围格式：如 "93.79~97.16%" 或 "93.79-97.16%"
    const rangeMatch = rtpStr.match(/(\d+\.?\d*)[~-](\d+\.?\d*)/);
    if (rangeMatch) {
      // 如果有范围，取平均值
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      rtpValue = (min + max) / 2 / 100; // 转换为0-1浮点
    } else {
      // 单个值，去掉%并转换
      rtpValue = toFloat01(rtpStr);
    }
  } else {
    rtpValue = tryParseNumber(metrics.rtp_value);
  }

  const d1Score = calculateD1Score(d1Retention);
  const d7Score = calculateD7Score(d7Retention);
  const scaleScore = calculateScaleScore(newUserBetRatio);
  const valueScore = calculateValueScore(ggrPerUser);
  const riskScore = calculateRiskScore(payoutBetRatio, rtpValue);

  const wD1 = scoringConfig.d1.weight;
  const wD7 = scoringConfig.d7.weight;
  const wScale = scoringConfig.scale.weight;
  const wValue = scoringConfig.value.weight;
  const wRisk = scoringConfig.risk.weight;

  let totalScore =
    d1Score * wD1 +
    d7Score * wD7 +
    scaleScore * wScale +
    valueScore * wValue +
    riskScore * wRisk;

  totalScore = applySmallSamplePenalty(totalScore, newUserCount);
  const tier = getTier(totalScore);

  const platformRatings = [];

  if (Array.isArray(platformMetrics) && platformMetrics.length > 0) {
    platformMetrics.forEach((platformData, idx) => {
      const platformName = String(platformData.platform_name ?? platformData.platformName ?? platformData.name ?? "").trim();
      const currency = String(platformData.currency || "").trim();

      const isPlatformNameValid = platformName ? !/^\d+\.?\d*$/.test(platformName) : true;
      const isCurrencyValid = currency ? /^[A-Z]{2,4}$/.test(currency) : true;

      if (!isPlatformNameValid && /^\d+\.?\d*$/.test(platformName)) {
        console.warn(`⚠️ 跳过无效的平台数据 [${idx}]: platform_name="${platformName}" 是数值，不是平台名称`);
        return;
      }

      if (!isCurrencyValid && /^\d+\.?\d*$/.test(currency)) {
        console.warn(`⚠️ 跳过无效的平台数据 [${idx}]: currency="${currency}" 是数值，不是币种代码`);
        return;
      }

      const platformMetricsData = platformData.metrics || {};
      
      // 提取平台营收数据
      const platformTotalBetUSD = tryParseNumber(platformMetricsData["总投注USD"] || platformMetricsData.total_bet_usd);
      const platformTotalPayoutUSD = tryParseNumber(platformMetricsData["总派奖USD"] || platformMetricsData.total_payout_usd);
      const platformGgrUSD = tryParseNumber(platformMetricsData["GGR-USD"] || platformMetricsData.ggr_usd);

      const platformD1Retention = tryParseNumber(platformMetricsData.d1_retention);
      const platformD7Retention = tryParseNumber(platformMetricsData.d7_retention);
      const platformNewUserCount = tryParseNumber(platformMetricsData.new_user_count) || 0;

      // 计算平台 new_user_bet_ratio：平台新用户数 ÷ 平台总新用户数
      let platformNewUserBetRatio = tryParseNumber(platformMetricsData.new_user_bet_ratio);
      if ((platformNewUserBetRatio === null || platformNewUserBetRatio === undefined) && platformSummary && platformSummary.new_user_count) {
        const totalNewUsers = tryParseNumber(platformSummary.new_user_count);
        if (totalNewUsers && totalNewUsers > 0 && platformNewUserCount > 0) {
          platformNewUserBetRatio = platformNewUserCount / totalNewUsers;
        }
      }
      
      // 计算平台 payout_bet_ratio
      let platformPayoutBetRatio = null;
      if (platformTotalPayoutUSD !== null && platformTotalBetUSD !== null && platformTotalBetUSD > 0) {
        platformPayoutBetRatio = platformTotalPayoutUSD / platformTotalBetUSD;
      } else {
        platformPayoutBetRatio = tryParseNumber(platformMetricsData.payout_bet_ratio);
      }
      
      // 计算平台 ggr_per_user
      let platformGgrPerUser = null;
      if (platformGgrUSD !== null && platformNewUserCount > 0) {
        platformGgrPerUser = platformGgrUSD / platformNewUserCount;
      } else {
        platformGgrPerUser = tryParseNumber(platformMetricsData.ggr_per_user) || 0;
      }
      
      const platformRtpValue = rtpValue; // 使用游戏的RTP值

      const platformD1Score = calculateD1Score(platformD1Retention);
      const platformD7Score = calculateD7Score(platformD7Retention);
      const platformScaleScore = calculateScaleScore(platformNewUserBetRatio);
      const platformValueScore = calculateValueScore(platformGgrPerUser);
      const platformRiskScore = calculateRiskScore(platformPayoutBetRatio, platformRtpValue);

      const wD1 = scoringConfig.d1.weight;
      const wD7 = scoringConfig.d7.weight;
      const wScale = scoringConfig.scale.weight;
      const wValue = scoringConfig.value.weight;
      const wRisk = scoringConfig.risk.weight;

      let platformTotalScore =
        platformD1Score * wD1 +
        platformD7Score * wD7 +
        platformScaleScore * wScale +
        platformValueScore * wValue +
        platformRiskScore * wRisk;

      platformTotalScore = applySmallSamplePenalty(platformTotalScore, platformNewUserCount);
      const platformTier = getTier(platformTotalScore);
      const isRedChannel = platformTier === "C";

      const normalizedD1Retention = platformD1Retention !== null
        ? Number(platformD1Retention.toFixed(2))
        : null;
      const normalizedD7Retention = platformD7Retention !== null
        ? Number(platformD7Retention.toFixed(2))
        : null;

      // 计算平台占比（相对于全平台）
      let platformRatios = {};
      if (platformSummary) {
        if (platformSummary.total_bet_usd && platformTotalBetUSD !== null && platformSummary.total_bet_usd > 0) {
          platformRatios.bet_ratio = platformTotalBetUSD / platformSummary.total_bet_usd;
        }
        if (platformSummary.total_payout_usd && platformTotalPayoutUSD !== null && platformSummary.total_payout_usd > 0) {
          platformRatios.payout_ratio = platformTotalPayoutUSD / platformSummary.total_payout_usd;
        }
        if (platformSummary.ggr_usd && platformGgrUSD !== null && platformSummary.ggr_usd > 0) {
          platformRatios.ggr_ratio = platformGgrUSD / platformSummary.ggr_usd;
        }
        if (platformSummary.new_user_count && platformNewUserCount > 0 && platformSummary.new_user_count > 0) {
          platformRatios.user_ratio = platformNewUserCount / platformSummary.new_user_count;
        }
      }

      platformRatings.push({
        platform_name: platformName || '',
        currency: currency || 'USDT',
        metrics: {
          d1_retention: normalizedD1Retention !== null ? Number(normalizedD1Retention.toFixed(2)) : null,
          d7_retention: normalizedD7Retention !== null ? Number(normalizedD7Retention.toFixed(2)) : null,
          new_user_bet_ratio: platformNewUserBetRatio !== null ? Number(platformNewUserBetRatio.toFixed(4)) : 0,
          payout_bet_ratio: platformPayoutBetRatio !== null ? Number(platformPayoutBetRatio.toFixed(2)) : null,
          rtp_value: platformRtpValue !== null ? Number(toFloat01(platformRtpValue).toFixed(4)) : null,
          new_user_count: platformNewUserCount,
          ggr_per_user: Number(platformGgrPerUser.toFixed(4)),
          total_bet_usd: platformTotalBetUSD,
          total_payout_usd: platformTotalPayoutUSD,
          ggr_usd: platformGgrUSD,
        },
        ratios: platformRatios, // 平台占比
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

  const normalizedD1Retention = d1Retention !== null
    ? Number(d1Retention.toFixed(2))
    : null;
  const normalizedD7Retention = d7Retention !== null
    ? Number(d7Retention.toFixed(2))
    : null;
  const normalizedRtpValue = rtpValue !== null
    ? Number(toFloat01(rtpValue).toFixed(4))
    : null;

  // 计算游戏占比（相对于全平台）
  let gameRatios = {};
  if (platformSummary) {
    if (platformSummary.total_bet_usd && revenueData.total_bet_usd !== null && platformSummary.total_bet_usd > 0) {
      gameRatios.bet_ratio = revenueData.total_bet_usd / platformSummary.total_bet_usd;
    }
    if (platformSummary.total_payout_usd && revenueData.total_payout_usd !== null && platformSummary.total_payout_usd > 0) {
      gameRatios.payout_ratio = revenueData.total_payout_usd / platformSummary.total_payout_usd;
    }
    if (platformSummary.ggr_usd && revenueData.ggr_usd !== null && platformSummary.ggr_usd > 0) {
      gameRatios.ggr_ratio = revenueData.ggr_usd / platformSummary.ggr_usd;
    }
    if (platformSummary.new_user_count && newUserCount > 0 && platformSummary.new_user_count > 0) {
      gameRatios.user_ratio = newUserCount / platformSummary.new_user_count;
    }
  }

  const output = {
    game: {
      name: gameName || '游戏',
    },
    period: {
      start: period?.start || '',
      end: period?.end || '',
      days_range: period?.days_range || "游戏上线后第1-14日（包括当日）",
    },
    global_rating: {
      metrics: {
        d1_retention: normalizedD1Retention !== null ? Number(normalizedD1Retention.toFixed(2)) : null,
        d7_retention: normalizedD7Retention !== null ? Number(normalizedD7Retention.toFixed(2)) : null,
        new_user_bet_ratio: newUserBetRatio !== null ? Number(newUserBetRatio.toFixed(4)) : 0,
        payout_bet_ratio: payoutBetRatio !== null ? Number(payoutBetRatio.toFixed(2)) : null,
        rtp_value: normalizedRtpValue,
        new_user_count: newUserCount,
        ggr_per_user: Number(ggrPerUser.toFixed(4)),
      },
      scores: {
        d1_score: Number(d1Score.toFixed(2)),
        d7_score: Number(d7Score.toFixed(2)),
        scale_score: Number(scaleScore.toFixed(2)),
        value_score: Number(valueScore.toFixed(2)),
        risk_score: Number(riskScore.toFixed(2)),
        total_score: Number(totalScore.toFixed(2)),
      },
      tier: tier,
      weights: {
        d1: scoringConfig.d1.weight,
        d7: scoringConfig.d7.weight,
        scale: scoringConfig.scale.weight,
        value: scoringConfig.value.weight,
        risk: scoringConfig.risk.weight,
      },
    },
    platform_ratings: platformRatings,
    summary: {
      global_tier: tier,
      global_score: Number(totalScore.toFixed(2)),
      platform_count: platformRatings.length,
      red_channel_count: platformRatings.filter(p => p.is_red_channel).length,
      can_increase_budget: (tier === "S" || tier === "A" || tier === "B") &&
        platformRatings.filter(p => p.is_red_channel).length === 0,
    },
    // 添加原始营收数据，供下游节点使用
    revenue_data: {
      total_bet_usd: revenueData.total_bet_usd,
      total_payout_usd: revenueData.total_payout_usd,
      ggr_usd: revenueData.ggr_usd,
      rtp_raw: revenueData.rtp_raw,
    },
    // 添加全平台汇总数据
    platform_summary: platformSummary ? {
      total_bet_usd: platformSummary.total_bet_usd,
      total_payout_usd: platformSummary.total_payout_usd,
      ggr_usd: platformSummary.ggr_usd,
      new_user_count: platformSummary.new_user_count,
      d1_retention: platformSummary.d1_retention,
      d7_retention: platformSummary.d7_retention,
    } : null,
    // 添加游戏占比
    ratios: gameRatios,
    meta: {
      generated_at: new Date().toISOString(),
      data_source: dataSource,
    },
  };

  console.log(`🎮 [${index + 1}/${totalCount}] ${output.game.name} → ${tier} 级（${totalScore.toFixed(2)} 分），平台 ${platformRatings.length} 个`);

  return output;
}

