// n8n Code节点：全游戏月度汇总处理器
// 功能：从 Merge2.json 结构的原始数据中，筛选出“当前月份-1”的全部游戏数据，
//      并按游戏聚合投注用户数、营收指标等关键字段，输出给后续评级流程使用。
//
// 适用场景：
//   - 上游直接读取 Lark Sheets Merge2.json 原始结构
//   - 需要获取上个月整个平台全游戏的用户数、营收，供新游戏对比占比
//
// 输出结构：
// [{
//   json: {
//     targetMonth: "202510",
//     totals: { userCount, totalBet, totalBetUSD, totalPayoutUSD, totalRounds, ggrUSD },
//     games: [
//       {
//         gameName,
//         userCount,            // 月度投注用户数（优先取“合计”行，若缺失则为日数据求和）
//         totalBet,
//         totalBetUSD,
//         totalPayoutUSD,
//         totalRounds,
//         ggrUSD,
//         avgBetPerUser,
//         avgGGRPerUser,
//         ggrMargin,
//         userContribution,     // 占全平台投注用户数比例
//         betContribution       // 占全平台投注金额(USD)比例
//       },
//       ...
//     ],
//     meta: {
//       processedSheets: [...],
//       targetMonthLabel: "2025-10"
//     }
//   }
// }]

const inputs = $input.all();

if (!inputs || inputs.length === 0) {
  throw new Error("❌ 未收到任何输入数据");
}

// ==================== 时间窗口：当前月份 - 1 ====================
const now = new Date();
const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const targetYear = targetDate.getUTCFullYear();
const targetMonth = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
const targetMonthKey = `${targetYear}${targetMonth}`;      // 例如 202510
const targetMonthLabel = `${targetYear}-${targetMonth}`;   // 例如 2025-10

console.log(`🎯 目标月份: ${targetMonthLabel} (${targetMonthKey})`);

// ==================== 通用工具函数 ====================
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // Excel 1900-01-00 (含闰年Bug校正)

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const cleaned = String(value).replace(/,/g, "").trim();
  if (cleaned === "") return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function extractMonthFromTitle(title) {
  if (!title) return null;
  const match = String(title).match(/(20\d{2})[^\d]?(\d{2})/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }
  const directMatch = String(title).match(/20\d{4}/);
  if (directMatch) {
    return directMatch[0];
  }
  return null;
}

function extractYearMonthFromValue(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    const rounded = Math.round(value);
    const asString = String(rounded);
    if (asString.length === 8 && asString.startsWith("20")) {
      // 形如 20251028
      return asString.slice(0, 6);
    }
    if (rounded > 20000 && rounded < 80000) {
      // Excel Serial
      const millis = EXCEL_EPOCH_UTC + rounded * 86400000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) {
        return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      }
    }
    return null;
  }

  const cleaned = cleanString(value);
  if (!cleaned) return null;

  if (/^\d{8}$/.test(cleaned) && cleaned.startsWith("20")) {
    return cleaned.slice(0, 6);
  }

  const match = cleaned.replace(/[^\d]/g, "").match(/^20\d{4}/);
  return match ? match[0] : null;
}

function containsRevenueHeader(values) {
  const maxScan = Math.min(values.length, 6);
  for (let i = 0; i < maxScan; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map(cell => String(cell || "").toLowerCase()).join("|");
    if (rowStr.includes("总投注") || rowStr.includes("ggr") || rowStr.includes("总派彩")) {
      return true;
    }
  }
  return false;
}

// ==================== 原始对象收集 ====================
const sheets = [];

inputs.forEach((item, index) => {
  const payload = item.json;
  if (!payload) return;

  if (Array.isArray(payload)) {
    payload.forEach((entry, subIdx) => {
      if (entry?.data?.valueRange?.values) {
        sheets.push(entry);
      } else if (entry?.valueRange?.values) {
        sheets.push({ code: 0, data: { valueRange: entry.valueRange } });
      }
    });
    return;
  }

  if (payload?.data?.valueRange?.values) {
    sheets.push(payload);
    return;
  }

  if (payload?.valueRange?.values) {
    sheets.push({ code: 0, data: { valueRange: payload.valueRange } });
    return;
  }

  if (payload?.code !== undefined && payload?.data?.valueRange?.values) {
    sheets.push(payload);
    return;
  }
});

if (sheets.length === 0) {
  throw new Error("❌ 未解析到包含 valueRange.values 的表格数据");
}

console.log(`🗂️ 检测到 ${sheets.length} 张表格`);

// ==================== 数据容器 ====================
const gameStats = new Map(); // gameName -> metrics
const processedSheets = [];

function ensureGame(gameName) {
  const key = gameName.trim();
  if (!gameStats.has(key)) {
    gameStats.set(key, {
      gameName: key,
      userCount: 0,
      userCountDailySum: 0,
      totalBet: 0,
      totalBetUSD: 0,
      totalPayoutUSD: 0,
      totalRounds: 0,
      ggr: 0,
      ggrUSD: 0
    });
  }
  return gameStats.get(key);
}

function processUserSheet(values, sheetMonthKey, sheetTitle) {
  const title = sheetTitle || "";
  console.log(`📄 [用户数] 处理表：${title}`);

  values.forEach((row, idx) => {
    if (!Array.isArray(row) || row.length < 3) return;
    if (idx === 0) return; // 标题行

    const dateOrFlag = cleanString(row[0]);
    const gameName = cleanString(row[1]);
    const userCount = toNumber(row[2]);

    if (!gameName || gameName.toLowerCase() === "游戏名") return;
    if (dateOrFlag === "" || dateOrFlag === "日期") return;

    // 平台或商户合计行（跳过）
    if (/合计/i.test(gameName) && !/^\d/.test(dateOrFlag)) {
      return;
    }

    if (/合计/i.test(dateOrFlag)) {
      if (gameName && !/合计/i.test(gameName)) {
        const game = ensureGame(gameName);
        game.userCount = userCount;
        console.log(`  - [月合计] ${gameName}: ${userCount}`);
      }
      return;
    }

    const rowMonthKey = extractYearMonthFromValue(row[0]) || sheetMonthKey;
    if (rowMonthKey !== targetMonthKey) return;

    const game = ensureGame(gameName);
    game.userCountDailySum += userCount;
  });
}

function processRevenueSheet(values, sheetMonthKey, sheetTitle) {
  const title = sheetTitle || "";
  console.log(`📄 [营收] 处理表：${title}`);

  let headerIndex = -1;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;
    const lowerRow = row.map(cell => String(cell || "").toLowerCase());
    if (lowerRow.includes("总投注usd") || lowerRow.includes("ggr-usd") || lowerRow.includes("总投注")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    console.warn("⚠️ 未找到营收表头，跳过该表");
    return;
  }

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row) || row.length < 13) continue;

    const gameName = cleanString(row[4]);
    if (!gameName || /合计/i.test(gameName) || gameName.toLowerCase() === "游戏名") {
      continue;
    }

    const rowMonthKey = extractYearMonthFromValue(row[0]) || sheetMonthKey;
    if (rowMonthKey !== targetMonthKey) continue;

    const game = ensureGame(gameName);
    game.totalBet += toNumber(row[5]);
    game.totalBetUSD += toNumber(row[6]);
    game.totalPayoutUSD += toNumber(row[8]);
    game.totalRounds += toNumber(row[9]);
    game.ggr += toNumber(row[11]);
    game.ggrUSD += toNumber(row[12]);
  }
}

// ==================== 遍历每张表 ====================
sheets.forEach((sheet, index) => {
  const values = sheet?.data?.valueRange?.values;
  if (!Array.isArray(values) || values.length === 0) return;

  const sheetTitle = cleanString(values[0]?.[0]);
  const sheetMonthKey = extractMonthFromTitle(sheetTitle);

  processedSheets.push({ index, title: sheetTitle, monthKey: sheetMonthKey });

  if (sheetMonthKey && sheetMonthKey !== targetMonthKey) {
    console.log(`⏭️ 跳过非目标月份表：${sheetTitle}`);
    return;
  }

  if (sheetTitle.includes("活跃用户数")) {
    processUserSheet(values, sheetMonthKey, sheetTitle);
    return;
  }

  if (sheetTitle.includes("营收") || containsRevenueHeader(values)) {
    processRevenueSheet(values, sheetMonthKey, sheetTitle);
    return;
  }

  if (sheetTitle.includes("留存")) {
    console.log(`ℹ️ 留存表：${sheetTitle}（当前脚本未聚合留存数据）`);
    return;
  }

  console.log(`ℹ️ 未识别类型的表：${sheetTitle}（已跳过）`);
});

// ==================== 汇总与输出 ====================
const totals = {
  userCount: 0,
  totalBet: 0,
  totalBetUSD: 0,
  totalPayoutUSD: 0,
  totalRounds: 0,
  ggr: 0,
  ggrUSD: 0
};

const gamesArray = [];

gameStats.forEach((stats, gameName) => {
  if (!stats.userCount && stats.userCountDailySum) {
    stats.userCount = stats.userCountDailySum;
  }

  totals.userCount += stats.userCount;
  totals.totalBet += stats.totalBet;
  totals.totalBetUSD += stats.totalBetUSD;
  totals.totalPayoutUSD += stats.totalPayoutUSD;
  totals.totalRounds += stats.totalRounds;
  totals.ggr += stats.ggr;
  totals.ggrUSD += stats.ggrUSD;

  gamesArray.push({
    gameName,
    userCount: Math.round(stats.userCount * 100) / 100,
    userCountDailySum: Math.round(stats.userCountDailySum * 100) / 100,
    totalBet: Number(stats.totalBet.toFixed(4)),
    totalBetUSD: Number(stats.totalBetUSD.toFixed(4)),
    totalPayoutUSD: Number(stats.totalPayoutUSD.toFixed(4)),
    totalRounds: Math.round(stats.totalRounds),
    ggrUSD: Number(stats.ggrUSD.toFixed(4)),
    avgBetPerUser: stats.userCount ? Number((stats.totalBetUSD / stats.userCount).toFixed(4)) : 0,
    avgGGRPerUser: stats.userCount ? Number((stats.ggrUSD / stats.userCount).toFixed(4)) : 0,
    ggrMargin: stats.totalBetUSD ? Number((stats.ggrUSD / stats.totalBetUSD).toFixed(4)) : 0
  });
});

gamesArray.sort((a, b) => b.totalBetUSD - a.totalBetUSD);

gamesArray.forEach(game => {
  game.betContribution = totals.totalBetUSD
    ? Number((game.totalBetUSD / totals.totalBetUSD).toFixed(4))
    : 0;
  game.userContribution = totals.userCount
    ? Number((game.userCount / totals.userCount).toFixed(4))
    : 0;
});

const output = {
  targetMonth: targetMonthKey,
  targetMonthLabel,
  totalGames: gamesArray.length,
  totals: {
    userCount: Math.round(totals.userCount * 100) / 100,
    totalBet: Number(totals.totalBet.toFixed(4)),
    totalBetUSD: Number(totals.totalBetUSD.toFixed(4)),
    totalPayoutUSD: Number(totals.totalPayoutUSD.toFixed(4)),
    totalRounds: Math.round(totals.totalRounds),
    ggrUSD: Number(totals.ggrUSD.toFixed(4))
  },
  games: gamesArray,
  meta: {
    processedSheets
  }
};

console.log(`✅ 聚合完成：${gamesArray.length} 款游戏`);

return [{
  json: output
}];


