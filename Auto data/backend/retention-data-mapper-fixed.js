// n8n Function节点：留存数据映射器（游戏+商户）- 修复版
// 修复：如果没有匹配的游戏名，使用游戏ID作为游戏名
// 处理新用户留存和活跃用户留存数据，同时完成游戏和商户的ID到名称映射

const inputs = $input.all();
console.log("=== 留存数据映射器开始（修复版） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 用于收集各种映射数据
const gameMappingEntries = [];
const merchantMappingEntries = [];
const retentionDataToProcess = [];

// 遍历所有输入项，智能识别数据类型
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  // 检查是否是游戏映射数据
  if (item.game_id && item.game_name && item.merchant_id) {
    console.log(`🎮 识别到游戏映射数据: ${item.game_name} (ID: ${item.game_id})`);
    gameMappingEntries.push(item);
  }
  // 检查是否是商户映射数据
  else if (item.sub_merchant_name && item.merchant_id && item.main_merchant_name) {
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
  // 检查是否是留存数据（新用户留存）
  else if (item.merchant && item.game_id && item.new_date && item.dataType === 'game_new') {
    console.log(`📊 识别到新用户留存数据: 商户ID ${item.merchant}, 游戏ID ${item.game_id}, 日期 ${item.new_date}`);
    retentionDataToProcess.push({ json: item });
  }
  // 检查是否是留存数据（活跃用户留存）
  else if (item.merchant && item.game_id && item.cohort_date && item.dataType === 'game_act') {
    console.log(`📊 识别到活跃用户留存数据: 商户ID ${item.merchant}, 游戏ID ${item.game_id}, 日期 ${item.cohort_date}`);
    retentionDataToProcess.push({ json: item });
  }
  // 检查是否是数组格式的数据
  else if (Array.isArray(item)) {
    item.forEach(subItem => {
      if (subItem && subItem.game_id && subItem.game_name && subItem.merchant_id) {
        console.log(`🎮 识别到数组中的游戏映射数据: ${subItem.game_name} (ID: ${subItem.game_id})`);
        gameMappingEntries.push(subItem);
      } else if (subItem && subItem.sub_merchant_name && subItem.merchant_id && subItem.main_merchant_name) {
        console.log(`🏪 识别到数组中的商户映射数据: ${subItem.sub_merchant_name} (ID: ${subItem.merchant_id})`);
        merchantMappingEntries.push(subItem);
      } else if (subItem && subItem.merchant && subItem.game_id && subItem.new_date && subItem.dataType === 'game_new') {
        console.log(`📊 识别到数组中的新用户留存数据: 商户ID ${subItem.merchant}, 游戏ID ${subItem.game_id}`);
        retentionDataToProcess.push({ json: subItem });
      } else if (subItem && subItem.merchant && subItem.game_id && subItem.cohort_date && subItem.dataType === 'game_act') {
        console.log(`📊 识别到数组中的活跃用户留存数据: 商户ID ${subItem.merchant}, 游戏ID ${subItem.game_id}`);
        retentionDataToProcess.push({ json: subItem });
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
if (gameMappingEntries.length === 0) {
  console.warn("⚠️ 没有找到游戏映射数据，将使用游戏ID作为游戏名");
}

if (merchantMappingEntries.length === 0) {
  console.error("❌ 没有找到商户映射数据，无法进行商户映射");
  return [];
}

if (retentionDataToProcess.length === 0) {
  console.warn("⚠️ 没有找到留存数据");
  return [];
}

// 构建游戏ID到游戏名的映射表
const gameIdToNameMap = new Map();
gameMappingEntries.forEach(game => {
  if (game.game_id && game.game_name) {
    gameIdToNameMap.set(game.game_id.toString(), game.game_name);
  }
});

// 构建商户ID到商户名的映射表
const merchantIdToNameMap = new Map();
const merchantIdToMainMerchantMap = new Map();

merchantMappingEntries.forEach(merchant => {
  if (merchant.merchant_id !== undefined && merchant.merchant_id !== null && merchant.sub_merchant_name) {
    const merchantIdStr = merchant.merchant_id.toString();
    merchantIdToNameMap.set(merchantIdStr, merchant.sub_merchant_name);
    merchantIdToMainMerchantMap.set(merchantIdStr, merchant.main_merchant_name || '未知主商户');
  }
});

console.log(`🎮 构建游戏映射表完成，共 ${gameIdToNameMap.size} 个游戏`);
console.log(`🏪 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
console.log("游戏映射表示例:", Array.from(gameIdToNameMap.entries()).slice(0, 3));
console.log("商户映射表示例:", Array.from(merchantIdToNameMap.entries()).slice(0, 3));

// 处理留存数据映射
const matchedResults = [];
let gameMatchedCount = 0;
let gameUnmatchedCount = 0;
let merchantMatchedCount = 0;
let merchantUnmatchedCount = 0;

retentionDataToProcess.forEach((item, index) => {
  const data = item.json;
  
  // 游戏映射
  const gameId = data.game_id ? data.game_id.toString() : null;
  const gameName = gameId ? gameIdToNameMap.get(gameId) : null;
  
  // 修复：如果游戏名未匹配，使用游戏ID作为游戏名
  const finalGameName = gameName || gameId;
  
  // 商户映射
  const merchantId = data.merchant ? data.merchant.toString() : null;
  const merchantName = merchantId ? merchantIdToNameMap.get(merchantId) : null;
  const mainMerchantName = merchantId ? merchantIdToMainMerchantMap.get(merchantId) : null;
  
  console.log(`🔍 处理留存数据 ${index}:`);
  console.log(`  游戏ID: ${gameId} -> ${gameName || gameId || '未找到'}`);
  console.log(`  商户ID: ${merchantId} -> ${merchantName || '未找到'}`);
  
  // 构建映射后的数据
  const mappedData = {
    ...data,
    // 游戏映射结果
    game: finalGameName,              // 修复：使用游戏名或游戏ID
    game_id: gameId,                  // 保留原始游戏ID
    game_matched: !!gameName,         // 游戏是否映射成功（是否找到了游戏名）
    game_name_used: finalGameName,    // 实际使用的游戏名（可能是游戏名或游戏ID）
    // 商户映射结果
    merchant: merchantName || data.merchant,  // 如果映射成功使用商户名，否则保留ID
    merchant_id: merchantId,                  // 保留原始商户ID
    main_merchant_name: mainMerchantName,     // 主商户名
    merchant_matched: !!merchantName,          // 商户是否映射成功
    // 整体匹配状态
    isFullyMatched: !!(gameName && merchantName),
    matchType: `${gameName ? 'game_ok' : 'game_id_fallback'}_${merchantName ? 'merchant_ok' : 'merchant_fail'}`
  };
  
  matchedResults.push({ json: mappedData });
  
  // 统计匹配结果
  if (gameName) {
    gameMatchedCount++;
    console.log(`✅ 游戏映射成功: ${gameId} -> ${gameName}`);
  } else {
    gameUnmatchedCount++;
    console.log(`⚠️ 游戏映射失败，使用游戏ID: ${gameId} -> ${gameId}`);
  }
  
  if (merchantName) {
    merchantMatchedCount++;
    console.log(`✅ 商户映射成功: ${merchantId} -> ${merchantName}`);
  } else {
    merchantUnmatchedCount++;
    console.log(`❌ 商户映射失败: 商户ID ${merchantId} 未找到对应商户名`);
  }
});

console.log(`=== 留存数据映射完成 ===`);
console.log(`📊 总共处理留存数据: ${retentionDataToProcess.length}`);
console.log(`🎮 游戏映射成功: ${gameMatchedCount}, 使用游戏ID: ${gameUnmatchedCount}`);
console.log(`🏪 商户映射成功: ${merchantMatchedCount}, 失败: ${merchantUnmatchedCount}`);
console.log(`📈 游戏映射率: ${retentionDataToProcess.length > 0 ? ((gameMatchedCount / retentionDataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);
console.log(`📈 商户映射率: ${retentionDataToProcess.length > 0 ? ((merchantMatchedCount / retentionDataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);

// 按游戏名和商户名排序，生成最终数据
const finalResults = [];

// 修复：获取所有游戏名（包括使用游戏ID的情况），然后排序
const allGameNames = Array.from(new Set(matchedResults.map(item => item.json.game_name_used || item.json.game))).filter(Boolean);

// 按游戏名A→Z排序（游戏ID通常是数字字符串，会排在前面）
const sortedGameNames = allGameNames.sort((a, b) => {
  return a.localeCompare(b, 'zh-CN', { numeric: true });
});

console.log("游戏排序结果（前10个）:", sortedGameNames.slice(0, 10));

// 为每个游戏生成数据
sortedGameNames.forEach(gameName => {
  // 获取该游戏的所有数据（使用 game_name_used 字段，包含游戏ID的情况）
  const gameData = matchedResults
    .filter(item => {
      const itemGameName = item.json.game_name_used || item.json.game;
      return itemGameName === gameName;
    })
    .map(item => item.json);
  
  // 按商户名分组
  const merchantGroups = {};
  gameData.forEach(item => {
    const merchantName = item.merchant;
    if (!merchantGroups[merchantName]) {
      merchantGroups[merchantName] = [];
    }
    merchantGroups[merchantName].push(item);
  });
  
  // 为每个商户生成数据
  Object.keys(merchantGroups).forEach(merchantName => {
    const merchantData = merchantGroups[merchantName];
    
    // 按日期排序（新用户留存用new_date，活跃用户留存用cohort_date）
    const sortedData = merchantData.sort((a, b) => {
      const dateA = a.new_date || a.cohort_date || '';
      const dateB = b.new_date || b.cohort_date || '';
      return dateA.localeCompare(dateB);
    });
    
    function formatPercent(val) {
      if (val === undefined || val === null || val === '') return '0%';
      const s = String(val).trim();
      if (s.endsWith('%')) return s;
      const num = parseFloat(s);
      if (Number.isNaN(num)) return '0%';
      return `${num}%`;
    }
    
    // 生成最终数据
    sortedData.forEach(item => {
      const finalItem = {
        游戏名: gameName,  // 修复：使用游戏名或游戏ID
        商户名: merchantName,
        日期: item.new_date || item.cohort_date,
        数据类型: item.dataType === 'game_new' ? '新用户留存' : '活跃用户留存',
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
      
      finalResults.push({ json: finalItem });
    });
  });
});

console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);
console.log("数据示例（前3条）:", finalResults.slice(0, 3).map(item => item.json));

// 统计使用游戏ID的数据
const gameIdUsedCount = finalResults.filter(item => {
  const gameName = item.json.游戏名;
  // 检查是否是纯数字字符串（游戏ID）
  return /^\d+$/.test(gameName);
}).length;
console.log(`📊 使用游戏ID作为游戏名的数据行数: ${gameIdUsedCount}`);

// 返回格式化的数据
return finalResults;

