// 测试上周日期计算器
// 用于验证不同日期的计算结果

console.log('=== 测试上周日期计算器 ===');

// 测试函数
function calculateLastWeek(todayDate) {
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
  
  const todayDayOfWeek = today.getDay();
  const daysToLastMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek + 6;
  
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToLastMonday);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  const lastWeekStart = formatDate(lastMonday);
  const lastWeekEnd = formatDate(lastSunday);
  const lastWeekRange = `${lastWeekStart}-${lastWeekEnd}`;
  
  return {
    today: today.toISOString().split('T')[0],
    todayDayOfWeek: todayDayOfWeek,
    todayDayOfWeekName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][todayDayOfWeek],
    lastWeekRange: lastWeekRange,
    lastWeekStart: lastWeekStart,
    lastWeekEnd: lastWeekEnd,
    lastMonday: lastMonday.toISOString().split('T')[0],
    lastSunday: lastSunday.toISOString().split('T')[0]
  };
}

// 测试用例
const testCases = [
  '2025.10.21', // 周一
  '2025.10.22', // 周二
  '2025.10.23', // 周三
  '2025.10.24', // 周四
  '2025.10.25', // 周五
  '2025.10.26', // 周六
  '2025.10.27', // 周日
  '2025.10.28', // 周一
  '2025.10.29', // 周二
  '2025.10.30', // 周三
  '2025.10.31', // 周四
  '2025.11.01', // 周五
  '2025.11.02', // 周六
  '2025.11.03', // 周日
];

console.log('测试结果:');
console.log('='.repeat(80));

testCases.forEach((testDate, index) => {
  try {
    const result = calculateLastWeek(testDate);
    console.log(`${index + 1}. 今日: ${testDate} (${result.todayDayOfWeekName})`);
    console.log(`   上周: ${result.lastWeekRange}`);
    console.log(`   上周一: ${result.lastMonday}`);
    console.log(`   上周日: ${result.lastSunday}`);
    console.log('');
  } catch (error) {
    console.log(`${index + 1}. 今日: ${testDate} - 错误: ${error.message}`);
  }
});

// 验证特定用例
console.log('='.repeat(80));
console.log('验证特定用例:');
console.log('');

// 用例1: 2025.10.21 (周一) -> 上周应该是 20251013-20251019
const result1 = calculateLastWeek('2025.10.21');
console.log('用例1: 2025.10.21 (周一)');
console.log('期望结果: 20251013-20251019');
console.log('实际结果:', result1.lastWeekRange);
console.log('验证:', result1.lastWeekRange === '20251013-20251019' ? '✅ 正确' : '❌ 错误');
console.log('');

// 用例2: 2025.10.27 (周日) -> 上周应该是 20251020-20251026
const result2 = calculateLastWeek('2025.10.27');
console.log('用例2: 2025.10.27 (周日)');
console.log('期望结果: 20251020-20251026');
console.log('实际结果:', result2.lastWeekRange);
console.log('验证:', result2.lastWeekRange === '20251020-20251026' ? '✅ 正确' : '❌ 错误');
console.log('');

// 用例3: 2025.11.03 (周日) -> 上周应该是 20251027-20251102
const result3 = calculateLastWeek('2025.11.03');
console.log('用例3: 2025.11.03 (周日)');
console.log('期望结果: 20251027-20251102');
console.log('实际结果:', result3.lastWeekRange);
console.log('验证:', result3.lastWeekRange === '20251027-20251102' ? '✅ 正确' : '❌ 错误');
console.log('');

console.log('='.repeat(80));
console.log('测试完成！');









