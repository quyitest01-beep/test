// 调试商户匹配代码 - 专门用于调试
const inputData = $json;

console.log('=== 开始调试商户匹配 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据是否为数组:', Array.isArray(inputData));
console.log('输入数据长度:', Array.isArray(inputData) ? inputData.length : 'N/A');

// 详细输出输入数据结构
console.log('=== 输入数据结构分析 ===');
if (Array.isArray(inputData)) {
  console.log('输入是数组，元素数量:', inputData.length);
  inputData.forEach((item, index) => {
    console.log(`元素 ${index}:`, typeof item);
    console.log(`元素 ${index} 键:`, Object.keys(item || {}));
    if (item && typeof item === 'object') {
      // 检查是否包含商户数据特征
      if (item.grouped_sub_merchants) {
        console.log(`元素 ${index} 是商户数据，主商户数量:`, item.grouped_sub_merchants.length);
      }
      // 检查是否包含TG数据特征
      if (item.extractedData || item.messageText || (item.originalData && item.originalData.message)) {
        console.log(`元素 ${index} 是TG数据`);
        console.log(`TG数据键:`, Object.keys(item));
        if (item.extractedData) {
          console.log(`TG提取数据键:`, Object.keys(item.extractedData));
          console.log(`TG商户名称:`, item.extractedData.merchant);
        }
      }
    }
  });
} else {
  console.log('输入不是数组，是:', typeof inputData);
  console.log('输入数据键:', Object.keys(inputData || {}));
}

// 尝试获取TG数据
let telegramData = null;
let merchantData = null;

// 方法1: 从$input.first().json获取TG数据
try {
  const firstInput = $input.first();
  console.log('$input.first() 结果:', firstInput);
  if (firstInput && firstInput.json) {
    console.log('$input.first().json 键:', Object.keys(firstInput.json));
    if (firstInput.json.extractedData) {
      telegramData = firstInput.json;
      console.log('从$input.first().json成功获取TG数据');
    }
  }
} catch (error) {
  console.log('无法从$input.first().json获取数据:', error.message);
}

// 方法2: 从$json中查找TG数据
if (!telegramData) {
  if (Array.isArray(inputData)) {
    for (let i = 0; i < inputData.length; i++) {
      const item = inputData[i];
      if (item && item.extractedData) {
        telegramData = item;
        console.log(`在数组位置 ${i} 找到TG数据`);
        break;
      }
    }
  } else if (inputData && inputData.extractedData) {
    telegramData = inputData;
    console.log('在单个对象中找到TG数据');
  }
}

// 获取商户数据
if (Array.isArray(inputData)) {
  for (let i = 0; i < inputData.length; i++) {
    const item = inputData[i];
    if (item && item.grouped_sub_merchants) {
      merchantData = item;
      console.log(`在数组位置 ${i} 找到商户数据`);
      break;
    }
  }
} else if (inputData && inputData.grouped_sub_merchants) {
  merchantData = inputData;
  console.log('在单个对象中找到商户数据');
}

console.log('=== 数据提取结果 ===');
console.log('TG数据:', telegramData ? '已找到' : '未找到');
console.log('商户数据:', merchantData ? '已找到' : '未找到');

if (telegramData) {
  console.log('TG数据键:', Object.keys(telegramData));
  console.log('TG商户名称:', telegramData.extractedData?.merchant);
}

if (merchantData) {
  console.log('商户数据键:', Object.keys(merchantData));
  console.log('主商户数量:', merchantData.grouped_sub_merchants?.length || 0);
}

// 如果找不到TG数据，返回调试信息而不是抛出错误
if (!telegramData) {
  console.log('错误：未找到TG数据');
  console.log('输入数据完整结构:', JSON.stringify(inputData, null, 2).substring(0, 2000));
  
  return {
    success: false,
    error: '未找到TG数据',
    debugInfo: {
      inputType: typeof inputData,
      isArray: Array.isArray(inputData),
      inputLength: Array.isArray(inputData) ? inputData.length : 'N/A',
      inputKeys: Array.isArray(inputData) ? inputData.map((item, index) => ({
        index,
        keys: Object.keys(item || {})
      })) : Object.keys(inputData || {}),
      telegramDataFound: false,
      merchantDataFound: !!merchantData
    },
    inputData: inputData
  };
}

if (!merchantData) {
  console.log('错误：未找到商户数据');
  return {
    success: false,
    error: '未找到商户数据',
    debugInfo: {
      inputType: typeof inputData,
      isArray: Array.isArray(inputData),
      inputLength: Array.isArray(inputData) ? inputData.length : 'N/A',
      telegramDataFound: !!telegramData,
      merchantDataFound: false
    },
    inputData: inputData
  };
}

// 从TG数据中提取商户名称
const targetMerchantName = telegramData.extractedData.merchant.toLowerCase().trim();
console.log('目标商户名称:', targetMerchantName);

// 在商户数据中查找匹配的商户
let matchedMerchant = null;
let matchedMerchantId = null;
let matchedEnvironment = null;
let matchedStatus = null;

if (merchantData.grouped_sub_merchants) {
  console.log('开始搜索商户数据，主商户数量:', merchantData.grouped_sub_merchants.length);
  
  // 遍历所有主商户组
  for (const mainMerchant of merchantData.grouped_sub_merchants) {
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
          console.log(`选择生产环境商户: ${subMerchantName}, ID: ${matchedMerchantId}`);
          break;
        }
        // 如果没有生产环境，选择第一个匹配的商户
        else if (!matchedMerchant) {
          matchedMerchant = subMerchant;
          matchedMerchantId = subMerchant.merchant_id;
          matchedEnvironment = environment;
          matchedStatus = status;
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
      merchantDataFound: !!merchantData,
      telegramDataFound: !!telegramData
    }
  };
}

console.log('匹配结果:', {
  merchantName: matchedMerchant.sub_merchant_name,
  merchantId: matchedMerchantId,
  environment: matchedEnvironment,
  status: matchedStatus
});

// 构建最终查询消息
const finalQueryMessage = `商户：${matchedMerchant.sub_merchant_name}
商户ID：${matchedMerchantId}
环境：${matchedEnvironment}
状态：${matchedStatus}
投注id：${telegramData.extractedData.betId}
用户uid：${telegramData.extractedData.uid}
结算时间：${telegramData.extractedData.time}
结算币种：${telegramData.extractedData.currency}
投注金额：${telegramData.extractedData.amount}
派奖金额：${telegramData.extractedData.payout}
chat id:${telegramData.extractedData.chatId}
chat title:"${telegramData.extractedData.chatTitle}"`;

console.log('最终查询消息:', finalQueryMessage);

// 返回结果
return {
  success: true,
  targetMerchantName: targetMerchantName,
  matchedMerchant: {
    name: matchedMerchant.sub_merchant_name,
    id: matchedMerchantId,
    environment: matchedEnvironment,
    status: matchedStatus,
    type: matchedMerchant.type,
    mainMerchant: mainMerchant.main_merchant_name || '未知'
  },
  finalQueryMessage: finalQueryMessage,
  extractedData: {
    ...telegramData.extractedData,
    merchantId: matchedMerchantId,
    merchantName: matchedMerchant.sub_merchant_name,
    environment: matchedEnvironment,
    status: matchedStatus
  },
  debugInfo: {
    inputType: typeof inputData,
    isArray: Array.isArray(inputData),
    targetMerchantFound: !!matchedMerchant,
    searchResult: {
      merchantName: matchedMerchant?.sub_merchant_name,
      merchantId: matchedMerchantId,
      environment: matchedEnvironment
    }
  }
};