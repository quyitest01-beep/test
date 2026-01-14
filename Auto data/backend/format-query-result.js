// 格式化查询结果为Telegram消息
const inputData = $input.all();

console.log('=== 格式化查询结果 ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据长度:', inputData.length);

// 检查输入数据
if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
  return {
    success: false,
    error: '输入数据格式不正确',
    debugInfo: {
      inputType: typeof inputData,
      isArray: Array.isArray(inputData),
      length: inputData ? inputData.length : 'undefined'
    }
  };
}

// 获取查询结果数据
let queryResult = inputData[0].json;

console.log('查询结果数据类型:', typeof queryResult);
console.log('查询结果是否为数组:', Array.isArray(queryResult));

// 如果查询结果是数组，取第一个元素
if (Array.isArray(queryResult)) {
  queryResult = queryResult[0];
  console.log('查询结果是数组，取第一个元素');
}

console.log('处理后的查询结果:', queryResult);

// 检查查询结果是否包含必要字段
if (!queryResult || !queryResult.id) {
  return {
    success: false,
    error: '查询结果格式不正确，缺少必要字段',
    debugInfo: {
      hasId: !!queryResult?.id,
      queryResultKeys: queryResult ? Object.keys(queryResult) : 'undefined'
    }
  };
}

// 格式化查询结果为可读消息
function formatQueryResult(result) {
  const {
    id,
    uid,
    merchant_id,
    game_id,
    game_code,
    result: gameResult,
    currency,
    amount,
    pay_out,
    multiplier,
    balance,
    created_at,
    updated_at
  } = result;

  // 解析游戏详情
  let gameDetail = '';
  try {
    if (result.detail) {
      const detail = JSON.parse(result.detail);
      if (detail.recall) {
        const recall = JSON.parse(detail.recall);
        gameDetail = `\n🎮 游戏详情:\n- 倍数序列: ${recall.multis ? recall.multis.slice(0, 5).join(', ') + '...' : 'N/A'}\n- 种子: ${detail.seed?.seed || 'N/A'}`;
      }
    }
  } catch (e) {
    console.log('解析游戏详情失败:', e.message);
  }

  // 格式化消息
  const message = `🔍 **查询结果**

📋 **基本信息:**
- 投注ID: \`${id}\`
- 用户UID: \`${uid}\`
- 商户ID: \`${merchant_id}\`
- 游戏ID: \`${game_id}\`

🎯 **游戏信息:**
- 游戏代码: \`${game_code}\`
- 游戏结果: ${gameResult === '1' ? '✅ 获胜' : '❌ 失败'}
- 倍数: \`${multiplier}x\`

💰 **金额信息:**
- 投注金额: \`${amount} ${currency}\`
- 派奖金额: \`${pay_out} ${currency}\`
- 余额: \`${balance} ${currency}\`

⏰ **时间信息:**
- 创建时间: \`${created_at}\`
- 更新时间: \`${updated_at}\`${gameDetail}

✅ 查询完成，数据已导出为CSV文件`;

  return message;
}

// 生成格式化消息
const formattedMessage = formatQueryResult(queryResult);

console.log('格式化消息长度:', formattedMessage.length);

// 返回结果
const result = {
  success: true,
  message: formattedMessage,
  queryData: queryResult,
  summary: {
    betId: queryResult.id,
    uid: queryResult.uid,
    merchantId: queryResult.merchant_id,
    gameCode: queryResult.game_code,
    result: queryResult.result === '1' ? '获胜' : '失败',
    amount: queryResult.amount,
    currency: queryResult.currency,
    payout: queryResult.pay_out,
    multiplier: queryResult.multiplier
  }
};

console.log('格式化完成:', result.summary);
return result;
