// n8n Function节点：留存数据映射器（游戏+商户）- 修复版
// 修复：正确处理xiayou.json和shangy.json数据结构，输出完整的留存数据格式
// 输出格式：游戏名、商户名、币种、日期、数据类型、当日用户数、次日用户数、次日留存率、3日用户数、3日留存率、7日用户数、7日留存率

const inputs = $input.all();
console.log("=== 留存数据映射器开始（修复版） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
    console.error("❌ 没有输入数据");
    return [];
}

// 用于收集各种数据
const gameMappingEntries = [];
const merchantMappingEntries = [];
const retentionDataToProcess = [];
const revenueDataWithCurrency = [];

// 遍历所有输入项，智能识别数据类型
inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 300) + "...");

    // 检查是否是xiayou.json格式的数据（包含metrics结构）
    if (item.metrics && item.metrics.global) {
        console.log(`📊 识别到xiayou.json格式数据`);
        
        // 提取游戏信息
        if (item.target_game) {
            console.log(`🎮 找到目标游戏: ${item.target_game.english_name} (${item.target_game.game_code})`);
        }
        
        // 提取商户映射信息（从metrics.global.users）
        if (item.metrics.global.users && Array.isArray(item.metrics.global.users)) {
            console.log(`🏪 找到商户用户数据: ${item.metrics.global.users.length} 条`);
            item.metrics.global.users.forEach(user => {
                if (user.merchant_id && user.platform_name) {
                    const merchantData = {
                        merchant_id: user.merchant_id,
                        sub_merchant_name: user.platform_name || user.platform,
                        main_merchant_name: user.main_merchant_name || '未知主商户'
                    };
                    merchantMappingEntries.push(merchantData);
                    console.log(`  添加商户映射: ${user.merchant_id} -> ${user.platform_name} (${user.main_merchant_name})`);
                }
            });
        }
        
        // 提取留存数据
        if (item.metrics.global.retention_new && Array.isArray(item.metrics.global.retention_new)) {
            console.log(`📊 找到新用户留存数据: ${item.metrics.global.retention_new.length} 条`);
            item.metrics.global.retention_new.forEach(retention => {
                retentionDataToProcess.push({
                    json: {
                        ...retention,
                        dataType: 'new_user_retention',
                        game_code: item.target_game?.game_code || null,
                        game_name: item.target_game?.english_name || null,
                        release_date: item.target_game?.release_date || null
                    }
                });
            });
        }
        
        if (item.metrics.global.retention_active && Array.isArray(item.metrics.global.retention_active)) {
            console.log(`📊 找到活跃用户留存数据: ${item.metrics.global.retention_active.length} 条`);
            item.metrics.global.retention_active.forEach(retention => {
                retentionDataToProcess.push({
                    json: {
                        ...retention,
                        dataType: 'active_user_retention',
                        game_code: item.target_game?.game_code || null,
                        game_name: item.target_game?.english_name || null,
                        release_date: item.target_game?.release_date || null
                    }
                });
            });
        }
        
        // 提取营收数据（包含币种信息）
        if (item.metrics.global.revenue && item.metrics.global.revenue.breakdown && Array.isArray(item.metrics.global.revenue.breakdown)) {
            console.log(`💰 找到营收数据: ${item.metrics.global.revenue.breakdown.length} 条`);
            item.metrics.global.revenue.breakdown.forEach(revenue => {
                revenueDataWithCurrency.push({
                    merchant_id: revenue.merchant_id,
                    platform: revenue.platform,
                    currency: revenue.currency,
                    main_merchant_name: revenue.main_merchant_name
                });
            });
        }
        
        return; // 处理完这个项目后继续下一个
    }

    // 检查是否是shangy.json格式的数据（包含status、statistics、filtered_merchants）
    if (item.status && item.statistics && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
        console.log(`🏪 识别到shangy.json格式数据，包含 ${item.filtered_merchants.length} 个商户`);
        item.filtered_merchants.forEach(merchant => {
            if (merchant.merchant_id && merchant.sub_merchant_name) {
                // 处理merchant_id可能是字符串的情况
                const merchantData = {
                    ...merchant,
                    merchant_id: typeof merchant.merchant_id === 'string' ? 
                        (merchant.merchant_id === '未开通' ? merchant.merchant_id : parseInt(merchant.merchant_id)) : 
                        merchant.merchant_id
                };
                merchantMappingEntries.push(merchantData);
                console.log(`  添加商户: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id})`);
            }
        });
        return; // 处理完这个项目后继续下一个
    }

    // 检查是否是游戏映射数据
    if (item.game_id && item.game) {
        console.log(`🎮 识别到游戏映射数据: ${item.game} (ID: ${item.game_id})`);
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
            if (subItem && subItem.game_id && subItem.game) {
                console.log(`🎮 识别到数组中的游戏映射数据: ${subItem.game} (ID: ${subItem.game_id})`);
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
console.log(`💰 收集到营收数据（含币种）: ${revenueDataWithCurrency.length} 条`);

// 如果没有留存数据，检查是否有商户映射数据或游戏映射数据
if (retentionDataToProcess.length === 0) {
    console.warn("⚠️ 没有找到留存数据");
    
    // 优先输出商户映射数据
    if (merchantMappingEntries.length > 0) {
        console.log("✅ 找到商户映射数据，输出商户映射信息");
        const merchantMappingResults = [];
        
        merchantMappingEntries.forEach((merchant, index) => {
            const merchantItem = {
                商户名: merchant.sub_merchant_name || '未知商户',
                主商户名: merchant.main_merchant_name || '未知主商户',
                商户ID: merchant.merchant_id || '未知ID',
                数据类型: '商户映射',
                处理状态: '映射成功',
                索引: index + 1
            };
            
            merchantMappingResults.push({ json: merchantItem });
            
            if (index < 5) { // 只显示前5条的详细日志
                console.log(`🏪 商户映射 ${index + 1}: ${merchant.sub_merchant_name} (ID: ${merchant.merchant_id}) -> ${merchant.main_merchant_name}`);
            }
        });
        
        console.log(`📈 生成商户映射数据: ${merchantMappingResults.length} 条`);
        console.log("商户映射示例（前3条）:", merchantMappingResults.slice(0, 3).map(item => item.json));
        
        return merchantMappingResults;
    }
    
    // 如果没有商户映射，检查游戏映射数据
    if (gameMappingEntries.length > 0) {
        console.log("✅ 找到游戏映射数据，输出游戏映射信息");
        const gameMappingResults = [];
        
        gameMappingEntries.forEach((game, index) => {
            const gameItem = {
                游戏名: game.game || '未知游戏',
                游戏ID: game.game_id || '未知ID',
                数据类型: '游戏映射',
                处理状态: '映射成功',
                索引: index + 1
            };
            
            gameMappingResults.push({ json: gameItem });
            
            if (index < 5) { // 只显示前5条的详细日志
                console.log(`🎮 游戏映射 ${index + 1}: ${game.game} (ID: ${game.game_id})`);
            }
        });
        
        console.log(`📈 生成游戏映射数据: ${gameMappingResults.length} 条`);
        console.log("游戏映射示例（前3条）:", gameMappingResults.slice(0, 3).map(item => item.json));
        
        return gameMappingResults;
    }
    
    console.warn("⚠️ 没有找到任何可处理的数据");
    return [];
}

// 构建商户ID到币种的映射表
const merchantIdToCurrencyMap = new Map();
revenueDataWithCurrency.forEach(revenue => {
    if (revenue.merchant_id && revenue.currency) {
        const merchantIdStr = revenue.merchant_id.toString();
        if (!merchantIdToCurrencyMap.has(merchantIdStr)) {
            merchantIdToCurrencyMap.set(merchantIdStr, []);
        }
        const currencies = merchantIdToCurrencyMap.get(merchantIdStr);
        if (!currencies.includes(revenue.currency)) {
            currencies.push(revenue.currency);
        }
    }
});

console.log(`💰 构建商户币种映射表完成，共 ${merchantIdToCurrencyMap.size} 个商户`);
console.log("商户币种映射表示例:", Array.from(merchantIdToCurrencyMap.entries()).slice(0, 5));

// 构建游戏ID到游戏名的映射表
const gameIdToNameMap = new Map();
gameMappingEntries.forEach(game => {
    if (game.game_id && game.game) {
        gameIdToNameMap.set(game.game_id.toString(), game.game);
    }
});

// 构建商户ID到商户名的映射表（使用shangy.json的数据）
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

// 处理留存数据映射
const finalResults = [];
let gameMatchedCount = 0;
let gameUnmatchedCount = 0;
let merchantMatchedCount = 0;
let merchantUnmatchedCount = 0;

retentionDataToProcess.forEach((item, index) => {
    const data = item.json;
    
    // 游戏信息处理
    let gameName = data.game_name || data.game || null;
    let gameCode = data.game_code || null;
    
    // 如果没有游戏名但有game_code，尝试从映射表获取
    if (!gameName && gameCode) {
        gameName = gameIdToNameMap.get(gameCode.toString()) || gameCode;
    }
    
    // 如果还是没有游戏名，使用默认值
    if (!gameName) {
        gameName = gameCode || '未知游戏';
    }
    
    // 商户信息处理 - 优先使用shangy.json的映射数据
    const merchantId = data.merchant_id ? data.merchant_id.toString() : null;
    let merchantName = null;
    let mainMerchantName = null;
    
    // 首先尝试从shangy.json映射表获取商户名
    if (merchantId && merchantIdToNameMap.has(merchantId)) {
        merchantName = merchantIdToNameMap.get(merchantId);
        mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);
        console.log(`✅ 商户映射成功: ID ${merchantId} -> ${merchantName} (${mainMerchantName})`);
    } else {
        // 如果映射表中没有，使用原始数据
        merchantName = data.platform_name || data.platform || merchantId || '未知商户';
        mainMerchantName = data.main_merchant_name || '未知主商户';
        console.log(`⚠️ 商户映射失败: ID ${merchantId}，使用原始数据: ${merchantName}`);
    }
    
    // 币种信息处理
    let currencies = [];
    if (merchantId && merchantIdToCurrencyMap.has(merchantId)) {
        currencies = merchantIdToCurrencyMap.get(merchantId);
    }
    const currencyStr = currencies.length > 0 ? currencies.join(', ') : '未知币种';
    
    // 日期信息处理
    let dateStr = data.release_date || data.new_date || data.cohort_date || '未知日期';
    
    // 数据类型处理
    let dataTypeStr = '';
    if (data.dataType === 'new_user_retention' || data.metric_type === 'new') {
        dataTypeStr = '新用户留存';
    } else if (data.dataType === 'active_user_retention' || data.metric_type === 'active') {
        dataTypeStr = '活跃用户留存';
    } else {
        dataTypeStr = '留存数据';
    }
    
    console.log(`🔍 处理留存数据 ${index}:`);
    console.log(`  游戏: ${gameName} (${gameCode || 'N/A'})`);
    console.log(`  商户: ${merchantName} (ID: ${merchantId}) -> 主商户: ${mainMerchantName}`);
    console.log(`  币种: ${currencyStr}`);
    console.log(`  日期: ${dateStr}`);
    console.log(`  类型: ${dataTypeStr}`);
    
    // 格式化百分比函数
    function formatPercent(val) {
        if (val === undefined || val === null || val === '') return '0%';
        const s = String(val).trim();
        if (s.endsWith('%')) return s;
        const num = parseFloat(s);
        if (Number.isNaN(num)) return '0%';
        return `${num}%`;
    }
    
    // 构建最终数据
    const finalItem = {
        游戏名: gameName,
        商户名: merchantName || '未知商户',
        主商户名: mainMerchantName || '未知主商户',
        币种: currencyStr,
        日期: dateStr,
        数据类型: dataTypeStr,
        当日用户数: parseInt(data.d0_users || 0),
        次日用户数: parseInt(data.d1_users || 0),
        次日留存率: formatPercent(data.d1_retention_rate),
        "3日用户数": parseInt(data.d3_users || 0),
        "3日留存率": formatPercent(data.d3_retention_rate),
        "7日用户数": parseInt(data.d7_users || 0),
        "7日留存率": formatPercent(data.d7_retention_rate)
    };
    
    // 动态添加14日留存数据（如果存在）
    if (data.d14_users !== undefined || data.d14_retention_rate !== undefined) {
        finalItem["14日用户数"] = parseInt(data.d14_users || 0);
        finalItem["14日留存率"] = formatPercent(data.d14_retention_rate);
    }
    
    // 动态添加30日留存数据（如果存在）
    if (data.d30_users !== undefined || data.d30_retention_rate !== undefined) {
        finalItem["30日用户数"] = parseInt(data.d30_users || 0);
        finalItem["30日留存率"] = formatPercent(data.d30_retention_rate);
    }
    
    finalResults.push({ json: finalItem });
    
    // 统计匹配结果
    if (gameName && gameName !== '未知游戏') {
        gameMatchedCount++;
    } else {
        gameUnmatchedCount++;
    }
    
    if (merchantName && merchantName !== '未知商户') {
        merchantMatchedCount++;
    } else {
        merchantUnmatchedCount++;
    }
});

console.log(`=== 留存数据映射完成 ===`);
console.log(`📊 总共处理留存数据: ${retentionDataToProcess.length}`);
console.log(`🎮 游戏映射成功: ${gameMatchedCount}, 失败: ${gameUnmatchedCount}`);
console.log(`🏪 商户映射成功: ${merchantMatchedCount}, 失败: ${merchantUnmatchedCount}`);
console.log(`📈 游戏映射率: ${retentionDataToProcess.length > 0 ? ((gameMatchedCount / retentionDataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);
console.log(`📈 商户映射率: ${retentionDataToProcess.length > 0 ? ((merchantMatchedCount / retentionDataToProcess.length) * 100).toFixed(1) + '%' : '0%'}`);
console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);

// 按主商户名、商户名、游戏名、数据类型排序
finalResults.sort((a, b) => {
    const mainMerchantCompare = a.json.主商户名.localeCompare(b.json.主商户名, 'zh-CN', { numeric: true });
    if (mainMerchantCompare !== 0) return mainMerchantCompare;
    
    const merchantCompare = a.json.商户名.localeCompare(b.json.商户名, 'zh-CN', { numeric: true });
    if (merchantCompare !== 0) return merchantCompare;
    
    const gameCompare = a.json.游戏名.localeCompare(b.json.游戏名, 'zh-CN', { numeric: true });
    if (gameCompare !== 0) return gameCompare;
    
    return a.json.数据类型.localeCompare(b.json.数据类型, 'zh-CN');
});

console.log("数据示例（前3条）:", finalResults.slice(0, 3).map(item => item.json));

// 返回格式化的数据
return finalResults;