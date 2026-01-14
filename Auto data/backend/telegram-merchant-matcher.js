// 简化商户匹配代码 - 专门处理你的情况
const inputData = $json;

console.log('=== 简化商户匹配 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据是否为数组:', Array.isArray(inputData));

// 检查输入数据
if (!inputData || typeof inputData !== 'object') {
  return {
    success: false,
    error: '输入数据格式不正确',
    debugInfo: {
      inputType: typeof inputData,
      hasInput: !!inputData
    }
  };
}

// 检查是否有商户数据
if (!inputData.grouped_sub_merchants) {
  return {
    success: false,
    error: '未找到商户数据',
    debugInfo: {
      inputKeys: Object.keys(inputData),
      hasGroupedMerchants: !!inputData.grouped_sub_merchants
    }
  };
}

// 模拟TG数据（用于测试）
const mockTelegramData = {
  merchant: 'betfarms', // 你要匹配的商户名称
  betId: 'PANDA-123456789',
  uid: 'User123456',
  time: '2025-01-17 10:30:00',
  currency: 'USDT',
  amount: '100.00',
  payout: '200.00',
  chatId: '123456789',
  chatTitle: '测试群组'
};

console.log('使用模拟TG数据:', mockTelegramData);

// 从模拟TG数据中提取商户名称
const targetMerchantName = mockTelegramData.merchant.toLowerCase().trim();
console.log('目标商户名称:', targetMerchantName);

// 在商户数据中查找匹配的商户
let matchedMerchant = null;
let matchedMerchantId = null;
let matchedEnvironment = null;
let matchedStatus = null;
let matchedMainMerchantName = null; // 添加主商户名称变量

if (inputData.grouped_sub_merchants) {
  console.log('开始搜索商户数据，主商户数量:', inputData.grouped_sub_merchants.length);
  
  // 遍历所有主商户组
  for (const mainMerchant of inputData.grouped_sub_merchants) {
    console.log('检查主商户:', mainMerchant.main_merchant_name);
    
    // 遍历该主商户下的所有子商户
    for (const subMerchant of mainMerchant.sub_merchants) {
      const subMerchantName = subMerchant.sub_merchant_name.toLowerCase().trim();
      const environment = subMerchant.environment;
      const status = subMerchant.status;
      
      console.log(`检查子商户: ${subMerchantName}, 环境: ${environment}, 状态: ${status}`);
      
      // 匹配商户名称（支持模糊匹配）
      if (subMerchantName.includes(targetMerchantName) || targetMerchantName.includes(subMerchantName)) {
        console.log(`找到匹配商户: ${subMerchantName}`);
        
        // 优先选择生产环境且状态正常的商户
        if (environment === '生产' && status === '正常') {
          matchedMerchant = subMerchant;
          matchedMerchantId = subMerchant.merchant_id;
          matchedEnvironment = environment;
          matchedStatus = status;
          matchedMainMerchantName = mainMerchant.main_merchant_name; // 保存主商户名称
          console.log(`选择生产环境商户: ${subMerchantName}, ID: ${matchedMerchantId}`);
          break;
        }
        // 如果没有生产环境，选择第一个匹配的商户
        else if (!matchedMerchant) {
          matchedMerchant = subMerchant;
          matchedMerchantId = subMerchant.merchant_id;
          matchedEnvironment = environment;
          matchedStatus = status;
          matchedMainMerchantName = mainMerchant.main_merchant_name; // 保存主商户名称
          console.log(`选择匹配商户: ${subMerchantName}, ID: ${matchedMerchantId}, 环境: ${environment}`);
        }
      }
    }
    
    // 如果找到生产环境商户，停止搜索
    if (matchedMerchant && matchedEnvironment === '生产') {
      break;
    }
  }
}

// 检查是否找到匹配的商户
if (!matchedMerchant) {
  console.log('未找到匹配的商户');
  return {
    success: false,
    error: `未找到匹配的商户: ${targetMerchantName}`,
    debugInfo: {
      targetMerchantName: targetMerchantName,
      searchedMerchants: inputData.grouped_sub_merchants.length
    }
  };
}

console.log('匹配结果:', {
  merchantName: matchedMerchant.sub_merchant_name,
  merchantId: matchedMerchantId,
  environment: matchedEnvironment,
  status: matchedStatus,
  mainMerchant: matchedMainMerchantName
});

// 构建最终输出 - 只输出关键信息
const result = {
  success: true,
  // 核心输出：TG消息中的子商户名对应的商户ID
  matchedMerchantId: matchedMerchantId,
  matchedMerchantName: matchedMerchant.sub_merchant_name,
  mainMerchantName: matchedMainMerchantName,
  environment: matchedEnvironment,
  status: matchedStatus,
  // 原始TG消息内容
  originalTelegramMessage: `商户：${matchedMerchant.sub_merchant_name}
商户ID：${matchedMerchantId}
环境：${matchedEnvironment}
状态：${matchedStatus}
投注id：${mockTelegramData.betId}
用户uid：${mockTelegramData.uid}
结算时间：${mockTelegramData.time}
结算币种：${mockTelegramData.currency}
投注金额：${mockTelegramData.amount}
派奖金额：${mockTelegramData.payout}
chat id:${mockTelegramData.chatId}
chat title:"${mockTelegramData.chatTitle}"`,
  // 调试信息
  debugInfo: {
    targetMerchantName: targetMerchantName,
    searchResult: {
      merchantName: matchedMerchant.sub_merchant_name,
      merchantId: matchedMerchantId,
      environment: matchedEnvironment,
      mainMerchant: matchedMainMerchantName
    }
  }
};

console.log('最终结果:', result);
return result;









