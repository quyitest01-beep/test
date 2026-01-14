// 健壮的商户匹配代码 - 处理只有商户数据的情况
const inputData = $json;

console.log('=== 健壮的商户匹配 ===');
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

// 尝试从不同路径获取TG数据
let targetMerchantName = '';
let telegramData = null;

// 方法1: 检查输入数据是否直接包含TG数据
if (inputData.extractedData && inputData.extractedData.merchant) {
  telegramData = inputData.extractedData;
  targetMerchantName = telegramData.merchant.toLowerCase().trim();
  console.log('从inputData.extractedData获取TG数据');
} else if (inputData.messageText) {
  // 方法2: 从messageText中提取商户名称
  const merchantMatch = inputData.messageText.match(/商户[：:]\s*([^\n\r]+)/i);
  if (merchantMatch) {
    targetMerchantName = merchantMatch[1].toLowerCase().trim();
    console.log('从messageText提取商户名称:', targetMerchantName);
  }
} else if (Array.isArray(inputData) && inputData.length > 1) {
  // 方法3: 如果输入是数组，查找第二个元素（TG数据）
  const tgData = inputData[1];
  if (tgData && tgData.extractedData && tgData.extractedData.merchant) {
    telegramData = tgData.extractedData;
    targetMerchantName = telegramData.merchant.toLowerCase().trim();
    console.log('从数组第二个元素获取TG数据');
  } else if (tgData && tgData.messageText) {
    const merchantMatch = tgData.messageText.match(/商户[：:]\s*([^\n\r]+)/i);
    if (merchantMatch) {
      targetMerchantName = merchantMatch[1].toLowerCase().trim();
      console.log('从数组第二个元素的messageText提取商户名称:', targetMerchantName);
    }
  }
} else {
  // 方法4: 如果没有找到TG数据，返回所有生产环境商户列表
  console.log('未找到TG消息数据，返回所有生产环境商户列表');
  
  const productionMerchants = [];
  
  if (inputData.grouped_sub_merchants) {
    for (const mainMerchant of inputData.grouped_sub_merchants) {
      for (const subMerchant of mainMerchant.sub_merchants) {
        if (subMerchant.environment === '生产' && subMerchant.status === '正常') {
          productionMerchants.push({
            merchantId: subMerchant.merchant_id,
            merchantName: subMerchant.sub_merchant_name,
            mainMerchantName: mainMerchant.main_merchant_name,
            environment: subMerchant.environment,
            status: subMerchant.status,
            type: subMerchant.type
          });
        }
      }
    }
  }
  
  return {
    success: true,
    message: '未找到TG消息数据，返回所有生产环境商户列表',
    productionMerchants: productionMerchants,
    totalCount: productionMerchants.length,
    debugInfo: {
      inputKeys: Object.keys(inputData),
      hasExtractedData: !!inputData.extractedData,
      hasMessageText: !!inputData.messageText,
      isArray: Array.isArray(inputData),
      arrayLength: Array.isArray(inputData) ? inputData.length : 'N/A'
    }
  };
}

if (!targetMerchantName) {
  return {
    success: false,
    error: '无法从TG消息中提取商户名称',
    debugInfo: {
      telegramData: telegramData,
      messageText: inputData.messageText,
      inputKeys: Object.keys(inputData)
    }
  };
}

console.log('目标商户名称:', targetMerchantName);

// 在商户数据中查找匹配的商户
let matchedMerchant = null;
let matchedMerchantId = null;
let matchedEnvironment = null;
let matchedStatus = null;
let matchedMainMerchantName = null;

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
          matchedMainMerchantName = mainMerchant.main_merchant_name;
          console.log(`选择生产环境商户: ${subMerchantName}, ID: ${matchedMerchantId}`);
          break;
        }
        // 如果没有生产环境，选择第一个匹配的商户
        else if (!matchedMerchant) {
          matchedMerchant = subMerchant;
          matchedMerchantId = subMerchant.merchant_id;
          matchedEnvironment = environment;
          matchedStatus = status;
          matchedMainMerchantName = mainMerchant.main_merchant_name;
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

// 构建最终输出 - 使用真实TG数据
const result = {
  success: true,
  // 核心输出：TG消息中的子商户名对应的商户ID
  matchedMerchantId: matchedMerchantId,
  matchedMerchantName: matchedMerchant.sub_merchant_name,
  mainMerchantName: matchedMainMerchantName,
  environment: matchedEnvironment,
  status: matchedStatus,
  // 原始TG消息内容 - 使用真实数据
  originalTelegramMessage: telegramData ? 
    `商户：${matchedMerchant.sub_merchant_name}
商户ID：${matchedMerchantId}
环境：${matchedEnvironment}
状态：${matchedStatus}
投注id：${telegramData.betId || '未知'}
用户uid：${telegramData.uid || '未知'}
结算时间：${telegramData.time || '未知'}
结算币种：${telegramData.currency || '未知'}
投注金额：${telegramData.amount || '未知'}
派奖金额：${telegramData.payout || '未知'}
chat id:${telegramData.chatId || '未知'}
chat title:"${telegramData.chatTitle || '未知'}"` :
    `商户：${matchedMerchant.sub_merchant_name}
商户ID：${matchedMerchantId}
环境：${matchedEnvironment}
状态：${matchedStatus}`,
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









