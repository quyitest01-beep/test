// 测试综合时间计算器

console.log('=== 测试综合时间计算器 ===');

// 测试函数
function calculateComprehensiveTime(todayDate) {
  let today;
  
  if (typeof todayDate === 'string') {
    if (todayDate.includes('.')) {
      const parts = todayDate.split('.');
      today = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (todayDate.includes('-')) {
      today = new Date(todayDate);
    } else if (todayDate.length === 8) {
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
  
  // 计算上周
  const todayDayOfWeek = today.getDay();
  let daysToLastMonday;
  if (todayDayOfWeek === 0) {
    daysToLastMonday = 6;
  } else {
    daysToLastMonday = todayDayOfWeek + 6;
  }
  
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  // 计算上月
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
  
  const lastWeekStart = formatDate(lastMonday);
  const lastWeekEnd = formatDate(lastSunday);
  const lastWeekRange = `${lastWeekStart}-${lastWeekEnd}`;
  
  const lastMonthStart = formatDate(lastMonthFirstDay);
  const lastMonthEnd = formatDate(lastMonthLastDay);
  const lastMonthRange = `${lastMonthStart}-${lastMonthEnd}`;
  const lastMonthStr = `${lastMonthYear}${String(lastMonth + 1).padStart(2, '0')}`;
  
  return {
    today: today.toISOString().split('T')[0],
    todayDayOfWeek: todayDayOfWeek,
    todayDayOfWeekName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][todayDayOfWeek],
    currentYear: currentYear,
    currentMonth: currentMonth + 1,
    lastWeekRange: lastWeekRange,
    lastWeekStart: lastWeekStart,
    lastWeekEnd: lastWeekEnd,
    lastMonthRange: lastMonthRange,
    lastMonthStart: lastMonthStart,
    lastMonthEnd: lastMonthEnd,
    lastMonthStr: lastMonthStr,
    lastMonthYear: lastMonthYear,
    lastMonth: lastMonth + 1,
    daysInLastMonth: lastMonthLastDay.getDate()
  };
}

// 验证特定用例
console.log('验证特定用例:');
console.log('='.repeat(100));

// 用例1: 2025.10.21 (周二)
const result1 = calculateComprehensiveTime('2025.10.21');
console.log('用例1: 2025.10.21 (周二)');
console.log('今日信息:');
console.log(`  日期: ${result1.today}`);
console.log(`  星期: ${result1.todayDayOfWeekName}`);
console.log(`  年月: ${result1.currentYear}年${result1.currentMonth}月`);
console.log('上周信息:');
console.log(`  范围: ${result1.lastWeekRange}`);
console.log(`  开始: ${result1.lastWeekStart}`);
console.log(`  结束: ${result1.lastWeekEnd}`);
console.log('上月信息:');
console.log(`  范围: ${result1.lastMonthRange}`);
console.log(`  月份: ${result1.lastMonthStr} (${result1.lastMonth}月)`);
console.log(`  天数: ${result1.daysInLastMonth}天`);
console.log('验证:');
console.log(`  上周: ${result1.lastWeekRange === '20251013-20251019' ? '✅ 正确' : '❌ 错误'}`);
console.log(`  上月: ${result1.lastMonthRange === '20250901-20250930' ? '✅ 正确' : '❌ 错误'}`);
console.log('');

// 用例2: 2025.01.15 (周三)
const result2 = calculateComprehensiveTime('2025.01.15');
console.log('用例2: 2025.01.15 (周三)');
console.log('今日信息:');
console.log(`  日期: ${result2.today}`);
console.log(`  星期: ${result2.todayDayOfWeekName}`);
console.log(`  年月: ${result2.currentYear}年${result2.currentMonth}月`);
console.log('上周信息:');
console.log(`  范围: ${result2.lastWeekRange}`);
console.log(`  开始: ${result2.lastWeekStart}`);
console.log(`  结束: ${result2.lastWeekEnd}`);
console.log('上月信息:');
console.log(`  范围: ${result2.lastMonthRange}`);
console.log(`  月份: ${result2.lastMonthStr} (${result2.lastMonth}月)`);
console.log(`  天数: ${result2.daysInLastMonth}天`);
console.log('验证:');
console.log(`  上周: ${result2.lastWeekRange === '20250106-20250112' ? '✅ 正确' : '❌ 错误'}`);
console.log(`  上月: ${result2.lastMonthRange === '20241201-20241231' ? '✅ 正确' : '❌ 错误'}`);
console.log('');

// 用例3: 2025.03.31 (周一)
const result3 = calculateComprehensiveTime('2025.03.31');
console.log('用例3: 2025.03.31 (周一)');
console.log('今日信息:');
console.log(`  日期: ${result3.today}`);
console.log(`  星期: ${result3.todayDayOfWeekName}`);
console.log(`  年月: ${result3.currentYear}年${result3.currentMonth}月`);
console.log('上周信息:');
console.log(`  范围: ${result3.lastWeekRange}`);
console.log(`  开始: ${result3.lastWeekStart}`);
console.log(`  结束: ${result3.lastWeekEnd}`);
console.log('上月信息:');
console.log(`  范围: ${result3.lastMonthRange}`);
console.log(`  月份: ${result3.lastMonthStr} (${result3.lastMonth}月)`);
console.log(`  天数: ${result3.daysInLastMonth}天`);
console.log('验证:');
console.log(`  上周: ${result3.lastWeekRange === '20250324-20250330' ? '✅ 正确' : '❌ 错误'}`);
console.log(`  上月: ${result3.lastMonthRange === '20250201-20250228' ? '✅ 正确' : '❌ 错误'}`);
console.log('');

// 测试一周内的所有日期
console.log('='.repeat(100));
console.log('测试一周内的所有日期 (2025.10.21-2025.10.27):');
console.log('');

const weekDates = [
  '2025.10.21', // 周二
  '2025.10.22', // 周三
  '2025.10.23', // 周四
  '2025.10.24', // 周五
  '2025.10.25', // 周六
  '2025.10.26', // 周日
  '2025.10.27', // 周一
];

weekDates.forEach((date, index) => {
  const result = calculateComprehensiveTime(date);
  console.log(`${index + 1}. 今日: ${date} (${result.todayDayOfWeekName})`);
  console.log(`   上周: ${result.lastWeekRange}`);
  console.log(`   上月: ${result.lastMonthRange} (${result.lastMonthStr})`);
  console.log('');
});

// 测试跨年情况
console.log('='.repeat(100));
console.log('测试跨年情况:');
console.log('');

const crossYearDates = [
  '2025.01.01', // 2025年1月1日
  '2025.01.31', // 2025年1月31日
  '2024.12.31', // 2024年12月31日
];

crossYearDates.forEach((date, index) => {
  const result = calculateComprehensiveTime(date);
  console.log(`${index + 1}. 今日: ${date} (${result.todayDayOfWeekName})`);
  console.log(`   上周: ${result.lastWeekRange}`);
  console.log(`   上月: ${result.lastMonthRange} (${result.lastMonthStr})`);
  console.log(`   上月年份: ${result.lastMonthYear}`);
  console.log('');
});

console.log('='.repeat(100));
console.log('测试完成！');









