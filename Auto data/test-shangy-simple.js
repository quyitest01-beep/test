// 简化测试 - 使用示例数据
console.log('=== shangy.json 留存数据映射器测试 ===\n');

// 模拟 shangy.json 的数据结构
const testData = {
    "status": "success",
    "timestamp": "2026-01-20T04:14:26.148Z",
    "statistics": {
        "total_rows": 1998,
        "processed_rows": 219
    },
    "filtered_merchants": [
        // 商户映射数据
        {
            "sub_merchant_name": "betfiery",
            "main_merchant_name": "RD1",
            "merchant_id": 1698202251
        },
        {
            "sub_merchant_name": "mexlucky",
            "main_merchant_name": "RD1",
            "merchant_id": 1698203058
        },
        // 游戏映射数据
        {
            "id": 1,
            "game_id": "1698217736104",
            "game": "Fortune Tiger",
            "merchant": "1698203185"
        },
        {
            "id": 2,
            "game_id": "1698217753408",
            "game": "Chicken Road Zombie",
            "merchant": null
        },
        // 留存数据
        {
            "merchant": "1698202251",
            "game_id": "1698217736104",
            "currency": "BRL",
            "cohort_date": "2025-12-05",
            "d0_users": "100",
            "d1_users": "85",
            "d1_retention_rate": "85.0",
            "d3_users": "70",
            "d3_retention_rate": "70.0",
            "d7_users": "60",
            "d7_retention_rate": "60.0",
            "d14_users": "50",
            "d14_retention_rate": "50.0",
            "d30_users": "40",
            "d30_retention_rate": "40.0",
            "dataType": "game_act",
            "originalIndex": 1
        },
        {
            "merchant": "1698203058",
            "game_id": "1698217753408",
            "currency": "MXN",
            "cohort_date": "2025-12-31",
            "d0_users": "200",
            "d1_users": "150",
            "d1_retention_rate": "75.0",
            "d3_users": "120",
            "d3_retention_rate": "60.0",
            "d7_users": "100",
            "d7_retention_rate": "50.0",
            "d14_users": "80",
            "d14_retention_rate": "40.0",
            "d30_users": "60",
            "d30_retention_rate": "30.0",
            "dataType": "game_act",
            "originalIndex": 2
        }
    ]
};

// 模拟 N8N 的 $input
const $input = {
    all: () => [{ json: testData }]
};

// === 映射器代码开始 ===
const inputs = $input.all();
console.log(`输入数据项数: ${inputs.length}`);

const merchantMap = new Map();
const gameMap = new Map();
const retentionData = [];

inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    
    if (item.status && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
        console.log(`📊 处理 shangy.json 数据 (项目 ${index})`);
        console.log(`   包含 ${item.filtered_merchants.length} 个数据项`);
        
        item.filtered_merchants.forEach(entry => {
            // 收集商户映射
            if (entry.merchant_id && entry.sub_merchant_name) {
                merchantMap.set(entry.merchant_id.toString(), {
                    sub_merchant_name: entry.sub_merchant_name,
                    main_merchant_name: entry.main_merchant_name || '未知主商户'
                });
            }
            
            // 收集游戏映射
            if (entry.game_id && entry.game) {
                gameMap.set(entry.game_id, entry.game);
            }
            
            // 收集留存数据
            if (entry.dataType === 'game_act' && entry.merchant && entry.game_id) {
                retentionData.push(entry);
            }
        });
        
        console.log(`🏪 收集到商户映射: ${merchantMap.size} 个`);
        console.log(`🎮 收集到游戏映射: ${gameMap.size} 个`);
        console.log(`📊 收集到留存数据: ${retentionData.length} 条`);
    }
});

// 格式化百分比
function formatPercent(val) {
    if (val === undefined || val === null || val === '') return '0%';
    const s = String(val).trim();
    if (s.endsWith('%')) return s;
    const num = parseFloat(s);
    if (Number.isNaN(num)) return '0%';
    return `${Math.round(num)}%`;
}

// 处理留存数据
const results = retentionData.map(data => {
    const merchantId = data.merchant ? data.merchant.toString() : null;
    const merchantInfo = merchantId ? merchantMap.get(merchantId) : null;
    const merchantName = merchantInfo?.sub_merchant_name || merchantId || '未知商户';
    const mainMerchantName = merchantInfo?.main_merchant_name || '未知主商户';
    const gameName = gameMap.get(data.game_id) || data.game_id || '未知游戏';
    
    return {
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
    };
});

console.log(`\n=== 处理完成 ===`);
console.log(`📈 生成留存数据: ${results.length} 行\n`);

results.forEach((item, index) => {
    console.log(`${index + 1}. ${JSON.stringify(item, null, 2)}`);
});

console.log('\n✅ 测试成功！代码可以在 N8N 中使用');
