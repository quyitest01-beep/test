// 优化版账单金额匹配节点 - 提高相近金额匹配能力
const inputData = $input.all();

console.log('=== 开始优化版账单金额匹配 ===');
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

// 优化版匹配算法 - 支持多种匹配策略
function findBestMatch(billAmount, billMerchant, transferData) {
  let bestMatch = null;
  let bestConfidence = 0;
  let matchStrategy = '';
  
  // 策略1：精确匹配（差异 < 0.01）
  for (const transfer of transferData) {
    const transferAmount = extractUSDTAmount(transfer['金额']);
    const isIncoming = transfer['交易类型'] === '转入';
    
    if (!isIncoming) continue;
    
    const amountDiff = Math.abs(billAmount - transferAmount);
    
    if (amountDiff < 0.01) {
      return {
        transfer,
        amountDiff,
        confidence: 100,
        matchReason: '金额完全匹配',
        strategy: '精确匹配'
      };
    }
  }
  
  // 策略2：百分比匹配（差异 < 1%）
  for (const transfer of transferData) {
    const transferAmount = extractUSDTAmount(transfer['金额']);
    const isIncoming = transfer['交易类型'] === '转入';
    
    if (!isIncoming) continue;
    
    const amountDiff = Math.abs(billAmount - transferAmount);
    const percentageDiff = (amountDiff / billAmount) * 100;
    
    if (percentageDiff < 1 && amountDiff < 10) {
      return {
        transfer,
        amountDiff,
        confidence: 95,
        matchReason: `金额高度匹配 (差异${percentageDiff.toFixed(2)}%)`,
        strategy: '百分比匹配'
      };
    }
  }
  
  // 策略3：固定阈值匹配（差异 < 5 USDT）
  for (const transfer of transferData) {
    const transferAmount = extractUSDTAmount(transfer['金额']);
    const isIncoming = transfer['交易类型'] === '转入';
    
    if (!isIncoming) continue;
    
    const amountDiff = Math.abs(billAmount - transferAmount);
    
    if (amountDiff < 5) {
      const confidence = Math.max(50, 100 - (amountDiff * 10));
      if (confidence > bestConfidence) {
        bestMatch = {
          transfer,
          amountDiff,
          confidence: Math.round(confidence),
          matchReason: `金额相近 (差异${amountDiff.toFixed(2)} USDT)`,
          strategy: '固定阈值匹配'
        };
        bestConfidence = confidence;
      }
    }
  }
  
  // 策略4：相对阈值匹配（差异 < 账单金额的5%）
  for (const transfer of transferData) {
    const transferAmount = extractUSDTAmount(transfer['金额']);
    const isIncoming = transfer['交易类型'] === '转入';
    
    if (!isIncoming) continue;
    
    const amountDiff = Math.abs(billAmount - transferAmount);
    const percentageDiff = (amountDiff / billAmount) * 100;
    
    if (percentageDiff < 5 && amountDiff < 50) {
      const confidence = Math.max(40, 100 - (percentageDiff * 15));
      if (confidence > bestConfidence) {
        bestMatch = {
          transfer,
          amountDiff,
          confidence: Math.round(confidence),
          matchReason: `金额相对匹配 (差异${percentageDiff.toFixed(2)}%)`,
          strategy: '相对阈值匹配'
        };
        bestConfidence = confidence;
      }
    }
  }
  
  return bestMatch;
}

// 创建匹配结果数组
const matchingResults = [];
const unmatchedBills = [];

// 遍历账单数据，查找匹配的转账记录
billingData.forEach((bill, billIndex) => {
  const billAmount = formatAmountForMatch(bill['账单金额']);
  const billMerchant = bill['商户名'];
  const isPaid = bill['是否支付'] === '是';
  
  console.log(`\n处理账单 ${billIndex + 1}: ${billMerchant}, 金额: ${billAmount}, 已支付: ${isPaid}`);
  
  // 如果账单未支付，跳过匹配
  if (!isPaid) {
    console.log(`  ⏭️ 账单未支付，跳过匹配`);
    return;
  }
  
  // 使用优化版匹配算法
  const bestMatch = findBestMatch(billAmount, billMerchant, transferData);
  
  if (bestMatch && bestMatch.confidence >= 40) {
    console.log(`  ✅ 找到匹配: 转账金额 ${bestMatch.transfer['金额']}, 差异: ${bestMatch.amountDiff}, 置信度: ${bestMatch.confidence}%`);
    console.log(`  📝 交易哈希: ${bestMatch.transfer['交易哈希']}`);
    console.log(`  🎯 匹配策略: ${bestMatch.strategy}`);
    
    matchingResults.push({
      bill_row_number: bill['row_number'],
      merchant_name: billMerchant,
      bill_amount: billAmount,
      payment_status: '已支付',
      matched_hash: bestMatch.transfer['交易哈希'],
      matched_amount: bestMatch.transfer['金额'],
      matched_time: bestMatch.transfer['时间'],
      matched_sender: bestMatch.transfer['发送方'],
      match_confidence: bestMatch.confidence,
      match_reason: bestMatch.matchReason,
      amount_difference: bestMatch.amountDiff,
      match_strategy: bestMatch.strategy
    });
  } else {
    console.log(`  ❌ 未找到匹配的转账记录`);
    unmatchedBills.push({
      merchant_name: billMerchant,
      bill_amount: billAmount,
      row_number: bill['row_number']
    });
  }
});

// 统计匹配结果
const totalBills = billingData.length;
const paidBills = billingData.filter(b => b['是否支付'] === '是').length;
const matchedBills = matchingResults.length;
const unmatchedBillsCount = unmatchedBills.length;
const highConfidenceMatches = matchingResults.filter(r => r.match_confidence >= 90).length;
const mediumConfidenceMatches = matchingResults.filter(r => r.match_confidence >= 70 && r.match_confidence < 90).length;
const lowConfidenceMatches = matchingResults.filter(r => r.match_confidence < 70).length;

console.log('\n=== 优化版匹配统计 ===');
console.log(`总账单数: ${totalBills}`);
console.log(`已支付账单: ${paidBills}`);
console.log(`匹配成功: ${matchedBills}`);
console.log(`未匹配: ${unmatchedBillsCount}`);
console.log(`高置信度匹配 (≥90%): ${highConfidenceMatches}`);
console.log(`中等置信度匹配 (70-89%): ${mediumConfidenceMatches}`);
console.log(`低置信度匹配 (<70%): ${lowConfidenceMatches}`);

// 显示未匹配的账单
if (unmatchedBills.length > 0) {
  console.log('\n=== 未匹配的账单 ===');
  unmatchedBills.forEach((bill, index) => {
    console.log(`${index + 1}. ${bill.merchant_name}: ${bill.bill_amount} USDT (行号: ${bill.row_number})`);
  });
}

// 显示匹配策略统计
const strategyStats = {};
matchingResults.forEach(result => {
  const strategy = result.match_strategy;
  strategyStats[strategy] = (strategyStats[strategy] || 0) + 1;
});

console.log('\n=== 匹配策略统计 ===');
Object.entries(strategyStats).forEach(([strategy, count]) => {
  console.log(`${strategy}: ${count} 条`);
});

// 为Google Sheets准备输出数据
const sheetsOutputData = matchingResults.map((result, index) => ({
  // 基础信息
  '账单行号': result.bill_row_number,
  '商户名称': result.merchant_name,
  '账单金额': result.bill_amount,
  '支付状态': result.payment_status,
  
  // 匹配信息
  '交易哈希': result.matched_hash,
  '转账金额': result.matched_amount,
  '转账时间': result.matched_time,
  '发送方地址': result.matched_sender,
  
  // 匹配质量
  '匹配置信度': result.match_confidence,
  '匹配原因': result.match_reason,
  '金额差异': result.amount_difference,
  '匹配策略': result.match_strategy,
  
  // 元数据
  '处理时间': new Date().toISOString(),
  '表名': currentSheetName,
  '前月表名': previousSheetName,
  '记录序号': index + 1
}));

console.log('\n=== Google Sheets输出数据 ===');
console.log(`准备写入 ${sheetsOutputData.length} 条匹配成功的记录`);

// 如果没有匹配成功的记录，返回空结果
if (sheetsOutputData.length === 0) {
  console.log('⚠️ 没有匹配成功的记录，返回空结果');
  return [];
}

// 返回结果
return sheetsOutputData.map(item => ({ json: item }));
