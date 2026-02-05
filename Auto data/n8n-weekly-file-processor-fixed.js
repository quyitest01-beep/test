/* ========== n8n Code节点：处理XLSX文件并准备邮件发送（修复版）==========
 * 
 * 修复要点：
 * 1. 最小化处理 binary 数据，直接传递原始数据
 * 2. 不重新构建 binary 对象，避免破坏文件格式
 * 3. 保持原始文件名和 mimeType
 * 
 * 功能：
 * 1. 从上游接收 xlsx 文件（二进制数据）
 * 2. 计算上周时间范围（格式：YYYYMMDD-YYYYMMDD）
 * 3. 计算上月时间（格式：YYYYMM）
 * 4. 准备输出格式，包含文件数据和周期信息，供下游邮件节点使用
 */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

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
  
  const monthKeywords = ['月', 'month', '月度', 'monthly'];
  const isMonth = monthKeywords.some(keyword => fileNameLower.includes(keyword));
  
  const weekKeywords = ['周', 'week', '周度', 'weekly'];
  const isWeek = weekKeywords.some(keyword => fileNameLower.includes(keyword));
  
  const monthPattern = /(\d{4}[-/]?\d{2}|(\d{1,2})月)/;
  const hasMonthPattern = monthPattern.test(fileName);
  
  const dateRangePattern = /\d{8}-\d{8}/;
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

console.log(`📅 计算周期信息:`);
console.log(`  上周时间: ${lastWeekRange}`);
console.log(`  上月时间: ${lastMonth}`);

/* ---------- 处理输入文件（关键修复：直接传递 binary 数据）---------- */
const binaryOutput = {};
const fileMetadata = [];
const attachmentKeys = [];

inputItems.forEach((item, index) => {
  const binary = item.binary || {};
  
  // 查找 xlsx 文件
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
      const fileName = bin.fileName || `file_${index + 1}.xlsx`;
      const fileType = detectFileType(fileName);
      
      // 关键修复：直接使用原始 binary 对象，不做任何修改
      const attachmentKey = `attachment_${attachmentKeys.length + 1}`;
      binaryOutput[attachmentKey] = bin;  // 直接传递原始 binary 对象
      attachmentKeys.push(attachmentKey);
      
      // 如果是第一个文件，也添加为 'data' 字段（兼容性）
      if (attachmentKeys.length === 1) {
        binaryOutput.data = bin;  // 直接传递原始 binary 对象
      }
      
      // 记录元数据
      fileMetadata.push({
        fileName: fileName,
        fileType: fileType,
        mimeType: bin.mimeType,
        attachmentKey: attachmentKey
      });
      
      console.log(`📎 找到文件 [${attachmentKeys.length}]: ${fileName} (类型: ${fileType === 'monthly' ? '月度' : fileType === 'weekly' ? '周度' : '未知'})`);
      console.log(`   Binary key: ${attachmentKey}`);
      console.log(`   原始 mimeType: ${bin.mimeType}`);
      console.log(`   原始 fileName: ${bin.fileName}`);
    }
  }
});

if (fileMetadata.length === 0) {
  throw new Error("❌ 未找到任何 xlsx 文件");
}

console.log(`✅ 共找到 ${fileMetadata.length} 个文件`);

/* ---------- 判断主要数据类型 ---------- */
const fileTypes = fileMetadata.map(f => f.fileType);
const uniqueTypes = [...new Set(fileTypes)];

let primaryDataType = 'unknown';
if (uniqueTypes.length === 1) {
  primaryDataType = uniqueTypes[0];
} else if (uniqueTypes.length > 1) {
  primaryDataType = 'mixed';
  if (uniqueTypes.includes('monthly')) {
    primaryDataType = 'monthly';
  } else if (uniqueTypes.includes('weekly')) {
    primaryDataType = 'weekly';
  }
}

console.log(`📊 数据类型判断: ${primaryDataType === 'monthly' ? '月度' : primaryDataType === 'weekly' ? '周度' : primaryDataType === 'mixed' ? '混合' : '未知'}`);

/* ---------- 构建输出 ---------- */
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
  primaryPeriod = lastMonth;
  primaryPeriodText = `统计周期：${lastMonth}`;
  periodLabel = '上月（默认）';
}

const output = {
  // 文件元数据
  files: fileMetadata,
  
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
    primary: primaryPeriodText,
    primary_label: periodLabel
  },
  
  // 附件信息
  attachment_keys: attachmentKeys,
  attachment_count: fileMetadata.length,
  
  // 元数据
  meta: {
    file_count: fileMetadata.length,
    file_names: fileMetadata.map(f => f.fileName),
    file_types: fileTypes,
    data_type: primaryDataType,
    generated_at: new Date().toISOString()
  }
};

console.log(`📤 输出准备完成:`);
console.log(`  文件数量: ${output.meta.file_count}`);
console.log(`  文件列表: ${output.meta.file_names.join(', ')}`);
console.log(`  数据类型: ${primaryDataType === 'monthly' ? '月度' : primaryDataType === 'weekly' ? '周度' : primaryDataType === 'mixed' ? '混合' : '未知'}`);
console.log(`  主要周期: ${periodLabel} - ${primaryPeriod}`);
console.log(`  附件 keys: ${attachmentKeys.join(', ')}`);

// 返回单个输出项（包含所有文件的原始 binary 数据）
return [{
  json: output,
  binary: binaryOutput  // 包含所有原始 binary 对象
}];
