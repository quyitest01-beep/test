// n8n Code节点：留存数据处理器
// 功能：处理留存数据，按周期分组，区分新用户和活跃用户，输出Top20排行

const inputs = $input.all();
console.log("=== 留存数据处理器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：日期规范化（统一转换为 YYYY-MM-DD 格式）
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  
  // YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // YYYYMMDD 格式
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // 尝试解析为Date对象
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// 工具函数：日期计算（用于自然周判断）
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 将周日转换为6，周一到周六为0-5
  return addDays(new Date(x.getFullYear(), x.getMonth(), x.getDate()), -day);
}

// 工具函数：获取日期所在的自然周范围（周一到周日）
function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const mon = mondayOfWeek(date); // 该周的周一
  const sun = addDays(mon, 6); // 该周的周日
  const startShort = `${fmtDate(mon).substring(5).replace('-', '.')}`;
  const endShort = `${fmtDate(sun).substring(5).replace('-', '.')}`;
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
    display: `${fmtDate(mon)} 至 ${fmtDate(sun)}`,
    displayShort: `${startShort}-${endShort}`
  };
}

// 工具函数：获取日期所在月份范围（整月）
function getMonthRange(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startShort = `${fmtDate(first).substring(5).replace('-', '.')}`;
  const endShort = `${fmtDate(last).substring(5).replace('-', '.')}`;
  return {
    start: fmtDate(first),
    end: fmtDate(last),
    display: `${fmtDate(first)} 至 ${fmtDate(last)}`,
    displayShort: `${startShort}-${endShort}`
  };
}

// 工具函数：解析留存率字符串为数字
function parseRetentionRate(rateStr) {
  if (!rateStr) return 0;
  if (typeof rateStr === 'number') return rateStr;
  if (typeof rateStr === 'string') {
    const cleaned = rateStr.replace('%', '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 工具函数：格式化百分比
function formatPercentage(value) {
  if (!value || value === 0) return '0%';
  return `${value.toFixed(2)}%`;
}

// 步骤1：收集和分类数据
const retentionData = [];

inputs.forEach((input) => {
  const item = input.json;
  
  // 判断数据类型：通过字段名或数据类型字段
  let dataType = item.数据类型 || item.data_type || '';
  let isNewUser = false;
  let isActiveUser = false;
  
  // 如果数据类型字段为空，通过其他字段推断
  if (!dataType) {
    // 如果有 new_date 字段，说明是新用户留存
    if (item.new_date !== undefined) {
      isNewUser = true;
      dataType = 'new_user_retention';
    }
    // 如果有 cohort_date 字段，说明是活跃用户留存
    else if (item.cohort_date !== undefined) {
      isActiveUser = true;
      dataType = 'active_user_retention';
    }
    // 如果都没有，但有留存相关字段，可能是留存数据
    else if (item.d1_retention_rate !== undefined || item.d7_retention_rate !== undefined || 
             item.次日留存率 !== undefined || item['7日留存率'] !== undefined) {
      // 默认作为新用户留存
      isNewUser = true;
      dataType = 'new_user_retention';
    }
    // 如果都没有，跳过
    else {
      return;
    }
  } else {
    // 根据数据类型字段判断
    isNewUser = dataType === '新用户留存' || dataType === 'new_user_retention' || 
                dataType.includes('新用户') || dataType.includes('new');
    isActiveUser = dataType === '活跃用户留存' || dataType === 'active_user_retention' || 
                   dataType.includes('活跃用户') || dataType.includes('active');
  }
  
  // 如果既不是新用户也不是活跃用户，且数据类型字段不为空，检查是否包含留存关键词
  if (!isNewUser && !isActiveUser && dataType) {
    if (!dataType.includes('留存') && !dataType.includes('retention')) {
      return;
    }
    // 默认作为新用户
    isNewUser = true;
  }
  
  // 提取日期（支持多种字段名）
  const dateStr = normalizeDate(
    item.日期 || item.date || item.report_date || 
    item.new_date || item.cohort_date
  );
  if (!dateStr) {
    console.warn(`⚠️ 跳过无日期数据: ${JSON.stringify(item).substring(0, 100)}`);
    return;
  }
  
  // 支持按周/按月分组：通过多种方式判断
  // 1. 检查数据中是否有 d14/d30 字段（月度数据特征）
  const hasD14 = '14日用户数' in item || '14日留存率' in item || 'd14_users' in item || 'd14_retention_rate' in item;
  const hasD30 = '30日用户数' in item || '30日留存率' in item || 'd30_users' in item || 'd30_retention_rate' in item;
  
  // 2. 检查时间范围类型字段（兼容上游输出）
  const timeRangeType = item.时间范围类型 || item.time_range_type || '';
  
  // 3. 检查显式开关
  let periodMode = 'weekly';
  if (hasD14 || hasD30 || timeRangeType === '月度' || timeRangeType === 'monthly') {
    periodMode = 'monthly';
  } else if (item._periodMode === 'monthly' || item.periodMode === 'monthly') {
    periodMode = 'monthly';
  }
  
  // 修复：使用 range 而不是 weekRange
  const range = periodMode === 'monthly' ? getMonthRange(dateStr) : getWeekRange(dateStr);
  if (!range) {
    console.warn(`⚠️ 无法解析日期周期: ${dateStr}`);
    return;
  }
  
  // 提取关键字段（支持多种字段名）
  const merchantName = (item.商户名 || item.merchant_name || item.merchant || '').toString().trim();
  const gameName = (item.游戏名 || item.game_name || item.game_id || '').toString().trim();
  const dailyUsers = parseInt(
    item.当日用户数 || item.当日用户 || item.daily_users || 
    item.users || item.d0_users || 0
  ) || 0;
  
  // 过滤当日用户数 < 50 的记录
  if (!dailyUsers || dailyUsers < 50) {
    return;
  }
  
  // 解析留存率（支持多种字段名）
  const d1Retention = parseRetentionRate(
    item.次日留存率 || item.d1_retention_rate || item['1日留存率'] || '0%'
  );
  const d7Retention = parseRetentionRate(
    item['7日留存率'] || item.d7_retention_rate || '0%'
  );
  
  retentionData.push({
    merchantName: merchantName,
    gameName: gameName,
    date: dateStr,
    weekRange: range,  // 注意：这里使用 weekRange 作为属性名，但变量名是 range
    dailyUsers: dailyUsers,
    d1Retention: d1Retention,
    d7Retention: d7Retention,
    isNewUser: isNewUser || (!isNewUser && !isActiveUser),
    isActiveUser: isActiveUser
  });
});

console.log(`✅ 收集到 ${retentionData.length} 条留存数据`);

// 步骤2：按周期分组
const weeklyData = {};

retentionData.forEach(item => {
  const weekKey = `${item.weekRange.start}_${item.weekRange.end}`;
  if (!weeklyData[weekKey]) {
    weeklyData[weekKey] = {
      weekRange: item.weekRange,
      newUsers: [],
      activeUsers: []
    };
  }
  
  if (item.isNewUser) {
    weeklyData[weekKey].newUsers.push(item);
  } else if (item.isActiveUser) {
    weeklyData[weekKey].activeUsers.push(item);
  }
});

console.log(`📅 识别到 ${Object.keys(weeklyData).length} 个周期`);

// 步骤3：按周期、用户类型、商户+游戏分组并汇总
function processRetentionData(items) {
  // 按商户+游戏分组
  const grouped = {};
  
  items.forEach(item => {
    const key = `${item.merchantName}|||${item.gameName}`;
    if (!grouped[key]) {
      grouped[key] = {
        merchantName: item.merchantName,
        gameName: item.gameName,
        totalDailyUsers: 0,
        d1RetentionSum: 0,
        d7RetentionSum: 0,
        count: 0
      };
    }
    
    grouped[key].totalDailyUsers += item.dailyUsers;
    // 使用加权平均计算留存率（按当日用户数加权）
    grouped[key].d1RetentionSum += item.d1Retention * item.dailyUsers;
    grouped[key].d7RetentionSum += item.d7Retention * item.dailyUsers;
    grouped[key].count += 1;
  });
  
  // 计算加权平均留存率
  const result = Object.values(grouped).map(item => ({
    merchantName: item.merchantName,
    gameName: item.gameName,
    dailyUsers: item.totalDailyUsers,
    d1Retention: item.totalDailyUsers > 0 ? item.d1RetentionSum / item.totalDailyUsers : 0,
    d7Retention: item.totalDailyUsers > 0 ? item.d7RetentionSum / item.totalDailyUsers : 0,
    d1RetentionFormatted: formatPercentage(item.totalDailyUsers > 0 ? item.d1RetentionSum / item.totalDailyUsers : 0),
    d7RetentionFormatted: formatPercentage(item.totalDailyUsers > 0 ? item.d7RetentionSum / item.totalDailyUsers : 0)
  }));
  
  return result;
}

// 步骤4：为每个周期生成Top20排行
const output = {
  periods: []
};

Object.keys(weeklyData).sort().forEach(weekKey => {
  const weekData = weeklyData[weekKey];
  const weekInfo = weekData.weekRange;
  
  console.log(`\n📊 处理周期: ${weekInfo.displayShort}`);
  
  // 处理新用户数据
  const newUsersData = processRetentionData(weekData.newUsers);
  
  // 按次日留存率排序（降序）
  const newUsersTop20D1 = [...newUsersData]
    .sort((a, b) => b.d1Retention - a.d1Retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      d1RetentionFormatted: item.d1RetentionFormatted
    }));
  
  // 按7日留存率排序（降序）
  const newUsersTop20D7 = [...newUsersData]
    .sort((a, b) => b.d7Retention - a.d7Retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      d7RetentionFormatted: item.d7RetentionFormatted
    }));
  
  // 处理活跃用户数据
  const activeUsersData = processRetentionData(weekData.activeUsers);
  
  // 按次日留存率排序（降序）
  const activeUsersTop20D1 = [...activeUsersData]
    .sort((a, b) => b.d1Retention - a.d1Retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      d1RetentionFormatted: item.d1RetentionFormatted
    }));
  
  // 按7日留存率排序（降序）
  const activeUsersTop20D7 = [...activeUsersData]
    .sort((a, b) => b.d7Retention - a.d7Retention)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      merchantName: item.merchantName,
      gameName: item.gameName,
      dailyUsers: item.dailyUsers,
      d7RetentionFormatted: item.d7RetentionFormatted
    }));
  
  output.periods.push({
    period: weekInfo.displayShort,
    periodFull: weekInfo.display,
    startDate: weekInfo.start,
    endDate: weekInfo.end,
    retention: {
      newUsers: {
        top20D1: newUsersTop20D1,
        top20D7: newUsersTop20D7,
        totalItems: newUsersData.length
      },
      activeUsers: {
        top20D1: activeUsersTop20D1,
        top20D7: activeUsersTop20D7,
        totalItems: activeUsersData.length
      }
    }
  });
  
  console.log(`  新用户数据: ${newUsersData.length} 条，Top20 (次日): ${newUsersTop20D1.length} 条，Top20 (7日): ${newUsersTop20D7.length} 条`);
  console.log(`  活跃用户数据: ${activeUsersData.length} 条，Top20 (次日): ${activeUsersTop20D1.length} 条，Top20 (7日): ${activeUsersTop20D7.length} 条`);
});

console.log(`\n✅ 处理完成，共 ${output.periods.length} 个周期`);

// 返回输出结果
return [{
  json: output
}];

