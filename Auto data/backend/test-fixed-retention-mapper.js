// 测试修复后的留存数据映射器
const fs = require('fs');
const path = require('path');

// 模拟n8n的$input对象
function createMockInput(data) {
    return {
        all: () => data.map(item => ({ json: item }))
    };
}

// 读取测试数据
function loadTestData() {
    try {
        const shangyData = JSON.parse(fs.readFileSync(path.join(__dirname, '../shangy.json'), 'utf8'));
        const xiayouData = JSON.parse(fs.readFileSync(path.join(__dirname, '../xiayou.json'), 'utf8'));
        
        console.log('✅ 测试数据加载成功');
        console.log(`📊 shangy.json: ${shangyData.length} 项`);
        console.log(`📊 xiayou.json: ${xiayouData.length} 项`);
        
        return [...shangyData, ...xiayouData];
    } catch (error) {
        console.error('❌ 测试数据加载失败:', error.message);
        return [];
    }
}

// 执行映射器代码
function runMapper(inputData) {
    // 模拟n8n环境
    const $input = createMockInput(inputData);
    
    // 这里复制映射器的核心逻辑
    const inputs = $input.all();
    console.log("=== 留存数据映射器开始（修复版测试） ===");
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
        
        // 检查是否是xiayou.json格式的数据（包含metrics结构）
        if (item.metrics && item.metrics.global) {
            console.log(`📊 识别到xiayou.json格式数据 (项目 ${index})`);
            
            // 提取游戏信息
            if (item.target_game) {
                console.log(`🎮 找到目标游戏: ${item.target_game.english_name} (${item.target_game.game_code})`);
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
    });

    console.log(`🎮 收集到游戏映射数据: ${gameMappingEntries.length} 条`);
    console.log(`🏪 收集到商户映射数据: ${merchantMappingEntries.length} 条`);
    console.log(`📊 收集到留存数据: ${retentionDataToProcess.length} 条`);
    console.log(`💰 收集到营收数据（含币种）: ${revenueDataWithCurrency.length} 条`);

    if (retentionDataToProcess.length === 0) {
        console.warn("⚠️ 没有找到留存数据");
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

    retentionDataToProcess.slice(0, 10).forEach((item, index) => { // 只处理前10条用于测试
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
            console.log(`✅ 商户映射成功: ID ${merchantId} -> ${merchantName} (${mainMerchantName})`);
            merchantMatchedCount++;
        } else {
            // 如果映射表中没有，使用原始数据
            merchantName = data.platform_name || data.platform || merchantId || '未知商户';
            mainMerchantName = data.main_merchant_name || '未知主商户';
            console.log(`⚠️ 商户映射失败: ID ${merchantId}，使用原始数据: ${merchantName}`);
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

    console.log(`=== 留存数据映射完成（测试版） ===`);
    console.log(`📊 总共处理留存数据: ${Math.min(retentionDataToProcess.length, 10)}`);
    console.log(`🏪 商户映射成功: ${merchantMatchedCount}, 失败: ${merchantUnmatchedCount}`);
    console.log(`📈 商户映射率: ${((merchantMatchedCount / (merchantMatchedCount + merchantUnmatchedCount)) * 100).toFixed(1)}%`);
    console.log(`📈 生成最终留存数据: ${finalResults.length} 行`);

    return finalResults;
}

// 主函数
function main() {
    console.log('🚀 开始测试修复后的留存数据映射器');
    
    const testData = loadTestData();
    if (testData.length === 0) {
        console.error('❌ 无法加载测试数据，退出测试');
        return;
    }
    
    const results = runMapper(testData);
    
    if (results.length > 0) {
        console.log('\n📋 测试结果示例（前3条）:');
        results.slice(0, 3).forEach((item, index) => {
            console.log(`\n${index + 1}. ${JSON.stringify(item.json, null, 2)}`);
        });
        
        // 保存测试结果
        const outputPath = path.join(__dirname, 'test-retention-mapper-output.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
        console.log(`\n💾 测试结果已保存到: ${outputPath}`);
    } else {
        console.log('❌ 没有生成任何结果');
    }
    
    console.log('\n✅ 测试完成');
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = { runMapper, loadTestData };