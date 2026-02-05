/* ========== n8n Code节点：简单传递CSV文件（不破坏数据） ==========
 * 
 * 核心原则：不要重新处理binary数据，直接传递！
 * 
 * 功能：
 * 1. 计算周期信息
 * 2. 直接传递上游的binary数据（不做任何转换）
 * 3. 添加文件元数据到JSON
 */

const inputItems = $input.all();

if (!inputItems || inputItems.length === 0) {
  throw new Error("❌ 没有输入数据");
}

console.log(`📥 收到 ${inputItems.length} 个输入项`);

/* ---------- 工具函数：计算周期信息 ---------- */
function getYesterdayTodayRange() {
  const today1 = new Date();
  const yesterday = new Date(today1);
  yesterday.setDate(today1.getDate() - 2);
  const today = new Date(today1);
  today.setDate(today1.getDate() - 1);
  
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  
  return {
    range: `${formatDate(yesterday)}-${formatDate(today)}`,
    yesterday: formatDate(yesterday),
    today: formatDate(today)
  };
}

function getLastMonth() {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

const { range: yesterdayTodayRange, yesterday, today } = getYesterdayTodayRange();
const lastMonth = getLastMonth();

console.log(`📅 周期信息:`);
console.log(`  统计周期: ${yesterdayTodayRange}`);
console.log(`  前日: ${yesterday}`);
console.log(`  昨日: ${today}`);
console.log(`  上月: ${lastMonth}`);

/* ---------- 收集文件信息（不修改binary数据） ---------- */
const fileNames = [];
const fileInfo = [];

// 🔧 关键：直接使用原始的binary对象，不做任何修改
const mergedBinary = {};
let fileCounter = 0;  // 用于生成唯一的key

inputItems.forEach((item, itemIndex) => {
  console.log(`\n🔍 处理输入项 [${itemIndex + 1}]:`);
  
  const binary = item.binary || {};
  
  if (Object.keys(binary).length === 0) {
    console.warn(`⚠️ 输入项 [${itemIndex + 1}] 没有 binary 数据`);
    return;
  }
  
  console.log(`  Binary keys: ${Object.keys(binary).join(', ')}`);
  
  // 遍历所有binary字段，直接复制到输出
  Object.keys(binary).forEach(binaryKey => {
    const bin = binary[binaryKey];
    
    if (!bin || typeof bin !== 'object') {
      return;
    }
    
    console.log(`  检查 binary.${binaryKey}:`);
    console.log(`    fileName: ${bin.fileName || 'N/A'}`);
    console.log(`    mimeType: ${bin.mimeType || 'N/A'}`);
    console.log(`    has data: ${!!bin.data}`);
    
    // 🔧 修复：使用唯一的key，避免覆盖
    fileCounter++;
    const uniqueKey = `attachment_${fileCounter}`;
    
    // 🔧 关键：直接复制原始binary对象，不做任何修改！
    mergedBinary[uniqueKey] = bin;
    
    // 同时保留原始key（如果不冲突）
    if (!mergedBinary[binaryKey]) {
      mergedBinary[binaryKey] = bin;
    }
    
    // 收集文件信息（仅用于JSON）
    if (bin.fileName) {
      fileNames.push(bin.fileName);
      fileInfo.push({
        fileName: bin.fileName,
        mimeType: bin.mimeType || 'unknown',
        binaryKey: uniqueKey,
        originalKey: binaryKey
      });
      
      console.log(`    ✅ 添加文件: ${bin.fileName} (key: ${uniqueKey})`);
    }
  });
});

if (fileNames.length === 0) {
  throw new Error("未找到任何文件");
}

console.log(`\n✅ 共找到 ${fileNames.length} 个文件:`);
fileNames.forEach((name, index) => {
  console.log(`  ${index + 1}. ${name}`);
});

/* ---------- 构建输出（只修改JSON，不修改binary） ---------- */
const output = {
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
  files: fileInfo,
  meta: {
    file_count: fileNames.length,
    file_names: fileNames,
    generated_at: new Date().toISOString()
  }
};

console.log(`\n📤 输出准备完成:`);
console.log(`  文件数量: ${output.meta.file_count}`);
console.log(`  文件列表: ${output.meta.file_names.join(', ')}`);
console.log(`  Binary keys: ${Object.keys(mergedBinary).join(', ')}`);

// 如果只有一个文件，添加data字段（便于邮件节点使用）
if (fileCounter === 1) {
  mergedBinary.data = mergedBinary.attachment_1;
  console.log(`\n📎 添加默认 binary.data 字段`);
}

// 🔧 关键：返回原始的binary数据，不做任何修改
return [{
  json: output,
  binary: mergedBinary  // 直接使用原始binary对象
}];
