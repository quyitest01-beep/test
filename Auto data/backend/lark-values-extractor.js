// n8n Function节点：Lark Values 数据提取器
// 处理上游数据，从 values 数组中提取每一行数据，输出多个 item
// 输入格式：包含 values 字段的对象，或直接是数组
// 输出格式：每个 item 是一个数组，如 [1698217736002, 1698203185, "Lucky Tanks", ...]

const inputs = $input.all();
console.log("=== Lark Values 数据提取器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const allResults = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 300) + "...");

  let valuesArray = null;

  // 情况1：如果输入是包含 values 字段的对象（Lark API 格式）
  if (item && item.valueRange && item.valueRange.values && Array.isArray(item.valueRange.values)) {
    console.log(`📊 识别到 Lark API 格式，values 数组长度: ${item.valueRange.values.length}`);
    valuesArray = item.valueRange.values;
  }
  // 情况2：如果输入是包含 values 字段的对象（简化格式）
  else if (item && item.values && Array.isArray(item.values)) {
    console.log(`📊 识别到包含 values 字段的对象，values 数组长度: ${item.values.length}`);
    valuesArray = item.values;
  }
  // 情况3：如果输入是包含 data.valueRange.values 的对象
  else if (item && item.data && item.data.valueRange && item.data.valueRange.values && Array.isArray(item.data.valueRange.values)) {
    console.log(`📊 识别到嵌套的 Lark API 格式，values 数组长度: ${item.data.valueRange.values.length}`);
    valuesArray = item.data.valueRange.values;
  }
  // 情况4：如果输入直接是数组（二维数组）
  else if (Array.isArray(item)) {
    console.log(`📊 识别到直接数组格式，数组长度: ${item.length}`);
    valuesArray = item;
  }
  // 情况5：如果输入是包含 data 字段，且 data 是数组
  else if (item && item.data && Array.isArray(item.data)) {
    console.log(`📊 识别到包含 data 数组的对象，数组长度: ${item.data.length}`);
    valuesArray = item.data;
  }
  // 情况6：如果输入是对象数组
  else if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
    console.log(`📊 识别到二维数组格式，数组长度: ${item.length}`);
    valuesArray = item;
  }
  else {
    console.warn(`⚠️ 无法识别的数据格式 (索引: ${index})，数据字段: ${Object.keys(item || {}).join(', ')}`);
    return;
  }

  if (!valuesArray || valuesArray.length === 0) {
    console.warn(`⚠️ 输入项 ${index} 没有有效的 values 数组`);
    return;
  }

  // 处理每一行数据
  valuesArray.forEach((row, rowIndex) => {
    // 跳过空行或全是 null/undefined 的行
    if (!row || !Array.isArray(row) || row.length === 0) {
      console.log(`⏭️ 跳过空行 ${rowIndex}`);
      return;
    }

    // 检查是否所有值都是 null 或空字符串
    const hasValidValue = row.some(cell => cell !== null && cell !== undefined && cell !== '');
    if (!hasValidValue) {
      console.log(`⏭️ 跳过全空行 ${rowIndex}`);
      return;
    }

    // 将数组转换为对象格式（n8n 要求 json 必须是对象）
    const rowObject = {
      values: row  // 保留原始数组
    };
    // 同时将每个元素作为对象的属性，使用索引作为键
    row.forEach((value, colIndex) => {
      rowObject[colIndex] = value;
    });
    
    allResults.push({
      json: rowObject
    });

    console.log(`✅ 提取行 ${rowIndex}:`, JSON.stringify(row).substring(0, 100) + "...");
  });
});

console.log(`=== 数据提取完成 ===`);
console.log(`📊 总共提取 ${allResults.length} 行数据`);

// 显示前几行示例
if (allResults.length > 0) {
  console.log("前3行数据示例:");
  allResults.slice(0, 3).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
}

return allResults;

