// n8n Function节点：过滤数据1中不在数据2中的数据
// 功能：基于 game_id 匹配，输出数据1中没有出现在数据2中的数据
// 
// 数据1结构：{ game_id: 1698217745002, game_name: "Fortune Mouse" }
// 数据2结构：{ game_id: "1698217736002", game: "Lucky Tanks", ... }
//
// 注意：数据1的 game_id 是数字，数据2的 game_id 是字符串
// 需要统一转换为字符串进行比较

const inputs = $input.all();
console.log("=== 过滤数据1中不在数据2中的数据 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 方案：假设输入数据已经通过 Merge 节点合并
// 或者我们可以通过数据特征来区分两个数据源

let data1Items = [];
let data2Items = [];

// 区分数据源的方法：
// 方法1：通过字段特征区分
// - 数据1有 game_name 字段
// - 数据2有 createdAt, updatedAt, merchant 字段
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  // 判断是数据1还是数据2
  // 数据1的特征：有 game_name 字段，没有 createdAt 字段
  // 数据2的特征：有 createdAt 字段，或者有 merchant 字段
  if (item.game_name && !item.createdAt && !item.merchant) {
    // 这是数据1
    data1Items.push(item);
  } else if (item.createdAt || item.merchant || (item.game && !item.game_name)) {
    // 这是数据2
    data2Items.push(item);
  } else {
    // 无法确定，根据其他特征判断
    // 如果 game_id 是数字类型，可能是数据1
    // 如果 game_id 是字符串类型，可能是数据2
    if (typeof item.game_id === 'number') {
      data1Items.push(item);
    } else if (typeof item.game_id === 'string') {
      data2Items.push(item);
    } else {
      // 默认当作数据1处理
      console.warn(`⚠️ 无法确定数据源，当作数据1处理: 索引 ${index}`);
      data1Items.push(item);
    }
  }
});

console.log(`📊 识别到数据1: ${data1Items.length} 条`);
console.log(`📊 识别到数据2: ${data2Items.length} 条`);

// 如果无法区分，提供备选方案
if (data1Items.length === 0 && data2Items.length === 0) {
  console.error("❌ 无法识别数据源，请检查数据格式");
  return [];
}

// 如果数据2为空，返回所有数据1
if (data2Items.length === 0) {
  console.warn("⚠️ 警告：没有识别到数据2，返回所有数据1");
  return data1Items.map(item => ({ json: item }));
}

// 构建数据2的 game_id 集合（统一转换为字符串进行比较）
const data2GameIds = new Set();
data2Items.forEach((item, index) => {
  if (item && item.game_id !== undefined && item.game_id !== null) {
    // 统一转换为字符串
    const gameIdStr = String(item.game_id);
    data2GameIds.add(gameIdStr);
    if (index < 5) {
      console.log(`📋 数据2 game_id: ${gameIdStr} (原始类型: ${typeof item.game_id})`);
    }
  }
});

console.log(`📊 数据2中的 game_id 数量: ${data2GameIds.size}`);
if (data2GameIds.size > 0) {
  console.log(`📋 数据2 game_id 示例:`, Array.from(data2GameIds).slice(0, 5).join(', '));
}

// 过滤数据1，只保留不在数据2中的数据
const filteredResults = [];
let matchedCount = 0;
let unmatchedCount = 0;

data1Items.forEach((item, index) => {
  if (!item || item.game_id === undefined || item.game_id === null) {
    console.warn(`⚠️ 跳过数据1项 ${index}：缺少 game_id 字段`);
    return;
  }

  // 将 game_id 转换为字符串进行比较
  const gameIdStr = String(item.game_id);
  
  if (!data2GameIds.has(gameIdStr)) {
    // 不在数据2中，保留
    filteredResults.push({
      json: item
    });
    unmatchedCount++;
    if (index < 10) {
      console.log(`✅ 保留: game_id=${gameIdStr}, game_name="${item.game_name || 'N/A'}"`);
    }
  } else {
    matchedCount++;
    if (index < 10) {
      console.log(`⏭️ 跳过: game_id=${gameIdStr}, game_name="${item.game_name || 'N/A'}" (在数据2中存在)`);
    }
  }
});

console.log(`=== 过滤完成 ===`);
console.log(`📊 原始数据1: ${data1Items.length} 条`);
console.log(`📊 数据2: ${data2Items.length} 条（用于匹配）`);
console.log(`📊 匹配的数据: ${matchedCount} 条`);
console.log(`📊 未匹配的数据（输出）: ${unmatchedCount} 条`);
console.log(`📊 过滤后结果: ${filteredResults.length} 条`);

// 显示前几条结果
if (filteredResults.length > 0) {
  console.log("前5条过滤结果示例:");
  filteredResults.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
} else {
  console.warn("⚠️ 没有数据被保留，所有数据1的数据都在数据2中存在");
}

return filteredResults;












