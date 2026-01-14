// n8n Function节点：过滤数据1中不在数据2中的数据（独立版本）
// 功能：基于 game_id 匹配，输出数据1中没有出现在数据2中的数据
// 
// 使用场景：
// 此 Code 节点需要接收两个输入源的数据
// 可以通过 Merge 节点合并后传入，或通过其他方式传递
//
// 数据1结构：{ game_id: 1698217745002, game_name: "Fortune Mouse" }
// 数据2结构：{ game_id: "1698217736002", game: "Lucky Tanks", ... }
//
// 匹配逻辑：基于 game_id（需要处理数字和字符串类型差异）

const inputs = $input.all();
console.log("=== 过滤数据1中不在数据2中的数据（独立版本） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 智能识别两个数据源
let data1Items = [];
let data2Items = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  if (!item) {
    console.warn(`⚠️ 跳过空数据项 ${index}`);
    return;
  }

  // 识别逻辑：
  // 数据1特征：有 game_name 字段，且没有 createdAt/merchant 字段
  // 数据2特征：有 createdAt 或 merchant 字段，或 game 字段（但不是 game_name）
  const hasGameName = item.game_name !== undefined;
  const hasCreatedAt = item.createdAt !== undefined;
  const hasMerchant = item.merchant !== undefined;
  const hasGame = item.game !== undefined;
  
  if (hasGameName && !hasCreatedAt && !hasMerchant) {
    // 数据1：有 game_name，没有 createdAt/merchant
    data1Items.push(item);
  } else if (hasCreatedAt || hasMerchant || (hasGame && !hasGameName)) {
    // 数据2：有 createdAt/merchant，或有 game（但不是 game_name）
    data2Items.push(item);
  } else {
    // 根据 game_id 类型判断
    // 数据1的 game_id 通常是数字
    // 数据2的 game_id 通常是字符串
    if (typeof item.game_id === 'number') {
      data1Items.push(item);
    } else if (typeof item.game_id === 'string') {
      data2Items.push(item);
    } else {
      // 默认当作数据1
      console.warn(`⚠️ 无法确定数据源（索引 ${index}），当作数据1处理`);
      data1Items.push(item);
    }
  }
});

console.log(`📊 数据1: ${data1Items.length} 条`);
console.log(`📊 数据2: ${data2Items.length} 条`);

// 验证数据
if (data1Items.length === 0) {
  console.error("❌ 错误：没有识别到数据1");
  return [];
}

if (data2Items.length === 0) {
  console.warn("⚠️ 警告：没有识别到数据2，返回所有数据1");
  return data1Items.map(item => ({ json: item }));
}

// 显示数据示例
if (data1Items.length > 0) {
  console.log("数据1示例:", JSON.stringify(data1Items[0]));
}
if (data2Items.length > 0) {
  console.log("数据2示例:", JSON.stringify(data2Items[0]));
}

// 构建数据2的 game_id 集合
// 注意：统一转换为字符串进行比较，因为数据1是数字，数据2是字符串
const data2GameIds = new Set();

data2Items.forEach((item, index) => {
  if (item && item.game_id !== undefined && item.game_id !== null) {
    const gameIdStr = String(item.game_id).trim();
    if (gameIdStr) {
      data2GameIds.add(gameIdStr);
    }
  }
});

console.log(`📊 数据2中的唯一 game_id 数量: ${data2GameIds.size}`);
if (data2GameIds.size > 0) {
  const sampleIds = Array.from(data2GameIds).slice(0, 10);
  console.log(`📋 数据2 game_id 示例: ${sampleIds.join(', ')}`);
}

// 过滤数据1，只保留不在数据2中的数据
const filteredResults = [];
let matchedCount = 0;
let unmatchedCount = 0;

data1Items.forEach((item, index) => {
  if (!item || item.game_id === undefined || item.game_id === null) {
    console.warn(`⚠️ 跳过数据1项 ${index}：缺少 game_id`);
    return;
  }

  // 将 game_id 转换为字符串进行比较
  const gameIdStr = String(item.game_id).trim();
  
  if (!data2GameIds.has(gameIdStr)) {
    // 不在数据2中，保留
    filteredResults.push({
      json: item
    });
    unmatchedCount++;
    
    // 只打印前10条的详细信息
    if (unmatchedCount <= 10) {
      console.log(`✅ [${unmatchedCount}] 保留: game_id=${gameIdStr}, game_name="${item.game_name || 'N/A'}"`);
    }
  } else {
    matchedCount++;
    // 只打印前10条的详细信息
    if (matchedCount <= 10) {
      console.log(`⏭️ [${matchedCount}] 跳过: game_id=${gameIdStr}, game_name="${item.game_name || 'N/A'}" (在数据2中存在)`);
    }
  }
});

console.log(`=== 过滤完成 ===`);
console.log(`📊 统计信息:`);
console.log(`   - 原始数据1: ${data1Items.length} 条`);
console.log(`   - 数据2（用于匹配）: ${data2Items.length} 条`);
console.log(`   - 数据2中的唯一 game_id: ${data2GameIds.size} 个`);
console.log(`   - 匹配的数据: ${matchedCount} 条`);
console.log(`   - 未匹配的数据（输出）: ${unmatchedCount} 条`);
console.log(`   - 过滤率: ${data1Items.length > 0 ? ((matchedCount / data1Items.length) * 100).toFixed(1) : 0}%`);

// 显示结果示例
if (filteredResults.length > 0) {
  console.log("\n📋 前5条过滤结果:");
  filteredResults.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
} else {
  console.warn("\n⚠️ 没有数据被保留，所有数据1的数据都在数据2中存在");
  console.log("建议：检查 game_id 字段是否匹配");
}

return filteredResults;

