// 匹配商户的Code节点 - 健壮版本
const inputData = $json;

console.log('=== 开始匹配商户 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据是否为数组:', Array.isArray(inputData));
console.log('输入数据长度:', Array.isArray(inputData) ? inputData.length : 'N/A');
console.log('输入数据完整结构:', JSON.stringify(inputData, null, 2).substring(0, 1000));

// 处理输入数据 - 更健壮的方式
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
  
  // 检查是否直接包含商户数据
  if (inputData.grouped_sub_merchants) {
    merchantData = inputData;
    console.log('单个对象包含商户数据');
  }
  
  // 检查是否直接包含TG数据
  if (inputData.extractedData || inputData.messageText) {
    telegramData = inputData;
    console.log('单个对象包含TG数据');
  }
  
  // 检查是否包含合并的数据
  if (inputData.merchantData) {
    merchantData = inputData.merchantData;
    console.log('从合并对象中提取商户数据');
  }
  if (inputData.telegramData) {
    telegramData = inputData.telegramData;
    console.log('从合并对象中提取TG数据');
  }
  
  // 如果还没有找到数据，尝试从对象属性中查找
  if (!merchantData || !telegramData) {
    console.log('尝试从对象属性中查找数据');
    const keys = Object.keys(inputData);
    console.log('对象键:', keys);
    
    // 查找商户数据
    for (const key of keys) {
      const value = inputData[key];
      if (value && typeof value === 'object' && value.grouped_sub_merchants) {
        merchantData = value;
        console.log(`在键 ${key} 中找到商户数据`);
        break;
      }
    }
    
    // 查找TG数据
    for (const key of keys) {
      const value = inputData[key];
      if (value && typeof value === 'object' && (value.extractedData || value.messageText)) {
        telegramData = value;
        console.log(`在键 ${key} 中找到TG数据`);
        break;
      }
    }
  }
} else {
  console.log('输入数据格式不正确，期望数组或对象格式');
  console.log('实际输入:', inputData);
  throw new Error('输入数据格式不正确，期望数组或对象格式');
}

// 输出提取结果
console.log('=== 数据提取结果 ===');
console.log('商户数据:', merchantData ? '已找到' : '未找到');
console.log('TG数据:', telegramData ? '已找到' : '未找到');

if (merchantData) {
  console.log('商户数据键:', Object.keys(merchantData));
  console.log('商户数据主商户数量:', merchantData.grouped_sub_merchants?.length || 0);
}

if (telegramData) {
  console.log('TG数据键:', Object.keys(telegramData));
  if (telegramData.extractedData) {
    console.log('TG提取数据键:', Object.keys(telegramData.extractedData));
  }
}

// 验证数据是否成功提取
if (!merchantData) {
  console.log('错误：无法找到商户数据');
  console.log('输入数据完整结构:', JSON.stringify(inputData, null, 2));
  throw new Error('无法找到商户数据');
}

if (!telegramData) {
  console.log('错误：无法找到TG数据');
  console.log('输入数据完整结构:', JSON.stringify(inputData, null, 2));
  throw new Error('无法找到TG数据');
}

// 从TG数据中提取商户名称
let targetMerchantName = '';
if (telegramData.extractedData && telegramData.extractedData.merchant) {
  targetMerchantName = telegramData.extractedData.merchant.toLowerCase().trim();
  console.log('目标商户名称:', targetMerchantName);
} else if (telegramData.messageText) {
  // 如果extractedData不存在，尝试从messageText中提取
  const merchantMatch = telegramData.messageText.match(/商户[：:]\s*([^\n\r]+)/i);
  if (merchantMatch) {
    targetMerchantName = merchantMatch[1].toLowerCase().trim();
    console.log('从messageText提取商户名称:', targetMerchantName);
  }
} else {
  console.log('未找到目标商户名称');
  throw new Error('未找到目标商户名称');
}

// 在商户数据中查找匹配的商户
let matchedMerchant = null;
let matchedMerchantId = null;
let matchedEnvironment = null;

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
投注id：${telegramData.extractedData?.betId || '未知'}
用户uid：${telegramData.extractedData?.uid || '未知'}
结算时间：${telegramData.extractedData?.time || '未知'}
结算币种：${telegramData.extractedData?.currency || '未知'}
投注金额：${telegramData.extractedData?.amount || '未知'}
派奖金额：${telegramData.extractedData?.payout || '未知'}
chat id:${telegramData.extractedData?.chatId || '未知'}
chat title:"${telegramData.extractedData?.chatTitle || '未知'}"`;

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
    ...(telegramData.extractedData || {}),
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
    },
    dataExtraction: {
      merchantDataFound: !!merchantData,
      telegramDataFound: !!telegramData,
      merchantDataKeys: merchantData ? Object.keys(merchantData) : [],
      telegramDataKeys: telegramData ? Object.keys(telegramData) : []
    }
  }
};










