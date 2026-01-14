// n8n Function节点：Lark Values 数据提取器（简化版）
// 处理上游数据，从 values 数组中提取每一行数据，输出多个 item
// 输出格式：{ values: [1698217736002, 1698203185, "Lucky Tanks"], 0: 1698217736002, 1: 1698203185, 2: "Lucky Tanks" }
// 自动去除末尾的 null 值
// 访问方式：{{ $json.values[0] }} 或 {{ $json.0 }}

const inputs = $input.all();
console.log("=== Lark Values 数据提取器（简化版）开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const allResults = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  console.log(`🔍 处理输入项 ${index}:`, JSON.stringify(item, null, 2).substring(0, 200) + "...");

  let valuesArray = null;

  // 提取 values 数组
  if (item && item.valueRange && item.valueRange.values && Array.isArray(item.valueRange.values)) {
    // Lark API 格式：item.valueRange.values
    valuesArray = item.valueRange.values;
  } else if (item && item.values && Array.isArray(item.values)) {
    // 简化格式：item.values
    valuesArray = item.values;
  } else if (item && item.data && item.data.valueRange && item.data.valueRange.values && Array.isArray(item.data.valueRange.values)) {
    // 嵌套格式：item.data.valueRange.values
    valuesArray = item.data.valueRange.values;
  } else if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
    // 直接是二维数组
    valuesArray = item;
  } else if (item && item.data && Array.isArray(item.data)) {
    // item.data 是数组
    valuesArray = item.data;
  }

  if (!valuesArray || valuesArray.length === 0) {
    console.warn(`⚠️ 输入项 ${index} 没有有效的 values 数组`);
    return;
  }

  console.log(`📊 找到 values 数组，长度: ${valuesArray.length}`);

  // 处理每一行数据
  valuesArray.forEach((row, rowIndex) => {
    // 跳过空行
    if (!row || !Array.isArray(row) || row.length === 0) {
      return;
    }

    // 去除末尾的 null/undefined 值
    let processedRow = [...row];
    while (processedRow.length > 0 && (processedRow[processedRow.length - 1] === null || processedRow[processedRow.length - 1] === undefined)) {
      processedRow.pop();
    }

    // 如果处理后数组为空，跳过
    if (processedRow.length === 0) {
      return;
    }

    // 将数组转换为对象格式（n8n 要求 json 必须是对象）
    // 使用索引作为键：{ 0: value0, 1: value1, 2: value2, ... }
    // 同时保留原始数组在 values 字段中
    const rowObject = {
      values: processedRow  // 保留原始数组，方便后续处理
    };
    
    // 同时将每个元素作为对象的属性，使用索引作为键
    processedRow.forEach((value, colIndex) => {
      rowObject[colIndex] = value;
    });

    allResults.push({
      json: rowObject
    });
  });
});

console.log(`=== 数据提取完成 ===`);
console.log(`📊 总共提取 ${allResults.length} 行数据`);

// 显示前几行示例
if (allResults.length > 0) {
  console.log("前5行数据示例:");
  allResults.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. values:`, JSON.stringify(item.json.values));
    console.log(`     对象格式:`, JSON.stringify(item.json).substring(0, 200));
  });
}

return allResults;

