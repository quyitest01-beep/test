// 测试上月日期计算器

console.log('=== 测试上月日期计算器 ===');

// 测试函数
function calculateLastMonth(todayDate) {
  let today;
  
  if (typeof todayDate === 'string') {
    if (todayDate.includes('.')) {
      // 格式: 2025.10.21
      const parts = todayDate.split('.');
      today = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (todayDate.includes('-')) {
      // 格式: 2025-10-21
      today = new Date(todayDate);
    } else if (todayDate.length === 8) {
      // 格式: 20251021
      const year = parseInt(todayDate.substring(0, 4));
      const month = parseInt(todayDate.substring(4, 6)) - 1;
      const day = parseInt(todayDate.substring(6, 8));
      today = new Date(year, month, day);
    } else {
      today = new Date(todayDate);
    }
  } else {
    today = new Date(todayDate);
  }
  
  if (isNaN(today.getTime())) {
    throw new Error('无效的日期格式');
  }
  
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  let lastMonthYear, lastMonth;
  if (currentMonth === 0) {
    lastMonthYear = currentYear - 1;
    lastMonth = 11;
  } else {
    lastMonthYear = currentYear;
    lastMonth = currentMonth - 1;
  }
  
  const lastMonthFirstDay = new Date(lastMonthYear, lastMonth, 1);
  const lastMonthLastDay = new Date(lastMonthYear, lastMonth + 1, 0);
  
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  const lastMonthStart = formatDate(lastMonthFirstDay);
  const lastMonthEnd = formatDate(lastMonthLastDay);
  const lastMonthRange = `${lastMonthStart}-${lastMonthEnd}`;
  const lastMonthStr = `${lastMonthYear}${String(lastMonth + 1).padStart(2, '0')}`;
  
  return {
    today: today.toISOString().split('T')[0],
    currentYear: currentYear,
    currentMonth: currentMonth + 1,
    lastMonthRange: lastMonthRange,
    lastMonthStart: lastMonthStart,
    lastMonthEnd: lastMonthEnd,
    lastMonthStr: lastMonthStr,
    lastMonthYear: lastMonthYear,
    lastMonth: lastMonth + 1,
    lastMonthName: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'][lastMonth],
    daysInLastMonth: lastMonthLastDay.getDate()
  };
}

// 验证特定用例
console.log('验证特定用例:');
console.log('='.repeat(80));

// 用例1: 2025.10.21 -> 上月应该是 20250901-20250930
const result1 = calculateLastMonth('2025.10.21');
console.log('用例1: 2025.10.21 (2025年10月)');
console.log('期望结果: 20250901-20250930');
console.log('实际结果:', result1.lastMonthRange);
console.log('上月月份:', result1.lastMonthStr, `(${result1.lastMonthName})`);
console.log('上月天数:', result1.daysInLastMonth);
console.log('验证:', result1.lastMonthRange === '20250901-20250930' ? '✅ 正确' : '❌ 错误');
console.log('');

// 用例2: 2025.01.15 -> 上月应该是 20241201-20241231
const result2 = calculateLastMonth('2025.01.15');
console.log('用例2: 2025.01.15 (2025年1月)');
console.log('期望结果: 20241201-20241231');
console.log('实际结果:', result2.lastMonthRange);
console.log('上月月份:', result2.lastMonthStr, `(${result2.lastMonthName})`);
console.log('上月天数:', result2.daysInLastMonth);
console.log('验证:', result2.lastMonthRange === '20241201-20241231' ? '✅ 正确' : '❌ 错误');
console.log('');

// 用例3: 2025.03.31 -> 上月应该是 20250201-20250228
const result3 = calculateLastMonth('2025.03.31');
console.log('用例3: 2025.03.31 (2025年3月)');
console.log('期望结果: 20250201-20250228');
console.log('实际结果:', result3.lastMonthRange);
console.log('上月月份:', result3.lastMonthStr, `(${result3.lastMonthName})`);
console.log('上月天数:', result3.daysInLastMonth);
console.log('验证:', result3.lastMonthRange === '20250201-20250228' ? '✅ 正确' : '❌ 错误');
console.log('');

// 用例4: 2024.03.31 -> 上月应该是 20240201-20240229 (闰年)
const result4 = calculateLastMonth('2024.03.31');
console.log('用例4: 2024.03.31 (2024年3月，闰年)');
console.log('期望结果: 20240201-20240229');
console.log('实际结果:', result4.lastMonthRange);
console.log('上月月份:', result4.lastMonthStr, `(${result4.lastMonthName})`);
console.log('上月天数:', result4.daysInLastMonth);
console.log('验证:', result4.lastMonthRange === '20240201-20240229' ? '✅ 正确' : '❌ 错误');
console.log('');

// 测试一年内的所有月份
console.log('='.repeat(80));
console.log('测试一年内的所有月份 (2025年):');
console.log('');

const monthDates = [
  '2025.01.15', // 1月
  '2025.02.15', // 2月
  '2025.03.15', // 3月
  '2025.04.15', // 4月
  '2025.05.15', // 5月
  '2025.06.15', // 6月
  '2025.07.15', // 7月
  '2025.08.15', // 8月
  '2025.09.15', // 9月
  '2025.10.15', // 10月
  '2025.11.15', // 11月
  '2025.12.15', // 12月
];

monthDates.forEach((date, index) => {
  const result = calculateLastMonth(date);
  console.log(`${index + 1}. 今日: ${date} (${result.currentMonth}月)`);
  console.log(`   上月: ${result.lastMonthRange} (${result.lastMonthName})`);
  console.log(`   上月月份: ${result.lastMonthStr}`);
  console.log(`   上月天数: ${result.daysInLastMonth}`);
  console.log('');
});

// 测试跨年情况
console.log('='.repeat(80));
console.log('测试跨年情况:');
console.log('');

const crossYearDates = [
  '2025.01.01', // 2025年1月1日
  '2025.01.31', // 2025年1月31日
  '2024.12.31', // 2024年12月31日
  '2024.01.01', // 2024年1月1日
];

crossYearDates.forEach((date, index) => {
  const result = calculateLastMonth(date);
  console.log(`${index + 1}. 今日: ${date}`);
  console.log(`   上月: ${result.lastMonthRange} (${result.lastMonthName})`);
  console.log(`   上月年份: ${result.lastMonthYear}`);
  console.log(`   上月月份: ${result.lastMonthStr}`);
  console.log('');
});

console.log('='.repeat(80));
console.log('测试完成！');









