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

// 格式化查询结果为可读消息的函数
function formatQueryResult(result, index = 1) {
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
  const message = `🔍 **查询结果 ${index}**

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

// 处理所有输入项目
const results = [];

for (let i = 0; i < inputData.length; i++) {
  const item = inputData[i];
  console.log(`处理第${i+1}个项目:`, item);
  
  // 获取查询结果数据
  let queryResult = item.json;
  
  // 如果查询结果是数组，取第一个元素
  if (Array.isArray(queryResult)) {
    queryResult = queryResult[0];
    console.log('查询结果是数组，取第一个元素');
  }
  
  console.log('处理后的查询结果:', queryResult);
  
  // 检查查询结果是否包含必要字段
  if (!queryResult || !queryResult.id) {
    console.log(`第${i+1}个项目格式不正确，跳过`);
    continue;
  }
  
  // 生成格式化消息
  const formattedMessage = formatQueryResult(queryResult, i + 1);
  
  console.log(`第${i+1}个项目格式化消息长度:`, formattedMessage.length);
  
  // 添加到结果数组
  results.push({
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
  });
}

console.log('总共处理了', results.length, '个查询结果');

// 如果只有一个结果，直接返回
if (results.length === 1) {
  return results[0];
}

// 如果有多个结果，返回汇总信息
if (results.length > 1) {
  const totalAmount = results.reduce((sum, r) => sum + parseFloat(r.queryData.amount || 0), 0);
  const totalPayout = results.reduce((sum, r) => sum + parseFloat(r.queryData.pay_out || 0), 0);
  const winCount = results.filter(r => r.queryData.result === '1').length;
  
  const summaryMessage = `📊 **批量查询结果汇总**

✅ 成功查询 ${results.length} 个投注记录
🎯 获胜记录: ${winCount} 个
💰 总投注金额: ${totalAmount.toFixed(2)}
💸 总派奖金额: ${totalPayout.toFixed(2)}

📋 **详细结果:**`;

  return {
    success: true,
    message: summaryMessage,
    totalResults: results.length,
    winCount: winCount,
    totalAmount: totalAmount,
    totalPayout: totalPayout,
    results: results,
    individualMessages: results.map(r => r.message)
  };
}

// 没有有效结果
return {
  success: false,
  error: '没有找到有效的查询结果',
  processedCount: results.length
};
