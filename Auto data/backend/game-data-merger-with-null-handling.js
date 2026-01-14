// n8n Function节点：游戏数据合并器（增强版，符合指定输出）
// 目标输出：
// {
//   日期: "20251020" | "合计",
//   游戏名: "Bank Heist" | null,  // 如果未匹配到游戏名，则为null
//   投注用户数: 1726  // 整数
// }

const inputs = $input.all();
console.log("=== 游戏数据合并器开始（增强版-指定输出） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 收集所有需要处理的数据
// 注意：映射器已经会输出 game 字段（匹配成功为游戏名，失败为 null）
const allData = [];
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  // 检查：必须有dataType和用户数字段，game字段应该已经存在（可能是null）
  if (item && item.dataType && (item.daily_unique_users || item.weekly_unique_users || item.monthly_unique_users)) {
    // 如果映射器没有设置game字段（兼容旧数据），则设置为null
    if (!('game' in item)) {
      item.game = null;
      console.log(`⚠️ 数据缺少game字段，已设置为null`);
    }
    allData.push(item);
  }
});

if (allData.length === 0) {
  console.warn("⚠️ 没有找到游戏数据");
  return [];
}

console.log(`📊 收集到数据: ${allData.length} 条`);
const matchedCount = allData.filter(item => item.game !== null).length;
const unmatchedCount = allData.filter(item => item.game === null).length;
console.log(`✅ 已匹配游戏名: ${matchedCount} 条`);
console.log(`❌ 未匹配游戏名: ${unmatchedCount} 条`);

// 合并键：
// - 合计数据：period_range + game + dataType
// - 日数据：date_str + dataType + game
// 注意：game为null时，使用字符串"null"作为key的一部分
const mergeMap = new Map();

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

allData.forEach((item) => {
  // 使用game字段，如果为null则使用字符串"null"
  const gameKey = item.game !== null && item.game !== undefined ? item.game : 'null';
  
  const isTotal = item.dataType === 'game_weekly' || item.dataType === 'game_monthly';
  const mergeKey = isTotal
    ? `${item.period_range || '合计'}_${gameKey}_${item.dataType}`
    : `${item.date_str || '合计'}_${item.dataType}_${gameKey}`;

  if (mergeMap.has(mergeKey)) {
    const existing = mergeMap.get(mergeKey);
    const currentUsers = toInt(item.daily_unique_users || item.weekly_unique_users || item.monthly_unique_users || 0);
    const existingUsers = toInt(existing.daily_unique_users || existing.weekly_unique_users || existing.monthly_unique_users || 0);
    const totalUsers = currentUsers + existingUsers;

    if (item.dataType === 'game_daily') {
      existing.daily_unique_users = String(totalUsers);
    } else if (item.dataType === 'game_weekly') {
      existing.weekly_unique_users = String(totalUsers);
    } else if (item.dataType === 'game_monthly') {
      existing.monthly_unique_users = String(totalUsers);
    }
  } else {
    const mergedItem = {
      date_str: item.date_str || '合计',
      period_range: item.period_range,
      dataType: item.dataType,
      game: item.game  // 保留原始值（可能是null）
    };

    if (item.dataType === 'game_daily') {
      mergedItem.daily_unique_users = item.daily_unique_users;
    } else if (item.dataType === 'game_weekly') {
      mergedItem.weekly_unique_users = item.weekly_unique_users;
    } else if (item.dataType === 'game_monthly') {
      mergedItem.monthly_unique_users = item.monthly_unique_users;
    }

    mergeMap.set(mergeKey, mergedItem);
  }
});

const mergedResults = Array.from(mergeMap.values());

// 按游戏名分组
const gameGroups = new Map();
mergedResults.forEach(item => {
  // game为null时，使用字符串"null"作为分组key
  const gameName = item.game !== null && item.game !== undefined ? item.game : null;
  const groupKey = gameName !== null ? gameName : 'null';
  
  if (!gameGroups.has(groupKey)) {
    gameGroups.set(groupKey, { gameName: gameName, items: [] });
  }
  gameGroups.get(groupKey).items.push(item);
});

// 输出：合计优先，其次每日（按日期升序），按游戏名A→Z整体排序
// 注意：null值在排序时放在最后
const finalRows = [];
const sortedGameKeys = Array.from(gameGroups.keys()).sort((a, b) => {
  // null值放在最后
  if (a === 'null' && b !== 'null') return 1;
  if (a !== 'null' && b === 'null') return -1;
  if (a === 'null' && b === 'null') return 0;
  // 其他按中文排序
  return a.localeCompare(b, 'zh-CN', { numeric: true });
});

sortedGameKeys.forEach(groupKey => {
  const group = gameGroups.get(groupKey);
  const gameName = group.gameName; // 可能是null
  const items = group.items || [];
  
  const totals = items.filter(x => x.dataType === 'game_weekly' || x.dataType === 'game_monthly');
  const dailies = items.filter(x => x.dataType === 'game_daily').sort((a, b) => (a.date_str || '').localeCompare(b.date_str || ''));

  // 合计行（如果存在，多条则逐条输出，日期固定为"合计"）
  totals.forEach(t => {
    const users = toInt(t.weekly_unique_users || t.monthly_unique_users || 0);
    finalRows.push({
      日期: '合计',
      游戏名: gameName,  // 可能是null
      投注用户数: users
    });
  });

  // 每日行
  dailies.forEach(d => {
    const users = toInt(d.daily_unique_users || 0);
    finalRows.push({
      日期: d.date_str,
      游戏名: gameName,  // 可能是null
      投注用户数: users
    });
  });
});

console.log(`📈 最终行数: ${finalRows.length}`);
const nullGameRows = finalRows.filter(r => r.游戏名 === null).length;
console.log(`📊 其中游戏名为null的行数: ${nullGameRows}`);

return finalRows.map(r => ({ json: r }));

