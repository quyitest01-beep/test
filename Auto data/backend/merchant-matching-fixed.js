// 匹配商户的Code节点 - 修复版本
const inputData = $json;

console.log('=== 开始匹配商户 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据是否为数组:', Array.isArray(inputData));
console.log('输入数据长度:', Array.isArray(inputData) ? inputData.length : 'N/A');
console.log('输入数据完整结构:', JSON.stringify(inputData, null, 2).substring(0, 500));

// 处理输入数据
let merchantData = null;
let telegramData = null;

// 检查输入数据格式
if (Array.isArray(inputData) && inputData.length >= 2) {
  // 如果输入是数组格式，取第一个元素（商户数据）和第二个元素（TG数据）
  merchantData = inputData[0];
  telegramData = inputData[1];
  console.log('处理数组格式的合并数据');
  console.log('商户数据键:', Object.keys(merchantData));
  console.log('TG数据键:', Object.keys(telegramData));
} else if (Array.isArray(inputData) && inputData.length === 1) {
  // 如果只有一个元素，可能是合并后的单个对象
  console.log('输入是单元素数组，尝试解析合并对象');
  const mergedItem = inputData[0];
  if (mergedItem && typeof mergedItem === 'object') {
    // 尝试从合并对象中提取数据
    merchantData = mergedItem.merchantData || mergedItem[0];
    telegramData = mergedItem.telegramData || mergedItem[1];
    console.log('从合并对象中提取数据');
  }
} else if (inputData && typeof inputData === 'object') {
  // 如果输入是单个对象，可能是合并后的结果
  console.log('输入是单个对象，尝试解析合并数据');
  merchantData = inputData.merchantData || inputData[0];
  telegramData = inputData.telegramData || inputData[1];
} else {
  console.log('输入数据格式不正确，期望数组格式');
  console.log('实际输入:', inputData);
  throw new Error('输入数据格式不正确，期望数组格式');
}

// 验证数据是否成功提取
if (!merchantData || !telegramData) {
  console.log('无法提取商户数据或TG数据');
  console.log('merchantData:', merchantData);
  console.log('telegramData:', telegramData);
  throw new Error('无法提取商户数据或TG数据');
}

// 从TG数据中提取商户名称
let targetMerchantName = '';
if (telegramData && telegramData.extractedData && telegramData.extractedData.merchant) {
  targetMerchantName = telegramData.extractedData.merchant.toLowerCase().trim();
  console.log('目标商户名称:', targetMerchantName);
} else {
  console.log('未找到目标商户名称');
  throw new Error('未找到目标商户名称');
}

// 在商户数据中查找匹配的商户
let matchedMerchant = null;
let matchedMerchantId = null;
let matchedEnvironment = null;

if (merchantData && merchantData.grouped_sub_merchants) {
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
          console.log(`选择生产环境商户: ${subMerchantName}, ID: ${matchedMerchantId}`);
          break;
        }
        // 如果没有生产环境，选择第一个匹配的商户
        else if (!matchedMerchant) {
          matchedMerchant = subMerchant;
          matchedMerchantId = subMerchant.merchant_id;
          matchedEnvironment = environment;
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
  throw new Error(`未找到匹配的商户: ${targetMerchantName}`);
}

console.log('匹配结果:', {
  merchantName: matchedMerchant.sub_merchant_name,
  merchantId: matchedMerchantId,
  environment: matchedEnvironment,
  status: matchedMerchant.status
});

// 构建最终查询消息
const finalQueryMessage = `商户：${matchedMerchant.sub_merchant_name}
商户ID：${matchedMerchantId}
环境：${matchedEnvironment}
状态：${matchedMerchant.status}
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
  originalData: inputData,
  targetMerchantName: targetMerchantName,
  matchedMerchant: {
    name: matchedMerchant.sub_merchant_name,
    id: matchedMerchantId,
    environment: matchedEnvironment,
    status: matchedMerchant.status,
    type: matchedMerchant.type,
    mainMerchant: matchedMerchant.main_merchant_name || '未知'
  },
  finalQueryMessage: finalQueryMessage,
  extractedData: {
    ...telegramData.extractedData,
    merchantId: matchedMerchantId,
    merchantName: matchedMerchant.sub_merchant_name,
    environment: matchedEnvironment,
    status: matchedMerchant.status
  },
  debugInfo: {
    inputType: typeof inputData,
    isArray: Array.isArray(inputData),
    inputLength: Array.isArray(inputData) ? inputData.length : 'N/A',
    targetMerchantFound: !!matchedMerchant,
    searchResult: {
      merchantName: matchedMerchant?.sub_merchant_name,
      merchantId: matchedMerchantId,
      environment: matchedEnvironment
    }
  }
};










