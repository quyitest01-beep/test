// 商户匹配器 - 处理Merge节点合并的数据
const inputs = $input.all();
console.log("=== 商户ID匹配开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 检查输入数据格式
const firstInput = inputs[0].json;
console.log("第一个输入数据结构:", JSON.stringify(firstInput, null, 2).substring(0, 500) + "...");

// 如果第一个输入是商户映射数据
if (firstInput.filtered_merchants && Array.isArray(firstInput.filtered_merchants)) {
  console.log("📊 检测到商户映射数据");
  console.log(`商户映射数据: ${firstInput.filtered_merchants.length} 个商户`);
  
  // 构建商户ID到商户名的映射表
  const merchantIdToNameMap = new Map();
  const merchantIdToMainMerchantMap = new Map();

  firstInput.filtered_merchants.forEach(merchant => {
    if (merchant.merchant_id && merchant.sub_merchant_name) {
      merchantIdToNameMap.set(merchant.merchant_id.toString(), merchant.sub_merchant_name);
      merchantIdToMainMerchantMap.set(merchant.merchant_id.toString(), merchant.main_merchant_name);
    }
  });

  console.log(`📊 构建商户映射表完成，共 ${merchantIdToNameMap.size} 个商户`);
  console.log("映射表示例:", Array.from(merchantIdToNameMap.entries()).slice(0, 5));
  
  // 处理需要匹配的数据（从第二个输入开始）
  const dataToMatch = inputs.slice(1);
  console.log(`需要匹配的数据项数: ${dataToMatch.length}`);
  
  if (dataToMatch.length === 0) {
    console.log("⚠️ 没有需要匹配的数据，只有商户映射数据");
    console.log("需要先获取需要匹配的数据，然后再进行匹配");
    
    // 返回空结果，因为当前没有需要匹配的数据
    return [];
  }
  
  const results = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  
  dataToMatch.forEach((item, index) => {
    const data = item.json;
    
    // 只处理商户类数据
    if (data.stat_type && data.stat_type.includes('merchant') && data.merchant) {
      const merchantId = data.merchant.toString();
      const merchantName = merchantIdToNameMap.get(merchantId);
      const mainMerchantName = merchantIdToMainMerchantMap.get(merchantId);
      
      console.log(`🔍 处理商户ID: ${merchantId}, 查找结果: ${merchantName || '未找到'}`);
      
      if (merchantName) {
        // 匹配成功，替换merchant字段为商户名
        const matchedData = {
          ...data,
          merchant: merchantName,  // 替换为商户名
          merchant_id: merchantId, // 保留原始ID
          main_merchant_name: mainMerchantName, // 添加主商户名
          isMatched: true,
          matchType: 'merchant_id_to_name'
        };
        
        results.push({
          json: matchedData
        });
        
        matchedCount++;
        console.log(`✅ 匹配成功: ${merchantId} -> ${merchantName} (主商户: ${mainMerchantName})`);
      } else {
        // 匹配失败，保留原始数据但标记为未匹配
        const unmatchedData = {
          ...data,
          merchant_id: merchantId, // 保留原始ID
          isMatched: false,
          matchType: 'merchant_id_not_found'
        };
        
        results.push({
          json: unmatchedData
        });
        
        unmatchedCount++;
        console.log(`❌ 匹配失败: 商户ID ${merchantId} 未找到对应商户名`);
      }
    } else if (data.stat_type && data.stat_type.includes('game')) {
      // 游戏类数据，跳过匹配
      console.log(`⏭️  跳过游戏类数据: ${data.stat_type}`);
      results.push({
        json: {
          ...data,
          isMatched: false,
          matchType: 'game_data_skip'
        }
      });
    } else {
      console.log(`⏭️  跳过未知类型数据: ${data.stat_type || 'unknown'}`);
      results.push({
        json: {
          ...data,
          isMatched: false,
          matchType: 'unknown_data_type'
        }
      });
    }
  });
  
  console.log(`=== 商户ID匹配完成 ===`);
  console.log(`✅ 匹配成功: ${matchedCount}`);
  console.log(`❌ 匹配失败: ${unmatchedCount}`);
  console.log(`📈 匹配率: ${dataToMatch.length > 0 ? ((matchedCount / dataToMatch.length) * 100).toFixed(1) + '%' : '0%'}`);
  
  return results;
}

// 如果第一个输入不是商户映射数据，检查是否是需要匹配的数据
if (firstInput.stat_type || firstInput.merchant || firstInput.game_id) {
  console.log("📊 检测到需要匹配的数据，但缺少商户映射数据");
  console.log("数据示例:", {
    stat_type: firstInput.stat_type,
    merchant: firstInput.merchant,
    game_id: firstInput.game_id,
    unique_users: firstInput.unique_users
  });
  
  console.log("⚠️ 无法进行商户匹配：缺少商户映射数据");
  return [];
}

// 如果输入数据格式不明确
console.log("❌ 输入数据格式不明确，无法确定是商户映射数据还是需要匹配的数据");
console.log("输入数据字段:", Object.keys(firstInput));
return [];







