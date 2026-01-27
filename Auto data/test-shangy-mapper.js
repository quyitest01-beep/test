// 测试 shangy.json 映射器
const fs = require('fs');
const path = require('path');

// 模拟 N8N 的 $input 对象
function createMockInput(data) {
    return {
        all: () => [{ json: data }]
    };
}

// 读取 shangy.json
const shangyData = JSON.parse(fs.readFileSync(path.join(__dirname, 'shangy.json'), 'utf8'));

console.log('📊 加载 shangy.json 数据');
console.log(`   包含 ${shangyData.length} 个顶层项目`);

// 找到包含 filtered_merchants 的项目
const mainData = shangyData.find(item => item.filtered_merchants);

if (!mainData) {
    console.error('❌ 没有找到 filtered_merchants 数组');
    process.exit(1);
}

console.log(`   filtered_merchants 包含 ${mainData.filtered_merchants.length} 个数据项`);

// 模拟 N8N 环境
const $input = createMockInput(mainData);

// 执行映射器代码
const inputs = $input.all();
console.log("\n=== shangy.json 留存数据映射器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

// 用于收集各种数据
const merchantMap = new Map();
const gameMap = new Map();
const retentionData = [];

// 遍历所有输入项
inputs.forEach((inputItem, index) => {
    const item = inputItem.json;
    
    if (item.status && item.filtered_merchants && Array.isArray(item.filtered_merchants)) {
        console.log(`📊 处理 shangy.json 数据 (项目 ${index})`);
        console.log(`   包含 ${item.filtered_merchants.length} 个数据项`);
        
        // 第一遍：收集商户映射和游戏映射
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

if (retentionData.length === 0) {
    console.error('❌ 没有找到留存数据');
    process.exit(1);
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

// 处理留存数据
const results = retentionData.slice(0, 5).map(data => {
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
console.log(`📈 生成留存数据: ${results.length} 行（显示前5条）\n`);

results.forEach((item, index) => {
    console.log(`${index + 1}. ${JSON.stringify(item, null, 2)}`);
});

console.log('\n✅ 测试成功！');
