// 综合时间计算器
// 根据今日日期输出上周和上月的日期范围
// 用于n8n工作流

const inputData = $input.all();

console.log('=== 综合时间计算器 (上周+上月) ===');

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

// 格式化为YYYYMMDD格式
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 计算上周日期范围
const todayDayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六

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

const lastWeekStart = formatDate(lastMonday);
const lastWeekEnd = formatDate(lastSunday);
const lastWeekRange = `${lastWeekStart}-${lastWeekEnd}`;

console.log('上周日期范围:', lastWeekRange);

// 计算上月日期范围
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-11

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

const lastMonthStart = formatDate(lastMonthFirstDay);
const lastMonthEnd = formatDate(lastMonthLastDay);
const lastMonthRange = `${lastMonthStart}-${lastMonthEnd}`;
const lastMonthStr = `${lastMonthYear}${String(lastMonth + 1).padStart(2, '0')}`;

console.log('上月日期范围:', lastMonthRange);

// 返回结果
return {
  json: {
    // 基础信息
    today: today.toISOString().split('T')[0],
    todayDayOfWeek: todayDayOfWeek,
    todayDayOfWeekName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][todayDayOfWeek],
    currentYear: currentYear,
    currentMonth: currentMonth + 1,
    
    // 上周信息
    lastWeekRange: lastWeekRange,
    lastWeekStart: lastWeekStart,
    lastWeekEnd: lastWeekEnd,
    
    // 上月信息
    lastMonthRange: lastMonthRange,
    lastMonthStart: lastMonthStart,
    lastMonthEnd: lastMonthEnd,
    lastMonthStr: lastMonthStr,
    lastMonthYear: lastMonthYear,
    lastMonth: lastMonth + 1,
    
    // 计算信息
    calculation: {
      daysToLastMonday: daysToLastMonday,
      lastMondayDate: lastMonday.toISOString().split('T')[0],
      lastSundayDate: lastSunday.toISOString().split('T')[0],
      lastMonthFirstDay: lastMonthFirstDay.toISOString().split('T')[0],
      lastMonthLastDay: lastMonthLastDay.toISOString().split('T')[0],
      daysInLastMonth: lastMonthLastDay.getDate()
    }
  }
};









