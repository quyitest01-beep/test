// 修正的数据转换节点 - 正确提取TG消息信息
const inputData = $input.all();

console.log('=== 修正的数据转换 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据长度:', inputData.length);

// 检查输入数据
if (!inputData || !Array.isArray(inputData) || inputData.length < 2) {
  return {
    success: false,
    error: '输入数据格式不正确，需要2个输入',
    debugInfo: {
      inputType: typeof inputData,
      isArray: Array.isArray(inputData),
      length: inputData ? inputData.length : 'undefined'
    }
  };
}

// 获取商户数据和TG数据
let merchantData = inputData[0].json;
let telegramData = inputData[1].json;

console.log('商户数据类型:', typeof merchantData);
console.log('商户数据是否为数组:', Array.isArray(merchantData));
console.log('TG数据类型:', typeof telegramData);
console.log('TG数据是否为数组:', Array.isArray(telegramData));

// 如果商户数据是数组，取第一个元素
if (Array.isArray(merchantData)) {
  merchantData = merchantData[0];
  console.log('商户数据是数组，取第一个元素');
}

// 如果TG数据是数组，取第一个元素
if (Array.isArray(telegramData)) {
  telegramData = telegramData[0];
  console.log('TG数据是数组，取第一个元素');
}

console.log('处理后的商户数据:', merchantData);
console.log('处理后的TG数据:', telegramData);

// 检查商户数据是否包含grouped_sub_merchants
if (!merchantData || !merchantData.grouped_sub_merchants) {
  return {
    success: false,
    error: '商户数据格式不正确，缺少grouped_sub_merchants',
    debugInfo: {
      merchantDataKeys: merchantData ? Object.keys(merchantData) : 'undefined',
      hasGroupedMerchants: merchantData ? !!merchantData.grouped_sub_merchants : false
    }
  };
}

// 从TG数据中提取信息
let extractedInfo = {};

// 方法1：尝试从extractedData获取
if (telegramData.extractedData) {
  extractedInfo = {
    merchant: telegramData.extractedData.merchant || '',
    betId: telegramData.extractedData.betId || '',
    uid: telegramData.extractedData.uid || '',
    time: telegramData.extractedData.time || '',
    currency: telegramData.extractedData.currency || '',
    amount: telegramData.extractedData.amount || '',
    payout: telegramData.extractedData.payout || '',
    chatId: telegramData.extractedData.chatId || '',
    chatTitle: telegramData.extractedData.chatTitle || ''
  };
  console.log('从extractedData获取信息:', extractedInfo);
}

// 方法2：如果extractedData中的关键信息为空，尝试从原始消息文本中提取
const messageText = telegramData.originalData?.message?.text || telegramData.message?.text || '';
console.log('原始消息文本:', messageText);

if (messageText && (!extractedInfo.betId || !extractedInfo.time)) {
  console.log('从原始消息文本中提取信息');
  
  // 提取商户名称
  const merchantMatch = messageText.match(/商户[：:]\s*([^\n\r]+)/i);
  if (merchantMatch && !extractedInfo.merchant) {
    extractedInfo.merchant = merchantMatch[1].trim();
    console.log('提取到商户名称:', extractedInfo.merchant);
  }
  
  // 提取投注ID
  const betIdMatch = messageText.match(/投注id[：:]\s*([^\n\r]+)/i);
  if (betIdMatch && !extractedInfo.betId) {
    extractedInfo.betId = betIdMatch[1].trim();
    console.log('提取到投注ID:', extractedInfo.betId);
  }
  
  // 提取时间
  const timeMatch = messageText.match(/时间[：:]\s*([^\n\r]+)/i);
  if (timeMatch && !extractedInfo.time) {
    extractedInfo.time = timeMatch[1].trim();
    console.log('提取到时间:', extractedInfo.time);
  }
  
  // 提取用户ID
  const uidMatch = messageText.match(/用户[：:]\s*([^\n\r]+)/i);
  if (uidMatch && !extractedInfo.uid) {
    extractedInfo.uid = uidMatch[1].trim();
    console.log('提取到用户ID:', extractedInfo.uid);
  }
  
  // 提取货币
  const currencyMatch = messageText.match(/货币[：:]\s*([^\n\r]+)/i);
  if (currencyMatch && !extractedInfo.currency) {
    extractedInfo.currency = currencyMatch[1].trim();
    console.log('提取到货币:', extractedInfo.currency);
  }
  
  // 提取金额
  const amountMatch = messageText.match(/金额[：:]\s*([^\n\r]+)/i);
  if (amountMatch && !extractedInfo.amount) {
    extractedInfo.amount = amountMatch[1].trim();
    console.log('提取到金额:', extractedInfo.amount);
  }
  
  // 提取派奖
  const payoutMatch = messageText.match(/派奖[：:]\s*([^\n\r]+)/i);
  if (payoutMatch && !extractedInfo.payout) {
    extractedInfo.payout = payoutMatch[1].trim();
    console.log('提取到派奖:', extractedInfo.payout);
  }
}

// 确保有chatId和chatTitle
if (!extractedInfo.chatId && telegramData.originalData?.message?.chat?.id) {
  extractedInfo.chatId = telegramData.originalData.message.chat.id;
}
if (!extractedInfo.chatTitle && telegramData.originalData?.message?.chat?.title) {
  extractedInfo.chatTitle = telegramData.originalData.message.chat.title;
}

console.log('最终提取的信息:', extractedInfo);

// 从提取的信息中获取商户名称
const targetMerchant = extractedInfo.merchant.toLowerCase().trim();
console.log('目标商户:', targetMerchant);

if (!targetMerchant) {
  return {
    success: false,
    error: '无法从TG消息中提取商户名称',
    debugInfo: {
      messageText: messageText,
      extractedInfo: extractedInfo
    }
  };
}

// 在商户数据中查找匹配
let matchedMerchant = null;
let matchedMainMerchant = null;

console.log('开始搜索商户数据，主商户数量:', merchantData.grouped_sub_merchants.length);

for (const mainMerchant of merchantData.grouped_sub_merchants) {
  console.log('检查主商户:', mainMerchant.main_merchant_name);
  
  for (const subMerchant of mainMerchant.sub_merchants) {
    const subMerchantName = subMerchant.sub_merchant_name.toLowerCase().trim();
    
    console.log(`检查子商户: ${subMerchantName}, 环境: ${subMerchant.environment}, 状态: ${subMerchant.status}`);
    
    if (subMerchantName === targetMerchant && 
        subMerchant.environment === '生产' && 
        subMerchant.status === '正常') {
      matchedMerchant = subMerchant;
      matchedMainMerchant = mainMerchant;
      console.log(`找到匹配商户: ${subMerchantName}, ID: ${subMerchant.merchant_id}`);
      break;
    }
  }
  if (matchedMerchant) break;
}

if (matchedMerchant) {
  const result = {
    merchant: extractedInfo.merchant,
    merchantid: matchedMerchant.merchant_id,
    betId: extractedInfo.betId,
    uid: extractedInfo.uid,
    time: extractedInfo.time,
    currency: extractedInfo.currency,
    amount: extractedInfo.amount,
    payout: extractedInfo.payout,
    chatId: extractedInfo.chatId,
    chatTitle: extractedInfo.chatTitle,
    environment: matchedMerchant.environment,
    status: matchedMerchant.status,
    mainMerchantName: matchedMainMerchant.main_merchant_name
  };
  
  console.log('匹配成功:', result);
  return result;
} else {
  const availableMerchants = merchantData.grouped_sub_merchants.map(m => 
    m.sub_merchants.map(s => s.sub_merchant_name)
  ).flat();
  
  return {
    success: false,
    error: `未找到匹配的商户: ${targetMerchant}`,
    targetMerchant: targetMerchant,
    availableMerchants: availableMerchants,
    debugInfo: {
      searchedMerchants: merchantData.grouped_sub_merchants.length,
      totalSubMerchants: availableMerchants.length,
      extractedInfo: extractedInfo
    }
  };
}









