// n8n Function节点：Lark Values 数据提取器（灵活版）
// 处理上游数据，从 values 数组中提取每一行数据，输出多个 item
// 支持多种输入格式和输出格式

const inputs = $input.all();
console.log("=== Lark Values 数据提取器（灵活版）开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// ==================== 配置选项 ====================
// 是否跳过表头（第一行）
const SKIP_HEADER = false;

// 是否过滤空行（所有值都是 null/undefined/空字符串）
const FILTER_EMPTY_ROWS = true;

// 是否去除每行末尾的 null 值
const TRIM_NULL_VALUES = false;

// 输出格式：'array' 或 'object'
// 'array': 输出数组格式 [1698217736002, 1698203185, "Lucky Tanks"]
// 'object': 输出对象格式 { col0: 1698217736002, col1: 1698203185, col2: "Lucky Tanks" }
const OUTPUT_FORMAT = 'array';

// 如果输出格式为 'object'，可以使用自定义列名
// 如果为空，则使用 col0, col1, col2...
const COLUMN_NAMES = []; // 例如: ['game_id', 'merchant_id', 'game_name']

// ==================== 处理逻辑 ====================

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
  else if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
    console.log(`📊 识别到二维数组格式，数组长度: ${item.length}`);
    valuesArray = item;
  }
  // 情况5：如果输入是包含 data 字段，且 data 是数组
  else if (item && item.data && Array.isArray(item.data)) {
    console.log(`📊 识别到包含 data 数组的对象，数组长度: ${item.data.length}`);
    valuesArray = item.data;
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
    // 跳过表头
    if (SKIP_HEADER && rowIndex === 0) {
      console.log(`⏭️ 跳过表头行 ${rowIndex}`);
      return;
    }

    // 跳过空行
    if (!row || !Array.isArray(row) || row.length === 0) {
      if (!FILTER_EMPTY_ROWS) {
        allResults.push({ json: [] });
      }
      return;
    }

    // 检查是否所有值都是 null 或空字符串
    if (FILTER_EMPTY_ROWS) {
      const hasValidValue = row.some(cell => cell !== null && cell !== undefined && cell !== '');
      if (!hasValidValue) {
        console.log(`⏭️ 跳过全空行 ${rowIndex}`);
        return;
      }
    }

    // 处理行数据
    let processedRow = [...row]; // 复制数组

    // 去除末尾的 null 值
    if (TRIM_NULL_VALUES) {
      while (processedRow.length > 0 && (processedRow[processedRow.length - 1] === null || processedRow[processedRow.length - 1] === undefined)) {
        processedRow.pop();
      }
    }

    // 根据输出格式转换数据
    let outputData;
    if (OUTPUT_FORMAT === 'object' && COLUMN_NAMES.length > 0) {
      // 对象格式（使用自定义列名）
      outputData = {};
      processedRow.forEach((cell, colIndex) => {
        const columnName = COLUMN_NAMES[colIndex] || `col${colIndex}`;
        outputData[columnName] = cell;
      });
    } else {
      // 默认格式：对象包含 values 数组和索引键（n8n 要求 json 必须是对象）
      outputData = {
        values: processedRow  // 保留原始数组
      };
      // 同时将每个元素作为对象的属性，使用索引作为键
      processedRow.forEach((value, colIndex) => {
        outputData[colIndex] = value;
      });
    }

    allResults.push({
      json: outputData
    });

    if (rowIndex < 5 || rowIndex === valuesArray.length - 1) {
      console.log(`✅ 提取行 ${rowIndex}:`, JSON.stringify(outputData).substring(0, 150) + "...");
    }
  });
});

console.log(`=== 数据提取完成 ===`);
console.log(`📊 总共提取 ${allResults.length} 行数据`);
console.log(`⚙️ 配置: SKIP_HEADER=${SKIP_HEADER}, FILTER_EMPTY_ROWS=${FILTER_EMPTY_ROWS}, TRIM_NULL_VALUES=${TRIM_NULL_VALUES}, OUTPUT_FORMAT=${OUTPUT_FORMAT}`);

// 显示前几行示例
if (allResults.length > 0) {
  console.log("前3行数据示例:");
  allResults.slice(0, 3).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
}

return allResults;

