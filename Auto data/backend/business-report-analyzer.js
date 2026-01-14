// n8n Function节点：业务数据分析器
// 根据业务规则自动生成日报/周报/月报分析结论
// 支持多维度数据分析和智能结论生成

const inputs = $input.all();
console.log("=== 业务数据分析器开始 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 工具函数：计算环比
function calculateChangeRate(current, previous) {
  if (!previous || previous === 0) return null;
  const rate = ((current - previous) / previous * 100).toFixed(1);
  return {
    rate: parseFloat(rate),
    isPositive: rate > 0,
    display: `${rate > 0 ? '+' : ''}${rate}%`
  };
}

// 工具函数：格式化货币
function formatCurrency(amount, currency = 'USD') {
  if (typeof amount === 'string') amount = parseFloat(amount);
  if (isNaN(amount)) return '0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// 工具函数：获取Top N
function getTopN(array, key, n, reverse = false) {
  return [...array]
    .sort((a, b) => reverse ? b[key] - a[key] : a[key] - b[key])
    .slice(0, n);
}

// 工具函数：计算占比
function calculatePercentage(part, total) {
  if (!total || total === 0) return 0;
  return ((part / total) * 100).toFixed(1);
}

// 工具函数：日期计算和周期推断
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(new Date(x.getFullYear(), x.getMonth(), x.getDate()), -day);
}

// 日期规范化函数：将任何格式的日期字符串统一转换为 YYYY-MM-DD 格式
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') {
    // 如果是Date对象或其他类型，尝试转换
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return fmtDate(d);
    }
    return null;
  }
  
  // 已经是 YYYY-MM-DD 格式
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
    return fmtDate(d);
  }
  
  return null;
}

function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const mon = mondayOfWeek(date);
  const sun = addDays(mon, 6);
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
    display: `${fmtDate(mon)} 至 ${fmtDate(sun)}`
  };
}

function getMonthRange(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = date.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  return {
    start: fmtDate(firstDay),
    end: fmtDate(lastDay),
    display: `${y}年${pad2(m + 1)}月`
  };
}

// 步骤1：收集所有输入数据
const dataSources = {
  newGames: [],      // 新游戏数据
  merchant: [],      // 商户数据
  game: [],          // 游戏数据
  bet: [],           // 投注数据
  rounds: [],        // 局数数据
  currency: [],      // 币种数据
  retention: [],     // 留存数据
  previousPeriod: [] // 上期对比数据
};

// 全局变量：从subject提取的报告日期范围
let extractedReportDateRange = null;

// 全局变量：新游戏列表（从第一个组中提取，包含 english_name 和 release_date）
const newGameListFromInput = [];

// 步骤0：先识别第一个组（新游戏列表），这些数据包含 english_name 和 release_date
let firstGroupProcessed = false;
let hasNewGameList = false;

inputs.forEach((input, index) => {
  const item = input.json;
  
  // 检查是否是第一个组的新游戏列表数据（包含 english_name 和 release_date）
  if (!firstGroupProcessed && item.english_name && item.release_date) {
    hasNewGameList = true;
    newGameListFromInput.push({
      english_name: item.english_name.trim(),
      release_date: item.release_date.trim()
    });
    console.log(`✅ 发现新游戏: ${item.english_name} (${item.release_date})`);
    // 跳过后续处理，这些只是标识新游戏的元数据
    return;
  }
  
  // 如果已经收集了新游戏列表，且当前数据项不是新游戏列表，则标记第一个组处理完成
  if (!firstGroupProcessed && hasNewGameList && (!item.english_name || !item.release_date)) {
    firstGroupProcessed = true;
    console.log(`\n🎮 新游戏列表收集完成，共 ${newGameListFromInput.length} 个新游戏`);
    if (newGameListFromInput.length > 0) {
      console.log(`   新游戏列表: ${newGameListFromInput.map(g => g.english_name).join(', ')}`);
    }
  }
  
  // 如果是新游戏列表数据且第一个组已处理完成，跳过（避免重复处理）
  if (item.english_name && item.release_date && firstGroupProcessed) {
    return;
  }
  
  // 首先检查是否有Lark表格原始数据（data.valueRange.values），需要从第一行提取日期范围，并解析为filtered_data
  if (item.data && item.data.valueRange && item.data.valueRange.values && Array.isArray(item.data.valueRange.values)) {
    const values = item.data.valueRange.values;
    let dateRange = null;
    
    // 检查第一行是否包含日期标识（格式："数据日期：20251027-1102"）
    if (values.length > 0 && Array.isArray(values[0]) && values[0].length > 0) {
      const firstCell = values[0][0];
      if (typeof firstCell === 'string' && firstCell.includes('数据日期')) {
        // 提取日期范围：格式可能是 "数据日期：20251027-1102" 或 "数据日期：2025-10-27 至 2025-11-02"
        let dateMatch = firstCell.match(/数据日期[：:]\s*(\d{8})[-\s]+(\d{4})/); // 匹配 "20251027-1102"
        if (!dateMatch) {
          dateMatch = firstCell.match(/数据日期[：:]\s*(\d{4}-\d{2}-\d{2})\s*[至-]\s*(\d{4}-\d{2}-\d{2})/); // 匹配 "2025-10-27 至 2025-11-02"
        }
        
        if (dateMatch) {
          let startDate, endDate;
          if (dateMatch[1].length === 8 && dateMatch[2].length === 4) {
            // 格式：20251027-1102，需要转换
            const startStr = dateMatch[1]; // "20251027"
            const endStr = dateMatch[2]; // "1102"
            const startYear = parseInt(startStr.substring(0, 4));
            const startMonth = parseInt(startStr.substring(4, 6));
            const startDay = parseInt(startStr.substring(6, 8));
            const endMonth = parseInt(endStr.substring(0, 2));
            const endDay = parseInt(endStr.substring(2, 4));
            
            startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`; // "2025-10-27"
            
            // 判断是否跨年：如果结束月份小于开始月份，可能是跨年
            let endYear = startYear;
            if (endMonth < startMonth) {
              endYear = startYear + 1;
            }
            endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`; // "2025-11-02" 或跨年情况
          } else {
            startDate = dateMatch[1];
            endDate = dateMatch[2];
          }
          
          dateRange = {
            start: startDate,
            end: endDate,
            display: `${startDate} 至 ${endDate}`
          };
          
          // 保存到item中，供后续处理使用
          item.extractedDateRange = dateRange;
          // 也保存到全局变量，供后续使用
          if (!extractedReportDateRange) {
            extractedReportDateRange = dateRange;
            console.log(`📅 从表格首行提取日期范围: ${dateRange.display}`);
          }
        }
      }
    }
    
    // 如果filtered_data不存在或为空，但有values数组，解析values为filtered_data
    if ((!item.filtered_data || !Array.isArray(item.filtered_data) || item.filtered_data.length === 0) && values.length >= 2) {
      // 智能检测表头行：检查第0行和第1行，看哪个包含常见字段名
      let headerRowIndex = 1; // 默认为第1行（兼容旧逻辑）
      let dataStartIndex = 2; // 默认从第2行开始
      
      // 常见的中文字段名
      const commonHeaderFields = ['游戏名', '日期', '商户名', 'GGR-USD', '总投注USD', '总局数', '投注用户数', '时间范围', '数据类型'];
      // 常见的英文字段名
      const commonHeaderFieldsEn = ['game_name', 'date', 'merchant_name', 'ggr', 'bet_amount', 'rounds', 'users', 'time_range', 'data_type'];
      
      // 检查第0行是否是表头
      const row0 = values[0];
      if (Array.isArray(row0) && row0.length > 0) {
        const row0Str = row0.map(cell => String(cell || '')).join('|').toLowerCase();
        const hasHeaderFields0 = commonHeaderFields.some(field => row0Str.includes(field.toLowerCase())) ||
                                 commonHeaderFieldsEn.some(field => row0Str.includes(field.toLowerCase()));
        
        // 检查第1行是否是表头
        const row1 = values[1];
        let hasHeaderFields1 = false;
        if (Array.isArray(row1) && row1.length > 0) {
          const row1Str = row1.map(cell => String(cell || '')).join('|').toLowerCase();
          hasHeaderFields1 = commonHeaderFields.some(field => row1Str.includes(field.toLowerCase())) ||
                             commonHeaderFieldsEn.some(field => row1Str.includes(field.toLowerCase()));
        }
        
        // 如果第0行包含表头字段，且第1行不包含（或第1行看起来像数据），则使用第0行作为表头
        if (hasHeaderFields0 && !hasHeaderFields1) {
          headerRowIndex = 0;
          dataStartIndex = 1; // 从第1行开始解析数据
        }
        // 如果第1行包含表头字段，使用第1行作为表头（原有逻辑）
        else if (hasHeaderFields1) {
          headerRowIndex = 1;
          dataStartIndex = 2; // 从第2行开始解析数据
        }
        // 如果都不包含，但第0行看起来像表头（都是字符串且不全是数字），也尝试使用第0行
        else if (row0.every(cell => typeof cell === 'string' && isNaN(parseFloat(cell)))) {
          headerRowIndex = 0;
          dataStartIndex = 1;
        }
      }
      
      const headers = values[headerRowIndex];
      if (Array.isArray(headers) && headers.length > 0 && headers[0]) {
        console.log(`📊 解析values数组，表头行: 第${headerRowIndex}行, 数据从第${dataStartIndex}行开始`);
        console.log(`📊 表头: ${headers.slice(0, 5).join(', ')}... (共${headers.length}列)`);
        
        // 从数据开始行解析数据
        item.filtered_data = [];
        for (let i = dataStartIndex; i < values.length; i++) {
          const row = values[i];
          if (!Array.isArray(row) || row.length === 0 || !row[0]) {
            continue; // 跳过空行
          }
          
          // 将行数据转换为对象
          const rowObj = {};
          headers.forEach((header, colIndex) => {
            if (header && typeof header === 'string' && header.trim()) {
              const value = row[colIndex];
              // 跳过null和undefined，但保留0和空字符串
              if (value !== null && value !== undefined) {
                rowObj[header.trim()] = value;
              }
            }
          });
          
          // 如果有有效的商户名或游戏名，添加到filtered_data
          if (rowObj['商户名'] || rowObj['游戏名'] || rowObj['merchant_name'] || rowObj['game_name']) {
            item.filtered_data.push(rowObj);
          }
        }
        
        console.log(`✅ 从values数组解析出 ${item.filtered_data.length} 条营收数据记录`);
      }
    }
  }
  
  // 然后检查是否有filtered_data或data数组需要展开
  if (item.filtered_data && Array.isArray(item.filtered_data)) {
    console.log(`📦 发现filtered_data数组，展开 ${item.filtered_data.length} 条记录`);
    
    // 从subject中提取日期范围
    let dateRange = null;
    let reportPeriod = null;
    
    // 优先使用从表格首行提取的日期范围
    if (item.extractedDateRange) {
      dateRange = item.extractedDateRange;
      reportPeriod = dateRange.start;
      extractedReportDateRange = dateRange;
      console.log(`📅 使用从表格首行提取的日期范围: ${dateRange.display}`);
    }
    // 其次从subject中提取
    else if (item.subject && typeof item.subject === 'string') {
      // 提取日期范围：如 "2025-10-27 至 2025-11-02"
      const match = item.subject.match(/(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/);
      if (match) {
        dateRange = {
          start: match[1],
          end: match[2],
          display: item.subject
        };
        reportPeriod = match[1]; // 使用开始日期作为报告期
        // 保存到全局变量，供后续使用
        extractedReportDateRange = dateRange;
        console.log(`📅 从subject提取日期范围: ${dateRange.display}`);
      }
    }
    // 最后尝试从target_week_start和target_week_end提取
    else if (item.target_week_start && item.target_week_end) {
      dateRange = {
        start: item.target_week_start,
        end: item.target_week_end,
        display: `${item.target_week_start} 至 ${item.target_week_end}`
      };
      reportPeriod = item.target_week_start;
      extractedReportDateRange = dateRange;
      console.log(`📅 从target_week提取日期范围: ${dateRange.display}`);
    }
    
    item.filtered_data.forEach(subItem => {
      // 如果subItem没有日期字段，添加从subject/target_week/表格首行提取的日期
      if (dateRange && !subItem.日期 && !subItem.date) {
        subItem.日期 = reportPeriod;
        subItem.date = reportPeriod;
        subItem.report_date = reportPeriod;
      }
      
      // 根据"时间范围"字段区分当前期和上期数据（last_week = 当前期，prev_week = 上期）
      const timeRange = subItem.时间范围 || subItem.time_range;
      
      // 如果营收数据没有明确的"时间范围"字段，但父级item有提取的日期范围，则标记为当前期
      if (!timeRange && dateRange && (subItem.商户名 || subItem.merchant_name) && 
          (subItem['GGR-USD'] !== undefined || subItem['GGR'] !== undefined || 
           subItem['ggr-usd'] !== undefined || subItem['ggr'] !== undefined)) {
        // 营收数据，使用父级的日期范围，标记为当前期
        subItem.period = 'current';
        subItem.is_previous = false;
        subItem.时间范围 = 'last_week'; // 标记为当前周，与其他逻辑保持一致
        console.log(`✅ 营收数据根据表格日期范围标记为当前期: ${subItem.商户名 || subItem.merchant_name || '未知商户'}`);
      }
      // 如果有明确的时间范围标识
      else if (timeRange === 'prev_week' || timeRange === 'previous_week') {
        // 标记为上期数据
        subItem.period = 'previous';
        subItem.is_previous = true;
      }
      // 如果时间范围是 last_week 或其他表示当前期的值，确保标记为当前期
      else if (timeRange === 'last_week' || timeRange === 'current_week' || timeRange === '本周') {
        subItem.period = 'current';
        subItem.is_previous = false;
      }
      
      // 递归处理每个子项
      const subInput = { json: subItem };
      // 将处理逻辑内联到这里
      // 1. 留存数据（优先判断，因为有特定的中文字段）
      if (subItem.数据类型 && (subItem.次日留存率 !== undefined || subItem['3日留存率'] !== undefined || subItem['7日留存率'] !== undefined)) {
        dataSources.retention.push(subItem);
        // 如果是上期留存数据，也添加到previousPeriod
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 2. 商户营收数据（包含商户名、GGR等字段）
      else if ((subItem.商户名 && (subItem.GGR !== undefined || subItem['GGR-USD'] !== undefined)) || 
               (subItem.merchant_name && (subItem.ggr !== undefined || subItem['ggr-usd'] !== undefined))) {
        dataSources.merchant.push(subItem);
        // 如果是上期商户数据，也添加到previousPeriod
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 3. 新游戏数据
      else if (subItem.gametype === 'new_game' || subItem.is_new_game) {
        dataSources.newGames.push(subItem);
      }
      // 4. 其他商户数据（有商户名但没有GGR字段，可能包含投注、局数等）
      else if (subItem.merchant_id || subItem.merchant || subItem.商户名) {
        dataSources.merchant.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 5. 游戏数据
      else if (subItem.game_id || subItem.game_name || subItem.游戏名) {
        dataSources.game.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 6. 投注数据
      else if (subItem.bet_amount !== undefined || subItem.总投注 !== undefined || subItem['总投注USD'] !== undefined) {
        dataSources.bet.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 7. 局数数据
      else if (subItem.rounds !== undefined || subItem.round_count !== undefined || subItem.总局数 !== undefined) {
        dataSources.rounds.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 8. 币种数据
      else if (subItem.currency || subItem.currency_code || subItem.货币 || subItem.币种) {
        dataSources.currency.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 9. 其他留存数据
      else if (subItem.retention_rate !== undefined || subItem.d1_retention_rate !== undefined) {
        dataSources.retention.push(subItem);
        if (subItem.is_previous || timeRange === 'prev_week') {
          dataSources.previousPeriod.push(subItem);
        }
      }
      // 10. 已标记的上期数据
      else if (subItem.period === 'previous' || subItem.is_previous) {
        dataSources.previousPeriod.push(subItem);
      }
    });
    return; // 已处理完filtered_data，跳过外层处理
  }
  
  // 根据数据特征分类
  
  // 1. 留存数据（优先判断，因为有特定的中文字段）
  if (item.数据类型 && (item.次日留存率 !== undefined || item['3日留存率'] !== undefined)) {
    dataSources.retention.push(item);
  }
  // 2. 商户营收数据（包含商户名、GGR等字段）
  else if ((item.商户名 && (item.GGR !== undefined || item['GGR-USD'] !== undefined)) || 
           (item.merchant_name && (item.ggr !== undefined || item['ggr-usd'] !== undefined))) {
    dataSources.merchant.push(item);
  }
  // 3. 新游戏数据
  else if (item.gametype === 'new_game' || item.is_new_game) {
    dataSources.newGames.push(item);
  }
  // 4. 其他商户数据
  else if (item.merchant_id || item.merchant || item.商户名) {
    dataSources.merchant.push(item);
  }
  // 5. 游戏数据
  else if (item.game_id || item.game_name || item.游戏名) {
    dataSources.game.push(item);
  }
  // 6. 投注数据
  else if (item.bet_amount !== undefined || item.总投注 !== undefined || item['总投注USD'] !== undefined) {
    dataSources.bet.push(item);
  }
  // 7. 局数数据
  else if (item.rounds !== undefined || item.round_count !== undefined || item.总局数 !== undefined) {
    dataSources.rounds.push(item);
  }
  // 8. 币种数据
  else if (item.currency || item.currency_code || item.货币 || item.币种) {
    dataSources.currency.push(item);
  }
  // 9. 其他留存数据
  else if (item.retention_rate !== undefined || item.d1_retention_rate !== undefined) {
    dataSources.retention.push(item);
  }
  // 10. 上期对比数据
  else if (item.period === 'previous' || item.is_previous) {
    dataSources.previousPeriod.push(item);
  }
  // 11. 未分类数据
  else {
    console.log(`⚠️ 未分类数据项 ${index}:`, Object.keys(item).join(', '));
  }
});

// 如果第一个组还没标记为完成，现在标记
if (!firstGroupProcessed && hasNewGameList) {
  firstGroupProcessed = true;
  console.log(`\n🎮 新游戏列表收集完成，共 ${newGameListFromInput.length} 个新游戏`);
  if (newGameListFromInput.length > 0) {
    console.log(`   新游戏列表: ${newGameListFromInput.map(g => g.english_name).join(', ')}`);
  }
}

console.log("📊 数据分类统计:");
console.log(`   新游戏数据: ${dataSources.newGames.length}`);
console.log(`   商户数据: ${dataSources.merchant.length}`);
console.log(`   游戏数据: ${dataSources.game.length}`);
console.log(`   投注数据: ${dataSources.bet.length}`);
console.log(`   局数数据: ${dataSources.rounds.length}`);
console.log(`   币种数据: ${dataSources.currency.length}`);
console.log(`   留存数据: ${dataSources.retention.length}`);
console.log(`   上期数据: ${dataSources.previousPeriod.length}`);
console.log(`   新游戏列表（从输入中提取）: ${newGameListFromInput.length} 个`);

// 步骤1.5：自动推断报告类型和时间范围
let reportType = 'unknown';
let currentDate = null;
let currentWeekRange = null;
let currentMonthRange = null;
let previousWeekRange = null;
let previousMonthRange = null;

// 优先使用从subject提取的日期范围
if (extractedReportDateRange) {
  currentWeekRange = extractedReportDateRange;
  currentDate = new Date(extractedReportDateRange.start);
  console.log(`📅 使用从subject提取的日期范围: ${extractedReportDateRange.display}`);
  
  // 自动查找上一周的数据
  const prevWeekStart = addDays(new Date(currentWeekRange.start), -7);
  const prevWeekEnd = addDays(prevWeekStart, 6);
  previousWeekRange = {
    start: fmtDate(prevWeekStart),
    end: fmtDate(prevWeekEnd),
    display: `${fmtDate(prevWeekStart)} 至 ${fmtDate(prevWeekEnd)}`
  };
  console.log(`📅 对比周期: ${previousWeekRange.display}`);
  reportType = 'weekly';
} else {
  // 从商户数据或留存数据中提取日期
  if (dataSources.merchant.length > 0) {
    // 尝试从商户数据中提取日期
    const merchantWithDate = dataSources.merchant.find(item => item.日期 || item.date || item.report_date);
    if (merchantWithDate) {
      currentDate = new Date(merchantWithDate.日期 || merchantWithDate.date || merchantWithDate.report_date);
      if (!isNaN(currentDate.getTime())) {
        console.log(`📅 从商户数据推断报告日期: ${fmtDate(currentDate)}`);
      }
    }
  }

  if (!currentDate && dataSources.retention.length > 0) {
    const retentionWithDate = dataSources.retention.find(item => item.日期 || item.date);
    if (retentionWithDate) {
      currentDate = new Date(retentionWithDate.日期 || retentionWithDate.date);
      if (!isNaN(currentDate.getTime())) {
        console.log(`📅 从留存数据推断报告日期: ${fmtDate(currentDate)}`);
      }
    }
  }

  // 根据日期推断当前周期
  if (currentDate && !isNaN(currentDate.getTime())) {
    currentWeekRange = getWeekRange(currentDate);
    currentMonthRange = getMonthRange(currentDate);
    
    if (currentWeekRange) {
      console.log(`📅 当前周期: ${currentWeekRange.display}`);
      
      // 自动查找上一周的数据
      const prevWeekStart = addDays(new Date(currentWeekRange.start), -7);
      const prevWeekEnd = addDays(prevWeekStart, 6);
      previousWeekRange = {
        start: fmtDate(prevWeekStart),
        end: fmtDate(prevWeekEnd),
        display: `${fmtDate(prevWeekStart)} 至 ${fmtDate(prevWeekEnd)}`
      };
      console.log(`📅 对比周期: ${previousWeekRange.display}`);
      
      // 将符合对比周期的数据标记为上期数据
      if (dataSources.previousPeriod.length === 0) {
      console.log(`🔍 自动查找上一周数据...`);
      const autoPrevData = [];
      
      // 从商户数据中查找
      dataSources.merchant.forEach(item => {
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const prevRangeStart = normalizeDate(previousWeekRange.start);
        const prevRangeEnd = normalizeDate(previousWeekRange.end);
        if (itemDate && prevRangeStart && prevRangeEnd && itemDate >= prevRangeStart && itemDate <= prevRangeEnd) {
          autoPrevData.push({ ...item, period: 'previous', is_previous: true });
        }
      });
      
      if (autoPrevData.length > 0) {
        console.log(`✅ 自动找到上一周商户数据: ${autoPrevData.length} 条`);
        dataSources.previousPeriod = autoPrevData;
        if (reportType === 'unknown') {
          reportType = 'weekly';
        }
      }
    }
    
    // 如果没有找到周数据，尝试月对比
    if (reportType === 'unknown' && currentMonthRange) {
      const prevMonthStart = addDays(new Date(currentMonthRange.start), -30);
      const prevMonthRange = getMonthRange(prevMonthStart);
      console.log(`📅 尝试月度对比: ${currentMonthRange.display} vs ${prevMonthRange.display}`);
      reportType = 'monthly';
    }
    
    if (reportType === 'unknown') {
      reportType = 'daily';
    }
    }
  }
}

console.log(`📊 推断报告类型: ${reportType}`);

// 步骤1.6：使用新游戏列表识别新游戏数据（优先使用从输入中提取的新游戏列表）
if (newGameListFromInput.length > 0) {
  console.log(`\n🎮 使用输入的新游戏列表进行识别...`);
  console.log(`📅 报告期间: ${currentWeekRange?.start || '未知'} 至 ${currentWeekRange?.end || '未知'}`);
  
  // 创建新游戏名称映射（小写 -> 原始名称）
  const newGameNameMap = new Map();
  newGameListFromInput.forEach(game => {
    const lowerName = game.english_name.toLowerCase().trim();
    newGameNameMap.set(lowerName, game.english_name.trim());
  });
  
  console.log(`   新游戏列表: ${Array.from(newGameNameMap.values()).join(', ')}`);
  
  // 从商户数据和留存数据中识别新游戏相关的数据
  // 从第6列开始往后的数据（即从索引6开始的所有数据）
  // 对于 filtered_data，我们需要检查每个子项
  
  // 处理商户数据：检查游戏名是否匹配新游戏列表
  dataSources.merchant.forEach(item => {
    const itemGameName = (item.游戏名 || item.game_name || '').trim();
    const itemGameNameLower = itemGameName.toLowerCase();
    
    if (itemGameNameLower && newGameNameMap.has(itemGameNameLower)) {
      // 匹配到新游戏，标记为新游戏数据
      item.is_new_game = true;
      item.gametype = 'new_game';
      item.english_name = newGameNameMap.get(itemGameNameLower);
      
      // 如果数据不在 dataSources.newGames 中，添加进去
      if (!dataSources.newGames.some(g => 
        (g.游戏名 || g.game_name || '').trim().toLowerCase() === itemGameNameLower
      )) {
        dataSources.newGames.push({
          ...item,
          name_key: itemGameNameLower,
          game_name: newGameNameMap.get(itemGameNameLower),
          first_appear_date: item.日期 || item.date || item.report_date || currentWeekRange?.start
        });
      }
    }
  });
  
  // 处理留存数据：检查游戏名是否匹配新游戏列表
  dataSources.retention.forEach(item => {
    const itemGameName = (item.游戏名 || item.game_name || item.game || '').trim();
    const itemGameNameLower = itemGameName.toLowerCase();
    
    if (itemGameNameLower && newGameNameMap.has(itemGameNameLower)) {
      // 匹配到新游戏，标记为新游戏数据
      item.is_new_game = true;
      item.gametype = 'new_game';
      item.english_name = newGameNameMap.get(itemGameNameLower);
      
      // 如果数据不在 dataSources.newGames 中，添加进去
      if (!dataSources.newGames.some(g => 
        (g.游戏名 || g.game_name || g.game || '').trim().toLowerCase() === itemGameNameLower
      )) {
        dataSources.newGames.push({
          ...item,
          name_key: itemGameNameLower,
          game_name: newGameNameMap.get(itemGameNameLower),
          first_appear_date: item.日期 || item.date || currentWeekRange?.start
        });
      }
    }
  });
  
  // 处理游戏数据
  dataSources.game.forEach(item => {
    const itemGameName = (item.游戏名 || item.game_name || item.name || '').trim();
    const itemGameNameLower = itemGameName.toLowerCase();
    
    if (itemGameNameLower && newGameNameMap.has(itemGameNameLower)) {
      item.is_new_game = true;
      item.gametype = 'new_game';
      item.english_name = newGameNameMap.get(itemGameNameLower);
    }
  });
  
  // 处理投注数据
  dataSources.bet.forEach(item => {
    const itemGameName = (item.游戏名 || item.game_name || item.name || '').trim();
    const itemGameNameLower = itemGameName.toLowerCase();
    
    if (itemGameNameLower && newGameNameMap.has(itemGameNameLower)) {
      item.is_new_game = true;
      item.gametype = 'new_game';
      item.english_name = newGameNameMap.get(itemGameNameLower);
    }
  });
  
  console.log(`✅ 新游戏数据识别完成，共识别到 ${dataSources.newGames.length} 条新游戏相关数据`);
  
} else if (reportType !== 'unknown' && currentWeekRange && previousWeekRange) {
  // 如果没有新游戏列表，使用原有的自动识别逻辑（作为后备方案）
  console.log(`🎮 未找到新游戏列表，使用自动识别逻辑...`);
  console.log(`📅 报告期间: ${currentWeekRange.start} 至 ${currentWeekRange.end}`);
  console.log(`📅 对比期间: ${previousWeekRange.start} 至 ${previousWeekRange.end}`);
  console.log(`📊 当前期商户数据: ${dataSources.merchant.filter(item => !item.is_previous && item.period !== 'previous').length} 条`);
  console.log(`📊 当前期留存数据: ${dataSources.retention.filter(item => !item.is_previous && item.period !== 'previous').length} 条`);
  console.log(`📊 上期商户数据: ${dataSources.merchant.filter(item => item.is_previous || item.period === 'previous').length} 条`);
  console.log(`📊 上期留存数据: ${dataSources.retention.filter(item => item.is_previous || item.period === 'previous').length} 条`);
  
  // 从商户数据和留存数据中收集当前期的所有游戏
  // 重要：使用小写标准化游戏名，避免大小写不一致导致的误判
  const currentPeriodGames = new Set();
  const gameFirstAppear = new Map(); // gameName (lowercase) -> firstAppearDate
  const gameUserCount = new Map(); // gameName (lowercase) -> totalUsers
  const gameNameMapping = new Map(); // gameName (lowercase) -> originalGameName (preserve original casing)
  
  // 1. 从当前期的商户数据中收集游戏（当前期数据：没有is_previous标记的数据）
  // 重要：不要严格过滤日期，只要是当前期数据就收集，这样能捕获到在报告期间有数据的新游戏
  const currentMerchantData = dataSources.merchant.filter(item => !item.is_previous && item.period !== 'previous');
  currentMerchantData.forEach(item => {
    const originalGameName = (item.游戏名 || item.game_name || '').trim();
    if (originalGameName && originalGameName !== '合计' && originalGameName !== 'Unknown') {
      const gameName = originalGameName.toLowerCase(); // 标准化为小写
      currentPeriodGames.add(gameName);
      // 保存原始游戏名（保留大小写）
      if (!gameNameMapping.has(gameName)) {
        gameNameMapping.set(gameName, originalGameName);
      }
      // 记录首次出现日期（优先使用报告期间内的日期）
      const itemDateRaw = item.日期 || item.date || item.report_date;
      const itemDate = normalizeDate(itemDateRaw);
      const rangeStart = normalizeDate(currentWeekRange.start);
      const rangeEnd = normalizeDate(currentWeekRange.end);
      if (itemDate && rangeStart && rangeEnd) {
        // 如果日期在报告期间内，记录为首次出现日期
        if (itemDate >= rangeStart && itemDate <= rangeEnd) {
          const existingDate = normalizeDate(gameFirstAppear.get(gameName));
          if (!gameFirstAppear.has(gameName) || !existingDate || itemDate < existingDate) {
            gameFirstAppear.set(gameName, itemDate);
          }
        }
        // 如果还没有记录首次出现日期，且日期不在报告期间内，稍后会在判断新游戏时设置为报告期间的第一天
      } else if (!gameFirstAppear.has(gameName)) {
        // 如果没有日期，使用报告期间的第一天
        gameFirstAppear.set(gameName, rangeStart || currentWeekRange.start);
      }
    }
  });
  
  // 2. 从当前期的留存数据中收集游戏（当前期数据：没有is_previous标记的数据）
  // 重要：不要严格过滤日期，只要是当前期数据就收集
  const currentRetentionData = dataSources.retention.filter(item => !item.is_previous && item.period !== 'previous');
  currentRetentionData.forEach(item => {
    const originalGameName = (item.游戏名 || item.game_name || item.game || '').trim();
    
    if (originalGameName) {
      const gameName = originalGameName.toLowerCase(); // 标准化为小写
      // 只要游戏名存在就添加到当前期游戏集合（不管日期）
      currentPeriodGames.add(gameName);
      // 保存原始游戏名（保留大小写）
      if (!gameNameMapping.has(gameName)) {
        gameNameMapping.set(gameName, originalGameName);
      }
      
      const itemDateRaw = item.日期 || item.date;
      const itemDate = normalizeDate(itemDateRaw);
      const rangeStart = normalizeDate(currentWeekRange.start);
      const rangeEnd = normalizeDate(currentWeekRange.end);
      // 如果有日期且在报告期间内，记录为首次出现日期
      if (itemDate && rangeStart && rangeEnd) {
        if (itemDate >= rangeStart && itemDate <= rangeEnd) {
          const existingDate = normalizeDate(gameFirstAppear.get(gameName));
          if (!gameFirstAppear.has(gameName) || !existingDate || itemDate < existingDate) {
            gameFirstAppear.set(gameName, itemDate);
          }
        }
      }
      
      // 累计用户数（只统计报告期间内的数据）
      if (itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
        const userCount = parseInt(item.当日用户数 || item.d0_users || 0);
        if (!isNaN(userCount) && userCount > 0) {
          gameUserCount.set(gameName, (gameUserCount.get(gameName) || 0) + userCount);
        }
      }
    }
  });
  
  // 3. 从上期数据中收集出现的游戏（用于对比）
  // 改进：不仅从previousPeriod收集，还要从所有数据中根据日期和时间范围字段判断
  const previousPeriodGames = new Set();
  
  // 辅助函数：判断数据是否属于上期
  function isPreviousPeriodData(item) {
    // 优先级1: 检查is_previous标记（最可靠）
    // 如果明确标记为当前期，直接返回false，不再检查其他条件
    if (item.is_previous === false || item.period === 'current') {
      return false;
    }
    // 如果明确标记为上期，直接返回true
    if (item.is_previous === true || item.period === 'previous') {
      return true;
    }
    
    // 优先级2: 检查时间范围字段
    const timeRange = item.时间范围 || item.time_range;
    if (timeRange === 'prev_week' || timeRange === 'previous_week') {
      return true;
    }
    if (timeRange === 'last_week' || timeRange === 'current_week' || timeRange === '本周') {
      return false;
    }
    
    // 优先级3: 检查日期是否在上期范围内（仅当没有明确标记时）
    if (previousWeekRange) {
      const itemDateRaw = item.日期 || item.date || item.report_date;
      if (itemDateRaw) {
        const itemDate = normalizeDate(itemDateRaw);
        const prevRangeStart = normalizeDate(previousWeekRange.start);
        const prevRangeEnd = normalizeDate(previousWeekRange.end);
        // 同时检查是否在报告期内：如果在报告期内，则不是上期数据
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          // 日期在报告期内，不是上期数据
          return false;
        }
        if (itemDate && prevRangeStart && prevRangeEnd && itemDate >= prevRangeStart && itemDate <= prevRangeEnd) {
          // 日期在上期范围内，且不在报告期内，是上期数据
          return true;
        }
      }
    }
    
    return false;
  }
  
  // 从所有商户数据中收集上期游戏（使用小写标准化）
  dataSources.merchant.forEach(item => {
    if (isPreviousPeriodData(item)) {
      const gameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
      if (gameName && gameName !== '合计' && gameName !== 'unknown') {
        previousPeriodGames.add(gameName);
      }
    }
  });
  
  // 从所有留存数据中收集上期游戏（使用小写标准化）
  dataSources.retention.forEach(item => {
    if (isPreviousPeriodData(item)) {
      const gameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
      if (gameName) {
        previousPeriodGames.add(gameName);
      }
    }
  });
  
  // 从previousPeriod中收集（双重保险，使用小写标准化）
  const previousMerchantData = dataSources.previousPeriod.filter(item => 
    item.商户名 || item.merchant_name || item.游戏名 || item.game_name
  );
  previousMerchantData.forEach(item => {
    const gameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
    if (gameName && gameName !== '合计' && gameName !== 'unknown') {
      previousPeriodGames.add(gameName);
    }
  });
  
  const previousRetentionData = dataSources.previousPeriod.filter(item => 
    item.游戏名 || item.game_name || item.game
  );
  previousRetentionData.forEach(item => {
    const gameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
    if (gameName) {
      previousPeriodGames.add(gameName);
    }
  });
  
  // 输出调试信息：显示当前期和上期游戏集合
  console.log(`\n🔍 新游戏识别调试信息:`);
  console.log(`   当前期游戏总数: ${currentPeriodGames.size}`);
  console.log(`   上期游戏总数: ${previousPeriodGames.size}`);
  if (currentPeriodGames.size > 0) {
    const currentGamesList = Array.from(currentPeriodGames).slice(0, 10);
    console.log(`   当前期游戏示例: ${currentGamesList.join(', ')}${currentPeriodGames.size > 10 ? '...' : ''}`);
  }
  if (previousPeriodGames.size > 0) {
    const previousGamesList = Array.from(previousPeriodGames).slice(0, 10);
    console.log(`   上期游戏示例: ${previousGamesList.join(', ')}${previousPeriodGames.size > 10 ? '...' : ''}`);
  }
  
  // 特别检查 "aero rush" 的状态
  const aeroRushLower = 'aero rush';
  if (currentPeriodGames.has(aeroRushLower)) {
    console.log(`\n🔍 发现 "aero rush" 在当前期游戏中`);
    if (previousPeriodGames.has(aeroRushLower)) {
      console.log(`   ⚠️ "aero rush" 也在上期游戏中，可能不是新游戏`);
      // 检查上期数据中"aero rush"的实际日期
      const aeroRushPrevData = dataSources.merchant.filter(item => {
        if (!isPreviousPeriodData(item)) return false;
        const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
        return itemGameName === aeroRushLower;
      });
      if (aeroRushPrevData.length > 0) {
        console.log(`   上期"aero rush"数据条数: ${aeroRushPrevData.length}`);
        aeroRushPrevData.slice(0, 3).forEach((item, idx) => {
          const itemDate = normalizeDate(item.日期 || item.date || item.report_date);
          console.log(`   上期数据${idx + 1}: 日期=${itemDate}, 商户=${item.商户名 || item.merchant_name || '未知'}`);
        });
      }
    } else {
      console.log(`   ✅ "aero rush" 不在上期游戏中，应该是新游戏`);
    }
  } else {
    console.log(`\n⚠️ 未发现 "aero rush" 在当前期游戏中`);
    // 检查是否有类似的游戏名
    const similarGames = Array.from(currentPeriodGames).filter(name => 
      name.includes('aero') || name.includes('rush')
    );
    if (similarGames.length > 0) {
      console.log(`   但发现相似游戏名: ${similarGames.join(', ')}`);
    }
  }
  
  // 4. 识别新游戏：在当前期出现，但在上期未出现的游戏
  const newGames = Array.from(currentPeriodGames)
    .filter(gameName => {
      const originalName = gameNameMapping.get(gameName) || gameName;
      
      // 必须是上期未出现的游戏
      if (previousPeriodGames.has(gameName)) {
        // 额外检查：如果游戏在上期数据中，验证上期数据的日期是否真的在上期范围内
        const prevDataForGame = dataSources.merchant.filter(item => {
          if (!isPreviousPeriodData(item)) return false;
          const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
          return itemGameName === gameName;
        });
        // 如果上期数据确实在上期范围内，则不是新游戏
        if (prevDataForGame.length > 0) {
          console.log(`⚠️ 游戏 ${originalName} 在上期数据中有 ${prevDataForGame.length} 条记录，不是新游戏`);
          return false;
        }
        // 如果上期数据不在上期范围内（可能是误判），则仍然可能是新游戏
        console.log(`⚠️ 游戏 ${originalName} 在上期游戏集合中，但验证上期数据时未找到有效记录，继续判断`);
      }
      
      // 检查游戏是否在报告期间内有数据（通过检查是否有报告期间内的首次出现日期）
      const firstAppearRaw = gameFirstAppear.get(gameName);
      const firstAppear = normalizeDate(firstAppearRaw);
      const rangeStart = normalizeDate(currentWeekRange.start);
      const rangeEnd = normalizeDate(currentWeekRange.end);
      
      // 如果游戏在报告期间内有首次出现日期，直接认可
      if (firstAppear && rangeStart && rangeEnd && firstAppear >= rangeStart && firstAppear <= rangeEnd) {
        console.log(`✅ 游戏 ${originalName} 首次出现在报告期间内: ${firstAppear}`);
        return true;
      }
      
      // 如果游戏没有首次出现日期记录，但确实在currentPeriodGames中，说明它是当前期数据
      // 这种情况下，将其首次出现日期设置为报告期间的第一天
      if (!firstAppear) {
        console.log(`ℹ️ 游戏 ${originalName} 在当前期数据中但无明确日期，使用报告期间第一天作为首次出现日期`);
        gameFirstAppear.set(gameName, rangeStart || currentWeekRange.start);
        return true;
      }
      
      // 如果首次出现日期不在报告期间内，但仍需要检查游戏是否在报告期间内有数据
      // 通过检查merchant和retention数据中是否有报告期间内的记录（使用小写比较）
      const hasDataInReportPeriod = 
        currentMerchantData.some(item => {
          const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
          const itemDateRaw = item.日期 || item.date || item.report_date;
          const itemDate = normalizeDate(itemDateRaw);
          return itemGameName === gameName && 
                 itemDate && rangeStart && rangeEnd &&
                 itemDate >= rangeStart && 
                 itemDate <= rangeEnd;
        }) ||
        currentRetentionData.some(item => {
          const itemGameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
          const itemDateRaw = item.日期 || item.date;
          const itemDate = normalizeDate(itemDateRaw);
          return itemGameName === gameName && 
                 itemDate && rangeStart && rangeEnd &&
                 itemDate >= rangeStart && 
                 itemDate <= rangeEnd;
        });
      
      if (hasDataInReportPeriod && rangeStart && rangeEnd) {
        // 更新首次出现日期为报告期间内的最早日期（使用小写比较）
        let earliestDate = null;
        currentMerchantData.forEach(item => {
          const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
          const itemDateRaw = item.日期 || item.date || item.report_date;
          const itemDate = normalizeDate(itemDateRaw);
          if (itemGameName === gameName && itemDate && 
              itemDate >= rangeStart && itemDate <= rangeEnd) {
            if (!earliestDate || itemDate < earliestDate) {
              earliestDate = itemDate;
            }
          }
        });
        currentRetentionData.forEach(item => {
          const itemGameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
          const itemDateRaw = item.日期 || item.date;
          const itemDate = normalizeDate(itemDateRaw);
          if (itemGameName === gameName && itemDate && 
              itemDate >= rangeStart && itemDate <= rangeEnd) {
            if (!earliestDate || itemDate < earliestDate) {
              earliestDate = itemDate;
            }
          }
        });
        if (earliestDate) {
          gameFirstAppear.set(gameName, earliestDate);
          console.log(`✅ 游戏 ${originalName} 在报告期间内有数据，更新首次出现日期为 ${earliestDate}`);
          return true;
        }
      }
      
      console.log(`⚠️ 游戏 ${originalName} 在当前期数据中，但在报告期间内无数据，跳过 (firstAppear: ${firstAppear}, range: ${rangeStart} - ${rangeEnd})`);
      return false;
    })
    .map(gameName => {
      // 恢复原始游戏名（保留大小写）
      const originalName = gameNameMapping.get(gameName) || gameName;
      return {
        name: originalName, // 使用原始游戏名（保留大小写）
        nameKey: gameName,  // 保存小写key用于后续匹配
        firstAppear: gameFirstAppear.get(gameName) || currentWeekRange.start,
        totalUsers: gameUserCount.get(gameName) || 0
      };
    })
    .sort((a, b) => b.totalUsers - a.totalUsers);
  
  if (newGames.length > 0) {
    console.log(`✅ 识别到 ${newGames.length} 个新游戏: ${newGames.map(g => `${g.name}(${g.firstAppear})`).join(', ')}`);
    // 将新游戏数据添加到dataSources中
    newGames.forEach(game => {
      dataSources.newGames.push({
        game_name: game.name,
        name: game.name,
        name_key: game.nameKey, // 保存小写key用于后续匹配
        ggr: 0, // 后续会从商户数据中计算
        total_users: game.totalUsers,
        is_new_game: true,
        gametype: 'new_game',
        first_appear_date: game.firstAppear
      });
    });
    
    // 调试：检查"Aero Rush"是否在新游戏列表中
    const aeroRushLower = 'aero rush';
    const foundAeroRush = newGames.find(g => g.nameKey === aeroRushLower || g.name.toLowerCase().includes('aero') && g.name.toLowerCase().includes('rush'));
    if (foundAeroRush) {
      console.log(`🔍 调试: 找到"Aero Rush"在新游戏列表中: ${foundAeroRush.name}, firstAppear: ${foundAeroRush.firstAppear}`);
    } else {
      console.log(`⚠️ 调试: 未找到"Aero Rush"在新游戏列表中`);
      console.log(`   当前期游戏集合中是否包含: ${currentPeriodGames.has(aeroRushLower) ? '是' : '否'}`);
      console.log(`   上期游戏集合中是否包含: ${previousPeriodGames.has(aeroRushLower) ? '是' : '否'}`);
      if (gameFirstAppear.has(aeroRushLower)) {
        console.log(`   首次出现日期: ${gameFirstAppear.get(aeroRushLower)}`);
      }
    }
  } else {
    console.log(`ℹ️ 未识别到符合条件的新游戏`);
    console.log(`   当前期游戏数: ${currentPeriodGames.size}`);
    console.log(`   上期游戏数: ${previousPeriodGames.size}`);
    
    // 调试：即使没有识别到新游戏，也检查"Aero Rush"的状态
    const aeroRushLower = 'aero rush';
    console.log(`🔍 调试: 检查"Aero Rush"状态:`);
    console.log(`   当前期游戏集合中是否包含: ${currentPeriodGames.has(aeroRushLower) ? '是' : '否'}`);
    console.log(`   上期游戏集合中是否包含: ${previousPeriodGames.has(aeroRushLower) ? '是' : '否'}`);
    if (gameFirstAppear.has(aeroRushLower)) {
      console.log(`   首次出现日期: ${gameFirstAppear.get(aeroRushLower)}`);
      const firstAppear = normalizeDate(gameFirstAppear.get(aeroRushLower));
      const rangeStart = normalizeDate(currentWeekRange.start);
      const rangeEnd = normalizeDate(currentWeekRange.end);
      console.log(`   首次出现日期(规范化): ${firstAppear}`);
      console.log(`   报告期间: ${rangeStart} 至 ${rangeEnd}`);
      if (firstAppear && rangeStart && rangeEnd) {
        console.log(`   是否在报告期间内: ${firstAppear >= rangeStart && firstAppear <= rangeEnd ? '是' : '否'}`);
      }
    }
  }
}

// 步骤2：执行各维度分析
const analysisResults = {
  reportType: reportType,
  overallGGR: { current: 0, previous: 0, change: null },
  newGameAnalysis: { totalGGR: 0, topGames: [], conclusion: '', totalBet: 0, activeUsers: 0 },
  merchantAnalysis: { topGrowth: [], topDecline: [], conclusion: '' },
  gameAnalysis: { topGrowth: [], topDecline: [], conclusion: '' },
  betAnalysis: { total: 0, change: null, conclusion: '' },
  roundsAnalysis: { total: 0, change: null, avgBet: 0, conclusion: '' },
  currencyAnalysis: { topGrowth: [], topDecline: [], conclusion: '' },
  retentionAnalysis: { newUsers: {}, oldUsers: {}, conclusion: '' },
  activeUsersAnalysis: { total: 0, change: null },
  overallConclusion: ''
};

// 2.1 计算总GGR（只统计正GGR）
let totalGGR = 0;
let totalGGRPrevious = 0;

// 从商户数据汇总GGR（支持中文字段和英文字段，只统计正GGR）
if (dataSources.merchant.length > 0) {
  dataSources.merchant.forEach(item => {
    // 优先使用USD字段，如果没有则使用原始GGR
    const ggr = parseFloat(item['GGR-USD'] || item.ggr || item.gcr || item.gross_revenue || item.GGR || 0);
    // 只累加正GGR
    if (!isNaN(ggr) && ggr > 0) {
      totalGGR += ggr;
    }
  });
}

// 从上期数据计算对比（只统计正GGR）
const prevMerchantData = dataSources.previousPeriod.filter(item => 
  item.merchant_id || item.merchant || item.商户名
);

if (prevMerchantData.length > 0) {
  prevMerchantData.forEach(item => {
    const ggr = parseFloat(item['GGR-USD'] || item.ggr || item.gcr || item.gross_revenue || item.GGR || 0);
    // 只累加正GGR
    if (!isNaN(ggr) && ggr > 0) {
      totalGGRPrevious += ggr;
    }
  });
}

analysisResults.overallGGR = {
  current: totalGGR,
  previous: totalGGRPrevious,
  change: calculateChangeRate(totalGGR, totalGGRPrevious)
};

console.log(`💰 总GGR: ${formatCurrency(totalGGR)} (上期: ${formatCurrency(totalGGRPrevious)})`);

// 2.2 新游戏分析（只有在有新游戏数据时才进行分析）
if (dataSources.newGames.length > 0 && newGameListFromInput.length > 0) {
  // 获取新游戏名称列表（用于筛选数据，优先使用name_key小写key）
  const newGameNames = dataSources.newGames.map(game => 
    (game.name_key || game.game_name || game.name || '').trim().toLowerCase()
  );
  const newGameIds = dataSources.newGames.map(game => 
    (game.game_id || game.id || '').toString().trim()
  ).filter(id => id);
  
  // 先从商户数据中计算每个新游戏的GGR（只统计正GGR，且只统计报告期间内的数据）
  const newGameGGRMap = new Map(); // gameName -> totalGGR
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(item => {
      // 只处理当前期数据（不是上期数据）
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
      const itemGameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
      
      // 检查是否为新游戏
      const isNewGame = newGameNames.includes(itemGameName) || (itemGameId && newGameIds.includes(itemGameId));
      
      if (isNewGame) {
        // 验证日期是否在报告期间内
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          const ggr = parseFloat(item['GGR-USD'] || item.ggr || item.gcr || item.gross_revenue || item.GGR || 0);
          // 只累加正GGR
          if (!isNaN(ggr) && ggr > 0) {
            const currentGGR = newGameGGRMap.get(itemGameName) || 0;
            newGameGGRMap.set(itemGameName, currentGGR + ggr);
          }
        }
      }
    });
  }
  
  // 构建newGameList，使用从商户数据中计算的GGR（优先使用name_key进行匹配）
  const newGameList = dataSources.newGames.map(game => {
    const gameNameKey = (game.name_key || game.game_name || game.name || '').trim().toLowerCase();
    const calculatedGGR = newGameGGRMap.get(gameNameKey) || 0;
    
    return {
      name: game.game_name || game.name || 'Unknown',
      id: game.game_id || game.id,
      ggr: calculatedGGR, // 使用从商户数据中计算的GGR
      merchants: game.top_merchants || [],
      currencies: game.currencies || [],
      date: game.date || game.report_date,
      first_appear_date: game.first_appear_date || null // 新增：首次出现日期
    };
  });
  
  // 同时更新dataSources.newGames中的ggr字段，供后续使用（优先使用name_key进行匹配）
  dataSources.newGames.forEach(game => {
    const gameNameKey = (game.name_key || game.game_name || game.name || '').trim().toLowerCase();
    const calculatedGGR = newGameGGRMap.get(gameNameKey) || 0;
    game.ggr = calculatedGGR;
  });
  
  const topNewGames = getTopN(newGameList, 'ggr', 5, true);
  const totalNewGameGGR = newGameList.reduce((sum, g) => sum + g.ggr, 0);
  
  console.log(`🎮 新游戏GGR统计: 共${newGameList.length}个新游戏，总GGR ${formatCurrency(totalNewGameGGR)}`);
  
  // 计算新游戏投注总额（从商户数据和游戏数据中筛选，只统计当前期且在报告期间内的数据）
  let totalNewGameBet = 0;
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(item => {
      // 只处理当前期数据（不是上期数据）
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const gameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
      const gameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
      
      // 检查是否为新游戏
      const isNewGame = newGameNames.includes(gameName) || (gameId && newGameIds.includes(gameId));
      
      if (isNewGame) {
        // 验证日期是否在报告期间内
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          const bet = parseFloat(item['总投注USD'] || item['总投注'] || item.bet_amount || item.total_bet || 0);
          totalNewGameBet += isNaN(bet) ? 0 : bet;
        }
      }
    });
  }
  
  // 如果商户数据中没有，尝试从游戏数据中获取（只统计当前期数据）
  if (totalNewGameBet === 0 && dataSources.game.length > 0) {
    dataSources.game.forEach(item => {
      // 只处理当前期数据
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const gameName = (item.游戏名 || item.game_name || item.name || '').trim().toLowerCase();
      const gameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
      
      const isNewGame = newGameNames.includes(gameName) || (gameId && newGameIds.includes(gameId));
      
      if (isNewGame) {
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          const bet = parseFloat(item.bet_amount || item.total_bet || item['总投注USD'] || 0);
          totalNewGameBet += isNaN(bet) ? 0 : bet;
        }
      }
    });
  }
  
  // 计算新游戏活跃用户数（从商户数据和游戏数据中筛选，只统计当前期且在报告期间内的数据）
  let totalNewGameUsers = 0;
  const newGameUserSet = new Set(); // 用于去重
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(item => {
      // 只处理当前期数据（不是上期数据）
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const gameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
      const gameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
      
      // 检查是否为新游戏
      const isNewGame = newGameNames.includes(gameName) || (gameId && newGameIds.includes(gameId));
      
      if (isNewGame) {
        // 验证日期是否在报告期间内
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          // 如果有用户ID列表，使用Set去重
          if (item.user_ids && Array.isArray(item.user_ids)) {
            item.user_ids.forEach(userId => newGameUserSet.add(userId.toString()));
          } else {
            // 如果只是数字，累加（可能是已经去重后的数字）
            const users = parseInt(item.投注用户 || item.活跃用户 || item.用户数 || item.users || item.active_users || item.total_users || 0);
            totalNewGameUsers += isNaN(users) ? 0 : users;
          }
        }
      }
    });
  }
  
  // 如果商户数据中没有，尝试从游戏数据中获取（只统计当前期数据）
  if (totalNewGameUsers === 0 && dataSources.game.length > 0) {
    dataSources.game.forEach(item => {
      // 只处理当前期数据
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const gameName = (item.游戏名 || item.game_name || item.name || '').trim().toLowerCase();
      const gameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
      
      const isNewGame = newGameNames.includes(gameName) || (gameId && newGameIds.includes(gameId));
      
      if (isNewGame) {
        const itemDateRaw = item.日期 || item.date || item.report_date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          if (item.user_ids && Array.isArray(item.user_ids)) {
            item.user_ids.forEach(userId => newGameUserSet.add(userId.toString()));
          } else {
            const users = parseInt(item.users || item.active_users || item.total_users || item.投注用户 || 0);
            totalNewGameUsers += isNaN(users) ? 0 : users;
          }
        }
      }
    });
  }
  
  // 如果还没有，尝试从留存数据中获取（因为新游戏主要是从留存数据中识别的）
  // 注意：需要去重，因为同一用户可能在不同新游戏中出现，只统计当前期且在报告期间内的数据
  if (totalNewGameUsers === 0 && dataSources.retention.length > 0) {
    dataSources.retention.forEach(item => {
      // 只处理当前期数据
      if (item.is_previous || item.period === 'previous') {
        return;
      }
      
      const gameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
      
      if (newGameNames.includes(gameName)) {
        const itemDateRaw = item.日期 || item.date;
        const itemDate = normalizeDate(itemDateRaw);
        const rangeStart = normalizeDate(currentWeekRange?.start);
        const rangeEnd = normalizeDate(currentWeekRange?.end);
        // 验证日期是否在报告期间内
        if (currentWeekRange && itemDate && rangeStart && rangeEnd && itemDate >= rangeStart && itemDate <= rangeEnd) {
          const users = parseInt(item.当日用户数 || item.d0_users || item.users || 0);
          if (!isNaN(users) && users > 0) {
            // 如果提供了用户ID列表，使用Set去重
            if (item.user_ids && Array.isArray(item.user_ids)) {
              item.user_ids.forEach(userId => newGameUserSet.add(userId.toString()));
            } else {
              // 如果只是数字，累加（可能是已经去重后的数字）
              totalNewGameUsers += users;
            }
          }
        }
      }
    });
    // 如果有去重的用户ID集合，使用其大小（覆盖累加值）
    if (newGameUserSet.size > 0) {
      totalNewGameUsers = newGameUserSet.size;
    }
  }
  
  // 也从newGames本身的数据中提取用户数
  if (totalNewGameUsers === 0) {
    dataSources.newGames.forEach(game => {
      const users = parseInt(game.total_users || game.users || game.active_users || 0);
      totalNewGameUsers += isNaN(users) ? 0 : users;
    });
  }
  
  // 为新游戏添加详细的商户和币种分析
  const newGameDetails = [];
  
  topNewGames.forEach(game => {
    const gameName = game.name.toLowerCase();
    const gameId = game.id ? game.id.toString().trim() : '';
    
    // 从商户数据中提取该游戏的商户和币种分布
    const merchantMap = new Map(); // merchantName -> ggr
    const currencyMap = new Map(); // currencyCode -> ggr
    const dailyGGR = new Map(); // date -> ggr（用于日GGR对比）
    
    if (dataSources.merchant.length > 0) {
      dataSources.merchant.forEach(item => {
        const itemGameName = (item.游戏名 || item.game_name || '').trim().toLowerCase();
        const itemGameId = (item.游戏ID || item.game_id || item.id || '').toString().trim();
        
        // 检查是否为新游戏
        const isThisGame = gameName === itemGameName || (gameId && gameId === itemGameId);
        
        if (isThisGame) {
          const ggr = parseFloat(item['GGR-USD'] || item.ggr || item.gcr || item.GGR || 0);
          if (!isNaN(ggr) && ggr > 0) {
            // 日GGR分布（只统计报告期间内的数据）
            const date = item.日期 || item.date || item.report_date;
            // 只收集报告期间内的数据
            if (date && currentWeekRange && date >= currentWeekRange.start && date <= currentWeekRange.end) {
              // 商户分布
              const merchantName = item.商户名 || item.merchant_name || item.name || item.sub_merchant_name || 'Unknown';
              const currentMerchantGGR = merchantMap.get(merchantName) || 0;
              merchantMap.set(merchantName, currentMerchantGGR + ggr);
              
              // 币种分布
              const currencyCode = item.货币 || item.currency || item.currency_code || 'Unknown';
              const currentCurrencyGGR = currencyMap.get(currencyCode) || 0;
              currencyMap.set(currencyCode, currentCurrencyGGR + ggr);
              
              // 日GGR分布
              const currentDateGGR = dailyGGR.get(date) || 0;
              dailyGGR.set(date, currentDateGGR + ggr);
            }
          }
        }
      });
    }
    
    // 转换为数组并排序
    const merchants = Array.from(merchantMap.entries())
      .map(([name, ggr]) => ({
        name,
        ggr,
        contribution: calculatePercentage(ggr, game.ggr)
      }))
      .sort((a, b) => b.ggr - a.ggr);
    
    const currencies = Array.from(currencyMap.entries())
      .map(([code, ggr]) => ({
        code,
        ggr,
        contribution: calculatePercentage(ggr, game.ggr)
      }))
      .sort((a, b) => b.ggr - a.ggr);
    
    // 从原始newGames数据中获取首次出现日期
    const originalGame = dataSources.newGames.find(g => 
      (g.game_name || g.name || '').trim().toLowerCase() === gameName ||
      (g.game_id || g.id)?.toString().trim() === gameId?.toString().trim()
    );
    let firstAppearDate = originalGame?.first_appear_date || game.first_appear_date || null;
    
    // 如果还没有首次出现日期，从dailyGGR中找到最早日期（只考虑报告期间内的日期）
    if (!firstAppearDate && dailyGGR.size > 0 && currentWeekRange) {
      const sortedDates = Array.from(dailyGGR.keys())
        .filter(date => date >= currentWeekRange.start && date <= currentWeekRange.end) // 只考虑报告期间内的日期
        .sort((a, b) => a.localeCompare(b));
      firstAppearDate = sortedDates[0] || null;
    }
    
    // 如果还是没有，尝试从留存数据中获取（只考虑报告期间内的数据）
    if (!firstAppearDate && dataSources.retention.length > 0 && currentWeekRange) {
      const retentionDates = [];
      dataSources.retention.forEach(item => {
        const itemGameName = (item.游戏名 || item.game_name || item.game || '').trim().toLowerCase();
        if (itemGameName === gameName) {
          const date = item.日期 || item.date;
          // 只考虑报告期间内的日期
          if (date && date >= currentWeekRange.start && date <= currentWeekRange.end) {
            retentionDates.push(date);
          }
        }
      });
      if (retentionDates.length > 0) {
        retentionDates.sort((a, b) => a.localeCompare(b));
        firstAppearDate = retentionDates[0];
      }
    }
    
    // 日GGR数据（按日期排序）
    const dailyGGRList = Array.from(dailyGGR.entries())
      .map(([date, ggr]) => ({ date, ggr }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    newGameDetails.push({
      name: game.name,
      totalGGR: game.ggr,
      merchants: merchants.slice(0, 10), // Top 10商户
      currencies: currencies.slice(0, 10), // Top 10币种
      dailyGGR: dailyGGRList,
      firstAppearDate: firstAppearDate // 新增：首次出现日期
    });
  });
  
  analysisResults.newGameAnalysis = {
    totalGGR: totalNewGameGGR,
    totalBet: totalNewGameBet,
    activeUsers: totalNewGameUsers,
    topGames: topNewGames,
    gameDetails: newGameDetails, // 新增：详细的游戏分析
    contribution: calculatePercentage(totalNewGameGGR, totalGGR),
    betContribution: totalNewGameBet > 0 && analysisResults.betAnalysis.total > 0 ? calculatePercentage(totalNewGameBet, analysisResults.betAnalysis.total) : '0',
    activeUsersContribution: totalNewGameUsers > 0 && analysisResults.activeUsersAnalysis.total > 0 ? calculatePercentage(totalNewGameUsers, analysisResults.activeUsersAnalysis.total) : '0'
  };
  
  // 生成新游戏详细结论
  let newGameConclusion = '';
  if (newGameDetails.length > 0) {
    newGameConclusion = '新游戏总结\n';
    newGameDetails.forEach(game => {
      const topMerchants = game.merchants.slice(0, 3);
      const topCurrencies = game.currencies.slice(0, 3);
      const top3MerchantContribution = topMerchants.reduce((sum, m) => sum + parseFloat(m.contribution), 0);
      
      // 格式化首次出现日期（如果有）
      let dateInfo = '';
      if (game.firstAppearDate) {
        // 将日期格式化为 "本周X号" 的格式
        try {
          const date = new Date(game.firstAppearDate);
          if (!isNaN(date.getTime())) {
            const dayOfMonth = date.getDate();
            dateInfo = `（从本周${dayOfMonth}号开始有数据）`;
          } else {
            // 如果日期格式不是标准格式，尝试直接使用
            dateInfo = `（从${game.firstAppearDate}开始有数据）`;
          }
        } catch (e) {
          dateInfo = `（从${game.firstAppearDate}开始有数据）`;
        }
      }
      
      newGameConclusion += `- ${game.name}${dateInfo}\n`;
      newGameConclusion += ` 本期合计 ${formatCurrency(game.totalGGR)}，`;
      
      if (topMerchants.length > 0) {
        const merchantNames = topMerchants.map(m => m.name).join('、');
        newGameConclusion += `主要来自 ${merchantNames}（合计占比 ${top3MerchantContribution.toFixed(1)}%），`;
      }
      
      if (topCurrencies.length > 0) {
        const currencyCodes = topCurrencies.map(c => c.code).join('、');
        const topCurrency = topCurrencies[0];
        newGameConclusion += `币种端 ${topCurrency.code} 占比 ${topCurrency.contribution}%，`;
        if (topCurrencies.length > 1) {
          newGameConclusion += `其次是 ${currencyCodes.slice(currencyCodes.indexOf('、') + 1)}。`;
        } else {
          newGameConclusion += `。`;
        }
      }
      
      // 分析集中度
      if (top3MerchantContribution > 75) {
        newGameConclusion += `说明该游戏表现高度依赖头部商户，一旦头部波动，整体表现也会明显受影响。\n`;
      } else if (top3MerchantContribution > 50) {
        newGameConclusion += `说明该游戏在核心商户中有稳定表现，但有一定的分散度。\n`;
      } else {
        newGameConclusion += `说明该游戏在多个商户中都有分布，风险分散。\n`;
      }
    });
    
    // 综合结论
    newGameConclusion += '\n综合结论：\n';
    newGameConclusion += ` ${newGameDetails.length}款新游戏总 GGR ~${formatCurrency(totalNewGameGGR)}，`;
    newGameConclusion += `占新增贡献的绝大部分。整体来看，新游戏为平台带来了新的增长极。\n`;
  }
  
  analysisResults.newGameAnalysis.conclusion = newGameConclusion || 
    `本期新游戏GGR达 ${formatCurrency(totalNewGameGGR)}，占比 ${analysisResults.newGameAnalysis.contribution}%。`;
}

// 2.3 商户维度分析（聚合同商户数据，只统计正GGR）
if (dataSources.merchant.length > 0) {
  // 按商户名聚合GGR（只统计正GGR）
  const merchantMap = new Map();
  
  dataSources.merchant.forEach(m => {
    const merchantName = m.商户名 || m.merchant_name || m.name || m.sub_merchant_name || 'Unknown';
    const ggr = parseFloat(m['GGR-USD'] || m.ggr || m.gcr || m.GGR || 0);
    
    // 只统计正GGR
    if (isNaN(ggr) || ggr <= 0) return;
    
    if (!merchantMap.has(merchantName)) {
      merchantMap.set(merchantName, {
        name: merchantName,
        current: 0,
        previous: 0,
        id: m.merchant_id || m.id
      });
    }
    const merchant = merchantMap.get(merchantName);
    merchant.current += ggr;
  });
  
  const merchantList = Array.from(merchantMap.values());
  
  // 匹配上期数据（只统计正GGR）
  if (prevMerchantData.length > 0) {
    prevMerchantData.forEach(prev => {
      const merchantName = prev.商户名 || prev.merchant_name || prev.name || prev.sub_merchant_name;
      const ggr = parseFloat(prev['GGR-USD'] || prev.ggr || prev.gcr || prev.GGR || 0);
      
      // 只统计正GGR
      if (isNaN(ggr) || ggr <= 0) return;
      
      let merchant = merchantList.find(m => m.name === merchantName);
      if (!merchant && prev.merchant_id) {
        merchant = merchantList.find(m => m.id && m.id.toString() === prev.merchant_id.toString());
      }
      
      if (merchant) {
        merchant.previous += ggr;
      }
    });
  }
  
  // 计算变化率和绝对值变化
  merchantList.forEach(m => {
    m.change = calculateChangeRate(m.current, m.previous);
    m.changeAmount = m.current - m.previous; // 绝对值变化（USD）
  });
  
  // 计算总GGR（只统计正GGR）
  const totalMerchantGGR = merchantList.reduce((sum, m) => sum + m.current, 0);
  const totalMerchantGGRPrevious = merchantList.reduce((sum, m) => sum + m.previous, 0);
  const totalMerchantChange = calculateChangeRate(totalMerchantGGR, totalMerchantGGRPrevious);
  const totalMerchantChangeAmount = totalMerchantGGR - totalMerchantGGRPrevious;
  
  const topGrowth = merchantList
    .filter(m => m.change && m.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  const topDecline = merchantList
    .filter(m => m.change && m.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  
  analysisResults.merchantAnalysis = {
    total: {
      current: totalMerchantGGR,
      previous: totalMerchantGGRPrevious,
      change: totalMerchantChange,
      changeAmount: totalMerchantChangeAmount
    },
    topGrowth,
    topDecline,
    totalCount: merchantList.length
  };
  
  // 生成商户结论
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n';
  conclusion += `- 总 GGR 由 ${formatCurrency(totalMerchantGGRPrevious)} → ${formatCurrency(totalMerchantGGR)}，`;
  if (totalMerchantChange) {
    conclusion += `环比 ${totalMerchantChange.display}（${totalMerchantChangeAmount > 0 ? '+' : ''}${formatCurrency(totalMerchantChangeAmount)}）。\n\n`;
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth.length > 0) {
    conclusion += '贡献最大的商户\n';
    topGrowth.slice(0, 5).forEach(m => {
      conclusion += `- ${m.name}：由 ${formatCurrency(m.previous)} → ${formatCurrency(m.current)}，`;
      if (m.change) {
        conclusion += `环比 ${m.change.display}（${m.changeAmount > 0 ? '+' : ''}${formatCurrency(m.changeAmount)}）。\n`;
      } else {
        conclusion += `新增。\n`;
      }
    });
    conclusion += '\n';
  }
  
  if (topDecline.length > 0) {
    conclusion += '下滑商户\n';
    topDecline.slice(0, 5).forEach(m => {
      conclusion += `- ${m.name}：由 ${formatCurrency(m.previous)} → ${formatCurrency(m.current)}，`;
      if (m.change) {
        conclusion += `环比 ${m.change.display}（${formatCurrency(m.changeAmount)}）。\n`;
      }
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topDecline.length > 0 && topGrowth.length > 0) {
    conclusion += `- 商户层面${totalMerchantChangeAmount < 0 ? '下降' : '增长'}主要来自 ${topDecline[0]?.name || ''}${topDecline.length > 1 ? ` 和 ${topDecline[1]?.name || ''}` : ''}。\n`;
    conclusion += `- ${totalMerchantChangeAmount > 0 ? '增长' : '下降'}动力主要来自 ${topGrowth[0]?.name || ''}${topGrowth.length > 1 ? `、${topGrowth[1]?.name || ''}` : ''}${topGrowth.length > 2 ? `、${topGrowth[2]?.name || ''}` : ''}。\n`;
  } else if (merchantList.length > 0) {
    // 没有对比数据时，生成Top商户分析
    const topMerchants = merchantList
      .sort((a, b) => b.current - a.current)
      .slice(0, 5);
    const topMerchantNames = topMerchants.map(m => m.name).join('、');
    conclusion += `- 本期共 ${merchantList.length} 个商户活跃，Top5商户为 ${topMerchantNames}。\n`;
    analysisResults.merchantAnalysis.topMerchants = topMerchants;
  }
  
  analysisResults.merchantAnalysis.conclusion = conclusion;
}

// 2.4 游戏维度分析（只统计正GGR）
if (dataSources.game.length > 0 || dataSources.merchant.length > 0) {
  // 从游戏数据和商户数据中聚合游戏GGR（只统计正GGR）
  const gameMap = new Map();
  
  // 从游戏数据中提取
  if (dataSources.game.length > 0) {
    dataSources.game.forEach(g => {
      const gameId = (g.game_id || g.id || '').toString();
      const gameName = g.game_name || g.name || 'Unknown';
      const ggr = parseFloat(g.ggr || 0);
      
      // 只统计正GGR
      if (isNaN(ggr) || ggr <= 0) return;
      
      const key = gameId || gameName;
      if (!gameMap.has(key)) {
        gameMap.set(key, {
          id: gameId,
          name: gameName,
          current: 0,
          previous: 0
        });
      }
      gameMap.get(key).current += ggr;
    });
  }
  
  // 从商户数据中提取（按游戏聚合）
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(m => {
      const gameName = (m.游戏名 || m.game_name || m.name || 'Unknown').trim();
      const gameId = (m.游戏ID || m.game_id || m.id || '').toString().trim();
      const ggr = parseFloat(m['GGR-USD'] || m.ggr || m.gcr || m.GGR || 0);
      
      // 只统计正GGR
      if (isNaN(ggr) || ggr <= 0) return;
      
      const key = gameId || gameName.toLowerCase();
      if (!gameMap.has(key)) {
        gameMap.set(key, {
          id: gameId,
          name: gameName,
          current: 0,
          previous: 0
        });
      }
      gameMap.get(key).current += ggr;
    });
  }
  
  const gameList = Array.from(gameMap.values());
  
  // 匹配上期数据（只统计正GGR）
  const prevGameData = dataSources.previousPeriod.filter(item => 
    item.game_id || item.game || item.游戏名 || item.game_name
  );
  
  prevGameData.forEach(prev => {
    const prevGameId = (prev.game_id || prev.id || '').toString();
    const prevGameName = (prev.游戏名 || prev.game_name || prev.game || '').trim();
    const ggr = parseFloat(prev.ggr || prev['GGR-USD'] || prev.GGR || 0);
    
    // 只统计正GGR
    if (isNaN(ggr) || ggr <= 0) return;
    
    // 尝试通过ID或名称匹配
    let game = gameList.find(g => 
      (g.id && prevGameId && g.id.toString() === prevGameId) ||
      (g.name && prevGameName && g.name.toLowerCase() === prevGameName.toLowerCase())
    );
    
    if (game) {
      game.previous += ggr;
    }
  });
  
  // 计算变化率和绝对值变化
  gameList.forEach(g => {
    g.change = calculateChangeRate(g.current, g.previous);
    g.changeAmount = g.current - g.previous; // 绝对值变化（USD）
  });
  
  // 计算总GGR（只统计正GGR）
  const totalGameGGR = gameList.reduce((sum, g) => sum + g.current, 0);
  const totalGameGGRPrevious = gameList.reduce((sum, g) => sum + g.previous, 0);
  const totalGameChange = calculateChangeRate(totalGameGGR, totalGameGGRPrevious);
  const totalGameChangeAmount = totalGameGGR - totalGameGGRPrevious;
  
  const topGrowth = gameList
    .filter(g => g.change && g.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  const topDecline = gameList
    .filter(g => g.change && g.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  
  analysisResults.gameAnalysis = {
    total: {
      current: totalGameGGR,
      previous: totalGameGGRPrevious,
      change: totalGameChange,
      changeAmount: totalGameChangeAmount
    },
    topGrowth,
    topDecline,
    totalCount: gameList.length
  };
  
  // 生成游戏结论
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n';
  conclusion += `- 总 GGR 由 ${formatCurrency(totalGameGGRPrevious)} → ${formatCurrency(totalGameGGR)}，`;
  if (totalGameChange) {
    conclusion += `环比 ${totalGameChange.display}（减少 ${formatCurrency(-totalGameChangeAmount)}）。\n`;
    conclusion += `- 整体明显下滑，主要是老热门下滑，新游戏部分对冲不足。\n\n`;
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth.length > 0) {
    conclusion += '主要增长游戏\n';
    topGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：由 ${formatCurrency(g.previous)} → ${formatCurrency(g.current)}，`;
      if (g.change) {
        conclusion += `环比 ${g.change.display}（${g.changeAmount > 0 ? '+' : ''}${formatCurrency(g.changeAmount)}）。\n`;
      } else {
        conclusion += `新增。\n`;
      }
    });
    conclusion += '\n';
  }
  
  if (topDecline.length > 0) {
    conclusion += '主要下滑游戏\n';
    topDecline.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：由 ${formatCurrency(g.previous)} → ${formatCurrency(g.current)}，`;
      if (g.change) {
        conclusion += `环比 ${g.change.display}（${formatCurrency(g.changeAmount)}）。\n`;
      }
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (totalGameChangeAmount < 0) {
    conclusion += `- 本周整体 GGR 下跌，主要因 ${topDecline[0]?.name || ''}等老游戏下滑。\n`;
    if (topGrowth.length > 0) {
      conclusion += `- 新游戏增长亮眼，尤其是 ${topGrowth[0]?.name || ''}${topGrowth.length > 1 ? ` 与 ${topGrowth[1]?.name || ''}` : ''}，但不足以抵消整体跌幅。\n`;
    }
  } else if (topGrowth.length > 0) {
    conclusion += `- 增长主要来自 ${topGrowth[0]?.name || ''}${topGrowth.length > 1 ? ` 与 ${topGrowth[1]?.name || ''}` : ''}。\n`;
  }
  
  analysisResults.gameAnalysis.conclusion = conclusion;
}

// 2.5 投注量分析（从商户数据中提取投注信息）
if (dataSources.bet.length > 0 || dataSources.merchant.length > 0) {
  // 优先从商户数据提取投注
  let totalBet = 0;
  if (dataSources.merchant.length > 0) {
    totalBet = dataSources.merchant.reduce((sum, b) => {
      const bet = parseFloat(b['总投注USD'] || b['总投注'] || b.bet_amount || b.total_bet || 0);
      return sum + (isNaN(bet) ? 0 : bet);
    }, 0);
  }
  
  // 如果商户数据中没有投注，则使用投注数据
  if (totalBet === 0 && dataSources.bet.length > 0) {
    totalBet = dataSources.bet.reduce((sum, b) => {
      return sum + parseFloat(b.bet_amount || b.total_bet || 0);
    }, 0);
  }
  
  const prevBetData = dataSources.previousPeriod.filter(item =>
    item.bet_amount !== undefined || item.total_bet !== undefined || item['总投注USD'] !== undefined
  );
  
  let totalBetPrevious = 0;
  if (prevBetData.length > 0) {
    totalBetPrevious = prevBetData.reduce((sum, b) => {
      const bet = parseFloat(b['总投注USD'] || b['总投注'] || b.bet_amount || b.total_bet || 0);
      return sum + (isNaN(bet) ? 0 : bet);
    }, 0);
  }
  
  const betChange = calculateChangeRate(totalBet, totalBetPrevious);
  const betChangeAmount = totalBet - totalBetPrevious;
  
  // 按游戏统计投注变化（用于增长/下滑来源分析）
  const gameBetMap = new Map(); // gameName -> { current, previous }
  
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(item => {
      const gameName = (item.游戏名 || item.game_name || item.name || 'Unknown').trim();
      const bet = parseFloat(item['总投注USD'] || item['总投注'] || item.bet_amount || item.total_bet || 0);
      if (!isNaN(bet) && bet > 0) {
        if (!gameBetMap.has(gameName)) {
          gameBetMap.set(gameName, { name: gameName, current: 0, previous: 0 });
        }
        gameBetMap.get(gameName).current += bet;
      }
    });
  }
  
  // 从上期数据提取游戏投注
  if (prevBetData.length > 0) {
    prevBetData.forEach(item => {
      const gameName = (item.游戏名 || item.game_name || item.name || 'Unknown').trim();
      const bet = parseFloat(item['总投注USD'] || item['总投注'] || item.bet_amount || item.total_bet || 0);
      if (!isNaN(bet) && bet > 0) {
        if (!gameBetMap.has(gameName)) {
          gameBetMap.set(gameName, { name: gameName, current: 0, previous: 0 });
        }
        gameBetMap.get(gameName).previous += bet;
      }
    });
  }
  
  // 计算每个游戏的投注变化
  const gameBetList = Array.from(gameBetMap.values())
    .map(g => ({
      ...g,
      changeAmount: g.current - g.previous
    }))
    .filter(g => g.changeAmount !== 0); // 只保留有变化的游戏
  
  const topBetGrowth = gameBetList
    .filter(g => g.changeAmount > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
  
  const topBetDecline = gameBetList
    .filter(g => g.changeAmount < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
  
  analysisResults.betAnalysis = {
    total: totalBet,
    previous: totalBetPrevious,
    change: betChange,
    changeAmount: betChangeAmount,
    topGrowth: topBetGrowth, // 新增：按游戏的增长来源
    topDecline: topBetDecline // 新增：按游戏的下滑来源
  };
  
  // 生成投注分析结论
  let conclusion = '整体情况\n';
  conclusion += `- 总投注由 ${formatCurrency(totalBetPrevious)} → ${formatCurrency(totalBet)}，`;
  if (betChange) {
    conclusion += `环比 ${betChange.display}（${betChangeAmount > 0 ? '+' : ''}${formatCurrency(betChangeAmount)}）。\n`;
    
    // 比较投注变化与GGR变化
    if (analysisResults.overallGGR.change) {
      const betRate = Math.abs(betChange.rate);
      const ggrRate = Math.abs(analysisResults.overallGGR.change.rate);
      if (betRate < ggrRate) {
        conclusion += `- 投注降幅 小于 GGR 降幅（GGR ${analysisResults.overallGGR.change.display}），说明 RTP/中奖结构波动放大了 GGR 跌幅，不仅仅是投注回撤导致。\n`;
      }
    }
    conclusion += '\n';
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topBetGrowth.length > 0) {
    conclusion += '主要增长来源（按游戏，环比新增投注额）\n';
    topBetGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount > 0 ? '+' : ''}${formatCurrency(g.changeAmount)}\n`;
    });
    conclusion += '\n';
  }
  
  if (topBetDecline.length > 0) {
    conclusion += '主要下滑来源（按游戏，环比减少投注额）\n';
    topBetDecline.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${formatCurrency(g.changeAmount)}\n`;
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topBetDecline.length > 0) {
    conclusion += `- 投注端的主要拖累来自 ${topBetDecline[0]?.name || ''}等老款游戏的显著回撤。\n`;
  }
  if (topBetGrowth.length > 0) {
    conclusion += `- ${topBetGrowth[0]?.name || ''}等少数项目对投注有正向拉动，但不足以对冲头部老游下滑。\n`;
  }
  if (betChange && analysisResults.overallGGR.change) {
    const betRate = Math.abs(betChange.rate);
    const ggrRate = Math.abs(analysisResults.overallGGR.change.rate);
    if (betRate < ggrRate) {
      conclusion += `- 由于投注降幅 < GGR 降幅，需重点复核 RTP/命中分布 与 高赔率段出奖 情况。\n`;
    }
  }
  
  analysisResults.betAnalysis.conclusion = conclusion;
}

// 2.5.5 活跃用户数分析（从商户数据中提取用户数信息）
// 根据需求：活跃用户数 = 所有商户投注用户合计总额
if (dataSources.merchant.length > 0 || dataSources.game.length > 0 || dataSources.retention.length > 0) {
  // 优先从商户数据提取用户数（根据需求，应该从商户数据获取）
  let totalActiveUsers = 0;
  if (dataSources.merchant.length > 0) {
    // 根据需求："所有商户投注用户合计总额"，需要累加所有商户的用户数
    // 注意：如果数据源已经去重，可以直接累加；如果没有去重，可能需要去重
    const userSet = new Set();
    let hasUserIds = false;
    
    dataSources.merchant.forEach(item => {
      // 支持多种用户数字段名
      const users = parseInt(item.投注用户 || item.活跃用户 || item.用户数 || item.users || item.active_users || item.total_users || 0);
      
      // 如果提供了用户ID列表，使用Set去重
      if (item.user_ids && Array.isArray(item.user_ids)) {
        hasUserIds = true;
        item.user_ids.forEach(userId => userSet.add(userId.toString()));
      } else if (!isNaN(users) && users > 0) {
        // 如果字段是单个用户数，累加（假设已经去重）
        totalActiveUsers += users;
      }
    });
    
    // 如果有去重的用户ID集合，使用其大小（覆盖累加值）
    if (hasUserIds && userSet.size > 0) {
      totalActiveUsers = userSet.size;
    }
  }
  
  // 如果商户数据中没有用户数，尝试从游戏数据中获取
  if (totalActiveUsers === 0 && dataSources.game.length > 0) {
    dataSources.game.forEach(item => {
      const users = parseInt(item.users || item.active_users || item.total_users || item.投注用户 || 0);
      totalActiveUsers += isNaN(users) ? 0 : users;
    });
  }
  
  // 如果还没有，尝试从留存数据中获取（留存数据通常有用户数）
  // 注意：从留存数据获取时需要去重，因为同一用户可能在不同游戏中出现
  if (totalActiveUsers === 0 && dataSources.retention.length > 0) {
    // 使用Set去重，因为同一用户可能在不同游戏中出现
    const retentionUserSet = new Set();
    dataSources.retention.forEach(item => {
      const users = parseInt(item.当日用户数 || item.d0_users || item.users || 0);
      if (!isNaN(users) && users > 0) {
        // 如果提供了用户ID列表，使用Set去重
        if (item.user_ids && Array.isArray(item.user_ids)) {
          item.user_ids.forEach(userId => retentionUserSet.add(userId.toString()));
        } else {
          // 如果只是数字，累加（可能是已经去重后的数字）
          totalActiveUsers += users;
        }
      }
    });
    // 如果有去重的用户ID集合，使用其大小（覆盖累加值）
    if (retentionUserSet.size > 0) {
      totalActiveUsers = retentionUserSet.size;
    }
  }
  
  // 计算上期活跃用户数
  const prevUsersData = dataSources.previousPeriod.filter(item =>
    item.投注用户 !== undefined || item.活跃用户 !== undefined || item.users !== undefined || item.active_users !== undefined
  );
  
  let totalActiveUsersPrevious = 0;
  if (prevUsersData.length > 0) {
    prevUsersData.forEach(item => {
      const users = parseInt(item.投注用户 || item.活跃用户 || item.用户数 || item.users || item.active_users || item.total_users || 0);
      totalActiveUsersPrevious += isNaN(users) ? 0 : users;
    });
  }
  
  const usersChange = calculateChangeRate(totalActiveUsers, totalActiveUsersPrevious);
  
  analysisResults.activeUsersAnalysis = {
    total: totalActiveUsers,
    previous: totalActiveUsersPrevious,
    change: usersChange
  };
  
  console.log(`👥 活跃用户数: ${totalActiveUsers.toLocaleString()} (上期: ${totalActiveUsersPrevious.toLocaleString()})`);
  
  // 更新新游戏分析的占比（现在总投注和活跃用户数都已经计算完成）
  if (analysisResults.newGameAnalysis && analysisResults.betAnalysis) {
    if (analysisResults.newGameAnalysis.totalBet > 0 && analysisResults.betAnalysis.total > 0) {
      analysisResults.newGameAnalysis.betContribution = calculatePercentage(
        analysisResults.newGameAnalysis.totalBet, 
        analysisResults.betAnalysis.total
      );
    }
    if (analysisResults.newGameAnalysis.activeUsers > 0 && totalActiveUsers > 0) {
      analysisResults.newGameAnalysis.activeUsersContribution = calculatePercentage(
        analysisResults.newGameAnalysis.activeUsers, 
        totalActiveUsers
      );
    }
  }
}

// 2.6 局数分析（从商户数据中提取局数信息）
if (dataSources.rounds.length > 0 || dataSources.merchant.length > 0) {
  // 优先从商户数据提取局数
  let totalRounds = 0;
  if (dataSources.merchant.length > 0) {
    totalRounds = dataSources.merchant.reduce((sum, r) => {
      const rounds = parseInt(r.总局数 || r.rounds || r.round_count || 0);
      return sum + (isNaN(rounds) ? 0 : rounds);
    }, 0);
  }
  
  // 如果商户数据中没有局数，则使用局数数据
  if (totalRounds === 0 && dataSources.rounds.length > 0) {
    totalRounds = dataSources.rounds.reduce((sum, r) => {
      return sum + parseInt(r.rounds || r.round_count || 0);
    }, 0);
  }
  
  const prevRoundsData = dataSources.previousPeriod.filter(item =>
    item.rounds !== undefined || item.round_count !== undefined || item.总局数 !== undefined
  );
  
  let totalRoundsPrevious = 0;
  if (prevRoundsData.length > 0) {
    totalRoundsPrevious = prevRoundsData.reduce((sum, r) => {
      const rounds = parseInt(r.总局数 || r.rounds || r.round_count || 0);
      return sum + (isNaN(rounds) ? 0 : rounds);
    }, 0);
  }
  
  const roundsChange = calculateChangeRate(totalRounds, totalRoundsPrevious);
  const roundsChangeAmount = totalRounds - totalRoundsPrevious;
  
  // 按游戏统计局数变化（用于增长/下滑来源分析）
  const gameRoundsMap = new Map(); // gameName -> { current, previous }
  
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(item => {
      const gameName = (item.游戏名 || item.game_name || item.name || 'Unknown').trim();
      const rounds = parseInt(item.总局数 || item.rounds || item.round_count || 0);
      if (!isNaN(rounds) && rounds > 0) {
        if (!gameRoundsMap.has(gameName)) {
          gameRoundsMap.set(gameName, { name: gameName, current: 0, previous: 0 });
        }
        gameRoundsMap.get(gameName).current += rounds;
      }
    });
  }
  
  // 从上期数据提取游戏局数
  if (prevRoundsData.length > 0) {
    prevRoundsData.forEach(item => {
      const gameName = (item.游戏名 || item.game_name || item.name || 'Unknown').trim();
      const rounds = parseInt(item.总局数 || item.rounds || item.round_count || 0);
      if (!isNaN(rounds) && rounds > 0) {
        if (!gameRoundsMap.has(gameName)) {
          gameRoundsMap.set(gameName, { name: gameName, current: 0, previous: 0 });
        }
        gameRoundsMap.get(gameName).previous += rounds;
      }
    });
  }
  
  // 计算每个游戏的局数变化
  const gameRoundsList = Array.from(gameRoundsMap.values())
    .map(g => ({
      ...g,
      changeAmount: g.current - g.previous
    }))
    .filter(g => g.changeAmount !== 0); // 只保留有变化的游戏
  
  const topRoundsGrowth = gameRoundsList
    .filter(g => g.changeAmount > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
  
  const topRoundsDecline = gameRoundsList
    .filter(g => g.changeAmount < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
  
  // 计算人均投注
  const avgBet = totalRounds > 0 && analysisResults.betAnalysis.total > 0
    ? analysisResults.betAnalysis.total / totalRounds
    : 0;
  
  analysisResults.roundsAnalysis = {
    total: totalRounds,
    previous: totalRoundsPrevious,
    change: roundsChange,
    changeAmount: roundsChangeAmount,
    avgBet: avgBet,
    topGrowth: topRoundsGrowth, // 新增：按游戏的增长来源
    topDecline: topRoundsDecline // 新增：按游戏的下滑来源
  };
  
  // 生成局数结论
  let conclusion = '整体情况\n';
  conclusion += `- 总局数由 ${totalRoundsPrevious.toLocaleString()} 局 → ${totalRounds.toLocaleString()} 局，`;
  if (roundsChange) {
    conclusion += `环比 ${roundsChange.display}（${roundsChangeAmount > 0 ? '+' : ''}${roundsChangeAmount.toLocaleString()} 局）。\n`;
    
    // 比较局数变化与投注变化
    if (analysisResults.betAnalysis.change) {
      const roundsRate = Math.abs(roundsChange.rate);
      const betRate = Math.abs(analysisResults.betAnalysis.change.rate);
      if (roundsRate < betRate) {
        conclusion += `- 局数降幅 小于 投注降幅与 GGR 降幅，显示活跃度回落相对温和，单局平均投注与赔付结构的变化更影响产出。\n`;
      }
    }
    conclusion += '\n';
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topRoundsGrowth.length > 0) {
    conclusion += '主要增长来源（按游戏，环比新增局数）\n';
    topRoundsGrowth.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount > 0 ? '+' : ''}${g.changeAmount.toLocaleString()}\n`;
    });
    conclusion += '\n';
  }
  
  if (topRoundsDecline.length > 0) {
    conclusion += '主要下滑来源（按游戏，环比减少局数）\n';
    topRoundsDecline.slice(0, 5).forEach(g => {
      conclusion += `- ${g.name}：${g.changeAmount.toLocaleString()}\n`;
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topRoundsDecline.length > 0) {
    conclusion += `- 活跃度的主要下滑来自 ${topRoundsDecline[0]?.name || ''}${topRoundsDecline.length > 1 ? ` / ${topRoundsDecline[1]?.name || ''}` : ''}${topRoundsDecline.length > 2 ? ` / ${topRoundsDecline[2]?.name || ''}` : ''}。\n`;
  }
  if (topRoundsGrowth.length > 0) {
    const minesGames = topRoundsGrowth.filter(g => g.name.toLowerCase().includes('mines'));
    if (minesGames.length > 0) {
      conclusion += `- Mines 系列（${minesGames.map(g => g.name).join('、')}）局数逆势增长，表明矿类玩法仍具用户粘性。\n`;
    }
  }
  if (roundsChange && analysisResults.betAnalysis.change) {
    const roundsRate = Math.abs(roundsChange.rate);
    const betRate = Math.abs(analysisResults.betAnalysis.change.rate);
    if (roundsRate !== betRate) {
      conclusion += `- 综合投注与局数的背离，建议联动排查：新老游戏的投注档位分布、免费/促销触发、RTP偏移点。\n`;
    }
  }
  
  analysisResults.roundsAnalysis.conclusion = conclusion;
}

// 2.7 币种维度分析（从商户数据中提取币种信息）
if (dataSources.currency.length > 0 || dataSources.merchant.length > 0) {
  // 优先从商户数据提取币种
  const currencyMap = new Map();
  
  if (dataSources.merchant.length > 0) {
    dataSources.merchant.forEach(m => {
      const currencyCode = m.货币 || m.currency || m.currency_code || 'Unknown';
      const ggr = parseFloat(m['GGR-USD'] || m.ggr || m.gcr || m.GGR || 0);
      
      // 只统计正GGR
      if (isNaN(ggr) || ggr <= 0) return;
      
      if (!currencyMap.has(currencyCode)) {
        currencyMap.set(currencyCode, {
          code: currencyCode,
          current: 0,
          previous: 0
        });
      }
      const curr = currencyMap.get(currencyCode);
      curr.current += ggr;
    });
  }
  
  // 如果商户数据中没有币种，则使用币种数据（只统计正GGR）
  if (currencyMap.size === 0 && dataSources.currency.length > 0) {
    dataSources.currency.forEach(c => {
      const currencyCode = c.currency || c.currency_code || 'Unknown';
      const ggr = parseFloat(c.ggr || c.gcr || 0);
      
      // 只统计正GGR
      if (isNaN(ggr) || ggr <= 0) return;
      
      if (!currencyMap.has(currencyCode)) {
        currencyMap.set(currencyCode, {
          code: currencyCode,
          current: 0,
          previous: 0
        });
      }
      const curr = currencyMap.get(currencyCode);
      curr.current += ggr;
    });
  }
  
  const currencyList = Array.from(currencyMap.values());
  
  const prevCurrencyData = dataSources.previousPeriod.filter(item =>
    item.currency || item.currency_code || item.货币
  );
  
  prevCurrencyData.forEach(prev => {
    const currencyCode = prev.货币 || prev.currency || prev.currency_code;
    const ggr = parseFloat(prev['GGR-USD'] || prev.ggr || prev.gcr || prev.GGR || 0);
    
    // 只统计正GGR
    if (isNaN(ggr) || ggr <= 0) return;
    
    const curr = currencyList.find(c => c.code === currencyCode);
    if (curr) {
      curr.previous += ggr;
    }
  });
  
  // 计算变化率和绝对值变化
  currencyList.forEach(c => {
    c.change = calculateChangeRate(c.current, c.previous);
    c.changeAmount = c.current - c.previous; // 绝对值变化（USD）
  });
  
  // 计算总GGR（只统计正GGR）
  const totalCurrencyGGR = currencyList.reduce((sum, c) => sum + c.current, 0);
  const totalCurrencyGGRPrevious = currencyList.reduce((sum, c) => sum + c.previous, 0);
  const totalCurrencyChange = calculateChangeRate(totalCurrencyGGR, totalCurrencyGGRPrevious);
  const totalCurrencyChangeAmount = totalCurrencyGGR - totalCurrencyGGRPrevious;
  
  const topGrowth = currencyList
    .filter(c => c.change && c.change.rate > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  const topDecline = currencyList
    .filter(c => c.change && c.change.rate < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount) // 按绝对值变化排序
    .slice(0, 10);
  
  analysisResults.currencyAnalysis = {
    total: {
      current: totalCurrencyGGR,
      previous: totalCurrencyGGRPrevious,
      change: totalCurrencyChange,
      changeAmount: totalCurrencyChangeAmount
    },
    topGrowth,
    topDecline,
    totalCount: currencyList.length
  };
  
  // 生成币种结论
  let conclusion = '整体情况（合计部分只统计正 GGR 之和）\n';
  conclusion += `- 总 GGR 由 ${formatCurrency(totalCurrencyGGRPrevious)} → ${formatCurrency(totalCurrencyGGR)}，`;
  if (totalCurrencyChange) {
    conclusion += `环比 ${totalCurrencyChange.display}（${totalCurrencyChangeAmount > 0 ? '+' : ''}${formatCurrency(totalCurrencyChangeAmount)}）。\n\n`;
  } else {
    conclusion += `。\n\n`;
  }
  
  if (topGrowth.length > 0) {
    conclusion += '主要增长币种\n';
    topGrowth.slice(0, 5).forEach(c => {
      conclusion += `- ${c.code}：由 ${formatCurrency(c.previous)} → ${formatCurrency(c.current)}，`;
      if (c.change) {
        conclusion += `环比 ${c.change.display}（${c.changeAmount > 0 ? '+' : ''}${formatCurrency(c.changeAmount)}）。\n`;
      } else {
        conclusion += `新增。\n`;
      }
    });
    conclusion += '\n';
  }
  
  if (topDecline.length > 0) {
    conclusion += '下滑币种\n';
    topDecline.slice(0, 5).forEach(c => {
      conclusion += `- ${c.code}：由 ${formatCurrency(c.previous)} → ${formatCurrency(c.current)}，`;
      if (c.change) {
        conclusion += `环比 ${c.change.display}（${formatCurrency(c.changeAmount)}）。\n`;
      }
    });
    conclusion += '\n';
  }
  
  conclusion += '结论\n';
  if (topDecline.length > 0) {
    const coreCurrencies = topDecline.filter(c => 
      ['MXN', 'BRL', 'PHP', 'USD', 'EUR'].includes(c.code)
    );
    if (coreCurrencies.length > 0) {
      conclusion += `- 核心币种（${coreCurrencies.map(c => c.code).join('、')}）全面下滑，是总下跌主因。\n`;
    } else {
      conclusion += `- ${topDecline[0]?.code || ''}等币种下滑，是总下跌主因。\n`;
    }
  }
  if (topGrowth.length > 0) {
    const emergingCurrencies = topGrowth.filter(c => 
      !['MXN', 'BRL', 'PHP', 'USD', 'EUR'].includes(c.code)
    );
    if (emergingCurrencies.length > 0) {
      conclusion += `- 新兴币种（${emergingCurrencies.slice(0, 3).map(c => c.code).join('、')}）增长明显，但规模仍有限。\n`;
    } else {
      conclusion += `- ${topGrowth[0]?.code || ''}等币种增长明显，显示新兴市场潜力。\n`;
    }
  }
  
  analysisResults.currencyAnalysis.conclusion = conclusion;
}

// 2.8 留存数据分析（支持中文字段）
if (dataSources.retention.length > 0) {
  const newUserRetention = dataSources.retention.filter(r => 
    r.数据类型 === '新用户留存' || r.user_type === 'new' || r.is_new_user
  );
  const oldUserRetention = dataSources.retention.filter(r => 
    r.数据类型 === '活跃用户留存' || r.user_type === 'old' || r.is_old_user
  );
  
  // 计算平均留存率（支持中文字段）
  function extractRetentionRate(item, field) {
    const value = item[field] || 0;
    if (typeof value === 'string') {
      // 如果包含%，提取数字
      const match = value.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return parseFloat(value) || 0;
  }
  
  const avgNewD1 = newUserRetention.length > 0
    ? (newUserRetention.reduce((sum, r) => sum + extractRetentionRate(r, '次日留存率'), 0) / newUserRetention.length).toFixed(1)
    : '0';
  const avgNewD7 = newUserRetention.length > 0
    ? (newUserRetention.reduce((sum, r) => sum + extractRetentionRate(r, '7日留存率'), 0) / newUserRetention.length).toFixed(1)
    : '0';
  
  analysisResults.retentionAnalysis = {
    newUsers: {
      d1Avg: avgNewD1,
      d7Avg: avgNewD7,
      count: newUserRetention.length
    },
    oldUsers: {
      count: oldUserRetention.length
    }
  };
  
  // 生成留存结论
  analysisResults.retentionAnalysis.conclusion = 
    `用户留存分析：新用户次留达${avgNewD1}%，7日留存${avgNewD7}%，初期吸引力足但长期粘性有待提升。`;
}

// 步骤3：生成综合结论
let overallConclusion = `总体表现分析：\n\n`;
overallConclusion += `本期整体GGR ${analysisResults.overallGGR.change 
  ? analysisResults.overallGGR.change.display 
  : formatCurrency(analysisResults.overallGGR.current)}${analysisResults.overallGGR.change && !analysisResults.overallGGR.change.isPositive ? '，主要由老游戏下滑导致。' : '。'}\n\n`;

if (analysisResults.newGameAnalysis.totalGGR > 0) {
  overallConclusion += `新游戏贡献 ${formatCurrency(analysisResults.newGameAnalysis.totalGGR)}（占比${analysisResults.newGameAnalysis.contribution}%）。`;
  if (analysisResults.newGameAnalysis.topGames.length > 0) {
    overallConclusion += `其中${analysisResults.newGameAnalysis.topGames[0].name}表现亮眼。`;
  }
  overallConclusion += `\n\n`;
}

if (analysisResults.gameAnalysis.topGrowth.length > 0) {
  overallConclusion += `增长亮点：${analysisResults.gameAnalysis.topGrowth[0].name}环比${analysisResults.gameAnalysis.topGrowth[0].change.display}。\n\n`;
}

// 添加商户维度分析
if (analysisResults.merchantAnalysis.conclusion) {
  overallConclusion += `${analysisResults.merchantAnalysis.conclusion}\n\n`;
}

// 添加投注和局数分析
if (analysisResults.betAnalysis.conclusion) {
  overallConclusion += `${analysisResults.betAnalysis.conclusion}\n\n`;
}
if (analysisResults.roundsAnalysis.conclusion) {
  overallConclusion += `${analysisResults.roundsAnalysis.conclusion}\n\n`;
}

// 添加币种维度分析
if (analysisResults.currencyAnalysis.conclusion) {
  overallConclusion += `${analysisResults.currencyAnalysis.conclusion}\n\n`;
}

overallConclusion += analysisResults.retentionAnalysis.conclusion || '';
overallConclusion += `\n\n改进建议：优化高RTP区间控制、丰富新游戏长期循环机制、关注新兴市场导流。`;

analysisResults.overallConclusion = overallConclusion;

// 步骤4：返回分析结果
console.log("\n✅ 分析完成");
console.log(`📄 总体GGR变化: ${analysisResults.overallGGR.change ? analysisResults.overallGGR.change.display : '无对比'}`);

// 格式化日期范围为YYYYMMDD格式
function formatDateRangeForTitle(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };
  
  return {
    start: formatDate(start),
    end: formatDate(end),
    display: `${formatDate(start)}-${formatDate(end)}`
  };
}

// 准备日期范围信息
const dateRanges = {
  current: null,
  previous: null
};

if (currentWeekRange) {
  dateRanges.current = formatDateRangeForTitle(currentWeekRange.start, currentWeekRange.end);
  if (previousWeekRange) {
    dateRanges.previous = formatDateRangeForTitle(previousWeekRange.start, previousWeekRange.end);
  }
} else if (currentMonthRange) {
  dateRanges.current = formatDateRangeForTitle(currentMonthRange.start, currentMonthRange.end);
  if (previousMonthRange) {
    dateRanges.previous = formatDateRangeForTitle(previousMonthRange.start, previousMonthRange.end);
  }
}

// 构建输出数据，如果没有新游戏，则不包含新游戏分析内容
const outputData = {
  reportType: analysisResults.reportType,
  timestamp: new Date().toISOString(),
  dateRanges: dateRanges, // 添加日期范围信息
  summary: {
    overallGGR: analysisResults.overallGGR,
    activeUsers: analysisResults.activeUsersAnalysis,
    betTotal: analysisResults.betAnalysis
  },
  analyses: {
    merchant: analysisResults.merchantAnalysis,
    game: analysisResults.gameAnalysis,
    bet: analysisResults.betAnalysis,
    rounds: analysisResults.roundsAnalysis,
    currency: analysisResults.currencyAnalysis,
    retention: analysisResults.retentionAnalysis,
    activeUsers: analysisResults.activeUsersAnalysis
  },
  overallConclusion: analysisResults.overallConclusion,
  rawAnalysis: analysisResults
};

// 只有在有新游戏时才添加新游戏分析内容
if (dataSources.newGames.length > 0 && newGameListFromInput.length > 0) {
  outputData.summary.newGameGGR = {
    total: analysisResults.newGameAnalysis.totalGGR,
    contribution: analysisResults.newGameAnalysis.contribution
  };
  outputData.summary.newGameBet = {
    total: analysisResults.newGameAnalysis.totalBet,
    contribution: analysisResults.newGameAnalysis.betContribution
  };
  outputData.summary.newGameActiveUsers = {
    total: analysisResults.newGameAnalysis.activeUsers,
    contribution: analysisResults.newGameAnalysis.activeUsersContribution
  };
  outputData.analyses.newGame = analysisResults.newGameAnalysis;
  console.log(`✅ 包含新游戏分析内容`);
} else {
  console.log(`ℹ️ 没有新游戏，已隐藏新游戏分析内容`);
}

return [{
  json: outputData
}];

