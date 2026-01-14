// 正确商户匹配代码 - 使用正确的数据路径
const inputData = $json;

console.log('=== 开始正确商户匹配 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据是否为数组:', Array.isArray(inputData));

// 从输入数据中提取TG数据和商户数据
let telegramData = null;
let merchantData = null;

// 处理输入数据
if (Array.isArray(inputData)) {
  // 如果是数组，查找包含extractedData的元素
  for (let i = 0; i < inputData.length; i++) {
    const item = inputData[i];
    if (item && item.extractedData) {
      telegramData = item;
      console.log(`在数组位置 ${i} 找到TG数据`);
    }
    if (item && item.grouped_sub_merchants) {
      merchantData = item;
      console.log(`在数组位置 ${i} 找到商户数据`);
    }
  }
} else if (inputData && typeof inputData === 'object') {
  // 如果是单个对象
  if (inputData.extractedData) {
    telegramData = inputData;
    console.log('在单个对象中找到TG数据');
  }
  if (inputData.grouped_sub_merchants) {
    merchantData = inputData;
    console.log('在单个对象中找到商户数据');
  }
}

// 如果还没有找到TG数据，尝试从$input.first().json.extractedData获取
if (!telegramData) {
  try {
    const firstInput = $input.first();
    if (firstInput && firstInput.json && firstInput.json.extractedData) {
      telegramData = firstInput.json;
      console.log('从$input.first().json找到TG数据');
    }
  } catch (error) {
    console.log('无法从$input.first().json获取数据:', error.message);
  }
}

console.log('数据提取结果:');
console.log('TG数据:', telegramData ? '已找到' : '未找到');
console.log('商户数据:', merchantData ? '已找到' : '未找到');

// 验证数据
if (!telegramData) {
  throw new Error('未找到TG数据');
}

if (!merchantData) {
  throw new Error('未找到商户数据');
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
  throw new Error(`未找到匹配的商户: ${targetMerchantName}`);
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










