// 精确匹配节点 - 处理负值金额，避免重复匹配
const inputData = $input.all();

console.log('=== 开始精确匹配与状态更新 (含负值处理) ===');
console.log('输入数据类型:', typeof inputData);
console.log('输入数据长度:', inputData.length);

// 处理输入数据 - 兼容Merge节点的输出格式
let allData = [];

// 如果是单个对象，转换为数组
if (inputData.length === 1 && inputData[0].json) {
  const data = inputData[0].json;
  
  // 如果数据本身是数组
  if (Array.isArray(data)) {
    allData = data;
  }
  // 如果是单个对象，包装成数组
  else if (typeof data === 'object') {
    allData = [data];
  }
}
// 如果是多个输入项
else {
  allData = inputData.map(item => item.json).filter(item => item !== null && item !== undefined);
}

console.log('处理后的数据长度:', allData.length);

// 检查数据是否包含必要的字段
if (allData.length === 0) {
  console.error('❌ 没有有效的数据输入');
  return [{ json: { error: 'No valid data input' } }];
}

// 生成表名函数
function generateSheetNames() {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const currentMonthStr = String(currentMonth).padStart(2, '0');
  const currentSheetName = `${year}年${currentMonthStr}月`;
  
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? year - 1 : year;
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const prevSheetName = `${prevYear}年${prevMonthStr}月`;
  
  return {
    current: currentSheetName,
    previous: prevSheetName
  };
}

// 尝试从数据中提取月份信息
function extractMonthFromData(data) {
  for (const item of data) {
    if (item['T 日期']) {
      const dateStr = item['T 日期'];
      const match = dateStr.match(/(\d{4})-(\d{2})/);
      if (match) {
        const [, year, month] = match;
        return `${year}年${month}月`;
      }
    }
    if (item['日期']) {
      const dateStr = item['日期'];
      const match = dateStr.match(/(\d{4})-(\d{2})/);
      if (match) {
        const [, year, month] = match;
        return `${year}年${month}月`;
      }
    }
  }
  return null;
}

// 确定表名
const dataMonth = extractMonthFromData(allData);
const sheetNames = generateSheetNames();

let currentSheetName, previousSheetName;
if (dataMonth) {
  currentSheetName = dataMonth;
  const match = dataMonth.match(/(\d{4})年(\d{2})月/);
  if (match) {
    const [, year, month] = match;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
    const prevYear = monthNum === 1 ? yearNum - 1 : yearNum;
    const prevMonthStr = String(prevMonth).padStart(2, '0');
    previousSheetName = `${prevYear}年${prevMonthStr}月`;
  } else {
    previousSheetName = sheetNames.previous;
  }
} else {
  currentSheetName = sheetNames.current;
  previousSheetName = sheetNames.previous;
}

console.log('当前月表名:', currentSheetName);
console.log('前月表名:', previousSheetName);

// 分离账单数据和转账数据
const billingData = [];
const transferData = [];

allData.forEach((item, index) => {
  // 检查是否包含账单字段
  if (item['商户名'] && item['账单金额'] !== undefined) {
    billingData.push(item);
  }
  // 检查是否包含转账字段
  else if (item['交易哈希'] && item['金额'] && item['交易类型']) {
    transferData.push(item);
  }
  // 如果是合并数据（包含两种字段）
  else if (item['商户名'] && item['交易哈希']) {
    billingData.push({
      row_number: item['# row_number'],
      '日期': item['T 日期'],
      '渠道': item['T 渠道'],
      '商户名': item['T 商户名'],
      '账单金额': item['# 账单金额'],
      '是否支付': item['T 是否支付'],
      '催收记录': item['T 催收记录']
    });
    
    transferData.push({
      '时间': item['T 时间'],
      '发送方': item['T 发送方'],
      '交易哈希': item['T 交易哈希'],
      '金额': item['T 金额'],
      '交易类型': item['T 交易类型']
    });
  }
});

console.log('\n=== 数据分离结果 ===');
console.log('账单数据条数:', billingData.length);
console.log('转账数据条数:', transferData.length);

// 辅助函数：格式化金额用于匹配
function formatAmountForMatch(amount) {
  if (typeof amount === 'number') {
    return Math.round(amount * 100) / 100;
  }
  if (typeof amount === 'string') {
    const match = amount.match(/(\d+\.?\d*)/);
    return match ? Math.round(parseFloat(match[1]) * 100) / 100 : 0;
  }
  return 0;
}

// 辅助函数：提取USDT金额
function extractUSDTAmount(amountStr) {
  if (typeof amountStr === 'string') {
    const match = amountStr.match(/(\d+\.?\d*)\s*USDT/i);
    return match ? parseFloat(match[1]) : 0;
  }
  return 0;
}

// 精确匹配算法 - 只匹配最接近的，避免重复匹配
function findBestMatch(billAmount, billMerchant, transferData, usedTransfers) {
  let bestMatch = null;
  let bestConfidence = 0;
  let bestAmountDiff = Infinity;
  
  // 只考虑精确匹配和百分比匹配
  for (let i = 0; i < transferData.length; i++) {
    const transfer = transferData[i];
    
    // 跳过已使用的转账记录
    if (usedTransfers.has(i)) {
      continue;
    }
    
    const transferAmount = extractUSDTAmount(transfer['金额']);
    const isIncoming = transfer['交易类型'] === '转入';
    
    if (!isIncoming) continue;
    
    const amountDiff = Math.abs(billAmount - transferAmount);
    const percentageDiff = billAmount === 0 ? (transferAmount === 0 ? 0 : Infinity) : (amountDiff / billAmount) * 100;
    
    let confidence = 0;
    let matchReason = '';
    let shouldMatch = false;
    
    // 策略1: 精确匹配 (差异 < 0.01 USDT)
    if (amountDiff < 0.01) {
      confidence = 100;
      matchReason = '金额完全匹配';
      shouldMatch = true;
    }
    // 策略2: 百分比匹配 (差异 < 1%)
    else if (percentageDiff < 1) {
      confidence = 95;
      matchReason = `金额高度匹配 (差异${percentageDiff.toFixed(2)}%)`;
      shouldMatch = true;
    }
    
    // 只记录符合条件的匹配
    if (shouldMatch && amountDiff < bestAmountDiff) {
      bestMatch = {
        transfer,
        transferIndex: i,
        amountDiff,
        confidence,
        matchReason,
        percentageDiff
      };
      bestConfidence = confidence;
      bestAmountDiff = amountDiff;
    }
  }
  
  return bestMatch;
}

// 创建匹配结果数组
const matchingResults = [];
const unmatchedBills = [];
const updatedBills = [];
const negativeBills = []; // 记录负值账单
const usedTransfers = new Set(); // 记录已使用的转账记录索引

// 遍历账单数据，查找匹配的转账记录
billingData.forEach((bill, billIndex) => {
  const billAmount = formatAmountForMatch(bill['账单金额']);
  const billMerchant = bill['商户名'];
  const originalPaymentStatus = bill['是否支付'] || '';
  
  console.log(`\n处理账单 ${billIndex + 1}: ${billMerchant}, 金额: ${billAmount}, 原始支付状态: "${originalPaymentStatus}"`);
  
  // 检查是否为负值金额
  if (billAmount < 0) {
    console.log(`  ⚠️ 检测到负值金额: ${billAmount} USDT，跳过匹配，直接标记为"无需支付"`);
    
    // 负值账单直接标记为"无需支付"
    let finalPaymentStatus = '无需支付';
    let statusUpdated = false;
    
    if (originalPaymentStatus !== '无需支付') {
      statusUpdated = true;
      console.log(`  🔄 自动更新支付状态: "${originalPaymentStatus}" → "无需支付"`);
      
      // 记录需要更新的负值账单
      updatedBills.push({
        row_number: bill['row_number'],
        merchant_name: billMerchant,
        bill_amount: billAmount,
        original_status: originalPaymentStatus,
        new_status: '无需支付',
        match_confidence: 100,
        transfer_hash: 'N/A',
        reason: '负值金额无需匹配'
      });
    }
    
    // 记录负值账单
    negativeBills.push({
      bill_row_number: bill['row_number'],
      merchant_name: billMerchant,
      bill_amount: billAmount,
      payment_status: finalPaymentStatus,
      original_payment_status: originalPaymentStatus,
      status_updated: statusUpdated,
      match_confidence: 100,
      match_reason: '负值金额无需匹配',
      amount_difference: 0,
      percentage_difference: 0,
      transfer_index: -1
    });
    
    return; // 跳过匹配过程
  }
  
  // 使用精确匹配算法（仅对正值金额）
  const bestMatch = findBestMatch(billAmount, billMerchant, transferData, usedTransfers);
  
  if (bestMatch && bestMatch.confidence >= 95) {
    // 标记该转账记录为已使用
    usedTransfers.add(bestMatch.transferIndex);
    
    console.log(`  ✅ 找到精确匹配: 转账金额 ${bestMatch.transfer['金额']}, 差异: ${bestMatch.amountDiff}, 置信度: ${bestMatch.confidence}%`);
    console.log(`  📝 交易哈希: ${bestMatch.transfer['交易哈希']}`);
    console.log(`  🎯 匹配原因: ${bestMatch.matchReason}`);
    console.log(`  🔒 转账记录已标记为已使用 (索引: ${bestMatch.transferIndex})`);
    
    // 确定最终支付状态
    let finalPaymentStatus = originalPaymentStatus;
    let statusUpdated = false;
    
    // 找到精确匹配，自动更新支付状态为"是"
    if (originalPaymentStatus !== '是') {
      finalPaymentStatus = '是';
      statusUpdated = true;
      console.log(`  🔄 自动更新支付状态: "${originalPaymentStatus}" → "是"`);
      
      // 记录需要更新的账单
      updatedBills.push({
        row_number: bill['row_number'],
        merchant_name: billMerchant,
        bill_amount: billAmount,
        original_status: originalPaymentStatus,
        new_status: '是',
        match_confidence: bestMatch.confidence,
        transfer_hash: bestMatch.transfer['交易哈希'],
        reason: '找到精确匹配的转账记录'
      });
    }
    
    matchingResults.push({
      bill_row_number: bill['row_number'],
      merchant_name: billMerchant,
      bill_amount: billAmount,
      payment_status: finalPaymentStatus,
      original_payment_status: originalPaymentStatus,
      status_updated: statusUpdated,
      matched_hash: bestMatch.transfer['交易哈希'],
      matched_amount: bestMatch.transfer['金额'],
      matched_time: bestMatch.transfer['时间'],
      matched_sender: bestMatch.transfer['发送方'],
      match_confidence: bestMatch.confidence,
      match_reason: bestMatch.matchReason,
      amount_difference: bestMatch.amountDiff,
      percentage_difference: bestMatch.percentageDiff,
      transfer_index: bestMatch.transferIndex
    });
  } else {
    console.log(`  ❌ 未找到精确匹配的转账记录 (要求: 差异<0.01 USDT 或 差异<1%)`);
    unmatchedBills.push({
      merchant_name: billMerchant,
      bill_amount: billAmount,
      row_number: bill['row_number'],
      payment_status: originalPaymentStatus
    });
  }
});

// 统计匹配结果
const totalBills = billingData.length;
const matchedBills = matchingResults.length;
const unmatchedBillsCount = unmatchedBills.length;
const negativeBillsCount = negativeBills.length;
const statusUpdatedBills = updatedBills.length;
const usedTransfersCount = usedTransfers.size;
const exactMatches = matchingResults.filter(r => r.match_confidence === 100).length;
const percentageMatches = matchingResults.filter(r => r.match_confidence === 95).length;

console.log('\n=== 精确匹配统计 (含负值处理) ===');
console.log(`总账单数: ${totalBills}`);
console.log(`匹配成功: ${matchedBills}`);
console.log(`未匹配: ${unmatchedBillsCount}`);
console.log(`负值账单: ${negativeBillsCount}`);
console.log(`自动更新支付状态: ${statusUpdatedBills}`);
console.log(`已使用转账记录: ${usedTransfersCount}`);
console.log(`精确匹配 (差异<0.01): ${exactMatches}`);
console.log(`百分比匹配 (差异<1%): ${percentageMatches}`);

// 显示需要更新支付状态的账单
if (updatedBills.length > 0) {
  console.log('\n=== 需要更新支付状态的账单 ===');
  updatedBills.forEach((bill, index) => {
    console.log(`${index + 1}. ${bill.merchant_name}: ${bill.bill_amount} USDT (行号: ${bill.row_number})`);
    console.log(`   状态更新: "${bill.original_status}" → "${bill.new_status}" (置信度: ${bill.match_confidence}%)`);
    console.log(`   更新原因: ${bill.reason}`);
    if (bill.transfer_hash !== 'N/A') {
      console.log(`   匹配哈希: ${bill.transfer_hash}`);
    }
  });
}

// 显示负值账单
if (negativeBills.length > 0) {
  console.log('\n=== 负值账单 (无需匹配) ===');
  negativeBills.forEach((bill, index) => {
    console.log(`${index + 1}. ${bill.merchant_name}: ${bill.bill_amount} USDT (行号: ${bill.bill_row_number})`);
    console.log(`   支付状态: "${bill.payment_status}" (${bill.match_reason})`);
  });
}

// 显示未匹配的账单
if (unmatchedBills.length > 0) {
  console.log('\n=== 未匹配的账单 ===');
  unmatchedBills.forEach((bill, index) => {
    console.log(`${index + 1}. ${bill.merchant_name}: ${bill.bill_amount} USDT (行号: ${bill.row_number}, 支付状态: "${bill.payment_status}")`);
  });
}

// 显示已使用的转账记录
if (usedTransfers.size > 0) {
  console.log('\n=== 已使用的转账记录 ===');
  const usedTransferList = Array.from(usedTransfers).map(index => {
    const transfer = transferData[index];
    return {
      index,
      hash: transfer['交易哈希'],
      amount: transfer['金额'],
      time: transfer['时间']
    };
  });
  
  usedTransferList.forEach((transfer, index) => {
    console.log(`${index + 1}. 索引${transfer.index}: ${transfer.amount} (${transfer.hash}) - ${transfer.time}`);
  });
}

// 为Google Sheets准备输出数据
const sheetsOutputData = [
  // 匹配成功的账单
  ...matchingResults.map((result, index) => ({
    // 基础信息
    '账单行号': result.bill_row_number,
    '商户名称': result.merchant_name,
    '账单金额': result.bill_amount,
    '支付状态': result.payment_status,
    '原始支付状态': result.original_payment_status,
    '状态已更新': result.status_updated ? '是' : '否',
    
    // 匹配信息
    '交易哈希': result.matched_hash,
    '转账金额': result.matched_amount,
    '转账时间': result.matched_time,
    '发送方地址': result.matched_sender,
    
    // 匹配质量
    '匹配置信度': result.match_confidence,
    '匹配原因': result.match_reason,
    '金额差异': result.amount_difference,
    '百分比差异': result.percentage_difference,
    '转账记录索引': result.transfer_index,
    
    // 元数据
    '处理时间': new Date().toISOString(),
    '表名': currentSheetName,
    '前月表名': previousSheetName,
    '记录序号': index + 1,
    '账单类型': '正值匹配'
  })),
  
  // 负值账单
  ...negativeBills.map((result, index) => ({
    // 基础信息
    '账单行号': result.bill_row_number,
    '商户名称': result.merchant_name,
    '账单金额': result.bill_amount,
    '支付状态': result.payment_status,
    '原始支付状态': result.original_payment_status,
    '状态已更新': result.status_updated ? '是' : '否',
    
    // 匹配信息
    '交易哈希': 'N/A',
    '转账金额': 'N/A',
    '转账时间': 'N/A',
    '发送方地址': 'N/A',
    
    // 匹配质量
    '匹配置信度': result.match_confidence,
    '匹配原因': result.match_reason,
    '金额差异': result.amount_difference,
    '百分比差异': result.percentage_difference,
    '转账记录索引': result.transfer_index,
    
    // 元数据
    '处理时间': new Date().toISOString(),
    '表名': currentSheetName,
    '前月表名': previousSheetName,
    '记录序号': matchingResults.length + index + 1,
    '账单类型': '负值无需匹配'
  }))
];

console.log('\n=== Google Sheets输出数据 ===');
console.log(`准备写入 ${sheetsOutputData.length} 条记录`);
console.log(`其中 ${matchingResults.length} 条为匹配成功的记录`);
console.log(`其中 ${negativeBills.length} 条为负值账单记录`);
console.log(`总共 ${statusUpdatedBills} 条记录的支付状态已自动更新`);
console.log(`使用了 ${usedTransfersCount} 条转账记录，避免了重复匹配`);

// 如果没有记录，返回空结果
if (sheetsOutputData.length === 0) {
  console.log('⚠️ 没有处理任何记录，返回空结果');
  return [];
}

// 返回结果
return sheetsOutputData.map(item => ({ json: item }));
