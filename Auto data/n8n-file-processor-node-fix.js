/* ========== n8n Code节点：处理XLSX文件并准备邮件发送（修复版） ==========
 * 
 * 🔧 修复的问题：
 * 1. 添加了详细的数据验证和错误提示
 * 2. 修复了 binary 数据提取逻辑
 * 3. 添加了文件大小检查
 * 4. 改进了调试日志
 * 5. 确保 base64 数据正确传递
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

/* ---------- 处理输入文件（修复版） ---------- */
const fileData = [];
const fileNames = [];

inputItems.forEach((item, index) => {
  console.log(`\n🔍 检查输入项 [${index + 1}]:`);
  
  const json = item.json || {};
  const binary = item.binary || {};
  
  // 🔧 修复1: 先检查 binary 对象是否存在
  if (Object.keys(binary).length === 0) {
    console.warn(`⚠️ 输入项 [${index + 1}] 没有 binary 数据`);
    console.warn(`   JSON keys: ${Object.keys(json).join(', ')}`);
    return; // 跳过这个项
  }
  
  console.log(`   Binary keys: ${Object.keys(binary).join(', ')}`);
  
  // 查找 xlsx 文件的二进制数据
  let fileBinary = null;
  let fileName = '';
  let binaryKey = '';
  
  // 尝试多种可能的字段名
  const possibleKeys = Object.keys(binary);
  
  for (const key of possibleKeys) {
    const bin = binary[key];
    
    if (!bin) {
      console.log(`   跳过 key "${key}": 值为空`);
      continue;
    }
    
    // 🔧 修复2: 详细检查 binary 对象的结构
    console.log(`   检查 key "${key}":`);
    console.log(`     类型: ${typeof bin}`);
    console.log(`     keys: ${typeof bin === 'object' ? Object.keys(bin).join(', ') : 'N/A'}`);
    
    if (typeof bin === 'object') {
      console.log(`     fileName: ${bin.fileName || 'N/A'}`);
      console.log(`     mimeType: ${bin.mimeType || 'N/A'}`);
      console.log(`     fileExtension: ${bin.fileExtension || 'N/A'}`);
      
      // 🔧 修复3: 检查 data 字段是否存在且有内容
      if (bin.data) {
        const dataType = typeof bin.data;
        const dataLength = dataType === 'string' ? bin.data.length : 
                          Buffer.isBuffer(bin.data) ? bin.data.length : 0;
        console.log(`     data 类型: ${dataType}`);
        console.log(`     data 长度: ${dataLength}`);
        
        // 🔧 修复4: 检查数据是否太小
        if (dataLength < 100) {
          console.warn(`     ⚠️ 警告: data 太小 (${dataLength} 字符/字节)，可能不是有效的 Excel 文件`);
          console.warn(`     data 内容: ${String(bin.data).substring(0, 100)}`);
        }
      } else {
        console.warn(`     ⚠️ 警告: 没有 data 字段`);
      }
    }
    
    // 检查是否是 xlsx 文件
    const isXlsx = 
      bin.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      bin.mimeType === 'application/vnd.ms-excel' ||
      (bin.fileName && (bin.fileName.endsWith('.xlsx') || bin.fileName.endsWith('.xls'))) ||
      (bin.fileExtension && (bin.fileExtension === 'xlsx' || bin.fileExtension === 'xls'));
    
    if (isXlsx) {
      // 🔧 修复5: 验证 data 字段
      if (!bin.data) {
        console.error(`     ❌ 错误: 找到 xlsx 文件但没有 data 字段`);
        continue;
      }
      
      // 🔧 修复6: 验证 data 不是空字符串
      const dataLength = typeof bin.data === 'string' ? bin.data.length : 
                        Buffer.isBuffer(bin.data) ? bin.data.length : 0;
      
      if (dataLength === 0) {
        console.error(`     ❌ 错误: data 字段为空`);
        continue;
      }
      
      if (dataLength < 100) {
        console.error(`     ❌ 错误: data 太小 (${dataLength})，不是有效的 Excel 文件`);
        console.error(`     data 内容: ${String(bin.data)}`);
        continue;
      }
      
      fileBinary = bin;
      fileName = bin.fileName || json.fileName || `file_${index + 1}.xlsx`;
      binaryKey = key;
      
      console.log(`     ✅ 找到有效的 xlsx 文件`);
      console.log(`     文件名: ${fileName}`);
      console.log(`     数据大小: ${dataLength} 字符/字节`);
      
      break;
    }
  }
  
  // 🔧 修复7: 如果没找到，提供详细的错误信息
  if (!fileBinary) {
    console.error(`❌ 输入项 [${index + 1}] 未找到有效的 xlsx 文件`);
    console.error(`   可用的 binary keys: ${possibleKeys.join(', ')}`);
    
    // 输出每个 key 的详细信息
    possibleKeys.forEach(key => {
      const bin = binary[key];
      if (bin && typeof bin === 'object') {
        console.error(`   ${key}:`);
        console.error(`     fileName: ${bin.fileName || 'N/A'}`);
        console.error(`     mimeType: ${bin.mimeType || 'N/A'}`);
        console.error(`     has data: ${!!bin.data}`);
        console.error(`     data length: ${bin.data ? String(bin.data).length : 0}`);
      }
    });
    
    return; // 跳过这个项
  }
  
  // 🔧 修复8: 确保 data 是 base64 字符串
  let dataToStore = fileBinary.data;
  
  if (Buffer.isBuffer(dataToStore)) {
    console.log(`   🔄 转换 Buffer 为 base64`);
    dataToStore = dataToStore.toString('base64');
  } else if (typeof dataToStore !== 'string') {
    console.error(`   ❌ 错误: data 类型不正确 (${typeof dataToStore})`);
    return;
  }
  
  // 🔧 修复9: 再次验证转换后的数据
  if (dataToStore.length < 100) {
    console.error(`   ❌ 错误: 转换后的 data 太小 (${dataToStore.length})`);
    console.error(`   data 内容: ${dataToStore}`);
    return;
  }
  
  // 存储文件数据
  fileData.push({
    data: dataToStore,  // 确保是 base64 字符串
    fileName: fileName,
    mimeType: fileBinary.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: fileBinary.fileExtension || 'xlsx',
    originalKey: binaryKey
  });
  
  fileNames.push(fileName);
  
  console.log(`✅ 成功添加文件 [${index + 1}]: ${fileName}`);
  console.log(`   数据大小: ${dataToStore.length} 字符`);
  console.log(`   预估文件大小: ${Math.round(dataToStore.length * 0.75)} 字节`);
});

// 🔧 修复10: 详细的错误提示
if (fileData.length === 0) {
  console.error(`\n❌ 未找到任何有效的 xlsx 文件`);
  console.error(`\n📋 调试信息:`);
  console.error(`  输入项数量: ${inputItems.length}`);
  
  inputItems.forEach((item, index) => {
    console.error(`\n  输入项 [${index + 1}]:`);
    console.error(`    JSON keys: ${Object.keys(item.json || {}).join(', ') || '无'}`);
    console.error(`    Binary keys: ${Object.keys(item.binary || {}).join(', ') || '无'}`);
    
    const binary = item.binary || {};
    Object.keys(binary).forEach(key => {
      const bin = binary[key];
      if (bin && typeof bin === 'object') {
        console.error(`    ${key}:`);
        console.error(`      fileName: ${bin.fileName || 'N/A'}`);
        console.error(`      mimeType: ${bin.mimeType || 'N/A'}`);
        console.error(`      has data: ${!!bin.data}`);
        console.error(`      data length: ${bin.data ? String(bin.data).length : 0}`);
      }
    });
  });
  
  throw new Error("❌ 未找到任何有效的 xlsx 文件。请检查上游节点是否正确生成了文件。");
}

console.log(`\n✅ 共找到 ${fileData.length} 个有效文件`);

/* ---------- 构建输出 ---------- */
const output = {
  files: fileData.map((file, index) => ({
    fileName: file.fileName,
    fileSize: Math.round(file.data.length * 0.75), // 预估实际文件大小
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
  meta: {
    file_count: fileData.length,
    file_names: fileNames,
    generated_at: new Date().toISOString()
  }
};

// 周期信息的文本格式
output.period_text = {
  yesterday_today: `统计周期：${yesterdayTodayRange}`,
  yesterday: `前日日期：${yesterday}`,
  today: `昨日日期：${today}`,
  last_month: `统计周期：${lastMonth}`
};

console.log(`\n📤 输出准备完成:`);
console.log(`  文件数量: ${output.meta.file_count}`);
console.log(`  文件列表: ${output.meta.file_names.join(', ')}`);

// 构建 binary 对象
const binaryOutput = {};
const attachmentKeys = [];

fileData.forEach((file, index) => {
  const fileName = file.fileName;
  const fileNameWithExt = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') 
    ? fileName 
    : `${fileName}.xlsx`;
  
  const key = `attachment_${index + 1}`;
  attachmentKeys.push(key);
  
  // 🔧 修复11: 确保 binary 对象包含所有必要字段
  const binaryObj = {
    data: file.data,  // 已经是 base64 字符串
    mimeType: file.mimeType,
    fileName: fileNameWithExt,
    fileExtension: file.fileExtension
  };
  
  binaryOutput[key] = binaryObj;
  
  // 同时添加以文件名为 key 的版本
  const fileKey = fileNameWithExt
    .replace(/\s+/g, '_')
    .replace(/\.xlsx?$/i, '')
    .toLowerCase();
  binaryOutput[fileKey] = binaryObj;
  
  console.log(`\n📎 Binary 对象 [${key}]:`);
  console.log(`  fileName: ${binaryObj.fileName}`);
  console.log(`  mimeType: ${binaryObj.mimeType}`);
  console.log(`  fileExtension: ${binaryObj.fileExtension}`);
  console.log(`  data length: ${binaryObj.data.length} 字符`);
  console.log(`  预估文件大小: ${Math.round(binaryObj.data.length * 0.75)} 字节`);
  
  // 🔧 修复12: 验证数据不是太小
  if (binaryObj.data.length < 100) {
    console.error(`  ❌ 警告: 数据太小！`);
  } else {
    console.log(`  ✅ 数据大小正常`);
  }
});

// 如果只有一个文件，添加 data 字段
if (fileData.length === 1) {
  const file = fileData[0];
  const fileNameWithExt = file.fileName.endsWith('.xlsx') || file.fileName.endsWith('.xls')
    ? file.fileName
    : `${file.fileName}.xlsx`;
  
  binaryOutput.data = {
    data: file.data,
    mimeType: file.mimeType,
    fileName: fileNameWithExt,
    fileExtension: file.fileExtension
  };
  
  console.log(`\n📎 添加默认 binary.data 字段`);
}

// 在 json 中添加附件信息
output.attachment_keys = attachmentKeys;
output.attachment_count = fileData.length;

console.log(`\n✅ 输出构建完成`);
console.log(`  attachment_keys: ${attachmentKeys.join(', ')}`);
console.log(`  attachment_count: ${output.attachment_count}`);

// 🔧 修复13: 最终验证
console.log(`\n🔍 最终验证:`);
attachmentKeys.forEach(key => {
  const bin = binaryOutput[key];
  const dataLength = bin.data ? bin.data.length : 0;
  const estimatedSize = Math.round(dataLength * 0.75);
  
  if (dataLength < 100) {
    console.error(`  ❌ ${key}: 数据太小 (${dataLength} 字符, ~${estimatedSize} 字节)`);
  } else {
    console.log(`  ✅ ${key}: 数据正常 (${dataLength} 字符, ~${estimatedSize} 字节)`);
  }
});

// 返回单个输出项
return [{
  json: output,
  binary: binaryOutput
}];
