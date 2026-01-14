// 测试商户映射修复效果
const fs = require('fs');
const path = require('path');

console.log('🧪 测试商户映射修复效果\n');

// 读取xiayou.json
function loadXiayouData() {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../xiayou.json'), 'utf8'));
        console.log(`✅ xiayou.json加载成功: ${data.length} 项\n`);
        return data;
    } catch (error) {
        console.error('❌ xiayou.json加载失败:', error.message);
        return [];
    }
}

// 提取商户映射信息
function extractMerchantMappings(xiayouData) {
    console.log('📊 提取商户映射信息...\n');
    
    const merchantMap = new Map();
    let totalUsers = 0;
    
    xiayouData.forEach((item, index) => {
        if (item.metrics && item.metrics.global && item.metrics.global.users) {
            const users = item.metrics.global.users;
            console.log(`项目 ${index}: 找到 ${users.length} 个商户用户数据`);
            
            users.forEach(user => {
                if (user.merchant_id && user.platform_name) {
                    const merchantId = user.merchant_id.toString();
                    merchantMap.set(merchantId, {
                        platform_name: user.platform_name || user.platform,
                        main_merchant_name: user.main_merchant_name || '未知主商户',
                        unique_users: user.unique_users_total || 0
                    });
                    totalUsers++;
                }
            });
        }
    });
    
    console.log(`\n✅ 提取完成:`);
    console.log(`   总商户用户记录: ${totalUsers} 条`);
    console.log(`   唯一商户ID: ${merchantMap.size} 个\n`);
    
    return merchantMap;
}

// 提取留存数据中的商户ID
function extractRetentionMerchantIds(xiayouData) {
    console.log('📊 提取留存数据中的商户ID...\n');
    
    const merchantIds = new Set();
    let retentionCount = 0;
    
    xiayouData.forEach((item, index) => {
        if (item.metrics && item.metrics.global) {
            const processRetention = (retentionArray, type) => {
                if (Array.isArray(retentionArray)) {
                    retentionArray.forEach(retention => {
                        if (retention.merchant_id) {
                            merchantIds.add(retention.merchant_id.toString());
                            retentionCount++;
                        }
                    });
                }
            };
            
            processRetention(item.metrics.global.retention_new, '新用户留存');
            processRetention(item.metrics.global.retention_active, '活跃用户留存');
        }
    });
    
    console.log(`✅ 提取完成:`);
    console.log(`   留存数据记录: ${retentionCount} 条`);
    console.log(`   唯一商户ID: ${merchantIds.size} 个\n`);
    
    return merchantIds;
}

// 检查映射匹配率
function checkMappingRate(merchantMap, retentionMerchantIds) {
    console.log('🔍 检查商户映射匹配率...\n');
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedIds = [];
    
    for (const merchantId of retentionMerchantIds) {
        if (merchantMap.has(merchantId)) {
            matchedCount++;
        } else {
            unmatchedCount++;
            if (unmatchedIds.length < 10) {
                unmatchedIds.push(merchantId);
            }
        }
    }
    
    const matchRate = retentionMerchantIds.size > 0 
        ? ((matchedCount / retentionMerchantIds.size) * 100).toFixed(1) 
        : 0;
    
    console.log(`📈 匹配结果:`);
    console.log(`   ✅ 匹配成功: ${matchedCount} 个`);
    console.log(`   ❌ 匹配失败: ${unmatchedCount} 个`);
    console.log(`   📊 匹配率: ${matchRate}%\n`);
    
    if (unmatchedIds.length > 0) {
        console.log(`⚠️  未匹配的商户ID示例:`);
        unmatchedIds.forEach(id => {
            console.log(`   ${id}`);
        });
        console.log('');
    }
    
    return { matchedCount, unmatchedCount, matchRate };
}

// 显示商户映射示例
function showMappingExamples(merchantMap, count = 10) {
    console.log(`📋 商户映射示例（前${count}个）:\n`);
    
    let i = 0;
    for (const [merchantId, data] of merchantMap.entries()) {
        if (i >= count) break;
        console.log(`   ${merchantId} -> ${data.platform_name} (${data.main_merchant_name})`);
        console.log(`      用户数: ${data.unique_users.toLocaleString()}`);
        i++;
    }
    console.log('');
}

// 主函数
function main() {
    const xiayouData = loadXiayouData();
    if (xiayouData.length === 0) {
        console.error('❌ 无法加载数据，退出测试');
        return;
    }
    
    // 提取商户映射
    const merchantMap = extractMerchantMappings(xiayouData);
    
    // 提取留存数据中的商户ID
    const retentionMerchantIds = extractRetentionMerchantIds(xiayouData);
    
    // 检查映射匹配率
    const result = checkMappingRate(merchantMap, retentionMerchantIds);
    
    // 显示商户映射示例
    showMappingExamples(merchantMap);
    
    // 总结
    console.log('📊 测试总结:');
    console.log(`   商户映射表大小: ${merchantMap.size} 个`);
    console.log(`   留存数据商户ID: ${retentionMerchantIds.size} 个`);
    console.log(`   映射匹配率: ${result.matchRate}%\n`);
    
    if (result.matchRate >= 95) {
        console.log('✅ 测试通过！商户映射修复效果良好。\n');
    } else if (result.matchRate >= 80) {
        console.log('⚠️  测试部分通过。大部分商户能够映射，但仍有改进空间。\n');
    } else {
        console.log('❌ 测试失败。商户映射率过低，需要进一步修复。\n');
    }
    
    console.log('✅ 测试完成');
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = { loadXiayouData, extractMerchantMappings, extractRetentionMerchantIds, checkMappingRate };
