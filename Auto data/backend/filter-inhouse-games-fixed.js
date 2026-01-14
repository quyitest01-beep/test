// n8n Code node
// 输出多个 item，每个 item 形如 { game_id, game_name }，仅保留 provider === 'inhouse'
// 修复：处理所有输入 items，而不只是第一个

const items = $input.all().map(i => i.json);
console.log(`=== 处理 Inhouse 游戏数据 ===`);
console.log(`输入 items 数量: ${items.length}`);

// 修复：收集所有 items 中的 list，而不是只取第一个
const allGames = [];

items.forEach((item, index) => {
  // 兼容查找 list 的位置（优先 data.list，其次顶层 list）
  let list = null;
  
  if (Array.isArray(item?.data?.list)) {
    list = item.data.list;
    console.log(`✅ Item ${index}: 在 data.list 中找到 ${list.length} 个游戏`);
  } else if (Array.isArray(item?.list)) {
    list = item.list;
    console.log(`✅ Item ${index}: 在 list 中找到 ${list.length} 个游戏`);
  }
  
  if (list && list.length > 0) {
    // 将所有游戏添加到 allGames 数组
    allGames.push(...list);
    console.log(`📊 Item ${index}: 添加了 ${list.length} 个游戏，总计 ${allGames.length} 个游戏`);
  } else {
    console.log(`⏭️ Item ${index}: 没有找到 list 数据`);
  }
});

console.log(`📊 总共收集到 ${allGames.length} 个游戏数据`);

// 过滤 provider === 'inhouse' 的游戏
const inhouseGames = allGames.filter(g => {
  const provider = String(g.provider || '').toLowerCase().trim();
  return provider === 'inhouse';
});

console.log(`📊 过滤后 Inhouse 游戏数量: ${inhouseGames.length}`);

// 转换并去重（如果同一个游戏出现多次）
const gameMap = new Map();
inhouseGames.forEach(g => {
  const gameId = g.id;
  // 如果 gameId 已存在，保留第一个（或可以根据需要保留最后一个）
  if (!gameMap.has(gameId)) {
    gameMap.set(gameId, {
      game_id: g.id,
      game_name: g.name
    });
  }
});

const uniqueGames = Array.from(gameMap.values());

console.log(`📊 去重后 Inhouse 游戏数量: ${uniqueGames.length}`);

// 转换为输出格式
const out = uniqueGames.map(game => ({
  json: game
}));

console.log(`📈 最终输出 ${out.length} 个 Inhouse 游戏`);

// 显示前几条结果
if (out.length > 0) {
  console.log("前5条结果示例:");
  out.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
} else {
  console.warn("⚠️ 没有找到 Inhouse 游戏");
}

// 如果没有任何结果，返回空数组
return out;

