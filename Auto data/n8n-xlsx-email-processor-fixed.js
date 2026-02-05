/* ========== n8n Code节点：处理XLSX文件并准备邮件发送（修复版）========== */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

console.log(`📥 接收到 ${inputItems.length} 个输入项`);

/* ---------- 工具函数：计算上周时间范围 ---------- */
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  const daysToSubtract = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToSubtract);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  return `${formatDate(lastMonday)}-${formatDate(lastSunday)}`;
}

/* ---------- 工具函数：计算上月时间 ---------- */
function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/* ---------- 工具函数：判断文件类型 ---------- */
function detectFileType(fileName) {
  if (!fileName) return 'unknown';
  
  const fileNameLower = fileName.toLowerCase();
  
  const monthKeywords = ['月', 'month', '月度', 'monthly'];
  const weekKeywords = ['周', 'week', '周度', 'weekly'];
  
  const isMonth = monthKeywords.some(keyword => fileNameLower.includes(keyword));
  const isWeek = weekKeywords.some(keyword => fileNameLower.includes(keyword));
  
  const monthPattern = /(\d{4}[-/]?\d{2}|(\d{1,2})月)/;
  const dateRangePattern = /\d{8}-\d{8}/;
  
  const hasMonthPattern = monthPattern.test(fileName);
  const hasDateRangePattern = dateRangePattern.test(fileName);
  
  if (isMonth || (hasMonthPattern && !hasDateRangePattern)) {
    return 'monthly';
  } else if (isWeek || hasDateRangePattern) {
    return 'weekly';
  }
  
  return 'unknown';
}

/* ---------- 提取周期信息 ---------- */
const lastWeekRange = getLastWeekRange();
const lastMonth = getLastMonth();

console.log(`📅 周期信息:`);
console.log(`  上周: ${lastWeekRange}`);
console.log(`  上月: ${lastMonth}`);

/* ---------- 处理输入文件 ---------- */
const processedFiles = [];

inputItems.forEach((item, index) => {
  console.log(`\n处理 Item ${index + 1}:`);
  
  const binary = item.binary || {};
  const json = item.json || {};
  
  // 查找XLSX文件
  const binaryKeys = Object.keys(binary);
  console.log(`  Binary keys: ${binaryKeys.join(', ')}`);
  
  for (const key of binaryKeys) {
    const bin = binary[key];
    if (!bin) continue;
    
    // 检查是否是XLSX文件
    const isXlsx = 
      bin.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      bin.mimeType === 'application/vnd.ms-excel' ||
      (bin.fileName && (bin.fileName.endsWith('.xlsx') || bin.fileName.endsWith('.xls')));
    
    if (isXlsx) {
      const fileName = bin.fileName || `file_${index + 1}.xlsx`;
      const fileType = detectFileType(fileName);
      
      console.log(`  ✅ 找到文件: ${fileName}`);
      console.log(`     类型: ${fileType}`);
      console.log(`     MimeType: ${bin.mimeType}`);
      console.log(`     Data存在: ${!!bin.data}`);
      
      processedFiles.push({
        binaryKey: key,
        binary: bin,
        fileName: fileName,
        fileType: fileType,
        originalItem: item
      });
    }
  }
});

if (processedFiles.length === 0) {
  throw new Error("❌ 未找到任何XLSX文件");
}

console.log(`\n✅ 共找到 ${processedFiles.length} 个XLSX文件`);

/* ---------- 判断主要数据类型 ---------- */
const fileTypes = processedFiles.map(f => f.fileType);
const uniqueTypes = [...new Set(fileTypes)];

let primaryDataType = 'unknown';
if (uniqueTypes.length === 1) {
  primaryDataType = uniqueTypes[0];
} else if (uniqueTypes.includes('monthly')) {
  primaryDataType = 'monthly';
} else if (uniqueTypes.includes('weekly')) {
  primaryDataType = 'weekly';
}

let primaryPeriod, periodLabel;
if (primaryDataType === 'monthly') {
  primaryPeriod = lastMonth;
  periodLabel = '上月';
} else if (primaryDataType === 'weekly') {
  primaryPeriod = lastWeekRange;
  periodLabel = '上周';
} else {
  primaryPeriod = lastMonth;
  periodLabel = '上月（默认）';
}

console.log(`\n📊 数据类型: ${primaryDataType}`);
console.log(`📅 主要周期: ${periodLabel} - ${primaryPeriod}`);

/* ---------- 构建输出 ---------- */

// 构建binary对象
const binaryOutput = {};

processedFiles.forEach((file, index) => {
  const key = `attachment_${index + 1}`;
  
  // 确保文件名有扩展名
  let fileName = file.fileName;
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    fileName = `${fileName}.xlsx`;
  }
  
  // 构建binary对象 - 关键：必须包含data字段
  binaryOutput[key] = {
    data: file.binary.data,  // 必须：base64数据
    fileName: fileName,       // 必须：文件名
    mimeType: file.binary.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx'
  };
  
  console.log(`\n📎 Binary[${key}]:`);
  console.log(`   fileName: ${fileName}`);
  console.log(`   data length: ${file.binary.data ? String(file.binary.data).length : 0}`);
});

// 如果只有一个文件，也添加到'data'字段（兼容性）
if (processedFiles.length === 1) {
  const file = processedFiles[0];
  let fileName = file.fileName;
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    fileName = `${fileName}.xlsx`;
  }
  
  binaryOutput.data = {
    data: file.binary.data,
    fileName: fileName,
    mimeType: file.binary.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx'
  };
}

// 构建JSON输出
const jsonOutput = {
  // 文件信息
  file_count: processedFiles.length,
  file_names: processedFiles.map(f => f.fileName),
  file_types: fileTypes,
  
  // 周期信息
  period: {
    last_week: lastWeekRange,
    last_month: lastMonth,
    primary: primaryPeriod,
    primary_type: primaryDataType,
    primary_label: periodLabel
  },
  
  // 周期文本（用于邮件）
  period_text: {
    last_week: `上周时间：${lastWeekRange}`,
    last_month: `上月时间：${lastMonth}`,
    primary: `统计周期：${primaryPeriod}`,
    primary_label: periodLabel
  },
  
  // 附件信息
  attachment_keys: Object.keys(binaryOutput).filter(k => k.startsWith('attachment_')),
  attachment_count: processedFiles.length,
  
  // 元数据
  generated_at: new Date().toISOString(),
  data_type: primaryDataType
};

console.log(`\n📤 输出准备完成:`);
console.log(`   文件数: ${jsonOutput.file_count}`);
console.log(`   Binary keys: ${Object.keys(binaryOutput).join(', ')}`);
console.log(`   主要周期: ${periodLabel} - ${primaryPeriod}`);

// 返回单个item（包含所有文件）
return [{
  json: jsonOutput,
  binary: binaryOutput
}];
