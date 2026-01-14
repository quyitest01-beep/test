// 日度营收数据聚合节点（全平台/商户/游戏/币种维度）
// 输入：shangyou.json 格式的营收数据（每个 item 是一行）
// 输出：按全平台/商户/游戏/币种维度聚合的营收数据

const inputs = $input.all();
console.log('=== 日度营收数据聚合开始 ===');
console.log('📊 输入项数量:', inputs.length);

// ========== 1. 工具函数 ==========
const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// ========== 2. 数据分类 ==========
const allRevenueData = inputs.map(input => input.json || {}).filter(row => {
    // 只处理有营收字段的数据
    return row['总投注USD'] !== undefined || row['总派奖USD'] !== undefined || row['GGR-USD'] !== undefined;
});

console.log(`\n📊 有效营收数据: ${allRevenueData.length} 条`);

// ========== 3. 全平台汇总 ==========
// 所有"日期=合计"的数据之和
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

console.log(`✅ 全平台汇总完成`);

// ========== 4. 商户维度聚合 ==========
// 每个商户的所有非合计数据求和
const merchantMap = new Map();
allRevenueData.filter(row => row['日期'] !== '合计' && row['商户名']).forEach(row => {
    const merchantName = String(row['商户名'] || '').trim();
    if (!merchantName) return;

    // 初始化该商户的累计桶
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
    // 对同一商户的所有非合计记录做求和
    agg.总投注USD += num(row['总投注USD']);
    agg.总派奖USD += num(row['总派奖USD']);
    agg.总GGR_USD += num(row['GGR-USD']);
    agg.总局数 += num(row['总局数']);
});

const merchantResults = Array.from(merchantMap.values());
console.log(`✅ 商户维度聚合完成: ${merchantMap.size} 个商户`);

// ========== 5. 游戏维度聚合 ==========
// 每个游戏的所有非合计数据求和
const gameMap = new Map();
// 同时为后续"游戏-平台数据"准备按【游戏-商户】拆分的聚合
const gameMerchantMap = new Map(); // key: gameName -> Map(merchantName -> agg)

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

    // 游戏-商户拆分聚合（用于主力商户榜单）
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
console.log(`✅ 游戏维度聚合完成: ${gameMap.size} 个游戏`);

// ========== 5.1 游戏-平台数据（按游戏拆分主力商户） ==========
// 输出结构示例：
// {
//   类型: '游戏-平台数据',
//   游戏名: 'Fortune Gems',
//   累计商户数: 8,
//   主力商户名1: '7COME',
//   主力商户1_总投注USD: ...,
//   主力商户1_总派奖USD: ...,
//   主力商户1_总GGR_USD: ...,
//   主力商户1_总局数: ...,
//   ... 主力商户名2/3/4/5
// }
const gamePlatformRows = [];
gameMerchantMap.forEach((merchantAggMap, gameName) => {
    const merchantsArr = Array.from(merchantAggMap.values());
    const merchantCount = merchantsArr.length;

    // 按 GGR_USD 从高到低排序，取前 5 名作为主力商户
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

console.log(`✅ 游戏-平台数据生成完成: ${gamePlatformRows.length} 条`);

// ========== 6. 币种维度聚合 ==========
// 每种币种的所有非合计数据求和
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
console.log(`✅ 币种维度聚合完成: ${currencyMap.size} 种币种`);

// ========== 7. 组装最终输出 ==========
const output = [
    platformSummary,
    ...merchantResults,
    ...gameResults,
    ...gamePlatformRows,
    ...currencyResults,
];

console.log(`\n✅ 日度营收数据聚合完成！`);
console.log(`   全平台: 1 条`);
console.log(`   商户: ${merchantResults.length} 条`);
console.log(`   游戏: ${gameResults.length} 条`);
console.log(`   游戏-平台数据: ${gamePlatformRows.length} 条`);
console.log(`   币种: ${currencyResults.length} 条`);
console.log(`   总计: ${output.length} 条`);

// 输出：每个 item 一条记录
return output.map(row => ({ json: row }));