/* ========== n8n Code节点：处理XLSX文件并准备邮件发送 ==========
 * 功能：
 * 1. 从上游接收 xlsx 文件（二进制数据）
 * 2. 计算上周时间范围（格式：YYYYMMDD-YYYYMMDD）
 * 3. 计算上月时间（格式：YYYYMM）
 * 4. 准备输出格式，包含文件数据和周期信息，供下游邮件节点使用
 * 
 * 输入数据格式：
 * - 上游可能有多个输入项，每个包含 xlsx 文件的二进制数据
 * - 文件名可能包含：商户投注用户数据、商户新用户留存数据、商户活跃用户留存数据
 */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

/* ---------- 工具函数：计算上周时间范围 ---------- */
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
  
  // 计算上周一：当前日期减去（当前星期几 + 7）
  const daysToSubtract = dayOfWeek === 0 ? 13 : dayOfWeek + 6; // 如果是周日，减13天；否则减(dayOfWeek+6)天
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToSubtract);
  
  // 计算上周日：上周一 + 6天
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  // 格式化为 YYYYMMDD
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  const startDate = formatDate(lastMonday);
  const endDate = formatDate(lastSunday);
  
  return `${startDate}-${endDate}`;
}

/* ---------- 工具函数：计算上月时间 ---------- */
function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  
  return `${y}${m}`;
}

/* ---------- 工具函数：判断文件类型（周度/月度） ---------- */
function detectFileType(fileName) {
  if (!fileName) return 'unknown';
  
  const fileNameLower = fileName.toLowerCase();
  
  // 月度关键词：月、month、月度
  const monthKeywords = ['月', 'month', '月度', 'monthly'];
  const isMonth = monthKeywords.some(keyword => fileNameLower.includes(keyword));
  
  // 周度关键词：周、week、周度、weekly
  const weekKeywords = ['周', 'week', '周度', 'weekly'];
  const isWeek = weekKeywords.some(keyword => fileNameLower.includes(keyword));
  
  // 如果文件名包含月份格式（如 202510、2025-10、10月）
  const monthPattern = /(\d{4}[-/]?\d{2}|(\d{1,2})月)/;
  const hasMonthPattern = monthPattern.test(fileName);
  
  // 如果文件名包含日期范围格式（如 20251010-20251016）
  const dateRangePattern = /\d{8}-\d{8}/;
  const hasDateRangePattern = dateRangePattern.test(fileName);
  
  // 判断逻辑
  if (isMonth || (hasMonthPattern && !hasDateRangePattern)) {
    return 'monthly';
  } else if (isWeek || hasDateRangePattern) {
    return 'weekly';
  }
  
  // 默认：如果无法判断，返回 unknown（将同时提供周度和月度）
  return 'unknown';
}

/* ---------- 提取周期信息 ---------- */
const lastWeekRange = getLastWeekRange();
const lastMonth = getLastMonth();

console.log(`📅 计算周期信息:`);
console.log(`  上周时间: ${lastWeekRange}`);
console.log(`  上月时间: ${lastMonth}`);

/* ---------- 处理输入文件 ---------- */
const fileData = [];
const fileNames = [];
const fileTypes = []; // 记录每个文件的类型（weekly/monthly/unknown）

inputItems.forEach((item, index) => {
  const json = item.json || {};
  const binary = item.binary || {};
  
  // 查找 xlsx 文件的二进制数据
  // n8n 中二进制数据通常在 item.binary 中，key 可能是 'data' 或其他字段名
  let fileBinary = null;
  let fileName = '';
  
  // 尝试多种可能的字段名（常见的有 'data', 'file', 'attachment' 等）
  const possibleKeys = Object.keys(binary);
  
  for (const key of possibleKeys) {
    const bin = binary[key];
    if (!bin) continue;
    
    // 检查是否是 xlsx 文件
    const isXlsx = 
      bin.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      bin.mimeType === 'application/vnd.ms-excel' ||
      (bin.fileName && (bin.fileName.endsWith('.xlsx') || bin.fileName.endsWith('.xls'))) ||
      (bin.fileExtension && (bin.fileExtension === 'xlsx' || bin.fileExtension === 'xls'));
    
    if (isXlsx) {
      fileBinary = bin;
      fileName = bin.fileName || json.fileName || `file_${index + 1}.xlsx`;
      break;
    }
  }
  
  // 如果没找到，尝试从 json 中查找
  if (!fileBinary) {
    // 检查 json 中是否有文件信息
    if (json.fileName && json.data) {
      fileName = json.fileName;
      fileBinary = {
        data: json.data,
        fileName: json.fileName,
        mimeType: json.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: 'xlsx'
      };
    } else if (json.data) {
      // 如果只有 data，尝试推断文件名
      fileName = json.fileName || `file_${index + 1}.xlsx`;
      fileBinary = {
        data: json.data,
        fileName: fileName,
        mimeType: json.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileExtension: 'xlsx'
      };
    }
  }
  
  if (fileBinary) {
    // 检测文件类型
    const fileType = detectFileType(fileName);
    fileData.push(fileBinary);
    fileNames.push(fileName);
    fileTypes.push(fileType);
    console.log(`📎 找到文件 [${index + 1}]: ${fileName} (类型: ${fileType === 'monthly' ? '月度' : fileType === 'weekly' ? '周度' : '未知'})`);
  } else {
    console.warn(`⚠️ 跳过输入项 [${index + 1}]: 未找到 xlsx 文件`);
    console.warn(`   可用字段: ${Object.keys(binary).join(', ') || '无binary数据'}`);
  }
});

if (fileData.length === 0) {
  throw new Error("❌ 未找到任何 xlsx 文件");
}

console.log(`✅ 共找到 ${fileData.length} 个文件`);

// 判断主要数据类型（如果所有文件都是同一类型，使用该类型；否则使用 'mixed'）
const uniqueTypes = [...new Set(fileTypes)];
let primaryDataType = 'unknown';
if (uniqueTypes.length === 1) {
  primaryDataType = uniqueTypes[0];
} else if (uniqueTypes.length > 1) {
  primaryDataType = 'mixed';
  // 如果混合类型，优先使用月度（因为月度数据通常更重要）
  if (uniqueTypes.includes('monthly')) {
    primaryDataType = 'monthly';
  } else if (uniqueTypes.includes('weekly')) {
    primaryDataType = 'weekly';
  }
}

console.log(`📊 数据类型判断: ${primaryDataType === 'monthly' ? '月度' : primaryDataType === 'weekly' ? '周度' : primaryDataType === 'mixed' ? '混合' : '未知'}`);

/* ---------- 构建输出 ---------- */
// 方式1：如果下游邮件节点支持多个附件，直接输出所有文件
// 方式2：如果需要合并为单个输出，可以分别输出每个文件

// 根据数据类型选择主要周期
let primaryPeriod = null;
let primaryPeriodText = '';
let periodLabel = '';

if (primaryDataType === 'monthly') {
  primaryPeriod = lastMonth;
  primaryPeriodText = `统计周期：${lastMonth}`;
  periodLabel = '上月';
} else if (primaryDataType === 'weekly') {
  primaryPeriod = lastWeekRange;
  primaryPeriodText = `统计周期：${lastWeekRange}`;
  periodLabel = '上周';
} else {
  // 未知或混合类型：默认使用月度（因为月度数据通常更重要）
  primaryPeriod = lastMonth;
  primaryPeriodText = `统计周期：${lastMonth}`;
  periodLabel = '上月（默认）';
}

// 这里采用方式1：输出包含所有文件数据的对象
const output = {
  files: fileData.map((bin, index) => ({
    fileName: fileNames[index] || `file_${index + 1}.xlsx`,
    data: bin.data,
    mimeType: bin.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx',
    fileType: fileTypes[index] || 'unknown' // 每个文件的类型
  })),
  period: {
    last_week: lastWeekRange,        // 格式：20251110-20251116
    last_month: lastMonth,           // 格式：202510
    primary: primaryPeriod,          // 主要周期（根据文件类型自动选择）
    primary_type: primaryDataType,   // 主要周期类型：weekly/monthly/mixed/unknown
    primary_label: periodLabel       // 主要周期标签：上周/上月
  },
  meta: {
    file_count: fileData.length,
    file_names: fileNames,
    file_types: fileTypes,           // 每个文件的类型数组
    data_type: primaryDataType,      // 主要数据类型
    generated_at: new Date().toISOString()
  }
};

// 同时输出周期信息的文本格式，方便在邮件中使用
output.period_text = {
  last_week: `上周时间：${lastWeekRange}`,
  last_month: `上月时间：${lastMonth}`,
  primary: primaryPeriodText,        // 主要周期文本（根据文件类型自动选择）
  primary_label: periodLabel         // 主要周期标签
};

console.log(`📤 输出准备完成:`);
console.log(`  文件数量: ${output.meta.file_count}`);
console.log(`  文件列表: ${output.meta.file_names.join(', ')}`);
console.log(`  数据类型: ${primaryDataType === 'monthly' ? '月度' : primaryDataType === 'weekly' ? '周度' : primaryDataType === 'mixed' ? '混合' : '未知'}`);
console.log(`  主要周期: ${periodLabel} - ${primaryPeriod}`);
console.log(`  周期信息: ${JSON.stringify(output.period, null, 2)}`);

// 构建 binary 对象（供邮件节点使用）
// n8n 邮件节点需要 binary 对象包含 fileName、mimeType、data、fileExtension
const binaryOutput = {};
const attachmentKeys = []; // 记录所有附件字段名，便于下游使用

fileData.forEach((bin, index) => {
  const fileName = fileNames[index] || `file_${index + 1}.xlsx`;
  // 确保文件名有扩展名
  const fileNameWithExt = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') 
    ? fileName 
    : `${fileName}.xlsx`;
  
  // 使用文件名作为 key（去除扩展名，替换空格为下划线）
  const key = `attachment_${index + 1}`;
  attachmentKeys.push(key);
  
  // 构建完整的 binary 对象，确保包含所有必要字段
  const binaryObj = {
    data: bin.data,  // base64 编码的数据
    mimeType: bin.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: fileNameWithExt,  // 完整的文件名（含扩展名）
    fileExtension: 'xlsx'
  };
  
  // 保留原始 binary 数据（如果原始数据已经有完整结构，优先使用）
  // 但确保 fileName 是正确的
  if (bin.fileName && bin.fileName !== fileNameWithExt) {
    binaryObj.fileName = fileNameWithExt; // 覆盖为正确的文件名
  }
  
  binaryOutput[key] = binaryObj;
  
  // 同时添加以文件名为 key 的版本（便于下游使用）
  const fileKey = fileNameWithExt
    .replace(/\s+/g, '_')
    .replace(/\.xlsx?$/i, '')
    .toLowerCase();
  binaryOutput[fileKey] = binaryObj;
});

// 如果只有一个文件，添加 data 字段（便于邮件节点使用）
if (fileData.length === 1 && fileData[0]) {
  const fileName = fileNames[0] || `file_1.xlsx`;
  const fileNameWithExt = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') 
    ? fileName 
    : `${fileName}.xlsx`;
  
  binaryOutput.data = {
    data: fileData[0].data,
    mimeType: fileData[0].mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: fileNameWithExt,
    fileExtension: 'xlsx'
  };
}

// 在 json 中添加附件信息，便于邮件节点配置
output.attachment_keys = attachmentKeys;
output.attachment_count = fileData.length;

// 调试日志：输出每个 binary 对象的结构
console.log(`📎 Binary 对象详情:`);
attachmentKeys.forEach(key => {
  const bin = binaryOutput[key];
  console.log(`  ${key}:`);
  console.log(`    fileName: ${bin.fileName}`);
  console.log(`    mimeType: ${bin.mimeType}`);
  console.log(`    fileExtension: ${bin.fileExtension}`);
  console.log(`    data length: ${bin.data ? String(bin.data).length : 0} 字符`);
});

// 返回单个输出项（包含所有文件）
return [{
  json: output,
  binary: binaryOutput
}];

