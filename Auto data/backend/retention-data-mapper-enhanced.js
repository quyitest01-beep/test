// n8n Function节点：留存数据映射器（增强版）
// 处理新用户留存和活跃用户留存数据，同时完成游戏和商户的ID到名称映射
// 自动识别数据类型和日期范围

const inputs = $input.all();
console.log("=== 留存数据映射器开始（增强版）===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 日期计算工具函数
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(new Date(x.getFullYear(), x.getMonth(), x.getDate()), -day);
}

// 获取当前时间范围
const now = new Date();

// 计算上周（周一-周日）
function getPrevWeekRange(ref = new Date()) {
  const thisMon = mondayOfWeek(ref);
  const start = addDays(thisMon, -7);
  const end = addDays(start, 6);
  return {
    start: fmtDate(start),
    end: fmtDate(end),
    display: `${fmtDate(start)} 至 ${fmtDate(end)}`
  };
}

// 计算上上周
function getPrevPrevWeekRange(ref = new Date()) {
  const thisMon = mondayOfWeek(ref);
  const start = addDays(thisMon, -14);
  const end = addDays(start, 6);
  return {
    start: fmtDate(start),
    end: fmtDate(end),
    display: `${fmtDate(start)} 至 ${fmtDate(end)}`
  };
}

// 计算上个月
function getPrevMonthRange(ref = new Date()) {
  let y = ref.getFullYear();
  let m = ref.getMonth(); // 0..11
  if (m === 0) { y = y - 1; m = 12; }
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: fmtDate(new Date(y, m - 1, 1)),
    end: fmtDate(new Date(y, m - 1, lastDay)),
    display: `${y}年${pad2(m)}月`
  };
}

// 计算上上月
function getPrevPrevMonthRange(ref = new Date()) {
  let y = ref.getFullYear();
  let m = ref.getMonth(); // 0..11
  if (m <= 1) { 
    y = y - 1; 
    m = m + 10; // 如果当前是0月，上上月是12月
  } else {
    m = m - 2;
  }
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    start: fmtDate(new Date(y, m, 1)),
    end: fmtDate(new Date(y, m, lastDay)),
    display: `${y}年${pad2(m + 1)}月`
  };
}

// 计算时间范围
const lastWeek = getPrevWeekRange(now);
const prevWeek = getPrevPrevWeekRange(now);
const lastMonth = getPrevMonthRange(now);
const prevMonth = getPrevPrevMonthRange(now);

console.log("📅 时间范围配置:");
console.log("  上周:", lastWeek);
console.log("  上上周:", prevWeek);
console.log("  上月:", lastMonth);
console.log("  上上月:", prevMonth);

// 判断日期属于哪个时间范围
// periodType: 'weekly' 或 'monthly'，根据数据中是否有d14/d30字段来判断
function classifyDateRange(dateStr, periodType = 'weekly') {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.warn(`⚠️ 无效日期: ${dateStr}`);
    return null;
  }
  
  const dateFormatted = fmtDate(date);
  
  // 根据周期类型选择相应的范围判断
  if (periodType === 'monthly') {
    // 月度数据：判断是否在上月范围
    if (dateFormatted >= lastMonth.start && dateFormatted <= lastMonth.end) {
      return { range: 'last_month', type: '月度' };
    }
    
    // 判断是否在上上月范围
    if (dateFormatted >= prevMonth.start && dateFormatted <= prevMonth.end) {
      return { range: 'prev_month', type: '月度' };
    }
  } else {
    // 周度数据：判断是否在上周范围
    if (dateFormatted >= lastWeek.start && dateFormatted <= lastWeek.end) {
      return { range: 'last_week', type: '周度' };
    }
    
    // 判断是否在上上周范围
    if (dateFormatted >= prevWeek.start && dateFormatted <= prevWeek.end) {
      return { range: 'prev_week', type: '周度' };
    }
  }
  
  console.warn(`⚠️ 日期不在预期范围内: ${dateFormatted} (周期类型: ${periodType})`);
  return null;
}

// 判断留存数据类型（月度或周度）
// 根据数据中是否存在 d14_users 或 d30_users 字段来判断
function detectPeriodType(dataItem) {
  // 检查是否存在 d14_users 或 d30_users 字段（即使值为0或null，只要字段存在就认为是月度数据）
  const hasD14 = 'd14_users' in dataItem || 'd14_retention_rate' in dataItem;
  const hasD30 = 'd30_users' in dataItem || 'd30_retention_rate' in dataItem;
  
  if (hasD14 || hasD30) {
    return 'monthly';
  }
  return 'weekly';
}

// 用于收集各种映射数据
const gameMappingEntries = [];
const merchantMappingEntries = [];
const retentionDataToProcess = [];

// 遍历所有输入项，智能识别数据类型
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  // 检查是否是游戏映射数据（只要有game_id和game_name即可，merchant_id可以为null）
  if (item.game_id && item.game_name) {
    console.log(`🎮 识别到游戏映射数据: ${item.game_name} (ID: ${item.game_id.trim()})`);
    gameMappingEntries.push(item);
  }
  // 检查是否是商户映射数据
  else if (item.sub_merchant_name && item.merchant_id && item.main_merchant_name !== undefined) {
    console.log(`🏪 识别到商户映射数据: ${item.sub_merchant_name} (ID: ${item.merchant_id})`);
    merchantMappingEntries.push(item);
  }
  // 检查是否是包含 filtered_merchants 的对象
  else if (item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
    console.log(`🏪 识别到包含 filtered_merchants 的对象，共 ${item.filtered_merchants.length} 条`);
    item.filtered_merchants.forEach(merchant => {
      if (merchant.merchant_id && merchant.sub_merchant_name) {
        merchantMappingEntries.push(merchant);
      }
    });
  }
  // 检查是否是留存数据（通过字段自动识别）
  else if (item.merchant && item.game_id) {
    // 判断是新用户留存还是活跃用户留存
    let dataType = null;
    let dateField = null;
    let dateValue = null;
    
    // 先判断周期类型（月度或周度）
    const periodType = detectPeriodType(item);
    
    if (item.new_date) {
      dataType = 'game_new';
      dateField = 'new_date';
      dateValue = item.new_date;
      console.log(`📊 识别到新用户留存数据（有new_date字段，${periodType === 'monthly' ? '月度' : '周度'}）: 商户ID ${item.merchant}, 游戏ID ${item.game_id}, 日期 ${item.new_date}`);
    } else if (item.cohort_date) {
      dataType = 'game_act';
      dateField = 'cohort_date';
      dateValue = item.cohort_date;
      console.log(`📊 识别到活跃用户留存数据（有cohort_date字段，${periodType === 'monthly' ? '月度' : '周度'}）: 商户ID ${item.merchant}, 游戏ID ${item.game_id}, 日期 ${item.cohort_date}`);
    }
    
    if (dataType) {
      retentionDataToProcess.push({ 
        json: {
          ...item,
          dataType,
          dateField,
          dateValue,
          periodType  // 添加周期类型标记
        }
      });
    }
  }
  // 检查是否是数组格式的数据
  else if (Array.isArray(item)) {
    item.forEach(subItem => {
      if (subItem && subItem.game_id && subItem.game_name) {
        console.log(`🎮 识别到数组中的游戏映射数据: ${subItem.game_name} (ID: ${subItem.game_id.trim()})`);
        gameMappingEntries.push(subItem);
      } else if (subItem && subItem.sub_merchant_name && subItem.merchant_id) {
        console.log(`🏪 识别到数组中的商户映射数据: ${subItem.sub_merchant_name} (ID: ${subItem.merchant_id})`);
        merchantMappingEntries.push(subItem);
      } else if (subItem && subItem.merchant && subItem.game_id) {
        // 判断数据类型
        let dataType = null;
        let dateField = null;
        let dateValue = null;
        
        // 先判断周期类型（月度或周度）
        const periodType = detectPeriodType(subItem);
        
        if (subItem.new_date) {
          dataType = 'game_new';
          dateField = 'new_date';
          dateValue = subItem.new_date;
        } else if (subItem.cohort_date) {
          dataType = 'game_act';
          dateField = 'cohort_date';
          dateValue = subItem.cohort_date;
        }
        
        if (dataType) {
          retentionDataToProcess.push({ 
            json: {
              ...subItem,
              dataType,
              dateField,
              dateValue,
              periodType  // 添加周期类型标记
            }
          });
        }
      }
    });
  }
  // 其他情况
  else {
    console.log(`⚠️ 无法识别的数据项 (索引: ${index})，数据字段: ${Object.keys(item).join(', ')}`);
  }
});

console.log(`🎮 收集到游戏映射数据: ${gameMappingEntries.length} 条`);
console.log(`🏪 收集到商户映射数据: ${merchantMappingEntries.length} 条`);
console.log(`📊 收集到留存数据: ${retentionDataToProcess.length} 条`);

// 检查是否收集到必要的映射数据
if (retentionDataToProcess.length === 0) {
  console.warn("⚠️ 没有找到留存数据");
  return [];
}

// 构建游戏ID到游戏名的映射表
const gameIdToNameMap = new Map();
if (gameMappingEntries.length > 0) {
  gameMappingEntries.forEach(game => {
    if (game.game_id && game.game_name) {
      // 清理game_id和game_name的空白字符
      const gameIdClean = game.game_id.toString().trim();
      const gameNameClean = game.game_name.toString().trim();
      gameIdToNameMap.set(gameIdClean, gameNameClean);
      console.log(`  添加映射: ${gameIdClean} -> ${gameNameClean}`);
    }
  });
  console.log(`🎮 构建游戏映射表完成，共 ${gameIdToNameMap.size} 个游戏`);
  console.log(`映射表示例:`, Array.from(gameIdToNameMap.entries()).slice(0, 3));
} else {
  console.warn("⚠️ 没有游戏映射数据，将使用游戏ID");
}

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

if (merchantMappingEntries.length > 0) {
  merchantMappingEntries.forEach(merchant => {
    if (merchant.merchant_id !== undefined && merchant.merchant_id !== null && merchant.sub_merchant_name) {
      const merchantIdStr = merchant.merchant_id.toString();
      merchantIdToNameMap.set(merchantIdStr, merchant.sub_merchant_name);
      merchantIdToMainMerchantMap.set(merchantIdStr, merchant.main_merchant_name || '未知主商户');
    }
  });
  console.log(`🏪 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
} else {
  console.warn("⚠️ 没有商户映射数据，将使用商户ID");
}

// 处理留存数据映射
const matchedResults = [];
let gameMatchedCount = 0;
let gameUnmatchedCount = 0;
let merchantMatchedCount = 0;
let merchantUnmatchedCount = 0;

retentionDataToProcess.forEach((item, index) => {
  const data = item.json;
  
  // 游戏映射（清理空白字符）
  const gameId = data.game_id ? data.game_id.toString().trim() : null;
  const gameName = gameId && gameIdToNameMap.size > 0 ? gameIdToNameMap.get(gameId) : null;
  
  // 商户映射
  const merchantId = data.merchant ? data.merchant.toString() : null;
  const merchantName = merchantId && merchantIdToNameMap.size > 0 ? merchantIdToNameMap.get(merchantId) : null;
  const mainMerchantName = merchantId && merchantIdToMainMerchantMap.size > 0 ? merchantIdToMainMerchantMap.get(merchantId) : null;
  
  // 日期范围分类（使用周期类型）
  const periodType = data.periodType || 'weekly'; // 默认周度
  const dateInfo = classifyDateRange(data.dateValue, periodType);
  const dateRange = dateInfo ? dateInfo.range : 'unknown';
  const rangeType = dateInfo ? dateInfo.type : '未知';
  
  console.log(`🔍 处理留存数据 ${index}:`);
  console.log(`  周期类型: ${periodType === 'monthly' ? '月度' : '周度'}`);
  console.log(`  游戏ID: ${gameId} -> ${gameName || '未找到'}`);
  console.log(`  商户ID: ${merchantId} -> ${merchantName || '未找到'}`);
  console.log(`  日期: ${data.dateValue} -> ${dateRange} (${rangeType})`);
  
  // 构建映射后的数据
  const mappedData = {
    ...data,
    // 游戏映射结果
    game: gameName || data.game_id,  // 如果映射成功使用游戏名，否则保留ID
    game_id: gameId,                 // 保留原始游戏ID
    game_matched: !!gameName,        // 游戏是否映射成功
    // 商户映射结果
    merchant_name: merchantName || data.merchant,  // 如果映射成功使用商户名，否则保留ID
    merchant_id: merchantId,                       // 保留原始商户ID
    main_merchant_name: mainMerchantName || '未知主商户',     // 主商户名
    merchant_matched: !!merchantName,              // 商户是否映射成功
    // 日期范围信息
    date_range: dateRange,
    date_range_type: rangeType,
    periodType: periodType,  // 保留周期类型（月度/周度）
    // 整体匹配状态
    isFullyMatched: !!(gameName && merchantName),
    matchType: `${gameName ? 'game_ok' : 'game_fail'}_${merchantName ? 'merchant_ok' : 'merchant_fail'}`
  };
  
  matchedResults.push({ json: mappedData });
  
  // 统计匹配结果
  if (gameName) {
    gameMatchedCount++;
  } else if (gameId && gameIdToNameMap.size > 0) {
    gameUnmatchedCount++;
  }
  
  if (merchantName) {
    merchantMatchedCount++;
  } else if (merchantId && merchantIdToNameMap.size > 0) {
    merchantUnmatchedCount++;
  }
});

console.log(`=== 留存数据映射完成 ===`);
console.log(`📊 总共处理留存数据: ${retentionDataToProcess.length}`);
console.log(`🎮 游戏映射成功: ${gameMatchedCount}, 失败: ${gameUnmatchedCount}`);
console.log(`🏪 商户映射成功: ${merchantMatchedCount}, 失败: ${merchantUnmatchedCount}`);

// 按游戏名和商户名排序，生成最终数据
const finalResults = [];

function formatPercent(val) {
  if (val === undefined || val === null || val === '') return '0%';
  const s = String(val).trim();
  if (s.endsWith('%')) return s;
  const num = parseFloat(s);
  if (Number.isNaN(num)) return '0%';
  return `${num}%`;
}

// 按游戏名排序
const sortedGameNames = Array.from(new Set(matchedResults
  .map(item => item.json.game)
)).sort((a, b) => {
  return a.toString().localeCompare(b.toString(), 'zh-CN', { numeric: true });
});

console.log("游戏排序结果:", sortedGameNames.slice(0, 10));

// 为每个游戏生成数据
sortedGameNames.forEach(gameName => {
  // 获取该游戏的所有数据
  const gameData = matchedResults
    .filter(item => item.json.game === gameName)
    .map(item => item.json);
  
  // 按商户名分组
  const merchantGroups = {};
  gameData.forEach(item => {
    const merchantName = item.merchant_name;
    if (!merchantGroups[merchantName]) {
      merchantGroups[merchantName] = [];
    }
    merchantGroups[merchantName].push(item);
  });
  
  // 为每个商户生成数据
  Object.keys(merchantGroups).forEach(merchantName => {
    const merchantData = merchantGroups[merchantName];
    
    // 按日期排序
    const sortedData = merchantData.sort((a, b) => {
      const dateA = a.new_date || a.cohort_date || '';
      const dateB = b.new_date || b.cohort_date || '';
      return dateA.localeCompare(dateB);
    });
    
    // 生成最终数据
    sortedData.forEach(item => {
      const dateValue = item.dateValue;
      const dataType = item.dataType === 'game_new' ? '新用户留存' : '活跃用户留存';
      
      const finalItem = {
        游戏名: gameName,
        商户名: merchantName,
        日期: dateValue,
        数据类型: dataType,
        时间范围: item.date_range,
        时间范围类型: item.date_range_type,
        当日用户数: parseInt(item.d0_users || 0),
        次日用户数: parseInt(item.d1_users || 0),
        次日留存率: formatPercent(item.d1_retention_rate),
        "3日用户数": parseInt(item.d3_users || 0),
        "3日留存率": formatPercent(item.d3_retention_rate),
        "7日用户数": parseInt(item.d7_users || 0),
        "7日留存率": formatPercent(item.d7_retention_rate)
      };
      
      // 动态添加14日留存数据（如果存在）
      if (item.d14_users !== undefined || item.d14_retention_rate !== undefined) {
        finalItem["14日用户数"] = parseInt(item.d14_users || 0);
        finalItem["14日留存率"] = formatPercent(item.d14_retention_rate);
      }
      
      // 动态添加30日留存数据（如果存在）
      if (item.d30_users !== undefined || item.d30_retention_rate !== undefined) {
        finalItem["30日用户数"] = parseInt(item.d30_users || 0);
        finalItem["30日留存率"] = formatPercent(item.d30_retention_rate);
      }
      
      // 添加映射状态信息（用于调试）
      finalItem.game_matched = item.game_matched;
      finalItem.merchant_matched = item.merchant_matched;
      
      finalResults.push({ json: finalItem });
    });
  });
});

console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);
console.log("数据示例:", finalResults.slice(0, 3).map(item => item.json));

// 返回格式化的数据
return finalResults;
