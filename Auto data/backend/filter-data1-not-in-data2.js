// n8n Function节点：过滤数据1中不在数据2中的数据
// 功能：输出数据1中没有出现在数据2中的数据（基于 game_id 匹配）
// 
// 使用场景：
// 1. 在 Merge 节点后使用此 Code 节点进行二次过滤
// 2. 或者直接使用此 Code 节点替代 Merge 节点
//
// 前置条件：
// - 需要两个输入源：data1 和 data2
// - 可以通过 Merge 节点合并后传入，或者通过其他方式传递

const inputs = $input.all();
console.log("=== 过滤数据1中不在数据2中的数据 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 方案：假设输入数据已经通过 Merge 节点合并
// Merge 节点会为匹配的数据添加标记
// 我们需要检查这些标记来过滤数据

// 如果 Merge 节点配置为 mode: "merge", joinMode: "left"
// 匹配的数据会有额外的字段，未匹配的数据可能没有这些字段

// 检查输入数据的结构
const sampleItem = inputs[0]?.json;
console.log("📋 输入数据结构示例:", JSON.stringify(sampleItem, null, 2).substring(0, 500));

// 方法1：检查 Merge 节点添加的标记字段
// Merge 节点可能会添加类似 _matched, _source 等字段

// 方法2：手动实现过滤逻辑
// 需要能够区分 data1 和 data2 的数据

// 由于 n8n 的限制，我们需要一个更实用的方案：

// 方案A：假设 Merge 节点已经处理了数据，我们需要进一步过滤
// 方案B：完全手动实现，需要能访问两个独立的数据源

// 提供方案B的完整实现（需要两个 Code 节点配合）

// 但如果只有一个 Code 节点可用，我们可以：
// 1. 假设输入数据包含来源标记
// 2. 或者假设数据顺序（前N个是data1，后M个是data2）

// 实用方案：创建一个通用的过滤函数
// 假设我们可以通过某种方式区分两个数据源

let data1Items = [];
let data2Items = [];

// 尝试区分数据源
// 方法1：通过字段标记
inputs.forEach((inputItem) => {
  const item = inputItem.json;
  
  // 如果数据有 _source 字段
  if (item._source === 'data1' || item._source === 'input1') {
    data1Items.push(item);
  } else if (item._source === 'data2' || item._source === 'input2') {
    data2Items.push(item);
  } else {
    // 如果没有标记，尝试其他方式
    // 例如：检查是否有特定字段组合
    // 或者使用数据顺序（需要知道数据量）
    data1Items.push(item); // 临时假设所有都是 data1
  }
});

// 如果无法区分，提供一个备选方案：
// 假设所有输入都是 data1，data2 需要通过其他方式提供
// 例如：通过工作流变量、HTTP 请求、或者另一个节点

console.log(`📊 识别到 data1: ${data1Items.length} 条`);
console.log(`📊 识别到 data2: ${data2Items.length} 条`);

// 构建 data2 的 game_id 集合
const data2GameIds = new Set();
data2Items.forEach((item) => {
  if (item && item.game_id !== undefined) {
    data2GameIds.add(String(item.game_id));
  }
});

console.log(`📊 data2 中的 game_id 数量: ${data2GameIds.size}`);

// 过滤 data1，只保留不在 data2 中的数据
const filteredResults = [];

data1Items.forEach((item, index) => {
  if (!item || item.game_id === undefined) {
    console.warn(`⚠️ 跳过数据项 ${index}：缺少 game_id 字段`);
    return;
  }

  const gameId = String(item.game_id);
  
  if (!data2GameIds.has(gameId)) {
    // 不在 data2 中，保留
    filteredResults.push({
      json: item
    });
    console.log(`✅ 保留: game_id=${gameId}, game="${item.game || 'N/A'}"`);
  } else {
    console.log(`⏭️ 跳过: game_id=${gameId} 在 data2 中存在`);
  }
});

console.log(`=== 过滤完成 ===`);
console.log(`📊 原始 data1: ${data1Items.length} 条`);
console.log(`📊 data2: ${data2Items.length} 条（用于匹配）`);
console.log(`📊 过滤后结果: ${filteredResults.length} 条`);
console.log(`📊 过滤掉: ${data1Items.length - filteredResults.length} 条`);

// 如果 data2 为空，返回所有 data1（因为没有数据可以匹配）
if (data2Items.length === 0) {
  console.warn("⚠️ 警告：没有识别到 data2 数据，返回所有 data1 数据");
  return data1Items.map(item => ({ json: item }));
}

return filteredResults;

