// n8n Function节点：游戏数据合并器（增强版，符合指定输出）
// 目标输出：
// {
//   日期: "20251020" | "合计",
//   游戏名: "Bank Heist",
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
const allData = [];
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  if (item && item.dataType && item.game && (item.daily_unique_users || item.weekly_unique_users || item.monthly_unique_users)) {
    allData.push(item);
  }
});

if (allData.length === 0) {
  console.warn("⚠️ 没有找到游戏数据");
  return [];
}

// 合并键：
// - 合计数据：period_range + game + dataType
// - 日数据：date_str + dataType + game
const mergeMap = new Map();

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

allData.forEach((item) => {
  const isTotal = item.dataType === 'game_weekly' || item.dataType === 'game_monthly';
  const mergeKey = isTotal
    ? `${item.period_range || '合计'}_${item.game}_${item.dataType}`
    : `${item.date_str || '合计'}_${item.dataType}_${item.game}`;

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
      game: item.game
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
  const gameName = item.game;
  if (!gameGroups.has(gameName)) gameGroups.set(gameName, []);
  gameGroups.get(gameName).push(item);
});

// 输出：合计优先，其次每日（按日期升序），按游戏名A→Z整体排序
const finalRows = [];
const sortedGames = Array.from(gameGroups.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));

sortedGames.forEach(gameName => {
  const items = gameGroups.get(gameName) || [];
  const totals = items.filter(x => x.dataType === 'game_weekly' || x.dataType === 'game_monthly');
  const dailies = items.filter(x => x.dataType === 'game_daily').sort((a, b) => (a.date_str || '').localeCompare(b.date_str || ''));

  // 合计行（如果存在，多条则逐条输出，日期固定为“合计”）
  totals.forEach(t => {
    const users = toInt(t.weekly_unique_users || t.monthly_unique_users || 0);
    finalRows.push({
      日期: '合计',
      游戏名: gameName,
      投注用户数: users
    });
  });

  // 每日行
  dailies.forEach(d => {
    const users = toInt(d.daily_unique_users || 0);
    finalRows.push({
      日期: d.date_str,
      游戏名: gameName,
      投注用户数: users
    });
  });
});

console.log(`📈 最终行数: ${finalRows.length}`);
return finalRows.map(r => ({ json: r }));


