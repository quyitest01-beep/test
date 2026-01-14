// n8n Code node
// 输出多个 item，每个 item 形如 { game_id, game_name }，仅保留 provider === 'inhouse'
// 修复：处理所有输入 items，而不只是第一个

const items = $input.all().map(i => i.json);
console.log(`=== 处理 Inhouse 游戏数据 ===`);
console.log(`输入 items 数量: ${items.length}`);

// 收集所有 items 中的 list
const allLists = [];

items.forEach((item, index) => {
  // 兼容查找 list 的位置（优先 data.list，其次顶层 list）
  let list = null;
  
  if (Array.isArray(item?.data?.list)) {
    list = item.data.list;
    console.log(`✅ 在 item ${index} 的 data.list 中找到 ${list.length} 个游戏`);
  } else if (Array.isArray(item?.list)) {
    list = item.list;
    console.log(`✅ 在 item ${index} 的 list 中找到 ${list.length} 个游戏`);
  }
  
  if (list && list.length > 0) {
    allLists.push(...list);
  }
});

console.log(`📊 总共收集到 ${allLists.length} 个游戏数据`);

// 过滤 provider === 'inhouse' 的游戏
const inhouseGames = allLists.filter(g => {
  const provider = String(g.provider || '').toLowerCase().trim();
  const isInhouse = provider === 'inhouse';
  
  if (!isInhouse && allLists.indexOf(g) < 10) {
    // 只打印前10个非inhouse的日志
    console.log(`⏭️ 跳过: game_id=${g.id || 'N/A'}, provider="${provider}"`);
  }
  
  return isInhouse;
});

console.log(`📊 过滤后 Inhouse 游戏数量: ${inhouseGames.length}`);

// 转换为输出格式
const out = inhouseGames.map(g => ({
  json: {
    game_id: g.id,
    game_name: g.name
  }
}));

console.log(`📈 输出 ${out.length} 个 Inhouse 游戏`);

// 显示前几条结果
if (out.length > 0) {
  console.log("前5条结果示例:");
  out.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}.`, JSON.stringify(item.json));
  });
} else {
  console.warn("⚠️ 没有找到 Inhouse 游戏");
}

// 如果没有任何结果，返回空数组而不是包含空对象的数组
return out.length > 0 ? out : [];












