// n8n Function节点：游戏数据合并器（修复版）
// 修复问题：
// 1. game=null 的数据没有显示该game_id
// 2. 存在多余的合计数据（同一游戏多条合计）
// 目标输出：
// {
//   日期: "20251020" | "合计",
//   游戏名: "Bank Heist" | "1698217747804",  // 匹配成功为游戏名，失败为game_id
//   投注用户数: 1726  // 整数
// }

const inputs = $input.all();
console.log("=== 游戏数据合并器开始（修复版） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

// 收集所有需要处理的数据
// 修复1：处理 game=null 的情况，使用 game_id 作为 game 的值
const allData = [];
inputs.forEach((inputItem, index) => {
  const item = inputItem.json;
  // 检查：必须有dataType和用户数字段
  if (item && item.dataType && (item.daily_unique_users || item.weekly_unique_users || item.monthly_unique_users)) {
    // 修复：如果 game 为 null 或 undefined，使用 game_id
    if (!item.game && item.game_id) {
      item.game = String(item.game_id);
      item.isMatched = false;
      item.matchType = 'game_id_fallback';
    }
    // 只有 game 字段存在（包括 game_id 转换后的值）才处理
    if (item.game) {
      allData.push(item);
    }
  }
});

if (allData.length === 0) {
  console.warn("⚠️ 没有找到游戏数据");
  return [];
}

console.log(`📊 收集到数据: ${allData.length} 条`);
const unmatchedCount = allData.filter(item => item.isMatched === false || item.matchType === 'game_id_fallback').length;
console.log(`📊 其中未匹配的数据（使用game_id）: ${unmatchedCount} 条`);

// 合并键：
// - 合计数据：period_range + game + dataType
// - 日数据：date_str + dataType + game
// 注意：game字段为游戏名（匹配成功）或game_id（匹配失败）
const mergeMap = new Map();

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

allData.forEach((item) => {
  // 使用game字段（匹配成功为游戏名，失败为game_id）
  const gameKey = item.game;
  
  const isTotal = item.dataType === 'game_weekly' || item.dataType === 'game_monthly';
  // 修复2：合计数据只按 game 和 dataType 合并，不管周期
  // 这样同一游戏、同一类型的合计数据会被合并
  const mergeKey = isTotal
    ? `${gameKey}_${item.dataType}`  // 合计数据：只区分游戏和类型
    : `${item.date_str || '合计'}_${item.dataType}_${gameKey}`;  // 日数据：区分日期、类型、游戏

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
      period_range: item.period_range || item.month_str,  // 支持 month_str
      dataType: item.dataType,
      game: item.game  // 保留原始值（游戏名或game_id）
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
  const gameName = item.game;  // 游戏名或game_id
  
  if (!gameGroups.has(gameName)) {
    gameGroups.set(gameName, []);
  }
  gameGroups.get(gameName).push(item);
});

// 输出：合计优先，其次每日（按日期升序），按游戏名A→Z整体排序
const finalRows = [];
const sortedGames = Array.from(gameGroups.keys()).sort((a, b) => {
  // 按中文排序（game_id通常是数字字符串，会排在前面）
  return a.localeCompare(b, 'zh-CN', { numeric: true });
});

sortedGames.forEach(gameName => {
  const items = gameGroups.get(gameName) || [];
  
  // 修复2：合计数据只输出一条（合并所有类型）
  // 优先使用 weekly，如果没有则使用 monthly
  const totals = items.filter(x => x.dataType === 'game_weekly' || x.dataType === 'game_monthly');
  const dailies = items.filter(x => x.dataType === 'game_daily').sort((a, b) => (a.date_str || '').localeCompare(b.date_str || ''));

  // 合计行：只输出一条，合并所有合计数据
  if (totals.length > 0) {
    let totalUsers = 0;
    totals.forEach(t => {
      const users = toInt(t.weekly_unique_users || t.monthly_unique_users || 0);
      totalUsers += users;
    });
    // 只输出一条合计行
    finalRows.push({
      日期: '合计',
      游戏名: gameName,  // 游戏名或game_id
      投注用户数: totalUsers
    });
  }

  // 每日行
  dailies.forEach(d => {
    const users = toInt(d.daily_unique_users || 0);
    finalRows.push({
      日期: d.date_str,
      游戏名: gameName,  // 游戏名或game_id
      投注用户数: users
    });
  });
});

console.log(`📈 最终行数: ${finalRows.length}`);
const unmatchedRows = finalRows.filter(r => {
  // 检查是否是game_id（通常是纯数字字符串）
  return /^\d+$/.test(r.游戏名);
}).length;
console.log(`📊 其中使用game_id作为游戏名的行数: ${unmatchedRows}`);

return finalRows.map(r => ({ json: r }));

