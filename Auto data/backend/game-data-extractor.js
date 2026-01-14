// n8n Function节点：游戏数据提取器
// 处理上游所有输入数据，提取 game_id 和 game 字段
// 将 game_id 从字符串转换为数字
// 输出格式：{ game_id: 1698217736002, game: "Lucky Tanks" }

const inputs = $input.all();
console.log("=== 游戏数据提取器开始 ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

const results = [];

inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  
  // 检查必要字段
  if (!item || (!item.game_id && !item.game)) {
    console.warn(`⚠️ 跳过输入项 ${index}：缺少 game_id 或 game 字段`);
    return;
  }

  // 提取 game_id（字符串转数字）
  let gameId = item.game_id;
  if (typeof gameId === 'string') {
    // 尝试转换为数字
    const parsedId = parseInt(gameId, 10);
    if (!Number.isNaN(parsedId)) {
      gameId = parsedId;
    } else {
      // 如果转换失败，保持原值
      console.warn(`⚠️ 输入项 ${index}：game_id "${item.game_id}" 无法转换为数字，保持字符串格式`);
    }
  } else if (typeof gameId === 'number') {
    // 已经是数字，直接使用
    gameId = gameId;
  } else {
    // 其他类型，尝试转换
    console.warn(`⚠️ 输入项 ${index}：game_id 类型异常 (${typeof gameId})，尝试转换`);
    const parsedId = parseInt(String(gameId), 10);
    gameId = Number.isNaN(parsedId) ? gameId : parsedId;
  }

  // 提取 game 名称
  const gameName = item.game || null;

  // 构建输出对象
  const output = {
    game_id: gameId,
    game: gameName
  };

  // 如果 game_id 和 game 都不存在，跳过
  if (gameId === undefined && gameName === null) {
    console.warn(`⚠️ 跳过输入项 ${index}：game_id 和 game 都不存在`);
    return;
  }

  results.push({
    json: output
  });

  console.log(`✅ 处理输入项 ${index}: game_id=${gameId}, game="${gameName}"`);
});

console.log(`=== 处理完成 ===`);
console.log(`📊 成功处理 ${results.length} 条数据`);

// 显示前几行示例
if (results.length > 0) {
  console.log("前5条数据示例:");
  results.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
}

return results;

