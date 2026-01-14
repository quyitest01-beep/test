// n8n Code节点：游戏指标汇总 → Lark 写入准备器（含币种汇率转换）
// 功能：
// 1. 读取 tenant token
// 2. 根据 game_code 匹配游戏英文名 + 上线时间，生成表名 “英文名-上线时间”
// 3. 将原始指标拆分为 “目标游戏” 与 “全游戏” 两大块，整理成后续写 Lark 表格所需的结构
// 4. 解析上游提供的币种 ↔ USDT 汇率，将投注 / 派奖金额统一折算为 USDT

const inputs = $input.all();
if (!inputs?.length) {
  throw new Error("❌ 未收到任何输入数据");
}

// --- 通用工具 ----------------------------------------------------------------

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeGameCode = (value) => {
  const str = cleanString(value);
  return str ? str : null;
};

const normalizeRate = (value) => {
  const str = cleanString(value);
  if (!str) return "";
  return str.includes("%") ? str : `${str}%`;
};

const tryParseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/[,，\s]/g, ""));
  return Number.isFinite(num) ? num : null;
};

const isRetentionRecord = (obj) =>
  obj &&
  typeof obj === "object" &&
  obj.metric_type &&
  obj.d0_users !== undefined &&
  obj.d1_users !== undefined &&
  obj.d7_users !== undefined;

const isRevenueRecord = (obj) =>
  obj &&
  typeof obj === "object" &&
  obj.total_amount !== undefined &&
  obj.total_pay_out !== undefined;

const isUsersRecord = (obj) =>
  obj &&
  typeof obj === "object" &&
  (obj.unique_users_by_game !== undefined || 
   obj.unique_users !== undefined || 
   obj.unique_users_total !== undefined);

const isMerchantRecord = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  // 检查是否有 merchant_id 字段
  const hasMerchantId = obj.merchant_id !== undefined || obj.merchantId !== undefined;
  // 检查是否有 merchant name 字段
  const hasMerchantName = 
    obj.sub_merchant_name !== undefined || 
    obj.subMerchantName !== undefined ||
    obj.main_merchant_name !== undefined ||
    obj.mainMerchantName !== undefined;
  
  // 如果同时有 merchant_id 和 merchant name，认为是 merchant 记录
  return hasMerchantId && hasMerchantName;
};

const formatRetentionRecord = (rec) => {
  const formatted = {
    metric_type: rec.metric_type,
    game_code: normalizeGameCode(rec.game_code) || null,
    d0_users: tryParseNumber(rec.d0_users) ?? 0,
    d1_users: tryParseNumber(rec.d1_users) ?? 0,
    d7_users: tryParseNumber(rec.d7_users) ?? 0,
    d1_retention_rate: normalizeRate(rec.d1_retention_rate),
    d7_retention_rate: normalizeRate(rec.d7_retention_rate),
  };
  
  // 保留原始 platform 字段（如果存在）
  if (rec.platform !== undefined && rec.platform !== null) {
    formatted.platform = String(rec.platform);
  }
  
  return formatted;
};

const normalizeCurrency = (value) => {
  const str = cleanString(value).toUpperCase();
  return str || null;
};

// --- 汇率解析 -----------------------------------------------------------------

const currencyRates = new Map([
  ["USDT", 1],
  ["USD", 1],
]);
const currencyRateSources = new Set();
const missingRateCurrencies = new Set();

const parseCurrencyTable = (range, values) => {
  if (!range || !/![A-Z]+\d+:[A-Z]+\d+/i.test(range)) return;
  if (!Array.isArray(values)) return;

  values.forEach((row) => {
    if (!Array.isArray(row) || row.length < 2) return;
    const currency = normalizeCurrency(row[0]);
    if (!currency || /^(CURRENCY|币种|货币)$/i.test(currency)) return;
    const rate = tryParseNumber(row[1]);
    if (rate === null) return;
    currencyRates.set(currency, rate);
    currencyRateSources.add(range);
  });
};

const traverseForRates = (node, path = []) => {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    node.forEach((child, idx) => traverseForRates(child, path.concat(idx)));
    return;
  }

  if (typeof node !== "object") return;

  const candidateRanges = [
    node.range,
    node.Range,
    node.rangeName,
    node.data?.range,
    node.valueRange?.range,
  ].filter((r) => typeof r === "string" && r.includes("!"));

  const possibleValues = [];
  if (Array.isArray(node.values)) possibleValues.push(node.values);
  if (Array.isArray(node.value)) possibleValues.push(node.value);
  if (Array.isArray(node.rows)) possibleValues.push(node.rows);
  if (Array.isArray(node.data?.values)) possibleValues.push(node.data.values);
  if (Array.isArray(node.data?.valueRange?.values))
    possibleValues.push(node.data.valueRange.values);
  if (Array.isArray(node.valueRange?.values))
    possibleValues.push(node.valueRange.values);

  if (candidateRanges.length > 0 && possibleValues.length > 0) {
    const range = candidateRanges[0];
    possibleValues.forEach((values) => parseCurrencyTable(range, values));
  }

  Object.values(node).forEach((child) => traverseForRates(child, path));
};

const getRate = (currency) => {
  const normalized = normalizeCurrency(currency) || "USDT";
  if (currencyRates.has(normalized)) {
    return currencyRates.get(normalized);
  }
  missingRateCurrencies.add(normalized);
  return 1;
};

// --- 数据分类 -----------------------------------------------------------------

let tenantToken = null;
const mappingEntries = [];
const metricEntries = [];
const merchantEntries = [];

// 规范化 merchant_id 或 platform 用于匹配
const normalizeMerchantId = (value) => {
  if (value === null || value === undefined) return null;
  // 转换为字符串以便匹配
  const str = String(value).trim();
  if (!str) return null;
  // 尝试转换为数字进行比较
  const num = tryParseNumber(str);
  return num !== null ? String(num) : str;
};

// 使用 Set 来跟踪已处理的 merchant 记录，避免重复
const processedMerchantRecords = new WeakSet();
const collectedMerchantIds = new Set(); // 跟踪已收集的商户ID

// 递归遍历对象，收集所有 merchant 记录
const collectMerchantRecords = (obj, path = [], depth = 0) => {
  if (!obj || typeof obj !== "object") return;
  
  // 限制递归深度，避免无限递归
  if (depth > 10) return;
  
  // 特殊处理：如果对象有 filtered_merchants 或 filteredMerchants 字段，直接处理该数组
  if (obj.filtered_merchants && Array.isArray(obj.filtered_merchants)) {
    console.log(`🔍 发现 filtered_merchants 数组，包含 ${obj.filtered_merchants.length} 个元素`);
    obj.filtered_merchants.forEach((merchant, index) => {
      // 检查是否是商户记录（只要有 merchant_id 就收集，不强制要求 merchant_name）
      const hasMerchantId = merchant && typeof merchant === "object" && (merchant.merchant_id !== undefined || merchant.merchantId !== undefined);
      
      if (hasMerchantId) {
        const merchantId = merchant.merchant_id ?? merchant.merchantId;
        const merchantIdStr = merchantId ? String(merchantId) : null;
        
        if (merchantIdStr && !collectedMerchantIds.has(merchantIdStr)) {
          merchantEntries.push(merchant);
          collectedMerchantIds.add(merchantIdStr);
          console.log(`✅ 从 filtered_merchants[${index}] 收集到 merchant 记录: merchant_id=${merchantIdStr}, sub_merchant_name=${merchant.sub_merchant_name || merchant.subMerchantName || '(null)'}, main_merchant_name=${merchant.main_merchant_name || merchant.mainMerchantName || '(null)'}`);
        } else if (merchantIdStr && collectedMerchantIds.has(merchantIdStr)) {
          console.log(`ℹ️ 商户ID ${merchantIdStr} 已经收集过，跳过`);
        } else {
          console.warn(`⚠️ filtered_merchants[${index}] 缺少有效的 merchant_id:`, merchant);
        }
      } else {
        console.warn(`⚠️ filtered_merchants[${index}] 不是有效的商户记录:`, merchant);
      }
    });
  }
  if (obj.filteredMerchants && Array.isArray(obj.filteredMerchants)) {
    console.log(`🔍 发现 filteredMerchants 数组，包含 ${obj.filteredMerchants.length} 个元素`);
    obj.filteredMerchants.forEach((merchant, index) => {
      // 检查是否是商户记录（只要有 merchant_id 就收集，不强制要求 merchant_name）
      const hasMerchantId = merchant && typeof merchant === "object" && (merchant.merchant_id !== undefined || merchant.merchantId !== undefined);
      
      if (hasMerchantId) {
        const merchantId = merchant.merchant_id ?? merchant.merchantId;
        const merchantIdStr = merchantId ? String(merchantId) : null;
        
        if (merchantIdStr && !collectedMerchantIds.has(merchantIdStr)) {
          merchantEntries.push(merchant);
          collectedMerchantIds.add(merchantIdStr);
          console.log(`✅ 从 filteredMerchants[${index}] 收集到 merchant 记录: merchant_id=${merchantIdStr}, sub_merchant_name=${merchant.sub_merchant_name || merchant.subMerchantName || '(null)'}, main_merchant_name=${merchant.main_merchant_name || merchant.mainMerchantName || '(null)'}`);
        } else if (merchantIdStr && collectedMerchantIds.has(merchantIdStr)) {
          console.log(`ℹ️ 商户ID ${merchantIdStr} 已经收集过，跳过`);
        } else {
          console.warn(`⚠️ filteredMerchants[${index}] 缺少有效的 merchant_id:`, merchant);
        }
      } else {
        console.warn(`⚠️ filteredMerchants[${index}] 不是有效的商户记录:`, merchant);
      }
    });
  }
  
  // 如果是 merchant 记录，添加到 merchantEntries（避免重复）
  if (isMerchantRecord(obj)) {
    const merchantId = obj.merchant_id ?? obj.merchantId;
    const merchantIdStr = merchantId ? String(merchantId) : null;
    
    // 检查是否已经收集过（使用 merchant_id 作为唯一标识）
    if (merchantIdStr && !collectedMerchantIds.has(merchantIdStr)) {
      merchantEntries.push(obj);
      collectedMerchantIds.add(merchantIdStr);
      console.log(`✅ 收集到 merchant 记录: merchant_id=${merchantIdStr}, sub_merchant_name=${obj.sub_merchant_name || obj.subMerchantName || '(null)'}, main_merchant_name=${obj.main_merchant_name || obj.mainMerchantName || '(null)'}`);
    }
    // 即使已经收集过，也继续遍历（可能有嵌套结构）
  }
  
  // 如果是数组，遍历每个元素
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      collectMerchantRecords(item, path.concat(index), depth + 1);
    });
    return;
  }
  
  // 如果是对象，遍历每个属性
  Object.values(obj).forEach((value) => {
    if (value && typeof value === "object") {
      collectMerchantRecords(value, path, depth + 1);
    }
  });
};

inputs.forEach((input, index) => {
  const payload = input?.json;
  if (!payload) return;

  traverseForRates(payload, [`input[${index}]`]);

  if (!tenantToken && payload.tenant_access_token) {
    tenantToken = payload.tenant_access_token;
  }

  // 优先收集 merchant 记录（递归遍历）
  collectMerchantRecords(payload, [`input[${index}]`]);

  // 识别其他类型的记录（排除 merchant 记录）
  if (payload.row_number || payload.rowNumber) {
    mappingEntries.push(payload);
  } else if (
    !isMerchantRecord(payload) && (
      isUsersRecord(payload) ||
      isRevenueRecord(payload) ||
      isRetentionRecord(payload)
    )
  ) {
    metricEntries.push(payload);
  }
});

if (!tenantToken) {
  throw new Error("❌ 未找到 tenant_access_token");
}

// --- 构建 merchant_id -> {sub_merchant_name, main_merchant_name} 映射 -------

const merchantDictionary = new Map();
const merchantIdMap = new Map(); // 用于存储所有可能的 merchant_id 格式

merchantEntries.forEach((entry) => {
  // 支持多种字段名格式（camelCase 和 snake_case）
  const rawMerchantId = entry.merchant_id ?? entry.merchantId;
  if (rawMerchantId === undefined || rawMerchantId === null) {
    console.warn(`⚠️ 跳过无效的 merchant 记录: 缺少 merchant_id`, entry);
    return;
  }

  const merchantId = normalizeMerchantId(rawMerchantId);
  if (!merchantId) {
    console.warn(`⚠️ 跳过无效的 merchant 记录: merchant_id 规范化失败`, rawMerchantId);
    return;
  }

  const subMerchantName = cleanString(entry.sub_merchant_name ?? entry.subMerchantName);
  const mainMerchantName = cleanString(entry.main_merchant_name ?? entry.mainMerchantName);

  // 构建 merchant 信息对象
  const merchantInfo = {
    merchant_id: rawMerchantId,
    sub_merchant_name: subMerchantName || null,
    main_merchant_name: mainMerchantName || null,
  };
  
  // 如果没有 sub_merchant_name 和 main_merchant_name，输出警告
  if (!subMerchantName && !mainMerchantName) {
    console.warn(`⚠️ merchant_id ${rawMerchantId} 没有 sub_merchant_name 和 main_merchant_name`);
  }

  // 使用规范化后的 merchant_id 作为 key
  if (!merchantDictionary.has(merchantId)) {
    merchantDictionary.set(merchantId, merchantInfo);
  } else {
    // 如果已存在，更新信息（优先使用非空值）
    const existing = merchantDictionary.get(merchantId);
    if (!existing.sub_merchant_name && subMerchantName) {
      existing.sub_merchant_name = subMerchantName;
    }
    if (!existing.main_merchant_name && mainMerchantName) {
      existing.main_merchant_name = mainMerchantName;
    }
  }

  // 同时使用原始 merchant_id（数字格式）作为 key，以便匹配
  const merchantIdNum = tryParseNumber(rawMerchantId);
  if (merchantIdNum !== null) {
    const merchantIdStr = String(merchantIdNum);
    // 使用数字字符串作为 key（确保能够匹配字符串格式的 platform）
    if (!merchantDictionary.has(merchantIdStr)) {
      merchantDictionary.set(merchantIdStr, merchantInfo);
    }
    // 也使用数字作为 key（确保能够匹配数字格式的 platform）
    if (!merchantIdMap.has(merchantIdNum)) {
      merchantIdMap.set(merchantIdNum, merchantInfo);
    }
    // 也使用原始 merchant_id 的字符串格式作为 key（处理可能的格式差异）
    const rawMerchantIdStr = String(rawMerchantId);
    if (rawMerchantIdStr !== merchantIdStr && !merchantDictionary.has(rawMerchantIdStr)) {
      merchantDictionary.set(rawMerchantIdStr, merchantInfo);
    }
  } else {
    // 如果不是数字，使用原始值作为 key
    const rawMerchantIdStr = String(rawMerchantId);
    if (!merchantDictionary.has(rawMerchantIdStr)) {
      merchantDictionary.set(rawMerchantIdStr, merchantInfo);
    }
  }
});

console.log(`📊 收集到 ${merchantEntries.length} 个 merchant 记录`);
console.log(`📊 构建了 ${merchantDictionary.size} 个 merchant 映射（字符串格式）`);
console.log(`📊 构建了 ${merchantIdMap.size} 个 merchant 映射（数字格式）`);

// 检查特定的商户ID是否被收集
const testMerchantIds = [1751255752, 1751615057, 1751613252];
testMerchantIds.forEach(testId => {
  const testIdStr = String(testId);
  const hasInMap = merchantIdMap.has(testId);
  const hasInDict = merchantDictionary.has(testIdStr);
  const hasNormalized = merchantDictionary.has(normalizeMerchantId(testId));
  console.log(`🔍 检查商户ID ${testId}: merchantIdMap=${hasInMap}, merchantDictionary(${testIdStr})=${hasInDict}, merchantDictionary(规范化)=${hasNormalized}`);
  if (hasInMap) {
    const info = merchantIdMap.get(testId);
    console.log(`   ✅ 找到: sub_merchant_name=${info.sub_merchant_name || '(null)'}, main_merchant_name=${info.main_merchant_name || '(null)'}`);
  } else if (hasInDict) {
    const info = merchantDictionary.get(testIdStr);
    console.log(`   ✅ 找到: sub_merchant_name=${info.sub_merchant_name || '(null)'}, main_merchant_name=${info.main_merchant_name || '(null)'}`);
  } else {
    console.warn(`   ❌ 未找到商户ID ${testId}`);
  }
});

if (merchantDictionary.size > 0) {
  const sampleMerchants = Array.from(merchantDictionary.entries()).slice(0, 5);
  console.log(`📊 示例 merchant 映射:`);
  sampleMerchants.forEach(([id, info]) => {
    console.log(`   merchant_id: ${id} -> sub_merchant_name: ${info.sub_merchant_name || '(null)'}, main_merchant_name: ${info.main_merchant_name || '(null)'}`);
  });
} else {
  console.warn(`⚠️ 没有收集到任何 merchant 记录，将无法匹配商户名称`);
}

// 跟踪未匹配的商户ID
const unmatchedMerchantIds = new Set();

// 创建统一的商户ID匹配函数
const matchMerchantInfo = (platformValue, trackUnmatched = true) => {
  if (platformValue === undefined || platformValue === null) return null;
  
  const platformStr = String(platformValue).trim();
  if (!platformStr) return null;
  
  // 首先尝试将 platform 转换为数字进行匹配（最可靠的方式）
  const platformNum = tryParseNumber(platformValue);
  if (platformNum !== null) {
    // 1. 使用数字在 merchantIdMap 中查找（最快）
    if (merchantIdMap.has(platformNum)) {
      const merchantInfo = merchantIdMap.get(platformNum);
      return merchantInfo;
    }
    
    // 2. 使用数字字符串在 merchantDictionary 中查找
    const platformIdStr = String(platformNum);
    if (merchantDictionary.has(platformIdStr)) {
      const merchantInfo = merchantDictionary.get(platformIdStr);
      return merchantInfo;
    }
    
    // 3. 尝试规范化后的字符串
    const normalizedId = normalizeMerchantId(platformValue);
    if (normalizedId && merchantDictionary.has(normalizedId)) {
      const merchantInfo = merchantDictionary.get(normalizedId);
      return merchantInfo;
    }
    
    // 4. 尝试不同的数字字符串格式变体
    const variants = [
      platformIdStr,
      platformNum.toString(),
      platformStr,
      `"${platformNum}"`,
      `${platformNum}`,
    ];
    
    for (const variant of variants) {
      if (merchantDictionary.has(variant)) {
        const merchantInfo = merchantDictionary.get(variant);
        return merchantInfo;
      }
    }
  } else {
    // 如果不是数字，尝试直接字符串匹配
    if (merchantDictionary.has(platformStr)) {
      const merchantInfo = merchantDictionary.get(platformStr);
      return merchantInfo;
    }
    
    // 尝试规范化后的字符串
    const normalizedId = normalizeMerchantId(platformValue);
    if (normalizedId && merchantDictionary.has(normalizedId)) {
      const merchantInfo = merchantDictionary.get(normalizedId);
      return merchantInfo;
    }
  }
  
  // 如果没有匹配到，记录未匹配的商户ID
  if (trackUnmatched && merchantDictionary.size > 0) {
    unmatchedMerchantIds.add(platformStr);
    // 输出详细的调试信息
    console.warn(`❌ 未匹配到商户: platform="${platformStr}" (数字: ${platformNum}), merchantIdMap.size=${merchantIdMap.size}, merchantDictionary.size=${merchantDictionary.size}`);
    // 检查 merchantIdMap 中是否有相似的ID
    if (platformNum !== null) {
      const similarIds = Array.from(merchantIdMap.keys()).filter(id => Math.abs(id - platformNum) < 100).slice(0, 5);
      if (similarIds.length > 0) {
        console.warn(`   相似的商户ID: ${similarIds.join(', ')}`);
      }
    }
  }
  
  return null;
};

// --- 构建 game_code -> {english_name, release_date} 映射 --------------------

const gameDictionary = new Map();
mappingEntries.forEach((entry) => {
  const rowNumber = entry.row_number ?? entry.rowNumber;
  if (!rowNumber || rowNumber <= 4) return; // 跳过标题/说明行

  const english = cleanString(entry.col_5 ?? entry.english_name);
  const release = cleanString(entry["2025 GMP Games Info"] ?? entry.release_date);
  const rawCode = entry.game_code ?? entry.col_3;
  const gameCode = normalizeGameCode(rawCode);

  if (!english || !release || !gameCode || !/^\d{4}\/\d{2}$/.test(release)) {
    return;
  }

  if (!gameDictionary.has(gameCode)) {
    gameDictionary.set(gameCode, {
      english_name: english,
      release_date: release,
      display_name: `${english}：${release}`,
      table_name: `${english}-${release}`,
    });
  }
});

// --- 指标准备 -----------------------------------------------------------------

const metrics = {
  global: {
    users: null,
    revenue: null,
    retention_active: [], // 改为数组，存储所有没有 game_code 的留存数据
    retention_new: [], // 改为数组，存储所有没有 game_code 的留存数据
  },
  target: {
    users: [],
    revenue: [],
    retention_active: [],
    retention_new: [],
  },
};

const targetCodes = new Set();
const globalRevenueRaw = [];
const targetRevenueAccumulator = new Map();

metricEntries.forEach((entry) => {
  if (isUsersRecord(entry)) {
    // 匹配 platform 与 merchant_id（用户数据中的 platform 字段是商户ID）
    let merchantInfo = null;
    if (entry.platform !== undefined && entry.platform !== null) {
      merchantInfo = matchMerchantInfo(entry.platform);
      if (!merchantInfo && merchantDictionary.size > 0) {
        // 如果没有匹配到，输出调试信息
        const platformStr = String(entry.platform);
        const platformNum = tryParseNumber(entry.platform);
        console.warn(`⚠️ 用户数据未匹配到 merchant: platform="${platformStr}" (数字: ${platformNum})`);
      }
    }
    
    if (entry.game_code) {
      const code = normalizeGameCode(entry.game_code);
      if (!code) return;
      targetCodes.add(code);
      
      const userEntry = {
        game_code: code,
        unique_users: tryParseNumber(entry.unique_users) ?? 0,
      };
      
      // 添加平台信息（商户ID和商户名称）
      if (entry.platform !== undefined && entry.platform !== null) {
        const platformId = tryParseNumber(entry.platform) || entry.platform;
        userEntry.merchant_id = platformId;
        
        // 如果匹配到商户信息，使用商户名称作为 platform
        if (merchantInfo) {
          // 优先使用 sub_merchant_name，如果没有则使用 main_merchant_name
          if (merchantInfo.sub_merchant_name) {
            userEntry.platform = merchantInfo.sub_merchant_name;
            console.log(`✅ 目标游戏用户数据匹配成功: platform="${entry.platform}" -> sub_merchant_name: ${merchantInfo.sub_merchant_name}, merchant_id: ${merchantInfo.merchant_id}, game_code: ${code}`);
          } else if (merchantInfo.main_merchant_name) {
            userEntry.platform = merchantInfo.main_merchant_name;
            console.log(`✅ 目标游戏用户数据匹配成功: platform="${entry.platform}" -> main_merchant_name: ${merchantInfo.main_merchant_name}, merchant_id: ${merchantInfo.merchant_id}, game_code: ${code}`);
          } else {
            // 如果都没有，保留原始的 platform 值（商户ID）
            userEntry.platform = String(entry.platform);
            console.warn(`⚠️ merchant_id ${merchantInfo.merchant_id} 既没有 sub_merchant_name 也没有 main_merchant_name，保留原始 platform: ${entry.platform}`);
          }
          
          // 添加额外的商户信息字段
          userEntry.platform_name = merchantInfo.sub_merchant_name || merchantInfo.main_merchant_name || null;
          if (merchantInfo.main_merchant_name) {
            userEntry.main_merchant_name = merchantInfo.main_merchant_name;
          }
          if (merchantInfo.merchant_id) {
            userEntry.merchant_id = merchantInfo.merchant_id;
          }
        } else {
          // 如果没有匹配到，保留原始的 platform 值（商户ID）
          userEntry.platform = String(entry.platform);
          if (merchantDictionary.size > 0) {
            console.warn(`⚠️ 目标游戏用户数据未匹配到 merchant: platform="${entry.platform}" (数字: ${platformId}), game_code="${code}"`);
          }
        }
      }
      
      metrics.target.users.push(userEntry);
    } else {
      // 全游戏用户数据
      // 如果有 platform 字段，说明是按平台分组的数据
      if (entry.platform !== undefined && entry.platform !== null) {
        // 按平台分组的数据，应该作为数组存储
        if (!Array.isArray(metrics.global.users)) {
          metrics.global.users = [];
        }
        
        const platformId = tryParseNumber(entry.platform) || entry.platform;
        const platformUserEntry = {
          merchant_id: platformId,
          unique_users_total: tryParseNumber(entry.unique_users_total) ?? 0,
        };
        
        // 如果匹配到商户信息，使用商户名称作为 platform
        if (merchantInfo) {
          // 优先使用 sub_merchant_name，如果没有则使用 main_merchant_name
          if (merchantInfo.sub_merchant_name) {
            platformUserEntry.platform = merchantInfo.sub_merchant_name;
          } else if (merchantInfo.main_merchant_name) {
            platformUserEntry.platform = merchantInfo.main_merchant_name;
          } else {
            // 如果都没有，保留原始的 platform 值（商户ID）
            platformUserEntry.platform = String(entry.platform);
            console.warn(`⚠️ merchant_id ${merchantInfo.merchant_id} 既没有 sub_merchant_name 也没有 main_merchant_name，保留原始 platform: ${entry.platform}`);
          }
          
          // 添加额外的商户信息字段
          platformUserEntry.platform_name = merchantInfo.sub_merchant_name || merchantInfo.main_merchant_name || null;
          if (merchantInfo.main_merchant_name) {
            platformUserEntry.main_merchant_name = merchantInfo.main_merchant_name;
          }
          if (merchantInfo.merchant_id) {
            platformUserEntry.merchant_id = merchantInfo.merchant_id;
          }
        } else {
          // 如果没有匹配到，保留原始的 platform 值（商户ID）
          platformUserEntry.platform = String(entry.platform);
        }
        
        metrics.global.users.push(platformUserEntry);
      } else {
        // 没有 platform 字段，是汇总数据
        metrics.global.users = {
          unique_users_by_game: tryParseNumber(entry.unique_users_by_game) ?? 0,
          unique_users_total: tryParseNumber(entry.unique_users_total) ?? 0,
        };
      }
    }
    return;
  }

  if (isRevenueRecord(entry)) {
    const currency = normalizeCurrency(entry.currency) || "USDT";
    const amount = tryParseNumber(entry.total_amount) ?? 0;
    const payout = tryParseNumber(entry.total_pay_out) ?? 0;

    // 匹配 platform 与 merchant_id
    let merchantInfo = null;
    
    if (entry.platform !== undefined && entry.platform !== null) {
      merchantInfo = matchMerchantInfo(entry.platform);
      if (merchantInfo) {
        const platformStr = String(entry.platform);
        console.log(`✅ 收入数据匹配成功: platform="${platformStr}" -> sub_merchant_name: ${merchantInfo.sub_merchant_name || '(null)'}`);
      } else if (merchantDictionary.size > 0) {
        // 如果没有匹配到，输出调试信息
        const platformStr = String(entry.platform);
        const platformNum = tryParseNumber(entry.platform);
        console.warn(`⚠️ 收入数据未匹配到 merchant: platform="${platformStr}" (数字: ${platformNum})`);
      }
    }

    // 构建 revenue 记录（包含 merchant 信息）
    const revenueEntry = {
      currency,
      total_amount: amount,
      total_pay_out: payout,
    };

    // 如果匹配到 merchant 信息，使用 sub_merchant_name 作为 platform
    if (merchantInfo) {
      // 确保使用 sub_merchant_name 作为 platform（如果存在）
      if (merchantInfo.sub_merchant_name) {
        revenueEntry.platform = merchantInfo.sub_merchant_name;
      } else if (merchantInfo.main_merchant_name) {
        // 如果没有 sub_merchant_name，使用 main_merchant_name
        revenueEntry.platform = merchantInfo.main_merchant_name;
        console.warn(`⚠️ merchant_id ${merchantInfo.merchant_id} 没有 sub_merchant_name，使用 main_merchant_name: ${merchantInfo.main_merchant_name}`);
      } else {
        // 如果都没有，保留原始的 platform 值（这种情况不应该发生）
        revenueEntry.platform = cleanString(entry.platform) || null;
        console.warn(`⚠️ merchant_id ${merchantInfo.merchant_id} 既没有 sub_merchant_name 也没有 main_merchant_name，保留原始 platform: ${entry.platform}`);
      }
      revenueEntry.main_merchant_name = merchantInfo.main_merchant_name || null;
      revenueEntry.merchant_id = merchantInfo.merchant_id || null;
    } else if (entry.platform !== undefined && entry.platform !== null) {
      // 如果没有匹配到，但存在 platform 字段，保留原始值（商户ID）
      // 同时添加 merchant_id 字段，以便后续能够识别
      revenueEntry.platform = cleanString(entry.platform) || null;
      const platformNum = tryParseNumber(entry.platform);
      if (platformNum !== null) {
        revenueEntry.merchant_id = platformNum;
      } else {
        revenueEntry.merchant_id = entry.platform;
      }
    }

    // 判断是否有有效的 game_code
    // 规则：有 game_code 字段且不为空 = 指定游戏数据；没有 game_code 字段或为空 = 全平台数据
    const rawGameCode = entry.game_code ?? entry.gameCode ?? null;
    const hasGameCode = rawGameCode !== undefined && 
                        rawGameCode !== null && 
                        String(rawGameCode).trim() !== '';
    
    if (hasGameCode) {
      // 有 game_code，计入指定游戏
      const code = normalizeGameCode(rawGameCode);
      if (code) {
        targetCodes.add(code);

        if (!targetRevenueAccumulator.has(code)) {
          targetRevenueAccumulator.set(code, {
            game_code: code,
            entries: [],
          });
        }
        targetRevenueAccumulator.get(code).entries.push(revenueEntry);
        // 调试日志：记录分类结果（仅记录前10条，避免日志过多）
        if (targetRevenueAccumulator.get(code).entries.length <= 10) {
          console.log(`✅ 收入记录分类为指定游戏: game_code="${code}", platform="${entry.platform}", currency="${currency}", amount=${amount}`);
        }
      } else {
        // game_code 存在但规范化后无效，计入全平台（避免数据丢失）
        console.warn(`⚠️ 收入记录的 game_code 规范化后无效，计入全平台:`, rawGameCode);
        globalRevenueRaw.push(revenueEntry);
      }
    } else {
      // 没有 game_code 或 game_code 为空，计入全平台
      globalRevenueRaw.push(revenueEntry);
      // 调试日志：记录分类结果（仅记录前10条，避免日志过多）
      if (globalRevenueRaw.length <= 10) {
        console.log(`✅ 收入记录分类为全平台: platform="${entry.platform}", currency="${currency}", amount=${amount}`);
      }
    }
    return;
  }

  if (isRetentionRecord(entry)) {
    // 匹配 platform 与 merchant_id（留存数据中的 platform 字段是商户ID）
    let merchantInfo = null;
    if (entry.platform !== undefined && entry.platform !== null) {
      merchantInfo = matchMerchantInfo(entry.platform);
      if (!merchantInfo && merchantDictionary.size > 0) {
        // 如果没有匹配到，输出调试信息
        const platformStr = String(entry.platform);
        const platformNum = tryParseNumber(entry.platform);
        console.warn(`⚠️ 留存数据未匹配到 merchant: platform="${platformStr}" (数字: ${platformNum}), metric_type="${entry.metric_type || 'unknown'}"`);
      }
    }
    
    const formatted = formatRetentionRecord(entry);
    
    // 添加商户ID（platform 字段已经在 formatRetentionRecord 中保留）
    if (entry.platform !== undefined && entry.platform !== null) {
      const platformId = tryParseNumber(entry.platform) || entry.platform;
      formatted.merchant_id = platformId;
      
      // 如果匹配到商户信息，使用商户名称替换 platform 字段
      if (merchantInfo) {
        // 优先使用 sub_merchant_name，如果没有则使用 main_merchant_name
        if (merchantInfo.sub_merchant_name) {
          formatted.platform = merchantInfo.sub_merchant_name;
        } else if (merchantInfo.main_merchant_name) {
          formatted.platform = merchantInfo.main_merchant_name;
        } else {
          // 如果都没有，保留原始的 platform 值（商户ID）
          console.warn(`⚠️ merchant_id ${merchantInfo.merchant_id} 既没有 sub_merchant_name 也没有 main_merchant_name，保留原始 platform: ${entry.platform}`);
        }
        
        // 添加额外的商户信息字段
        formatted.platform_name = merchantInfo.sub_merchant_name || merchantInfo.main_merchant_name || null;
        if (merchantInfo.main_merchant_name) {
          formatted.main_merchant_name = merchantInfo.main_merchant_name;
        }
        if (merchantInfo.merchant_id) {
          formatted.merchant_id = merchantInfo.merchant_id;
        }
      }
      // 如果没有匹配到，platform 字段保留原始的商户ID（已在 formatRetentionRecord 中设置）
    }
    
    if (formatted.game_code) {
      targetCodes.add(formatted.game_code);
      if (formatted.metric_type === "active") {
        metrics.target.retention_active.push(formatted);
      } else if (formatted.metric_type === "new") {
        metrics.target.retention_new.push(formatted);
      }
    } else {
      // 没有 game_code 的留存数据，按平台（merchant_id）分组存储到全局数组中
      // 避免后续数据覆盖前面的数据
      if (formatted.metric_type === "active") {
        metrics.global.retention_active.push(formatted);
      } else if (formatted.metric_type === "new") {
        metrics.global.retention_new.push(formatted);
      }
    }
  }
});

// --- 汇率折算：全游戏 --------------------------------------------------------

console.log(`📊 全平台收入数据统计: 共 ${globalRevenueRaw.length} 条记录`);

let globalAmountUSDT = 0;
let globalPayoutUSDT = 0;

const globalRevenueBreakdown = globalRevenueRaw.map((item) => {
  const rate = getRate(item.currency);
  const amountUSDT = Number((item.total_amount * rate).toFixed(6));
  const payoutUSDT = Number((item.total_pay_out * rate).toFixed(6));
  globalAmountUSDT += amountUSDT;
  globalPayoutUSDT += payoutUSDT;

  const breakdownItem = {
    currency: item.currency,
    total_amount: item.total_amount,
    total_pay_out: item.total_pay_out,
    rate_used: rate,
    total_amount_usdt: amountUSDT,
    total_pay_out_usdt: payoutUSDT,
  };

  // 添加 merchant 信息（如果存在）
  if (item.platform !== undefined && item.platform !== null) {
    breakdownItem.platform = item.platform;
  }
  if (item.main_merchant_name !== undefined && item.main_merchant_name !== null) {
    breakdownItem.main_merchant_name = item.main_merchant_name;
  }
  if (item.merchant_id !== undefined && item.merchant_id !== null) {
    breakdownItem.merchant_id = item.merchant_id;
  }

  return breakdownItem;
});

if (globalRevenueRaw.length > 0) {
  metrics.global.revenue = {
    total_amount: Number(globalAmountUSDT.toFixed(2)),
    total_pay_out: Number(globalPayoutUSDT.toFixed(2)),
    total_amount_usdt: Number(globalAmountUSDT.toFixed(2)),
    total_pay_out_usdt: Number(globalPayoutUSDT.toFixed(2)),
    breakdown: globalRevenueBreakdown,
  };
  
  console.log(`📊 全平台收入计算结果: 总投注USDT=${globalAmountUSDT.toFixed(2)}, 总派奖USDT=${globalPayoutUSDT.toFixed(2)}, 净收入USDT=${(globalAmountUSDT - globalPayoutUSDT).toFixed(2)}`);
} else {
  console.log(`⚠️ 没有全平台收入数据`);
}

// --- 汇率折算：目标游戏 ------------------------------------------------------

console.log(`📊 目标游戏收入数据统计: 共 ${targetRevenueAccumulator.size} 个游戏`);

const targetRevenueList = [];
targetRevenueAccumulator.forEach((bucket) => {
  console.log(`📊 处理游戏 ${bucket.game_code}: 共 ${bucket.entries.length} 条收入记录`);
  let totalAmountUSDT = 0;
  let totalPayoutUSDT = 0;

  const breakdown = bucket.entries.map((item) => {
    const rate = getRate(item.currency);
    const amountUSDT = Number((item.total_amount * rate).toFixed(6));
    const payoutUSDT = Number((item.total_pay_out * rate).toFixed(6));
    totalAmountUSDT += amountUSDT;
    totalPayoutUSDT += payoutUSDT;

    const breakdownItem = {
      currency: item.currency,
      total_amount: item.total_amount,
      total_pay_out: item.total_pay_out,
      rate_used: rate,
      total_amount_usdt: amountUSDT,
      total_pay_out_usdt: payoutUSDT,
    };

    // 添加 merchant 信息（如果存在）
    if (item.platform !== undefined && item.platform !== null) {
      breakdownItem.platform = item.platform;
    }
    if (item.main_merchant_name !== undefined && item.main_merchant_name !== null) {
      breakdownItem.main_merchant_name = item.main_merchant_name;
    }
    if (item.merchant_id !== undefined && item.merchant_id !== null) {
      breakdownItem.merchant_id = item.merchant_id;
    }

    return breakdownItem;
  });

  targetRevenueList.push({
    game_code: bucket.game_code,
    total_amount: Number(totalAmountUSDT.toFixed(2)),
    total_pay_out: Number(totalPayoutUSDT.toFixed(2)),
    total_amount_usdt: Number(totalAmountUSDT.toFixed(2)),
    total_pay_out_usdt: Number(totalPayoutUSDT.toFixed(2)),
    breakdown,
  });
  
  console.log(`📊 游戏 ${bucket.game_code} 收入计算结果: 总投注USDT=${totalAmountUSDT.toFixed(2)}, 总派奖USDT=${totalPayoutUSDT.toFixed(2)}, 净收入USDT=${(totalAmountUSDT - totalPayoutUSDT).toFixed(2)}`);
});

metrics.target.revenue = targetRevenueList;

// --- 确定目标游戏（默认取第一个） -------------------------------------------

const sortedTargetCodes = Array.from(targetCodes).filter(Boolean);
const primaryGameCode = sortedTargetCodes[0] || null;
const targetGameInfo = primaryGameCode
  ? gameDictionary.get(primaryGameCode) || {
      english_name: primaryGameCode,
      release_date: "未知",
      display_name: `${primaryGameCode}（未匹配游戏列表）`,
      table_name: primaryGameCode,
    }
  : null;

const tableName = targetGameInfo ? targetGameInfo.table_name : "游戏指标汇总";

// --- 统计所有使用到的 platform 值（商户ID）并找出未匹配的 ---------------------
// 注意：这里需要从原始输入数据中收集 platform ID，而不是处理后的数据
// 因为处理后的数据中，platform 字段可能已经被替换为商户名称

const allPlatformIds = new Set();

// 从原始输入数据中收集所有 platform 值（商户ID）
metricEntries.forEach((entry) => {
  // 用户数据
  if (isUsersRecord(entry) && entry.platform !== undefined && entry.platform !== null) {
    const platformId = String(entry.platform).trim();
    if (platformId) allPlatformIds.add(platformId);
  }
  
  // 收入数据
  if (isRevenueRecord(entry) && entry.platform !== undefined && entry.platform !== null) {
    const platformId = String(entry.platform).trim();
    if (platformId) allPlatformIds.add(platformId);
  }
  
  // 留存数据
  if (isRetentionRecord(entry) && entry.platform !== undefined && entry.platform !== null) {
    const platformId = String(entry.platform).trim();
    if (platformId) allPlatformIds.add(platformId);
  }
});

// 找出所有未匹配的商户ID
const trulyUnmatchedIds = Array.from(allPlatformIds).filter((platformId) => {
  const platformNum = tryParseNumber(platformId);
  if (platformNum !== null && merchantIdMap.has(platformNum)) return false;
  const normalizedId = normalizeMerchantId(platformId);
  if (normalizedId && merchantDictionary.has(normalizedId)) return false;
  if (merchantDictionary.has(platformId)) return false;
  return true;
});

// --- 组装输出 ----------------------------------------------------------------

const exchangeRatesObject = Object.fromEntries(currencyRates);

const outputPayload = {
  tenant_token: tenantToken,
  table_name: tableName,
  target_game: targetGameInfo
    ? {
        game_code: primaryGameCode,
        english_name: targetGameInfo.english_name,
        release_date: targetGameInfo.release_date,
      }
    : null,
  mapped_games: sortedTargetCodes.map((code) => ({
    game_code: code,
    ...(gameDictionary.get(code) || {
      english_name: code,
      release_date: "未知",
      table_name: code,
    }),
  })),
  metrics,
  exchange_rates: exchangeRatesObject,
  exchange_rate_sources: Array.from(currencyRateSources),
  stats: {
    total_target_games: sortedTargetCodes.length,
    has_global_users: Boolean(metrics.global.users),
    has_global_revenue: Boolean(metrics.global.revenue),
    has_global_revenue_usdt:
      Boolean(metrics.global.revenue) &&
      Number.isFinite(metrics.global.revenue.total_amount_usdt),
    missing_currency_rates: Array.from(missingRateCurrencies),
    currency_rate_count: currencyRates.size,
    merchant_count: merchantDictionary.size,
    merchant_entries_count: merchantEntries.length,
    unmatched_merchant_ids: trulyUnmatchedIds,
    unmatched_merchant_ids_count: trulyUnmatchedIds.length,
  },
};

console.log("=== 游戏指标整理完成（含汇率换算和商户匹配） ===");
console.log("Lark 表名:", tableName);
console.log("目标游戏:", targetGameInfo || "未匹配");
console.log("汇率来源:", Array.from(currencyRateSources));
console.log("商户信息:", {
  merchant_count: merchantDictionary.size,
  merchant_entries_count: merchantEntries.length,
  total_platform_ids_used: allPlatformIds.size,
  unmatched_count: trulyUnmatchedIds.length,
  merchant_ids: Array.from(merchantDictionary.keys()).slice(0, 10), // 只显示前10个
});
if (trulyUnmatchedIds.length > 0) {
  console.warn(`⚠️ 未匹配的商户ID (${trulyUnmatchedIds.length} 个):`, trulyUnmatchedIds.slice(0, 20));
  if (trulyUnmatchedIds.length > 20) {
    console.warn(`   ... 还有 ${trulyUnmatchedIds.length - 20} 个未匹配的商户ID`);
  }
  // 显示已收集的商户ID，帮助用户对比
  if (merchantDictionary.size > 0) {
    const collectedMerchantIds = Array.from(merchantIdMap.keys()).map(String).slice(0, 10);
    console.warn(`   已收集的商户ID示例:`, collectedMerchantIds);
  }
}
console.log("指标概览:", {
  target_users: metrics.target.users.length,
  target_revenue: metrics.target.revenue.length,
  target_retention_active: metrics.target.retention_active.length,
  target_retention_new: metrics.target.retention_new.length,
  global_retention_active: metrics.global.retention_active.length,
  global_retention_new: metrics.global.retention_new.length,
});

// 输出收入数据详细对比
console.log("=== 收入数据对比 ===");
if (metrics.target.revenue.length > 0) {
  const targetTotal = metrics.target.revenue.reduce((sum, rev) => {
    return {
      total_amount_usdt: sum.total_amount_usdt + (rev.total_amount_usdt || 0),
      total_pay_out_usdt: sum.total_pay_out_usdt + (rev.total_pay_out_usdt || 0),
    };
  }, { total_amount_usdt: 0, total_pay_out_usdt: 0 });
  const targetNet = targetTotal.total_amount_usdt - targetTotal.total_pay_out_usdt;
  console.log("指定游戏收入汇总:", {
    total_amount_usdt: targetTotal.total_amount_usdt.toFixed(2),
    total_pay_out_usdt: targetTotal.total_pay_out_usdt.toFixed(2),
    net_usdt: targetNet.toFixed(2),
    game_count: metrics.target.revenue.length,
  });
} else {
  console.log("指定游戏收入汇总: 无数据");
}

if (metrics.global.revenue) {
  const globalNet = metrics.global.revenue.total_amount_usdt - metrics.global.revenue.total_pay_out_usdt;
  console.log("全平台收入汇总:", {
    total_amount_usdt: metrics.global.revenue.total_amount_usdt.toFixed(2),
    total_pay_out_usdt: metrics.global.revenue.total_pay_out_usdt.toFixed(2),
    net_usdt: globalNet.toFixed(2),
    breakdown_count: metrics.global.revenue.breakdown?.length || 0,
  });
} else {
  console.log("全平台收入汇总: 无数据");
}

return [
  {
    json: outputPayload,
  },
];

