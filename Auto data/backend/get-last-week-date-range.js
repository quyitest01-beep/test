// 根据今日日期输出上周的日期范围
// 输入: 今日日期 (可选，不提供则使用当前日期)
// 输出: 上周的日期范围 (YYYYMMDD-YYYYMMDD格式)

const inputData = $input.all();

console.log('=== 计算上周日期范围 ===');

// 获取输入参数
let todayDate = null;
if (inputData && inputData.length > 0 && inputData[0].json) {
  const input = inputData[0].json;
  todayDate = input.todayDate || input.date || input.today;
}

// 如果没有提供日期，使用当前日期
if (!todayDate) {
  todayDate = new Date();
  console.log('使用当前日期:', todayDate.toISOString().split('T')[0]);
} else {
  console.log('使用提供的日期:', todayDate);
}

// 解析日期
let today;
if (typeof todayDate === 'string') {
  // 处理不同的日期格式
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
    // 尝试直接解析
    today = new Date(todayDate);
  }
} else if (todayDate instanceof Date) {
  today = new Date(todayDate);
} else {
  today = new Date();
}

// 验证日期是否有效
if (isNaN(today.getTime())) {
  console.error('❌ 无效的日期格式');
  throw new Error('无效的日期格式，请提供正确的日期');
}

console.log('解析后的今日日期:', today.toISOString().split('T')[0]);

// 计算上周的日期范围
// 上周一 = 今日 - 今日的星期几 - 7天
// 上周日 = 上周一 + 6天

// 获取今日是星期几 (0=周日, 1=周一, ..., 6=周六)
const todayDayOfWeek = today.getDay();
console.log('今日是星期:', ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][todayDayOfWeek]);

// 计算上周一
// 如果今日是周日(0)，则上周一是6天前
// 如果今日是周一(1)，则上周一是7天前
// 如果今日是周二(2)，则上周一是8天前
// 以此类推...
const daysToLastMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek + 6;
const lastMonday = new Date(today);
lastMonday.setDate(today.getDate() - daysToLastMonday);

// 计算上周日
const lastSunday = new Date(lastMonday);
lastSunday.setDate(lastMonday.getDate() + 6);

console.log('上周一:', lastMonday.toISOString().split('T')[0]);
console.log('上周日:', lastSunday.toISOString().split('T')[0]);

// 格式化为YYYYMMDD格式
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const lastWeekStart = formatDate(lastMonday);
const lastWeekEnd = formatDate(lastSunday);
const lastWeekRange = `${lastWeekStart}-${lastWeekEnd}`;

console.log('上周日期范围:', lastWeekRange);

// 计算其他有用的日期信息
const thisWeekMonday = new Date(today);
thisWeekMonday.setDate(today.getDate() - todayDayOfWeek + (todayDayOfWeek === 0 ? -6 : 1));

const thisWeekSunday = new Date(thisWeekMonday);
thisWeekSunday.setDate(thisWeekMonday.getDate() + 6);

const thisWeekStart = formatDate(thisWeekMonday);
const thisWeekEnd = formatDate(thisWeekSunday);
const thisWeekRange = `${thisWeekStart}-${thisWeekEnd}`;

console.log('本周日期范围:', thisWeekRange);

// 计算月份信息
const lastWeekMonth = lastMonday.getFullYear() * 100 + (lastMonday.getMonth() + 1);
const thisWeekMonth = thisWeekMonday.getFullYear() * 100 + (thisWeekMonday.getMonth() + 1);

console.log('上周月份:', lastWeekMonth);
console.log('本周月份:', thisWeekMonth);

// 返回结果
const result = {
  // 主要输出
  lastWeekRange: lastWeekRange,
  lastWeekStart: lastWeekStart,
  lastWeekEnd: lastWeekEnd,
  
  // 额外信息
  thisWeekRange: thisWeekRange,
  thisWeekStart: thisWeekStart,
  thisWeekEnd: thisWeekEnd,
  
  // 月份信息
  lastWeekMonth: lastWeekMonth,
  thisWeekMonth: thisWeekMonth,
  
  // 日期详情
  today: today.toISOString().split('T')[0],
  todayDayOfWeek: todayDayOfWeek,
  todayDayOfWeekName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][todayDayOfWeek],
  
  // 计算信息
  calculation: {
    daysToLastMonday: daysToLastMonday,
    lastMondayDate: lastMonday.toISOString().split('T')[0],
    lastSundayDate: lastSunday.toISOString().split('T')[0]
  }
};

console.log('=== 计算结果 ===');
console.log('上周日期范围:', result.lastWeekRange);
console.log('本周日期范围:', result.thisWeekRange);
console.log('上周月份:', result.lastWeekMonth);
console.log('本周月份:', result.thisWeekMonth);

return { json: result };
