// N8N Code Node - shangy.json 留存数据映射器
// 处理 shangy.json 格式的数据，所有数据都在 filtered_merchants 数组中

const inputs = $input.all();
console.log("=== shangy.json 留存数据映射器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
    throw new Error("没有输入数据");
}

// 用于收集各种数据
const merchantMap = new Map(); // merchant_id -> sub_merchant_name
const gameMap = new Map(); // game_id -> game name
const retentionData = [];

// 调试计数器
let totalItems = 0;
let merchantCount = 0;
let gameCount = 0;
let retentionCount = 0;
let otherCount = 0;

// 遍历所有输入项
inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    
    // 检查是否是 shangy.json 格式
    if (item.status && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
        console.log(`📊 处理 shangy.json 数据 (项目 ${index})`);
        console.log(`   包含 ${item.filtered_merchants.length} 个数据项`);
        
        totalItems = item.filtered_merchants.length;
        
        // 第一遍：收集商户映射和游戏映射
        item.filtered_merchants.forEach((entry, entryIndex) => {
            // 调试：显示每个条目的类型
            if (entryIndex < 5) {
                const keys = Object.keys(entry).slice(0, 5).join(', ');
                console.log(`   [${entryIndex}] 字段: ${keys}...`);
            }
            
            // 收集商户映射 (merchant_id -> sub_merchant_name)
            if (entry.merchant_id && entry.sub_merchant_name) {
                merchantMap.set(entry.merchant_id.toString(), {
                    sub_merchant_name: entry.sub_merchant_name,
                    main_merchant_name: entry.main_merchant_name || '未知主商户'
                });
                merchantCount++;
            }
            
            // 收集游戏映射 (game_id -> game name)
            if (entry.game_id && entry.game) {
                gameMap.set(entry.game_id, entry.game);
                gameCount++;
            }
            
            // 收集留存数据 (包含 dataType: "game_act" 的记录)
            if (entry.dataType === 'game_act') {
                console.log(`   ✅ 找到留存数据 [${entryIndex}]: merchant=${entry.merchant}, game_id=${entry.game_id}`);
                if (entry.merchant && entry.game_id) {
                    retentionData.push(entry);
                    retentionCount++;
                } else {
                    console.log(`   ⚠️ 留存数据缺少必要字段: merchant=${entry.merchant}, game_id=${entry.game_id}`);
                }
            } else {
                otherCount++;
            }
        });
        
        console.log(`\n📊 数据统计:`);
        console.log(`   总数据项: ${totalItems}`);
        console.log(`   🏪 商户映射: ${merchantCount} 个`);
        console.log(`   🎮 游戏映射: ${gameCount} 个`);
        console.log(`   📊 留存数据: ${retentionCount} 条`);
        console.log(`   ❓ 其他数据: ${otherCount} 条`);
    }
});

if (retentionData.length === 0) {
    console.error("\n❌ 错误：没有找到留存数据");
    console.error(`\n📋 数据分析:`);
    console.error(`   - 总共检查了 ${totalItems} 个数据项`);
    console.error(`   - 找到商户映射: ${merchantCount} 个`);
    console.error(`   - 找到游戏映射: ${gameCount} 个`);
    console.error(`   - 找到留存数据: ${retentionCount} 条`);
    console.error(`\n💡 可能的原因:`);
    console.error(`   1. filtered_merchants 数组中没有包含 dataType='game_act' 的记录`);
    console.error(`   2. 留存数据缺少 merchant 或 game_id 字段`);
    console.error(`   3. 输入的是错误的数据源（不是包含留存数据的 shangy.json）`);
    console.error(`\n✅ 留存数据应该包含以下字段:`);
    console.error(`   - dataType: "game_act"`);
    console.error(`   - merchant: "1698202251"`);
    console.error(`   - game_id: "1698217736104"`);
    console.error(`   - d0_users, d1_users, d1_retention_rate 等`);
    
    throw new Error(`没有找到留存数据。检查了 ${totalItems} 个数据项，其中商户映射 ${merchantCount} 个，游戏映射 ${gameCount} 个，但没有找到 dataType='game_act' 的留存数据。`);
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
const results = retentionData.map(data => {
    // 匹配商户名
    const merchantId = data.merchant ? data.merchant.toString() : null;
    const merchantInfo = merchantId ? merchantMap.get(merchantId) : null;
    const merchantName = merchantInfo?.sub_merchant_name || merchantId || '未知商户';
    const mainMerchantName = merchantInfo?.main_merchant_name || '未知主商户';
    
    // 匹配游戏名
    const gameName = gameMap.get(data.game_id) || data.game_id || '未知游戏';
    
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

console.log(`=== 处理完成 ===`);
console.log(`📈 生成留存数据: ${results.length} 行`);

return results;
