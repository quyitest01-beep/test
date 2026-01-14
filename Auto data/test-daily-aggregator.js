// 测试日度营收数据聚合脚本
const fs = require('fs');

// 读取上游数据
const shangyouData = JSON.parse(fs.readFileSync('shangyou.json', 'utf8'));

// 模拟 n8n 的 $input.all() 函数
const $input = {
    all: () => shangyouData.map(item => ({ json: item }))
};

// 执行聚合脚本
console.log('开始测试日度营收数据聚合...\n');

// ========== 1. 工具函数 ==========
const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// ========== 2. 数据分类 ==========
const inputs = $input.all();
const allRevenueData = inputs.map(input => input.json || {}).filter(row => {
    // 只处理有营收字段的数据
    return row['总投注USD'] !== undefined || row['总派奖USD'] !== undefined || row['GGR-USD'] !== undefined;
});

console.log(`📊 有效营收数据: ${allRevenueData.length} 条`);

// 查看数据样本
console.log('\n📋 数据样本:');
console.log('合计记录样本:', allRevenueData.find(row => row['日期'] === '合计'));
console.log('详细记录样本:', allRevenueData.find(row => row['日期'] !== '合计'));

// ========== 3. 全平台汇总 ==========
const platformTotal = allRevenueData.filter(row => row['日期'] === '合计').reduce((acc, row) => {
    return {
        总投注USD: acc.总投注USD + num(row['总投注USD']),
        总派奖USD: acc.总派奖USD + num(row['总派奖USD']),
        总GGR_USD: acc.总GGR_USD + num(row['GGR-USD']),
        总局数: acc.总局数 + num(row['总局数']),
    };
}, { 总投注USD: 0, 总派奖USD: 0, 总GGR_USD: 0, 总局数: 0 });

const platformSummary = {
    类型: '全平台',
    总投注USD: platformTotal.总投注USD,
    总派奖USD: platformTotal.总派奖USD,
    总GGR_USD: platformTotal.总GGR_USD,
    总局数: platformTotal.总局数,
};

console.log('\n✅ 全平台汇总结果:');
console.log(JSON.stringify(platformSummary, null, 2));

// ========== 4. 商户维度聚合 ==========
const merchantMap = new Map();
allRevenueData.filter(row => row['日期'] !== '合计' && row['商户名']).forEach(row => {
    const merchantName = String(row['商户名'] || '').trim();
    if (!merchantName) return;

    if (!merchantMap.has(merchantName)) {
        merchantMap.set(merchantName, {
            类型: '商户',
            商户名: merchantName,
            总投注USD: 0,
            总派奖USD: 0,
            总GGR_USD: 0,
            总局数: 0,
        });
    }

    const agg = merchantMap.get(merchantName);
    agg.总投注USD += num(row['总投注USD']);
    agg.总派奖USD += num(row['总派奖USD']);
    agg.总GGR_USD += num(row['GGR-USD']);
    agg.总局数 += num(row['总局数']);
});

const merchantResults = Array.from(merchantMap.values());
console.log(`\n✅ 商户维度聚合完成: ${merchantMap.size} 个商户`);
console.log('前3个商户样本:');
merchantResults.slice(0, 3).forEach(merchant => {
    console.log(JSON.stringify(merchant, null, 2));
});

// ========== 5. 游戏维度聚合 ==========
const gameMap = new Map();
const gameMerchantMap = new Map();

allRevenueData.filter(row => row['日期'] !== '合计' && row['游戏'] && row['商户名']).forEach(row => {
    const gameName = String(row['游戏'] || '').trim();
    const merchantName = String(row['商户名'] || '').trim();
    if (!gameName || !merchantName) return;

    // 游戏总汇总
    if (!gameMap.has(gameName)) {
        gameMap.set(gameName, {
            类型: '游戏',
            游戏名: gameName,
            总投注USD: 0,
            总派奖USD: 0,
            总GGR_USD: 0,
            总局数: 0,
        });
    }

    const game = gameMap.get(gameName);
    game.总投注USD += num(row['总投注USD']);
    game.总派奖USD += num(row['总派奖USD']);
    game.总GGR_USD += num(row['GGR-USD']);
    game.总局数 += num(row['总局数']);

    // 游戏-商户拆分聚合
    if (!gameMerchantMap.has(gameName)) {
        gameMerchantMap.set(gameName, new Map());
    }
    const merchantAggMap = gameMerchantMap.get(gameName);
    if (!merchantAggMap.has(merchantName)) {
        merchantAggMap.set(merchantName, {
            商户名: merchantName,
            总投注USD: 0,
            总派奖USD: 0,
            总GGR_USD: 0,
            总局数: 0,
        });
    }

    const ma = merchantAggMap.get(merchantName);
    ma.总投注USD += num(row['总投注USD']);
    ma.总派奖USD += num(row['总派奖USD']);
    ma.总GGR_USD += num(row['GGR-USD']);
    ma.总局数 += num(row['总局数']);
});

const gameResults = Array.from(gameMap.values());
console.log(`\n✅ 游戏维度聚合完成: ${gameMap.size} 个游戏`);
console.log('前3个游戏样本:');
gameResults.slice(0, 3).forEach(game => {
    console.log(JSON.stringify(game, null, 2));
});

// ========== 5.1 游戏-平台数据 ==========
const gamePlatformRows = [];
gameMerchantMap.forEach((merchantAggMap, gameName) => {
    const merchantsArr = Array.from(merchantAggMap.values());
    const merchantCount = merchantsArr.length;

    merchantsArr.sort((a, b) => b.总GGR_USD - a.总GGR_USD);
    const topMerchants = merchantsArr.slice(0, 5);

    const row = {
        类型: '游戏-平台数据',
        游戏名: gameName,
        累计商户数: merchantCount,
    };

    topMerchants.forEach((m, idx) => {
        const rank = idx + 1;
        row[`主力商户名${rank}`] = m.商户名;
        row[`主力商户${rank}_总投注USD`] = m.总投注USD;
        row[`主力商户${rank}_总派奖USD`] = m.总派奖USD;
        row[`主力商户${rank}_总GGR_USD`] = m.总GGR_USD;
        row[`主力商户${rank}_总局数`] = m.总局数;
    });

    gamePlatformRows.push(row);
});

console.log(`\n✅ 游戏-平台数据生成完成: ${gamePlatformRows.length} 条`);
console.log('第1个游戏-平台数据样本:');
if (gamePlatformRows.length > 0) {
    console.log(JSON.stringify(gamePlatformRows[0], null, 2));
}

// ========== 6. 币种维度聚合 ==========
const currencyMap = new Map();
allRevenueData.filter(row => row['日期'] !== '合计' && row['货币'] && row['商户名']).forEach(row => {
    const currency = String(row['货币'] || '').trim();
    if (!currency) return;

    if (!currencyMap.has(currency)) {
        currencyMap.set(currency, {
            类型: '币种',
            币种: currency,
            总投注USD: 0,
            总派奖USD: 0,
            总GGR_USD: 0,
            总局数: 0,
        });
    }

    const curr = currencyMap.get(currency);
    curr.总投注USD += num(row['总投注USD']);
    curr.总派奖USD += num(row['总派奖USD']);
    curr.总GGR_USD += num(row['GGR-USD']);
    curr.总局数 += num(row['总局数']);
});

const currencyResults = Array.from(currencyMap.values());
console.log(`\n✅ 币种维度聚合完成: ${currencyMap.size} 种币种`);
console.log('前3个币种样本:');
currencyResults.slice(0, 3).forEach(currency => {
    console.log(JSON.stringify(currency, null, 2));
});

// ========== 7. 最终输出统计 ==========
const output = [
    platformSummary,
    ...merchantResults,
    ...gameResults,
    ...gamePlatformRows,
    ...currencyResults,
];

console.log(`\n🎯 最终输出统计:`);
console.log(`   全平台: 1 条`);
console.log(`   商户: ${merchantResults.length} 条`);
console.log(`   游戏: ${gameResults.length} 条`);
console.log(`   游戏-平台数据: ${gamePlatformRows.length} 条`);
console.log(`   币种: ${currencyResults.length} 条`);
console.log(`   总计: ${output.length} 条`);

// 保存测试结果
fs.writeFileSync('daily-aggregator-test-result.json', JSON.stringify(output, null, 2));
console.log('\n💾 测试结果已保存到 daily-aggregator-test-result.json');

console.log('\n✅ 测试完成！');