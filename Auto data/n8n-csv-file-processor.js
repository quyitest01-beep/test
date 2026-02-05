/* ========== n8n Code节点：处理CSV文件并准备邮件发送 ==========
 * 
 * 功能：
 * 1. 从上游接收 CSV 文件（二进制数据）
 * 2. 计算昨日-今日时间范围（格式：YYYYMMDD-YYYYMMDD）
 * 3. 计算上月时间（格式：YYYYMM）
 * 4. 准备输出格式，包含文件数据和周期信息，供下游邮件节点使用
 * 
 * 支持的文件格式：
 * - CSV (.csv)
 * - 也兼容 XLSX (.xlsx) 格式
 */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

console.log(`📥 收到 ${inputItems.length} 个输入项`);

/* ---------- 工具函数：计算前日-昨日时间范围 ---------- */
function getYesterdayTodayRange() {
  const today1 = new Date();
  
  // 计算前日：当前日期减2天
  const yesterday = new Date(today1);
  yesterday.setDate(today1.getDate() - 2);
  
  // 计算昨日：当前日期减1天
  const today = new Date(today1);
  today.setDate(today1.getDate() - 1);
  
  // 格式化为 YYYYMMDD
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  const yesterdayDate = formatDate(yesterday);
  const todayDate = formatDate(today);
  
  return {
    range: `${yesterdayDate}-${todayDate}`,
    yesterday: yesterdayDate,
    today: todayDate
  };
}

/* ---------- 工具函数：计算上月时间 ---------- */
function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);
  
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/* ---------- 提取周期信息 ---------- */
const { range: yesterdayTodayRange, yesterday, today } = getYesterdayTodayRange();
const lastMonth = getLastMonth();

console.log(`📅 计算周期信息:`);
console.log(`  统计周期: ${yesterdayTodayRange}`);
console.log(`  前日日期: ${yesterday}`);
console.log(`  昨日日期: ${today}`);
console.log(`  上月周期: ${lastMonth}`);

/* ---------- 处理输入文件（支持CSV和XLSX） ---------- */
const fileData = [];
const fileNames = [];

inputItems.forEach((item, itemIndex) => {
  console.log(`\n🔍 处理输入项 [${itemIndex + 1}]:`);
  
  const json = item.json || {};
  const binary = item.binary || {};
  
  // 检查binary对象
  if (Object.keys(binary).length === 0) {
    console.warn(`⚠️ 输入项 [${itemIndex + 1}] 没有 binary 数据`);
    console.warn(`   JSON keys: ${Object.keys(json).join(', ')}`);
    return;
  }
  
  console.log(`  Binary keys: ${Object.keys(binary).join(', ')}`);
  
  // 遍历所有binary字段
  Object.keys(binary).forEach(binaryKey => {
    const bin = binary[binaryKey];
    
    if (!bin || typeof bin !== 'object') {
      console.log(`  跳过 ${binaryKey}: 不是对象`);
      return;
    }
    
    console.log(`\n  检查 binary.${binaryKey}:`);
    console.log(`    fileName: ${bin.fileName || 'N/A'}`);
    console.log(`    mimeType: ${bin.mimeType || 'N/A'}`);
    console.log(`    fileExtension: ${bin.fileExtension || 'N/A'}`);
    console.log(`    has data: ${!!bin.data}`);
    
    // 🔧 修改：检查是否是CSV或XLSX文件
    const isCSV = 
      bin.mimeType === 'text/csv' ||
      bin.mimeType === 'application/csv' ||
      (bin.fileName && bin.fileName.endsWith('.csv')) ||
      (bin.fileExtension && bin.fileExtension === 'csv');
    
    const isXLSX = 
      bin.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      bin.mimeType === 'application/vnd.ms-excel' ||
      (bin.fileName && (bin.fileName.endsWith('.xlsx') || bin.fileName.endsWith('.xls'))) ||
      (bin.fileExtension && (bin.fileExtension === 'xlsx' || bin.fileExtension === 'xls'));
    
    const isValidFile = isCSV || isXLSX;
    
    if (!isValidFile) {
      console.log(`    跳过: 不是CSV或XLSX文件`);
      return;
    }
    
    console.log(`    ✓ 文件类型: ${isCSV ? 'CSV' : 'XLSX'}`);
    
    // 验证data字段
    if (!bin.data) {
      console.error(`    ❌ 错误: 没有data字段`);
      return;
    }
    
    // 检查data类型和大小
    let dataToStore = bin.data;
    let dataLength = 0;
    
    if (typeof dataToStore === 'string') {
      dataLength = dataToStore.length;
      console.log(`    data类型: string`);
    } else if (Buffer.isBuffer(dataToStore)) {
      console.log(`    🔄 转换Buffer为base64`);
      dataToStore = dataToStore.toString('base64');
      dataLength = dataToStore.length;
    } else {
      console.error(`    ❌ 错误: data类型不正确 (${typeof dataToStore})`);
      return;
    }
    
    console.log(`    data长度: ${dataLength} 字符`);
    
    // 🔧 修改：CSV文件可能比XLSX小，所以降低最小大小要求
    const minSize = isCSV ? 10 : 100;  // CSV最小10字节，XLSX最小100字节
    
    if (dataLength < minSize) {
      console.error(`    ❌ 错误: data太小 (${dataLength}，最小要求${minSize})`);
      console.error(`    data内容: ${String(dataToStore).substring(0, 200)}`);
      return;
    }
    
    // CSV文件的预估大小（base64编码后）
    const estimatedSize = isCSV ? dataLength : Math.round(dataLength * 0.75);
    console.log(`    预估文件大小: ${estimatedSize} 字节`);
    
    // 提取文件名
    let fileName = bin.fileName || json.fileName || `file_${fileData.length + 1}`;
    
    // 🔧 修改：确保文件名有正确的扩展名
    const fileExt = isCSV ? '.csv' : '.xlsx';
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      fileName = `${fileName}${fileExt}`;
    }
    
    // 存储文件数据
    fileData.push({
      data: dataToStore,
      fileName: fileName,
      mimeType: bin.mimeType || (isCSV ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      fileExtension: isCSV ? 'csv' : 'xlsx',
      fileType: isCSV ? 'CSV' : 'XLSX',
      originalKey: binaryKey,
      sourceItemIndex: itemIndex
    });
    
    fileNames.push(fileName);
    
    console.log(`    ✅ 成功添加文件: ${fileName}`);
  });
});

// 验证是否找到文件
if (fileData.length === 0) {
  console.error(`\n❌ 未找到任何有效的CSV或XLSX文件`);
  console.error(`\n📋 调试信息:`);
  
  inputItems.forEach((item, index) => {
    console.error(`  输入项 [${index + 1}]:`);
    console.error(`    JSON keys: ${Object.keys(item.json || {}).join(', ')}`);
    console.error(`    Binary keys: ${Object.keys(item.binary || {}).join(', ')}`);
    
    const binary = item.binary || {};
    Object.keys(binary).forEach(key => {
      const bin = binary[key];
      if (bin && typeof bin === 'object') {
        console.error(`    Binary.${key}:`);
        console.error(`      fileName: ${bin.fileName || 'N/A'}`);
        console.error(`      mimeType: ${bin.mimeType || 'N/A'}`);
        console.error(`      fileExtension: ${bin.fileExtension || 'N/A'}`);
        console.error(`      has data: ${!!bin.data}`);
        console.error(`      data length: ${bin.data ? String(bin.data).length : 0}`);
      }
    });
  });
  
  throw new Error("未找到任何有效的CSV或XLSX文件。请检查上游节点是否正确生成了文件。");
}

console.log(`\n✅ 共找到 ${fileData.length} 个有效文件:`);
fileNames.forEach((name, index) => {
  const file = fileData[index];
  console.log(`  ${index + 1}. ${name} (${file.fileType}, ${Math.round(file.data.length * 0.75)} 字节)`);
});

/* ---------- 构建输出 ---------- */
const output = {
  files: fileData.map((file, index) => ({
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileType === 'CSV' ? file.data.length : Math.round(file.data.length * 0.75),
    dataLength: file.data.length,
    mimeType: file.mimeType,
    fileExtension: file.fileExtension
  })),
  period: {
    yesterday_today: yesterdayTodayRange,
    yesterday: yesterday,
    today: today,
    last_month: lastMonth
  },
  period_text: {
    yesterday_today: `统计周期：${yesterdayTodayRange}`,
    yesterday: `前日日期：${yesterday}`,
    today: `昨日日期：${today}`,
    last_month: `统计周期：${lastMonth}`
  },
  meta: {
    file_count: fileData.length,
    file_names: fileNames,
    file_types: fileData.map(f => f.fileType),
    generated_at: new Date().toISOString()
  }
};

console.log(`\n📤 输出准备完成:`);
console.log(`  文件数量: ${output.meta.file_count}`);
console.log(`  文件列表: ${output.meta.file_names.join(', ')}`);
console.log(`  文件类型: ${output.meta.file_types.join(', ')}`);

// 构建binary对象
const binaryOutput = {};
const attachmentKeys = [];

fileData.forEach((file, index) => {
  const key = `attachment_${index + 1}`;
  attachmentKeys.push(key);
  
  const binaryObj = {
    data: file.data,
    mimeType: file.mimeType,
    fileName: file.fileName,
    fileExtension: file.fileExtension
  };
  
  binaryOutput[key] = binaryObj;
  
  // 同时添加以文件名为key的版本
  const fileKey = file.fileName
    .replace(/\s+/g, '_')
    .replace(/\.(csv|xlsx?)$/i, '')
    .toLowerCase();
  binaryOutput[fileKey] = binaryObj;
  
  console.log(`\n📎 Binary [${key}]:`);
  console.log(`  fileName: ${file.fileName}`);
  console.log(`  fileType: ${file.fileType}`);
  console.log(`  mimeType: ${file.mimeType}`);
  console.log(`  data length: ${file.data.length} 字符`);
  
  const estimatedSize = file.fileType === 'CSV' ? file.data.length : Math.round(file.data.length * 0.75);
  console.log(`  预估大小: ${estimatedSize} 字节`);
  
  // 验证数据大小
  if (file.data.length < 10) {
    console.error(`  ❌ 警告: 数据太小！`);
  } else {
    console.log(`  ✅ 数据大小正常`);
  }
});

// 如果只有一个文件，添加data字段（便于邮件节点使用）
if (fileData.length === 1) {
  binaryOutput.data = binaryOutput.attachment_1;
  console.log(`\n📎 添加默认 binary.data 字段`);
}

// 在json中添加附件信息
output.attachment_keys = attachmentKeys;
output.attachment_count = fileData.length;

console.log(`\n✅ 输出构建完成`);
console.log(`  attachment_keys: ${attachmentKeys.join(', ')}`);
console.log(`  attachment_count: ${output.attachment_count}`);

// 最终验证
console.log(`\n🔍 最终验证:`);
let allValid = true;

attachmentKeys.forEach(key => {
  const bin = binaryOutput[key];
  const dataLength = bin.data ? bin.data.length : 0;
  const fileType = bin.fileName.endsWith('.csv') ? 'CSV' : 'XLSX';
  const minSize = fileType === 'CSV' ? 10 : 100;
  
  if (dataLength < minSize) {
    console.error(`  ❌ ${key}: 数据太小 (${dataLength} 字符)`);
    allValid = false;
  } else {
    console.log(`  ✅ ${key}: 数据正常 (${dataLength} 字符)`);
  }
});

if (!allValid) {
  console.error(`\n⚠️ 警告: 某些文件的数据可能有问题，请检查上游节点`);
}

// 返回单个输出项
return [{
  json: output,
  binary: binaryOutput
}];
