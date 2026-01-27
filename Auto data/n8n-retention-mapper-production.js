// N8N Code Node - 生产环境留存数据映射器
// 适用于实际的 shangy.json 和 xiayou.json 数据结构

const inputs = $input.all();
console.log("=== 留存数据映射器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
    console.error("❌ 没有输入数据");
    throw new Error("没有输入数据。请确保连接了数据源节点。");
}

// 用于收集各种数据
const merchantMappingEntries = [];
const retentionDataToProcess = [];
const revenueDataWithCurrency = [];

// 遍历所有输入项，智能识别数据类型
inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    
    // 调试：显示每个输入项的关键字段
    const itemKeys = Object.keys(item).slice(0, 10).join(', ');
    console.log(`📋 项目 ${index} 的字段: ${itemKeys}...`);
    
    // 检查是否是xiayou.json格式的数据（包含metrics结构）
    if (item.metrics && item.metrics.global) {
        console.log(`📊 识别到xiayou.json格式数据 (项目 ${index})`);
        
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
        console.log(`🏪 识别到shangy.json格式数据，包含 ${item.filtered_merchants.length} 个商户 (项目 ${index})`);
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
            }
        });
        return; // 处理完这个项目后继续下一个
    }
    
    // 检查是否是shangyou.json格式的数据（营收数据，不是留存数据）
    if (item.日期 && item.商户名 && item.货币 && item.游戏 && item.总投注) {
        console.log(`💰 识别到shangyou.json格式数据（营收数据，非留存数据） (项目 ${index})`);
        console.log(`   ⚠️ 这是营收数据，不包含留存信息`);
        return; // 跳过营收数据
    }
    
    // 未识别的数据格式
    console.log(`❓ 未识别的数据格式 (项目 ${index})`);
    console.log(`   字段: ${itemKeys}`);
});

console.log(`🏪 收集到商户映射数据: ${merchantMappingEntries.length} 条`);
console.log(`📊 收集到留存数据: ${retentionDataToProcess.length} 条`);
console.log(`💰 收集到营收数据（含币种）: ${revenueDataWithCurrency.length} 条`);

if (retentionDataToProcess.length === 0) {
    console.error("⚠️ 没有找到留存数据");
    console.error("📋 输入数据分析:");
    console.error(`  - 商户映射数据: ${merchantMappingEntries.length} 条`);
    console.error(`  - 营收数据: ${revenueDataWithCurrency.length} 条`);
    console.error(`  - 留存数据: ${retentionDataToProcess.length} 条`);
    console.error("");
    console.error("💡 可能的原因:");
    console.error("  1. 只输入了 shangyou.json（营收数据），缺少 xiayou.json（留存数据）");
    console.error("  2. 只输入了 shangy.json（商户映射），缺少 xiayou.json（留存数据）");
    console.error("  3. xiayou.json 中没有 retention_new 或 retention_active 数据");
    console.error("");
    console.error("✅ 解决方案:");
    console.error("  请确保输入包含 xiayou.json 格式的数据，该数据应包含:");
    console.error("  - metrics.global.retention_new (新用户留存数据)");
    console.error("  - metrics.global.retention_active (活跃用户留存数据)");
    
    throw new Error("没有找到留存数据。请检查输入数据是否包含 xiayou.json 格式的留存数据。");
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

console.log(`💰 构建商户币种映射表完成，共 ${merchantIdToCurrencyMap.size} 个商户`);
console.log(`🏪 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);

// 处理留存数据映射
const finalResults = [];
let merchantMatchedCount = 0;
let merchantUnmatchedCount = 0;

retentionDataToProcess.forEach((item, index) => {
    const data = item.json;
    
    // 游戏信息处理
    let gameName = data.game_name || data.game || '未知游戏';
    let gameCode = data.game_code || null;
    
    // 商户信息处理 - 优先使用shangy.json的映射数据
    const merchantId = data.merchant_id ? data.merchant_id.toString() : null;
    let merchantName = null;
    let mainMerchantName = null;
    
    // 首先尝试从shangy.json映射表获取商户名
    if (merchantId && merchantIdToNameMap.has(merchantId)) {
        merchantName = merchantIdToNameMap.get(merchantId);
        mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);
        merchantMatchedCount++;
    } else {
        // 如果映射表中没有，使用原始数据
        merchantName = data.platform_name || data.platform || merchantId || '未知商户';
        mainMerchantName = data.main_merchant_name || '未知主商户';
        merchantUnmatchedCount++;
    }
    
    // 币种信息处理
    let currencies = [];
    if (merchantId && merchantIdToCurrencyMap.has(merchantId)) {
        currencies = merchantIdToCurrencyMap.get(merchantId);
    }
    const currencyStr = currencies.length > 0 ? currencies.join(', ') : '未知币种';
    
    // 数据类型处理
    let dataTypeStr = '';
    if (data.dataType === 'new_user_retention' || data.metric_type === 'new') {
        dataTypeStr = '新用户留存';
    } else if (data.dataType === 'active_user_retention' || data.metric_type === 'active') {
        dataTypeStr = '活跃用户留存';
    } else {
        dataTypeStr = '留存数据';
    }
    
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
        日期: data.release_date || '未知日期',
        数据类型: dataTypeStr,
        当日用户数: parseInt(data.d0_users || 0),
        次日用户数: parseInt(data.d1_users || 0),
        次日留存率: formatPercent(data.d1_retention_rate),
        "7日用户数": parseInt(data.d7_users || 0),
        "7日留存率": formatPercent(data.d7_retention_rate)
    };
    
    finalResults.push({ json: finalItem });
});

console.log(`=== 留存数据映射完成 ===`);
console.log(`📊 总共处理留存数据: ${retentionDataToProcess.length}`);
console.log(`🏪 商户映射成功: ${merchantMatchedCount}, 失败: ${merchantUnmatchedCount}`);
console.log(`📈 商户映射率: ${((merchantMatchedCount / (merchantMatchedCount + merchantUnmatchedCount)) * 100).toFixed(1)}%`);
console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);

return finalResults;
