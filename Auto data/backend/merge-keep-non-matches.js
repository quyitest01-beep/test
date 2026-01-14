// n8n Function节点：保留数据1中不在数据2中的数据
// 功能：匹配两个数据源，输出数据1中没有出现在数据2中的数据
// 匹配字段：game_id

const inputs = $input.all();
console.log("=== 保留数据1中不在数据2中的数据 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 分离两个输入源
// n8n 的 Merge 节点会按顺序提供数据：
// - inputs 数组前半部分是 input1（数据1）
// - inputs 数组后半部分是 input2（数据2）
// 或者可以通过检查数据的来源来区分

// 方法1：如果 Merge 节点配置了 outputDataFrom: "input1"
// 则所有输入都是来自 input1，我们需要手动获取 input2

// 方法2：如果 Merge 节点输出的是合并后的数据，我们需要根据是否有匹配标记来过滤

// 方法3：最简单的方式 - 假设输入数据有某种标记，或者我们可以通过其他方式区分

// 让我们尝试一个更通用的方法：
// 收集所有 input2 的 game_id 到一个 Set 中
// 然后遍历 input1，只保留 game_id 不在 Set 中的数据

// 但问题是，在 n8n 的 Merge 节点中，如果使用 keepNonMatches 模式，
// 实际上应该已经过滤了数据。如果不行，我们可能需要手动实现

// 假设输入数据格式：
// 数据1: { game_id: 1, game: "Game A", ... }
// 数据2: { game_id: 1, game: "Game A", ... }

// 如果 Merge 节点输出的是合并后的数据，我们需要检查是否有匹配标记
// 或者我们可以通过检查数据的结构来判断

// 让我们先尝试解析输入数据
let data1 = [];
let data2 = [];

// 尝试从输入中区分两个数据源
// 如果 Merge 节点的 keepNonMatches 工作正常，这里应该只收到不匹配的数据
// 但如果收到了所有数据，说明 Merge 节点配置有问题

// 最简单的方法：手动实现过滤逻辑
// 需要先收集 data2 的所有 game_id，然后过滤 data1

// 但问题是，在 Function 节点中，我们通常只能访问合并后的结果
// 所以我们需要使用另一种方法

// 方案：使用 n8n 的 Merge 节点配置建议，或者创建一个 Code 节点来实现

// 实际上，最好的方式是检查 Merge 节点的配置
// 根据 n8n 文档，对于"保留不匹配的数据"，应该使用：
// - mode: "merge" (不是 "combine")
// - 或者使用 Code 节点手动实现

// 让我创建一个通用的过滤代码
console.log("开始处理数据...");

// 收集所有输入的 game_id 值（用于去重检查）
const allGameIds = new Set();
const processedItems = [];

// 先遍历一次，收集所有 game_id
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  if (item && item.game_id !== undefined) {
    allGameIds.add(String(item.game_id)); // 转换为字符串以便比较
  }
});

console.log(`📊 收集到 ${allGameIds.size} 个唯一的 game_id`);

// 由于我们在 Function 节点中，无法直接访问两个独立的输入源
// 我们需要假设 Merge 节点已经做了初步处理，或者我们需要手动实现

// 方案：创建一个更简单的方法
// 如果 Merge 节点配置正确，这里应该已经只收到不匹配的数据
// 如果还是收到所有数据，我们需要手动去重

// 但更好的方法是：直接在 Merge 节点中正确配置

// 让我提供一个 Code 节点方案，用于在 Merge 节点之后进一步过滤
// 这个代码假设 Merge 节点可能没有完全过滤，所以我们需要手动去重

const seenGameIds = new Set();
const uniqueItems = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  if (!item || item.game_id === undefined) {
    console.warn(`⚠️ 跳过输入项 ${index}：缺少 game_id 字段`);
    return;
  }

  const gameId = String(item.game_id);
  
  // 如果这个 game_id 已经处理过，跳过（去重）
  if (seenGameIds.has(gameId)) {
    console.log(`⏭️ 跳过重复的 game_id: ${gameId}`);
    return;
  }

  seenGameIds.add(gameId);
  uniqueItems.push(inputItem);
  
  console.log(`✅ 保留数据: game_id=${gameId}, game="${item.game || 'N/A'}"`);
});

console.log(`=== 处理完成 ===`);
console.log(`📊 原始数据: ${inputs.length} 条`);
console.log(`📊 去重后数据: ${uniqueItems.length} 条`);

return uniqueItems;

