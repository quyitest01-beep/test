// n8n Code节点：根据 english_name 过滤游戏数据
// 功能：只保留 game_name === english_name 的数据
// 逻辑：只要上游数据的 game_name 的值 = english_name 的值，就保留输出对应上游数据
// 输入：包含 game_name 字段的数据 + 包含 english_name 的列表
// 输出：匹配的数据（保留原始数据结构）

const inputs = $input.all();
console.log("=== 根据 english_name 过滤游戏数据 ===");
console.log(`📊 输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 步骤1：收集所有 english_name 值（用于匹配）
const englishNames = new Set();
// 收集所有包含 game_name 的数据项（用于过滤）
const gameDataItems = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  if (!item) {
    return;
  }
  
  // 如果包含 english_name 字段，添加到集合中（用于匹配）
  if (item.english_name !== undefined && item.english_name !== null) {
    const englishName = String(item.english_name).trim();
    if (englishName) {
      englishNames.add(englishName.toLowerCase()); // 使用小写进行匹配（不区分大小写）
      if (englishNames.size <= 10) {
        console.log(`📋 收集 english_name: ${englishName}`);
      }
    }
  }
  
  // 如果包含 game_name 字段，作为数据项处理（需要过滤的数据）
  if (item.game_name !== undefined && item.game_name !== null) {
    gameDataItems.push(item);
  }
});

console.log(`📊 收集到 ${englishNames.size} 个 english_name`);
console.log(`📊 收集到 ${gameDataItems.length} 个包含 game_name 的数据项`);

// 如果没有 english_name，返回所有包含 game_name 的数据
if (englishNames.size === 0) {
  console.warn("⚠️ 没有找到 english_name，返回所有包含 game_name 的数据");
  return gameDataItems.map(item => ({ json: item }));
}

// 如果没有 game_name 数据，返回空数组
if (gameDataItems.length === 0) {
  console.warn("⚠️ 没有找到包含 game_name 的数据");
  return [];
}

// 步骤2：过滤数据，只保留 game_name === english_name 的数据
const matchedResults = [];
let matchedCount = 0;
let unmatchedCount = 0;

gameDataItems.forEach((item, index) => {
  const gameName = item.game_name ? String(item.game_name).trim() : '';
  
  if (!gameName) {
    unmatchedCount++;
    if (unmatchedCount <= 5) {
      console.warn(`⚠️ 跳过数据项 ${index}：game_name 为空`);
    }
    return;
  }
  
  // 比较 game_name 和 english_name（不区分大小写）
  const gameNameLower = gameName.toLowerCase();
  
  if (englishNames.has(gameNameLower)) {
    // 匹配成功，保留原始数据
    matchedResults.push({
      json: item  // 保留完整的原始数据结构
    });
    matchedCount++;
    
    if (matchedCount <= 10) {
      console.log(`✅ [${matchedCount}] 匹配成功: game_name="${gameName}"`);
    }
  } else {
    unmatchedCount++;
    if (unmatchedCount <= 10) {
      console.log(`⏭️ [${unmatchedCount}] 不匹配: game_name="${gameName}"`);
    }
  }
});

console.log(`=== 过滤完成 ===`);
console.log(`📊 统计信息:`);
console.log(`   - english_name 数量: ${englishNames.size}`);
console.log(`   - 原始数据项: ${gameDataItems.length} 条`);
console.log(`   - 匹配成功: ${matchedCount} 条`);
console.log(`   - 未匹配: ${unmatchedCount} 条`);
console.log(`   - 匹配率: ${gameDataItems.length > 0 ? ((matchedCount / gameDataItems.length) * 100).toFixed(1) : 0}%`);

// 显示结果示例
if (matchedResults.length > 0) {
  console.log("\n📋 前5条匹配结果:");
  matchedResults.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json).substring(0, 300));
  });
} else {
  console.warn("\n⚠️ 没有匹配的数据");
  console.log("建议：");
  console.log("  1. 检查 game_name 和 english_name 的值是否一致");
  console.log("  2. 检查大小写是否匹配（代码使用不区分大小写匹配）");
  console.log("  3. 检查是否有空格或其他字符");
}

return matchedResults;

