// n8n Code节点：数据预处理器
// 功能：处理上游Merge13类型的数据，按分析维度分类，按周期分成两批数据，剔除无用数据

const inputs = $input.all();
console.log("=== 数据预处理器开始 ===");
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
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
    display: `${fmtDate(mon)} 至 ${fmtDate(sun)}`
  };
}

// 工具函数：判断两个日期是否在同一自然周
function isSameWeek(dateStr1, dateStr2) {
  const week1 = getWeekRange(dateStr1);
  const week2 = getWeekRange(dateStr2);
  if (!week1 || !week2) return false;
  return week1.start === week2.start && week1.end === week2.end;
}

// 工具函数：从字符串中提取日期范围
function extractDateRange(text) {
  if (!text || typeof text !== 'string') return null;
  
  // 格式1："数据日期：20251027-1102"
  let match = text.match(/数据日期[：:]\s*(\d{8})[-\s]+(\d{4})/);
  if (match) {
    const startStr = match[1]; // "20251027"
    const endStr = match[2]; // "1102"
    const startYear = parseInt(startStr.substring(0, 4));
    const startMonth = parseInt(startStr.substring(4, 6));
    const startDay = parseInt(startStr.substring(6, 8));
    const endMonth = parseInt(endStr.substring(0, 2));
    const endDay = parseInt(endStr.substring(2, 4));
    
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    let endYear = startYear;
    if (endMonth < startMonth) {
      endYear = startYear + 1;
    }
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    return { start: startDate, end: endDate };
  }
  
  // 格式2："2025-10-27 至 2025-11-02"
  match = text.match(/(\d{4}-\d{2}-\d{2})\s*[至-]\s*(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return { start: match[1], end: match[2] };
  }
  
  return null;
}

// 工具函数：判断是否为上期数据（基于自然周）
function isPreviousPeriodData(item, currentDateRange) {
  // 1. 优先检查明确的标记
  if (item.is_previous === true || item.period === 'previous') {
    return true;
  }
  if (item.is_previous === false || item.period === 'current') {
    return false;
  }
  
  // 2. 检查时间范围字段
  const timeRange = item.时间范围 || item.time_range;
  if (timeRange === 'prev_week' || timeRange === 'previous_week') {
    return true;
  }
  if (timeRange === 'last_week' || timeRange === 'current_week' || timeRange === '本周') {
    return false;
  }
  
  // 3. 基于自然周判断（核心逻辑）
  const itemDate = normalizeDate(item.日期 || item.date || item.report_date);
  if (itemDate && currentDateRange) {
    // 获取当前报告日期范围所在的自然周
    const currentStart = normalizeDate(currentDateRange.start);
    if (currentStart) {
      const currentWeek = getWeekRange(currentStart);
      if (currentWeek) {
        // 获取item日期所在的自然周
        const itemWeek = getWeekRange(itemDate);
        if (itemWeek) {
          // 如果item所在的自然周与当前报告的自然周相同，则为当前期
          if (itemWeek.start === currentWeek.start && itemWeek.end === currentWeek.end) {
            return false; // 当前期
          }
          // 如果item所在的自然周早于当前报告的自然周，则为上期
          if (itemWeek.start < currentWeek.start) {
            return true; // 上期
          }
        }
      }
    }
  }
  
  return false;
}

// 工具函数：判断数据类型
function getDataType(item) {
  // 1. 留存数据（最优先判断）
  if (item.数据类型 || item.data_type) {
    if (item.次日留存率 !== undefined || item['3日留存率'] !== undefined || 
        item['7日留存率'] !== undefined || item.retention_rate !== undefined ||
        item.d1_retention_rate !== undefined || item.d7_retention_rate !== undefined) {
      return 'retention';
    }
  }
  
  // 2. 商户营收数据
  if ((item.商户名 || item.merchant_name) && 
      (item['GGR-USD'] !== undefined || item['GGR'] !== undefined || 
       item['ggr-usd'] !== undefined || item['ggr'] !== undefined)) {
    return 'merchant_revenue';
  }
  
  // 3. 游戏数据
  if (item.游戏名 || item.game_name || item.game_id) {
    return 'game';
  }
  
  // 4. 投注数据
  if (item['总投注USD'] !== undefined || item['总投注'] !== undefined || 
      item.bet_amount !== undefined || item.total_bet !== undefined) {
    return 'bet';
  }
  
  // 5. 局数数据
  if (item.总局数 !== undefined || item.rounds !== undefined || item.round_count !== undefined) {
    return 'rounds';
  }
  
  // 6. 币种数据
  if (item.币种 || item.货币 || item.currency || item.currency_code) {
    return 'currency';
  }
  
  // 7. 商户数据（通用）
  if (item.商户名 || item.merchant_name || item.merchant_id || item.merchant) {
    return 'merchant';
  }
  
  // 8. 新游戏数据
  if (item.gametype === 'new_game' || item.is_new_game === true) {
    return 'new_game';
  }
  
  return 'unknown';
}

// 全局变量：当前报告日期范围
let currentDateRange = null;

// 步骤1：解析所有输入数据，提取日期范围和分类数据
const processedData = {
  current: {
    merchant_revenue: [],
    retention: [],
    game: [],
    bet: [],
    rounds: [],
    currency: [],
    merchant: [],
    new_game: []
  },
  previous: {
    merchant_revenue: [],
    retention: [],
    game: [],
    bet: [],
    rounds: [],
    currency: [],
    merchant: [],
    new_game: []
  },
  metadata: {
    dateRange: null,
    totalItems: 0,
    parsedItems: 0
  }
};

inputs.forEach((input, index) => {
  const item = input.json;
  processedData.metadata.totalItems++;
  
  // 1. 提取日期范围（优先从表格首行，其次从subject，最后从target_week）
  let dateRange = null;
  
  // 1.1 检查是否有Lark表格原始数据（values数组）
  if (item.data && item.data.valueRange && item.data.valueRange.values && Array.isArray(item.data.valueRange.values)) {
    const values = item.data.valueRange.values;
    
    // 检查第一行是否包含日期标识
    if (values.length > 0 && Array.isArray(values[0]) && values[0].length > 0) {
      const firstCell = values[0][0];
      if (typeof firstCell === 'string' && firstCell.includes('数据日期')) {
        dateRange = extractDateRange(firstCell);
        if (dateRange && !currentDateRange) {
          currentDateRange = dateRange;
          processedData.metadata.dateRange = dateRange;
          console.log(`📅 从表格首行提取日期范围: ${dateRange.start} 至 ${dateRange.end}`);
        }
      }
    }
    
    // 解析values数组为filtered_data（如果需要）
    if ((!item.filtered_data || !Array.isArray(item.filtered_data) || item.filtered_data.length === 0) && values.length >= 2) {
      // 智能检测表头行
      let headerRowIndex = 1;
      let dataStartIndex = 2;
      
      const commonHeaderFields = ['游戏名', '日期', '商户名', 'GGR-USD', '总投注USD', '总局数', '投注用户数', '时间范围', '数据类型'];
      const commonHeaderFieldsEn = ['game_name', 'date', 'merchant_name', 'ggr', 'bet_amount', 'rounds', 'users', 'time_range', 'data_type'];
      
      const row0 = values[0];
      if (Array.isArray(row0) && row0.length > 0) {
        const row0Str = row0.map(cell => String(cell || '')).join('|').toLowerCase();
        const hasHeaderFields0 = commonHeaderFields.some(field => row0Str.includes(field.toLowerCase())) ||
                                 commonHeaderFieldsEn.some(field => row0Str.includes(field.toLowerCase()));
        
        const row1 = values[1];
        let hasHeaderFields1 = false;
        if (Array.isArray(row1) && row1.length > 0) {
          const row1Str = row1.map(cell => String(cell || '')).join('|').toLowerCase();
          hasHeaderFields1 = commonHeaderFields.some(field => row1Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row1Str.includes(field.toLowerCase()));
        }
        
        if (hasHeaderFields0 && !hasHeaderFields1) {
          headerRowIndex = 0;
          dataStartIndex = 1;
        } else if (hasHeaderFields1) {
          headerRowIndex = 1;
          dataStartIndex = 2;
        } else if (row0.every(cell => typeof cell === 'string' && isNaN(parseFloat(cell)))) {
          headerRowIndex = 0;
          dataStartIndex = 1;
        }
      }
      
      const headers = values[headerRowIndex];
      if (Array.isArray(headers) && headers.length > 0 && headers[0]) {
        item.filtered_data = [];
        for (let i = dataStartIndex; i < values.length; i++) {
          const row = values[i];
          if (!Array.isArray(row) || row.length === 0 || !row[0]) {
            continue;
          }
          
          const rowObj = {};
          headers.forEach((header, colIndex) => {
            if (header && typeof header === 'string' && header.trim()) {
              const value = row[colIndex];
              if (value !== null && value !== undefined) {
                rowObj[header.trim()] = value;
              }
            }
          });
          
          if (rowObj['商户名'] || rowObj['游戏名'] || rowObj['merchant_name'] || rowObj['game_name']) {
            item.filtered_data.push(rowObj);
          }
        }
        console.log(`✅ 从values数组解析出 ${item.filtered_data.length} 条数据记录`);
      }
    }
  }
  
  // 1.2 从subject提取
  if (!dateRange && item.subject && typeof item.subject === 'string') {
    dateRange = extractDateRange(item.subject);
    if (dateRange && !currentDateRange) {
      currentDateRange = dateRange;
      processedData.metadata.dateRange = dateRange;
      console.log(`📅 从subject提取日期范围: ${dateRange.start} 至 ${dateRange.end}`);
    }
  }
  
  // 1.3 从target_week提取
  if (!dateRange && item.target_week_start && item.target_week_end) {
    dateRange = {
      start: normalizeDate(item.target_week_start),
      end: normalizeDate(item.target_week_end)
    };
    if (dateRange.start && dateRange.end && !currentDateRange) {
      currentDateRange = dateRange;
      processedData.metadata.dateRange = dateRange;
      console.log(`📅 从target_week提取日期范围: ${dateRange.start} 至 ${dateRange.end}`);
    }
  }
  
  // 2. 处理filtered_data数组（展开并分类）
  if (item.filtered_data && Array.isArray(item.filtered_data)) {
    console.log(`📦 处理filtered_data数组，共 ${item.filtered_data.length} 条记录`);
    
    item.filtered_data.forEach((subItem, subIndex) => {
      // 2.1 如果没有日期字段，添加从父级提取的日期
      if (dateRange && !subItem.日期 && !subItem.date) {
        subItem.日期 = dateRange.start;
        subItem.date = dateRange.start;
        subItem.report_date = dateRange.start;
      }
      
      // 2.2 标记周期（基于自然周）
      const timeRange = subItem.时间范围 || subItem.time_range;
      if (!timeRange) {
        // 如果没有明确的时间范围标记，根据日期所在的自然周判断
        const itemDate = normalizeDate(subItem.日期 || subItem.date || subItem.report_date);
        if (itemDate && currentDateRange) {
          const currentStart = normalizeDate(currentDateRange.start);
          if (currentStart) {
            const currentWeek = getWeekRange(currentStart);
            const itemWeek = getWeekRange(itemDate);
            if (currentWeek && itemWeek) {
              if (itemWeek.start === currentWeek.start && itemWeek.end === currentWeek.end) {
                // 与当前报告在同一自然周
                subItem.period = 'current';
                subItem.is_previous = false;
              } else if (itemWeek.start < currentWeek.start) {
                // 早于当前报告的自然周
                subItem.period = 'previous';
                subItem.is_previous = true;
              }
            }
          }
        }
      } else if (timeRange === 'prev_week' || timeRange === 'previous_week') {
        subItem.period = 'previous';
        subItem.is_previous = true;
      } else if (timeRange === 'last_week' || timeRange === 'current_week' || timeRange === '本周') {
        subItem.period = 'current';
        subItem.is_previous = false;
      }
      
      // 2.3 判断数据类型和周期，分类到对应的数组
      const dataType = getDataType(subItem);
      
      // 2.3.1 留存数据过滤：只保留当日用户数≥50的记录
      if (dataType === 'retention') {
        const dailyUsers = subItem['当日用户数'] || subItem['当日用户'] || subItem.daily_users || subItem.users || 0;
        const dailyUsersNum = typeof dailyUsers === 'string' ? parseInt(dailyUsers) : (typeof dailyUsers === 'number' ? dailyUsers : 0);
        if (dailyUsersNum < 50) {
          console.log(`⚠️ 跳过留存数据（当日用户数${dailyUsersNum} < 50）: ${subItem.游戏名 || subItem.game_name || '未知游戏'} - ${subItem.商户名 || subItem.merchant_name || '未知商户'}`);
          return;
        }
      }
      
      const isPrevious = isPreviousPeriodData(subItem, currentDateRange);
      
      // 清理无用数据：只保留有实际数值的记录
      if (dataType === 'unknown') {
        console.warn(`⚠️ 跳过未知类型数据: ${JSON.stringify(subItem).substring(0, 100)}`);
        return;
      }
      
      // 检查是否有有效数据
      const hasValidData = 
        subItem['GGR-USD'] !== undefined || subItem['GGR'] !== undefined ||
        subItem['ggr-usd'] !== undefined || subItem['ggr'] !== undefined ||
        subItem['总投注USD'] !== undefined || subItem['总投注'] !== undefined ||
        subItem.bet_amount !== undefined ||
        subItem.总局数 !== undefined || subItem.rounds !== undefined ||
        subItem.投注用户数 !== undefined || subItem.users !== undefined ||
        subItem.次日留存率 !== undefined || subItem.retention_rate !== undefined ||
        subItem.商户名 || subItem.merchant_name ||
        subItem.游戏名 || subItem.game_name;
      
      if (!hasValidData) {
        console.warn(`⚠️ 跳过无有效数据记录: ${JSON.stringify(subItem).substring(0, 100)}`);
        return;
      }
      
      // 分类到对应的周期和数据类型
      const targetPeriod = isPrevious ? 'previous' : 'current';
      const targetCategory = processedData[targetPeriod][dataType];
      
      if (targetCategory) {
        targetCategory.push(subItem);
        processedData.metadata.parsedItems++;
      }
    });
    
    return; // 已处理完filtered_data，跳过外层处理
  }
  
  // 3. 处理单个item（非filtered_data数组的情况）
  const dataType = getDataType(item);
  if (dataType === 'unknown') {
    console.warn(`⚠️ 跳过未知类型数据: ${JSON.stringify(item).substring(0, 100)}`);
    return;
  }
  
  // 3.1 留存数据过滤：只保留当日用户数≥50的记录
  if (dataType === 'retention') {
    const dailyUsers = item['当日用户数'] || item['当日用户'] || item.daily_users || item.users || 0;
    const dailyUsersNum = typeof dailyUsers === 'string' ? parseInt(dailyUsers) : (typeof dailyUsers === 'number' ? dailyUsers : 0);
    if (dailyUsersNum < 50) {
      console.log(`⚠️ 跳过留存数据（当日用户数${dailyUsersNum} < 50）: ${item.游戏名 || item.game_name || '未知游戏'} - ${item.商户名 || item.merchant_name || '未知商户'}`);
      return;
    }
  }
  
  // 检查是否有有效数据
  const hasValidData = 
    item['GGR-USD'] !== undefined || item['GGR'] !== undefined ||
    item['ggr-usd'] !== undefined || item['ggr'] !== undefined ||
    item['总投注USD'] !== undefined || item['总投注'] !== undefined ||
    item.bet_amount !== undefined ||
    item.总局数 !== undefined || item.rounds !== undefined ||
    item.投注用户数 !== undefined || item.users !== undefined ||
    item.次日留存率 !== undefined || item.retention_rate !== undefined ||
    item.商户名 || item.merchant_name ||
    item.游戏名 || item.game_name;
  
  if (!hasValidData) {
    console.warn(`⚠️ 跳过无有效数据记录: ${JSON.stringify(item).substring(0, 100)}`);
    return;
  }
  
  // 标记周期（基于自然周）
  if (!item.period && !item.is_previous) {
    const isPrevious = isPreviousPeriodData(item, currentDateRange);
    item.period = isPrevious ? 'previous' : 'current';
    item.is_previous = isPrevious;
  } else if (!item.period && item.is_previous !== undefined) {
    item.period = item.is_previous ? 'previous' : 'current';
  } else if (!item.is_previous && item.period) {
    item.is_previous = item.period === 'previous';
  }
  
  // 分类到对应的周期和数据类型
  const targetPeriod = item.is_previous || item.period === 'previous' ? 'previous' : 'current';
  const targetCategory = processedData[targetPeriod][dataType];
  
  if (targetCategory) {
    targetCategory.push(item);
    processedData.metadata.parsedItems++;
  }
});

// 步骤2：输出处理结果
console.log("\n=== 数据预处理完成 ===");
console.log(`📊 总计输入: ${processedData.metadata.totalItems} 项`);
console.log(`✅ 成功解析: ${processedData.metadata.parsedItems} 项`);
if (processedData.metadata.dateRange) {
  console.log(`📅 报告日期范围: ${processedData.metadata.dateRange.start} 至 ${processedData.metadata.dateRange.end}`);
}

console.log("\n📈 当前期数据统计:");
Object.keys(processedData.current).forEach(type => {
  const count = processedData.current[type].length;
  if (count > 0) {
    console.log(`  - ${type}: ${count} 条`);
  }
});

console.log("\n📉 上期数据统计:");
Object.keys(processedData.previous).forEach(type => {
  const count = processedData.previous[type].length;
  if (count > 0) {
    console.log(`  - ${type}: ${count} 条`);
  }
});

// 返回处理后的数据（扁平化，方便后续节点使用）
const output = [];

// 输出当前期数据
Object.keys(processedData.current).forEach(type => {
  processedData.current[type].forEach(item => {
    output.push({
      json: {
        ...item,
        _dataType: type,
        _period: 'current'
      }
    });
  });
});

// 输出上期数据
Object.keys(processedData.previous).forEach(type => {
  processedData.previous[type].forEach(item => {
    output.push({
      json: {
        ...item,
        _dataType: type,
        _period: 'previous'
      }
    });
  });
});

// 输出元数据（作为最后一个输出项）
output.push({
  json: {
    _metadata: true,
    dateRange: processedData.metadata.dateRange,
    statistics: {
      current: Object.keys(processedData.current).reduce((acc, type) => {
        acc[type] = processedData.current[type].length;
        return acc;
      }, {}),
      previous: Object.keys(processedData.previous).reduce((acc, type) => {
        acc[type] = processedData.previous[type].length;
        return acc;
      }, {}),
      totalInput: processedData.metadata.totalItems,
      totalParsed: processedData.metadata.parsedItems
    }
  }
});

console.log(`\n✅ 输出 ${output.length} 条数据（包含1条元数据）`);
return output;

