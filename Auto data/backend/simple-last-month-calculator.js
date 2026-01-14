// 简化版上月日期计算器
// 专门用于n8n工作流，根据今日日期输出上月的日期范围

const inputData = $input.all();

console.log('=== 计算上月日期范围 (简化版) ===');

// 获取今日日期
let today;
if (inputData && inputData.length > 0 && inputData[0].json) {
  const input = inputData[0].json;
  const todayDate = input.todayDate || input.date || input.today;
  
  if (todayDate) {
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
  } else {
    today = new Date();
  }
} else {
  today = new Date();
}

// 验证日期
if (isNaN(today.getTime())) {
  throw new Error('无效的日期格式');
}

console.log('今日日期:', today.toISOString().split('T')[0]);

// 计算上月日期范围
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-11

// 计算上月的年份和月份
let lastMonthYear, lastMonth;
if (currentMonth === 0) {
  // 当前是1月，上月是去年12月
  lastMonthYear = currentYear - 1;
  lastMonth = 11; // 12月 (0-11)
} else {
  // 其他月份，上月是当前年份的前一个月
  lastMonthYear = currentYear;
  lastMonth = currentMonth - 1;
}

// 计算上月的第一天和最后一天
const lastMonthFirstDay = new Date(lastMonthYear, lastMonth, 1);
const lastMonthLastDay = new Date(lastMonthYear, lastMonth + 1, 0); // 下个月的第0天 = 当前月的最后一天

// 格式化为YYYYMMDD格式
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const lastMonthStart = formatDate(lastMonthFirstDay);
const lastMonthEnd = formatDate(lastMonthLastDay);
const lastMonthRange = `${lastMonthStart}-${lastMonthEnd}`;

// 计算上月月份字符串 (YYYYMM格式)
const lastMonthStr = `${lastMonthYear}${String(lastMonth + 1).padStart(2, '0')}`;

console.log('当前年月:', currentYear, currentMonth + 1);
console.log('上月年月:', lastMonthYear, lastMonth + 1);
console.log('上月日期范围:', lastMonthRange);

// 返回结果
return {
  json: {
    lastMonthRange: lastMonthRange,
    lastMonthStart: lastMonthStart,
    lastMonthEnd: lastMonthEnd,
    lastMonthStr: lastMonthStr,
    today: today.toISOString().split('T')[0],
    currentYear: currentYear,
    currentMonth: currentMonth + 1,
    lastMonthYear: lastMonthYear,
    lastMonth: lastMonth + 1
  }
};
