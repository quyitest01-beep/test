// N8N Code Node - 通用留存数据映射器
// 能够处理多种数据格式

const inputs = $input.all();
console.log("=== 通用留存数据映射器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
    throw new Error("没有输入数据");
}

// 用于收集各种数据
const merchantMap = new Map();
const gameMap = new Map();
const retentionData = [];

// 遍历所有输入项
inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    
    console.log(`\n📋 项目 ${index} 的数据类型检查:`);
    const keys = Object.keys(item);
    console.log(`   字段数量: ${keys.length}`);
    console.log(`   前10个字段: ${keys.slice(0, 10).join(', ')}`);
    
    // 情况1: 标准 shangy.json 格式 (包含 filtered_merchants 数组)
    if (item.status && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
        console.log(`   ✅ 识别为标准 shangy.json 格式`);
        
        item.filtered_merchants.forEach((entry, idx) => {
            // 商户映射
            if (entry.merchant_id && entry.sub_merchant_name) {
                merchantMap.set(entry.merchant_id.toString(), {
                    sub_merchant_name: entry.sub_merchant_name,
                    main_merchant_name: entry.main_merchant_name || '未知主商户'
                });
            }
            
            // 游戏映射
            if (entry.game_id && entry.game) {
                gameMap.set(entry.game_id, entry.game);
            }
            
            // 留存数据
            if (entry.dataType === 'game_act' && entry.merchant && entry.game_id) {
                retentionData.push(entry);
            }
        });
    }
    // 情况2: 直接是留存数据记录 (已被展平)
    else if (item.dataType === 'game_act' && item.merchant && item.game_id) {
        console.log(`   ✅ 识别为单条留存数据记录`);
        retentionData.push(item);
    }
    // 情况3: 商户映射记录
    else if (item.merchant_id && item.sub_merchant_name) {
        console.log(`   ✅ 识别为商户映射记录`);
        merchantMap.set(item.merchant_id.toString(), {
            sub_merchant_name: item.sub_merchant_name,
            main_merchant_name: item.main_merchant_name || '未知主商户'
        });
    }
    // 情况4: 游戏映射记录
    else if (item.game_id && item.game && !item.dataType) {
        console.log(`   ✅ 识别为游戏映射记录`);
        gameMap.set(item.game_id, item.game);
    }
    else {
        console.log(`   ❓ 未识别的数据格式`);
    }
});

console.log(`\n📊 数据收集结果:`);
console.log(`   🏪 商户映射: ${merchantMap.size} 个`);
console.log(`   🎮 游戏映射: ${gameMap.size} 个`);
console.log(`   📊 留存数据: ${retentionData.length} 条`);

if (retentionData.length === 0) {
    console.error("\n❌ 没有找到留存数据");
    console.error("\n💡 请检查:");
    console.error("   1. 输入数据是否包含 dataType='game_act' 的记录");
    console.error("   2. 留存数据是否包含 merchant 和 game_id 字段");
    console.error("   3. 上游节点是否正确配置");
    
    throw new Error(`没有找到留存数据。检查了 ${inputs.length} 个输入项，找到商户映射 ${merchantMap.size} 个，游戏映射 ${gameMap.size} 个，但没有留存数据。`);
}

// 格式化百分比
function formatPercent(val) {
    if (val === undefined || val === null || val === '') return '0%';
    const s = String(val).trim();
    if (s.endsWith('%')) return s;
    const num = parseFloat(s);
    if (Number.isNaN(num)) return '0%';
    return `${Math.round(num)}%`;
}

// 处理留存数据并生成输出
const results = retentionData.map((data, idx) => {
    // 匹配商户名
    const merchantId = data.merchant ? data.merchant.toString() : null;
    const merchantInfo = merchantId ? merchantMap.get(merchantId) : null;
    const merchantName = merchantInfo?.sub_merchant_name || merchantId || '未知商户';
    const mainMerchantName = merchantInfo?.main_merchant_name || '未知主商户';
    
    // 匹配游戏名
    const gameName = gameMap.get(data.game_id) || data.game_id || '未知游戏';
    
    if (idx < 3) {
        console.log(`\n处理留存数据 ${idx + 1}:`);
        console.log(`   merchant: ${data.merchant} → ${merchantName}`);
        console.log(`   game_id: ${data.game_id} → ${gameName}`);
    }
    
    // 构建输出
    return {
        json: {
            "游戏名": gameName,
            "商户名": merchantName,
            "主商户名": mainMerchantName,
            "币种": data.currency || '未知币种',
            "日期": data.cohort_date || '未知日期',
            "数据类型": "留存数据",
            "当日用户数": parseInt(data.d0_users) || 0,
            "次日用户数": parseInt(data.d1_users) || 0,
            "次日留存率": formatPercent(data.d1_retention_rate),
            "3日用户数": parseInt(data.d3_users) || 0,
            "3日留存率": formatPercent(data.d3_retention_rate),
            "7日用户数": parseInt(data.d7_users) || 0,
            "7日留存率": formatPercent(data.d7_retention_rate),
            "14日用户数": parseInt(data.d14_users) || 0,
            "14日留存率": formatPercent(data.d14_retention_rate),
            "30日用户数": parseInt(data.d30_users) || 0,
            "30日留存率": formatPercent(data.d30_retention_rate)
        }
    };
});

console.log(`\n=== 处理完成 ===`);
console.log(`📈 生成留存数据: ${results.length} 行`);

return results;
