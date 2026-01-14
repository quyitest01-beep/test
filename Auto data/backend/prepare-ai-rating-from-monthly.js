// n8n Code节点：AI评级输入准备器（Merge2 行级数据版）
// 功能：
//   1. 读取 Merge2(1).json（前若干项为 { english_name, release_date }，之后为逐行数据）
//   2. 自动识别新游戏、月份周期，并统计同周期全平台指标与 Top 榜
//   3. 输出给 AI 提示词使用的结构化结果：platform 汇总、topGames 榜单、新游戏详单

const inputs = $input.all();
if (!inputs || inputs.length === 0) {
  throw new Error("❌ 未收到任何输入数据");
}

// ==================== 通用工具函数 ====================
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function toNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === "") return defaultValue;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : defaultValue;
  }
  const cleaned = String(value).replace(/,/g, "").trim();
  if (cleaned === "") return defaultValue;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function excelSerialToISO(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const rounded = Math.round(value);
    if (rounded > 20000 && rounded < 80000) {
      const millis = EXCEL_EPOCH_UTC + rounded * 86400000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    const str = String(rounded);
    if (str.length === 8 && str.startsWith("20")) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6)}`;
    }
    return null;
  }
  const str = cleanString(value);
  if (/^\d{8}$/.test(str) && str.startsWith("20")) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6)}`;
  }
  return null;
}

function extractMonthKeyFromValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    const rounded = Math.round(value);
    if (rounded > 20000 && rounded < 80000) {
      const millis = EXCEL_EPOCH_UTC + rounded * 86400000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) {
        return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      }
    }
    const str = String(rounded);
    if (str.length === 8 && str.startsWith("20")) return str.slice(0, 6);
    return null;
  }
  const cleaned = cleanString(value);
  if (/^\d{8}$/.test(cleaned) && cleaned.startsWith("20")) return cleaned.slice(0, 6);
  const match = cleaned.replace(/[^\d]/g, "").match(/^20\d{4}/);
  return match ? match[0] : null;
}

function toMonthKeyFromISO(iso) {
  if (!iso) return null;
  return iso.slice(0, 7).replace("-", "");
}

function toMonthKeyFromRelease(release) {
  const cleaned = cleanString(release).replace(/[^\d]/g, "");
  if (cleaned.length >= 6) return cleaned.slice(0, 6);
  return null;
}

function updateDateRange(range, iso) {
  if (!iso) return;
  if (!range.start || iso < range.start) range.start = iso;
  if (!range.end || iso > range.end) range.end = iso;
}

function isNoiseGameName(name) {
  const clean = cleanString(name).toLowerCase();
  if (!clean) return true;
  if (/^\d{8}$/.test(clean)) return true;
  return false;
}

function extractMonthKeyFromTitle(title) {
  const cleaned = cleanString(title);
  if (!cleaned) return null;
  const match = cleaned.replace(/[^\d]/g, "").match(/^20\d{4}/);
  return match ? match[0] : null;
}

function extractDateRangeFromTitle(title) {
  const cleaned = cleanString(title);
  if (!cleaned) return null;
  const match = cleaned.match(/(20\d{6})[-~](\d{4})/);
  if (!match) return null;
  const startRaw = match[1];
  const endRaw = match[2];
  const year = startRaw.slice(0, 4);
  const start = `${year}-${startRaw.slice(4, 6)}-${startRaw.slice(6)}`;
  const end = `${year}-${endRaw.slice(0, 2)}-${endRaw.slice(2)}`;
  return { start, end };
}

function containsRevenueHeader(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some(row => {
    if (!Array.isArray(row)) return false;
    return row.some(cell => cleanString(cell).toLowerCase().includes("总投注usd"));
  });
}

function findHeaderRowIndex(rows, matcher) {
  if (!Array.isArray(rows)) return -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const lowerRow = row.map(cell => cleanString(cell).toLowerCase());
    if (matcher(lowerRow)) return i;
  }
  return -1;
}

// ==================== 解析新游戏列表 ====================
const rawItems = inputs.map(item => item.json);

const newGameEntries = [];
for (const item of rawItems) {
  if (item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "english_name")) {
    newGameEntries.push(item);
  } else {
    break;
  }
}

if (newGameEntries.length === 0) {
  throw new Error("❌ 未找到 english_name 列表，新游戏信息缺失");
}

const newGameNameSet = new Set();
const newGameReleaseMap = new Map();
newGameEntries.forEach(entry => {
  const name = cleanString(entry.english_name);
  if (!name) return;
  const key = name.toLowerCase();
  newGameNameSet.add(key);
  newGameReleaseMap.set(key, cleanString(entry.release_date || ""));
});

let aggregateCandidate = null;

const remainingItems = rawItems.slice(newGameEntries.length);

const sheetEntries = [];
const legacyRows = [];

remainingItems.forEach(item => {
  if (item && typeof item === "object" && item.targetMonth) {
    aggregateCandidate = item;
    return;
  }

  const valueRange = item?.data?.valueRange?.values || item?.valueRange?.values;
  if (Array.isArray(valueRange) && valueRange.length > 0) {
    sheetEntries.push({ values: valueRange, source: item });
    return;
  }

  legacyRows.push(item);
});

// ==================== 准备数据结构 ====================
const platformStatsByMonth = new Map(); // monthKey -> Map(gameName -> stats)
function ensurePlatformStats(monthKey, gameName) {
  if (!monthKey || !gameName) return null;
  if (!platformStatsByMonth.has(monthKey)) {
    platformStatsByMonth.set(monthKey, new Map());
  }
  const map = platformStatsByMonth.get(monthKey);
  if (!map.has(gameName)) {
    map.set(gameName, {
      gameName,
      userTotal: 0,
      userDailySum: 0,
      totalBet: 0,
      totalBetUSD: 0,
      totalPayoutUSD: 0,
      totalRounds: 0,
      ggrUSD: 0
    });
  }
  return map.get(gameName);
}

const newGamesMap = new Map();
function ensureNewGame(gameName) {
  const key = gameName.trim();
  if (!newGamesMap.has(key)) {
    const lower = key.toLowerCase();
    newGamesMap.set(key, {
      gameName: key,
      releaseDate: newGameReleaseMap.get(lower) || "",
      monthlyUserTotal: null,
      dailyUsers: [],
      revenueRecords: [],
      retention: {
        newUser: [],
        activeUser: []
      }
    });
  }
  return newGamesMap.get(key);
}

const monthKeyFrequency = new Map();
function noteMonthKey(monthKey) {
  if (!monthKey) return;
  monthKeyFrequency.set(monthKey, (monthKeyFrequency.get(monthKey) || 0) + 1);
}

const newGameDateRange = { start: null, end: null };

// ==================== 逐行解析 ====================
let currentSection = null; // 'user' | 'revenue' | 'retention'

function processGameUserSheetFromValues(values, sheetMonthKey, sheetTitle) {
  const headerIndex = findHeaderRowIndex(values, row => row.includes("日期") && row.includes("游戏名") && row.some(cell => cell.includes("投注用户数")));
  if (headerIndex === -1) return;

  const headerRow = values[headerIndex].map(cell => cleanString(cell).toLowerCase());
  const dateIdx = headerRow.findIndex(cell => cell === "日期" || cell.includes("date"));
  const gameIdx = headerRow.findIndex(cell => cell.includes("游戏"));
  const userIdx = headerRow.findIndex(cell => cell.includes("投注用户数") || cell.includes("用户数"));

  if (dateIdx === -1 || gameIdx === -1 || userIdx === -1) return;
  if (sheetMonthKey) noteMonthKey(sheetMonthKey);

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;

    const gameName = cleanString(row[gameIdx]);
    if (!gameName || gameName.toLowerCase() === "游戏名") continue;
    const lowerGame = gameName.toLowerCase();

    const userValue = toNumber(row[userIdx]);
    const dateRaw = row[dateIdx];
    const flag = cleanString(dateRaw);
    const monthKey = extractMonthKeyFromValue(dateRaw) || sheetMonthKey;
    if (monthKey) noteMonthKey(monthKey);
    const stats = ensurePlatformStats(monthKey, gameName);

    if (/合计|total/i.test(flag)) {
      if (stats) stats.userTotal = userValue;
      if (newGameNameSet.has(lowerGame)) {
        const entry = ensureNewGame(gameName);
        entry.monthlyUserTotal = userValue;
      }
      continue;
    }

    if (stats) stats.userDailySum += userValue;

    if (newGameNameSet.has(lowerGame)) {
      const entry = ensureNewGame(gameName);
      const isoDate = excelSerialToISO(dateRaw);
      if (isoDate) {
        entry.dailyUsers.push({ date: isoDate, users: userValue });
        updateDateRange(newGameDateRange, isoDate);
        noteMonthKey(toMonthKeyFromISO(isoDate));
      }
    }
  }
}

function processRevenueSheetFromValues(values, sheetMonthKey, sheetTitle) {
  const headerIndex = findHeaderRowIndex(values, row => row.includes("总投注usd") && (row.includes("商户名") || row.includes("游戏名")));
  if (headerIndex === -1) return;

  const headerRowRaw = values[headerIndex].map(cell => cleanString(cell));
  const headerRow = headerRowRaw.map(cell => cell.toLowerCase());
  const dateIdx = headerRow.findIndex(cell => cell.includes("日期") || cell === "时间" || cell.includes("time"));
  const merchantIdx = headerRow.findIndex(cell => cell.includes("商户"));
  const currencyIdx = headerRow.findIndex(cell => cell.includes("货币"));
  const rateIdx = headerRow.findIndex(cell => cell.includes("usd汇率") || cell.includes("汇率"));
  const gameIdx = headerRow.findIndex(cell => cell.includes("游戏"));
  const totalBetIdx = headerRow.findIndex(cell => cell === "总投注" || (cell.includes("总投注") && !cell.includes("usd")));
  const totalBetUSDIdx = headerRow.findIndex(cell => cell.includes("总投注usd"));
  const totalPayoutIdx = headerRow.findIndex(cell => cell === "总派奖" || (cell.includes("总派奖") && !cell.includes("usd")));
  const totalPayoutUSDIdx = headerRow.findIndex(cell => cell.includes("总派奖usd"));
  const totalRoundsIdx = headerRow.findIndex(cell => cell.includes("总局数"));
  const rtpIdx = headerRow.findIndex(cell => cell === "rtp" || cell.includes("rtp"));
  const ggrIdx = headerRow.findIndex(cell => cell === "ggr" || (cell.includes("ggr") && !cell.includes("usd")));
  const ggrUSDIdx = headerRow.findIndex(cell => cell.includes("ggr-usd"));

  if (gameIdx === -1 || totalBetUSDIdx === -1 || totalPayoutUSDIdx === -1 || ggrUSDIdx === -1) return;
  if (sheetMonthKey) noteMonthKey(sheetMonthKey);

  const sheetPeriod = extractDateRangeFromTitle(sheetTitle);
  if (!sheetMonthKey && sheetPeriod) {
    noteMonthKey(extractMonthKeyFromValue(sheetPeriod.start));
  }

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;

    const gameName = cleanString(row[gameIdx]);
    if (!gameName || /合计/i.test(gameName) || gameName.toLowerCase() === "游戏名") continue;
    const lowerGame = gameName.toLowerCase();

    const hasDateColumn = dateIdx !== -1;
    const dateRaw = hasDateColumn ? row[dateIdx] : null;
    const monthKey = hasDateColumn ? (extractMonthKeyFromValue(dateRaw) || sheetMonthKey) : sheetMonthKey;
    if (!monthKey) continue;
    noteMonthKey(monthKey);

    const stats = ensurePlatformStats(monthKey, gameName);
    if (stats) {
      if (totalBetIdx !== -1) stats.totalBet += toNumber(row[totalBetIdx]);
      stats.totalBetUSD += toNumber(row[totalBetUSDIdx]);
      if (totalPayoutUSDIdx !== -1) stats.totalPayoutUSD += toNumber(row[totalPayoutUSDIdx]);
      if (totalRoundsIdx !== -1) stats.totalRounds += toNumber(row[totalRoundsIdx]);
      stats.ggrUSD += toNumber(row[ggrUSDIdx]);
    }

    if (newGameNameSet.has(lowerGame)) {
      const entry = ensureNewGame(gameName);
      let isoDate = hasDateColumn ? excelSerialToISO(dateRaw) : null;
      if (!isoDate && sheetPeriod) {
        isoDate = sheetPeriod.start;
      }
      if (isoDate) {
        updateDateRange(newGameDateRange, isoDate);
        noteMonthKey(toMonthKeyFromISO(isoDate));
      } else if (sheetPeriod) {
        updateDateRange(newGameDateRange, sheetPeriod.start);
        updateDateRange(newGameDateRange, sheetPeriod.end);
      }

      const totalBetVal = totalBetIdx !== -1 ? toNumber(row[totalBetIdx]) : 0;
      const totalBetUSDVal = toNumber(row[totalBetUSDIdx]);
      const totalPayoutVal = totalPayoutIdx !== -1 ? toNumber(row[totalPayoutIdx]) : 0;
      const totalPayoutUSDVal = totalPayoutUSDIdx !== -1 ? toNumber(row[totalPayoutUSDIdx]) : 0;
      const totalRoundsVal = totalRoundsIdx !== -1 ? toNumber(row[totalRoundsIdx]) : 0;
      const ggrVal = ggrIdx !== -1 ? toNumber(row[ggrIdx]) : 0;
      const ggrUSDVal = toNumber(row[ggrUSDIdx]);
      const rtpVal = rtpIdx !== -1 ? toNumber(row[rtpIdx]) : 0;

      entry.revenueRecords.push({
        date: isoDate || (sheetPeriod ? `${sheetPeriod.start}~${sheetPeriod.end}` : null),
        merchantName: merchantIdx !== -1 ? cleanString(row[merchantIdx]) : "",
        currency: currencyIdx !== -1 ? cleanString(row[currencyIdx]) : "",
        usdRate: rateIdx !== -1 ? toNumber(row[rateIdx]) : 0,
        totalBet: totalBetVal,
        totalBetUSD: Number(totalBetUSDVal.toFixed(4)),
        totalPayout: totalPayoutVal,
        totalPayoutUSD: Number(totalPayoutUSDVal.toFixed(4)),
        totalRounds: Math.round(totalRoundsVal),
        rtp: Number(rtpVal.toFixed(4)),
        ggr: ggrVal,
        ggrUSD: Number(ggrUSDVal.toFixed(4))
      });
    }
  }
}

function processRetentionSheetFromValues(values, sheetMonthKey, sheetTitle) {
  let headerIndex = findHeaderRowIndex(values, row => row.includes("数据类型") && row.some(cell => cell.includes("留存")));
  let hasDataTypeColumn = true;
  if (headerIndex === -1) {
    headerIndex = findHeaderRowIndex(values, row => row.includes("游戏名") && row.some(cell => cell.includes("留存率")));
    if (headerIndex === -1) return;
    hasDataTypeColumn = false;
  }

  const headerRowRaw = values[headerIndex].map(cell => cleanString(cell));
  const headerRow = headerRowRaw.map(cell => cell.toLowerCase());
  const gameIdx = headerRow.findIndex(cell => cell.includes("游戏"));
  const merchantIdx = headerRow.findIndex(cell => cell.includes("商户"));
  const dateIdx = headerRow.findIndex(cell => cell.includes("日期"));
  const dataTypeIdx = hasDataTypeColumn ? headerRow.findIndex(cell => cell.includes("数据类型") || cell.includes("类型")) : -1;
  if (gameIdx === -1 || dateIdx === -1) return;

  const retentionColumns = {
    day0Users: headerRow.findIndex(cell => cell.includes("当日用户") || cell.includes("当天新用户") || cell.includes("day0")),
    day0Retention: headerRow.findIndex(cell => cell.includes("当日留存") || cell.includes("day0留存")),
    day1Users: headerRow.findIndex(cell => cell.includes("次日用户") || cell.includes("1日用户") || cell.includes("day1")),
    day1Retention: headerRow.findIndex(cell => cell.includes("次日留存") || cell.includes("1日留存") || cell.includes("day1留存")),
    day3Users: headerRow.findIndex(cell => cell.includes("3日用户") || cell.includes("day3")),
    day3Retention: headerRow.findIndex(cell => cell.includes("3日留存") || cell.includes("day3留存")),
    day7Users: headerRow.findIndex(cell => cell.includes("7日用户") || cell.includes("day7")),
    day7Retention: headerRow.findIndex(cell => cell.includes("7日留存") || cell.includes("day7留存")),
    day14Users: headerRow.findIndex(cell => cell.includes("14日用户") || cell.includes("day14")),
    day14Retention: headerRow.findIndex(cell => cell.includes("14日留存") || cell.includes("day14留存")),
    day30Users: headerRow.findIndex(cell => cell.includes("30日用户") || cell.includes("day30")),
    day30Retention: headerRow.findIndex(cell => cell.includes("30日留存") || cell.includes("day30留存"))
  };

  const sheetHintSection = sheetTitle.includes("新") ? "newUser" : sheetTitle.includes("活跃") ? "activeUser" : null;

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;

    const gameName = cleanString(row[gameIdx]);
    if (!gameName) continue;
    const lowerGame = gameName.toLowerCase();
    if (!newGameNameSet.has(lowerGame)) continue;

    const entry = ensureNewGame(gameName);
    const isoDate = excelSerialToISO(row[dateIdx]);
    if (isoDate) {
      updateDateRange(newGameDateRange, isoDate);
      noteMonthKey(toMonthKeyFromISO(isoDate));
    }

    let sectionKey = "activeUser";
    if (hasDataTypeColumn && dataTypeIdx !== -1) {
      sectionKey = cleanString(row[dataTypeIdx]).includes("新用户") ? "newUser" : "activeUser";
    } else if (sheetHintSection) {
      sectionKey = sheetHintSection;
    } else if (headerRowRaw.some(cell => cell.includes("当天新用户"))) {
      sectionKey = "newUser";
    }

    entry.retention[sectionKey].push({
      date: isoDate,
      merchantName: merchantIdx !== -1 ? cleanString(row[merchantIdx]) : "",
      day0Users: retentionColumns.day0Users !== -1 ? toNumber(row[retentionColumns.day0Users]) : 0,
      day0Retention: retentionColumns.day0Retention !== -1 ? Number(toNumber(row[retentionColumns.day0Retention]).toFixed(4)) : 0,
      day1Users: retentionColumns.day1Users !== -1 ? toNumber(row[retentionColumns.day1Users]) : 0,
      day1Retention: retentionColumns.day1Retention !== -1 ? Number(toNumber(row[retentionColumns.day1Retention]).toFixed(4)) : 0,
      day3Users: retentionColumns.day3Users !== -1 ? toNumber(row[retentionColumns.day3Users]) : 0,
      day3Retention: retentionColumns.day3Retention !== -1 ? Number(toNumber(row[retentionColumns.day3Retention]).toFixed(4)) : 0,
      day7Users: retentionColumns.day7Users !== -1 ? toNumber(row[retentionColumns.day7Users]) : 0,
      day7Retention: retentionColumns.day7Retention !== -1 ? Number(toNumber(row[retentionColumns.day7Retention]).toFixed(4)) : 0,
      day14Users: retentionColumns.day14Users !== -1 ? toNumber(row[retentionColumns.day14Users]) : 0,
      day14Retention: retentionColumns.day14Retention !== -1 ? Number(toNumber(row[retentionColumns.day14Retention]).toFixed(4)) : 0,
      day30Users: retentionColumns.day30Users !== -1 ? toNumber(row[retentionColumns.day30Users]) : 0,
      day30Retention: retentionColumns.day30Retention !== -1 ? Number(toNumber(row[retentionColumns.day30Retention]).toFixed(4)) : 0
    });
  }
}

function processSheetEntry(entry) {
  const values = entry?.values;
  if (!Array.isArray(values) || values.length === 0) return;

  const sheetTitle = cleanString(values[0]?.[0]) || "";
  const sheetMonthKey = extractMonthKeyFromTitle(sheetTitle);

  if (sheetTitle.includes("商户活跃用户数")) {
    if (sheetMonthKey) noteMonthKey(sheetMonthKey);
    return;
  }

  if (sheetTitle.includes("游戏活跃用户数")) {
    processGameUserSheetFromValues(values, sheetMonthKey, sheetTitle);
    return;
  }

  if (sheetTitle.includes("留存")) {
    processRetentionSheetFromValues(values, sheetMonthKey, sheetTitle);
    return;
  }

  if (containsRevenueHeader(values)) {
    processRevenueSheetFromValues(values, sheetMonthKey, sheetTitle);
    return;
  }

  const fallbackUserHeader = findHeaderRowIndex(values, row => row.includes("日期") && row.includes("游戏名") && row.some(cell => cell.includes("投注用户数")));
  if (fallbackUserHeader !== -1) {
    processGameUserSheetFromValues(values, sheetMonthKey, sheetTitle);
  }
}

sheetEntries.forEach(processSheetEntry);

// ==================== 确定目标月份 ====================
function pickMonthKey() {
  if (aggregateCandidate?.targetMonth) return cleanString(aggregateCandidate.targetMonth);

  const endMonthKey = toMonthKeyFromISO(newGameDateRange.end);
  const startMonthKey = toMonthKeyFromISO(newGameDateRange.start);
  if (endMonthKey && platformStatsByMonth.has(endMonthKey)) {
    return endMonthKey;
  }
  if (startMonthKey && platformStatsByMonth.has(startMonthKey)) {
    return startMonthKey;
  }

  for (const release of newGameReleaseMap.values()) {
    const key = toMonthKeyFromRelease(release);
    if (key && platformStatsByMonth.has(key)) return key;
  }

  if (monthKeyFrequency.size > 0) {
    let bestKey = null;
    let bestCount = -1;
    monthKeyFrequency.forEach((count, key) => {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    });
    if (bestKey) return bestKey;
  }

  if (platformStatsByMonth.size === 1) {
    return Array.from(platformStatsByMonth.keys())[0];
  }

  return endMonthKey || startMonthKey || null;
}

let targetMonthKey = pickMonthKey();
if (!targetMonthKey) {
  throw new Error("❌ 无法确定新游戏的数据月份（缺少日期或发行月信息）");
}
let targetMonthLabel = `${targetMonthKey.slice(0, 4)}-${targetMonthKey.slice(4)}`;

let usingAggregateFallback = false;
let monthStatsMap = platformStatsByMonth.get(targetMonthKey);
if ((!monthStatsMap || monthStatsMap.size === 0) && platformStatsByMonth.size > 0) {
  let fallbackKey = null;
  let bestSize = -1;
  platformStatsByMonth.forEach((map, key) => {
    const size = map ? map.size : 0;
    if (size > bestSize) {
      fallbackKey = key;
      bestSize = size;
    }
  });
  if (fallbackKey && fallbackKey !== targetMonthKey) {
    monthStatsMap = platformStatsByMonth.get(fallbackKey);
    if (monthStatsMap && monthStatsMap.size > 0) {
      targetMonthKey = fallbackKey;
      targetMonthLabel = `${targetMonthKey.slice(0, 4)}-${targetMonthKey.slice(4)}`;
    }
  }
}

if ((!monthStatsMap || monthStatsMap.size === 0) && aggregateCandidate?.games?.length) {
  usingAggregateFallback = true;
  if (aggregateCandidate.targetMonth) {
    const cleaned = cleanString(aggregateCandidate.targetMonth);
    if (cleaned && cleaned.length === 6) {
      targetMonthKey = cleaned;
      targetMonthLabel = `${targetMonthKey.slice(0, 4)}-${targetMonthKey.slice(4)}`;
    }
  }
  monthStatsMap = new Map();
  aggregateCandidate.games.forEach(game => {
    monthStatsMap.set(game.gameName, {
      gameName: game.gameName,
      userTotal: toNumber(game.userCount ?? game.userTotal),
      userDailySum: toNumber(game.userCountDailySum ?? game.userDailySum),
      totalBet: toNumber(game.totalBet),
      totalBetUSD: toNumber(game.totalBetUSD),
      totalPayoutUSD: toNumber(game.totalPayoutUSD),
      totalRounds: toNumber(game.totalRounds),
      ggrUSD: toNumber(game.ggrUSD)
    });
  });
}

if (!monthStatsMap || monthStatsMap.size === 0) {
  throw new Error(`❌ 在月份 ${targetMonthLabel} 未找到任何全平台数据`);
}

let totalUsers = 0;
let totalBetUSD = 0;
let totalPayoutUSD = 0;
let totalRounds = 0;
let totalGGRUSD = 0;
let totalBet = 0;
const gamesArray = [];

monthStatsMap.forEach(stats => {
  const userCount = stats.userTotal || stats.userDailySum || 0;
  const betUSD = toNumber(stats.totalBetUSD);
  const ggrUSD = toNumber(stats.ggrUSD);

  totalUsers += userCount;
  totalBetUSD += betUSD;
  totalPayoutUSD += toNumber(stats.totalPayoutUSD);
  totalRounds += toNumber(stats.totalRounds);
  totalGGRUSD += ggrUSD;
  totalBet += toNumber(stats.totalBet);

  if (isNoiseGameName(stats.gameName)) return;

  gamesArray.push({
    gameName: stats.gameName,
    userCount: Number(userCount.toFixed ? userCount.toFixed(4) : userCount),
    userCountDailySum: Number(toNumber(stats.userDailySum).toFixed(4)),
    totalBet: Number(toNumber(stats.totalBet).toFixed(4)),
    totalBetUSD: Number(betUSD.toFixed(4)),
    totalPayoutUSD: Number(toNumber(stats.totalPayoutUSD).toFixed(4)),
    totalRounds: Math.round(toNumber(stats.totalRounds)),
    ggrUSD: Number(ggrUSD.toFixed(4)),
    avgBetPerUser: userCount ? Number((betUSD / userCount).toFixed(4)) : 0,
    avgGGRPerUser: userCount ? Number((ggrUSD / userCount).toFixed(4)) : 0,
    ggrMargin: betUSD ? Number((ggrUSD / betUSD).toFixed(4)) : 0
  });
});

let platformTotals = {
  totalGames: gamesArray.length,
  totalUsers: Number(totalUsers.toFixed(4)),
  totalBet,
  totalBetUSD: Number(totalBetUSD.toFixed(4)),
  totalPayoutUSD: Number(totalPayoutUSD.toFixed(4)),
  totalRounds: Math.round(totalRounds),
  totalGGRUSD: Number(totalGGRUSD.toFixed(4))
};

if (usingAggregateFallback && aggregateCandidate?.totals) {
  const aggTotals = aggregateCandidate.totals;
  platformTotals = {
    totalGames: aggregateCandidate.totalGames || gamesArray.length,
    totalUsers: Number(toNumber(aggTotals.userCount, totalUsers).toFixed(4)),
    totalBet: toNumber(aggTotals.totalBet, totalBet),
    totalBetUSD: Number(toNumber(aggTotals.totalBetUSD, totalBetUSD).toFixed(4)),
    totalPayoutUSD: Number(toNumber(aggTotals.totalPayoutUSD, totalPayoutUSD).toFixed(4)),
    totalRounds: Math.round(toNumber(aggTotals.totalRounds, totalRounds)),
    totalGGRUSD: Number(toNumber(aggTotals.ggrUSD, totalGGRUSD).toFixed(4))
  };
}

if (gamesArray.length === 0) {
  throw new Error("❌ 全平台游戏列表为空，无法生成对比数据");
}

gamesArray.sort((a, b) => b.totalBetUSD - a.totalBetUSD);
gamesArray.forEach(game => {
  game.betContribution = platformTotals.totalBetUSD ? Number((game.totalBetUSD / platformTotals.totalBetUSD).toFixed(4)) : 0;
  game.userContribution = platformTotals.totalUsers ? Number((game.userCount / platformTotals.totalUsers).toFixed(4)) : 0;
});

const topGamesByBet = gamesArray.slice(0, 15);

const betRankMap = new Map();
gamesArray.forEach((game, idx) => betRankMap.set(game.gameName, idx + 1));

const gamesByUser = [...gamesArray].sort((a, b) => b.userCount - a.userCount);
const userRankMap = new Map();
gamesByUser.forEach((game, idx) => userRankMap.set(game.gameName, idx + 1));

// ==================== 生成新游戏输出 ====================
const newGames = [];
newGamesMap.forEach((entry, gameName) => {
  const lower = gameName.toLowerCase();
  const aggGame = gamesArray.find(g => g.gameName === gameName);
  const fallbackUserTotalRaw = entry.monthlyUserTotal ?? entry.dailyUsers.reduce((sum, row) => sum + (row.users || 0), 0);
  const fallbackUserTotal = Number(
    fallbackUserTotalRaw && fallbackUserTotalRaw.toFixed ? fallbackUserTotalRaw.toFixed(4) : fallbackUserTotalRaw
  );
  const fallbackDailySumRaw = entry.dailyUsers.reduce((sum, row) => sum + (row.users || 0), 0);
  const fallbackDailySum = Number(
    fallbackDailySumRaw && fallbackDailySumRaw.toFixed ? fallbackDailySumRaw.toFixed(4) : fallbackDailySumRaw
  );
  const fallbackBetUSD = Number(entry.revenueRecords.reduce((sum, row) => sum + row.totalBetUSD, 0).toFixed(4));
  const fallbackGGRUSD = Number(entry.revenueRecords.reduce((sum, row) => sum + row.ggrUSD, 0).toFixed(4));
  const fallbackRounds = entry.revenueRecords.reduce((sum, row) => sum + (row.totalRounds || 0), 0);

  const summary = {
    userCount: aggGame && aggGame.userCount > 0 ? aggGame.userCount : fallbackUserTotal,
    userCountDailySum: aggGame && aggGame.userCountDailySum > 0 ? aggGame.userCountDailySum : fallbackDailySum,
    totalBetUSD: aggGame && aggGame.totalBetUSD > 0 ? aggGame.totalBetUSD : fallbackBetUSD,
    ggrUSD: aggGame && aggGame.ggrUSD !== 0 ? aggGame.ggrUSD : fallbackGGRUSD,
    totalRounds: aggGame && aggGame.totalRounds > 0 ? aggGame.totalRounds : fallbackRounds,
    avgBetPerUser: 0,
    avgGGRPerUser: 0,
    ggrMargin: 0
  };

  summary.avgBetPerUser = summary.userCount ? Number((summary.totalBetUSD / summary.userCount).toFixed(4)) : 0;
  summary.avgGGRPerUser = summary.userCount ? Number((summary.ggrUSD / summary.userCount).toFixed(4)) : 0;
  summary.ggrMargin = summary.totalBetUSD ? Number((summary.ggrUSD / summary.totalBetUSD).toFixed(4)) : 0;

  const share = {
    userShare: platformTotals.totalUsers ? Number((summary.userCount / platformTotals.totalUsers).toFixed(4)) : 0,
    betShare: platformTotals.totalBetUSD ? Number((summary.totalBetUSD / platformTotals.totalBetUSD).toFixed(4)) : 0
  };

  const allDates = entry.dailyUsers.map(item => item.date).filter(Boolean).sort();
  const dataPeriod = allDates.length
    ? (allDates[0] === allDates[allDates.length - 1] ? allDates[0] : `${allDates[0]} ~ ${allDates[allDates.length - 1]}`)
    : (entry.releaseDate ? entry.releaseDate : targetMonthLabel);

  newGames.push({
    gameName,
    releaseDate: entry.releaseDate,
    dataPeriod,
    summary,
    share,
    ranking: {
      betRank: betRankMap.get(gameName) || null,
      userRank: userRankMap.get(gameName) || null
    },
    dailyUsers: entry.dailyUsers.sort((a, b) => a.date.localeCompare(b.date)),
    revenueBreakdown: entry.revenueRecords.sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    }),
    retention: entry.retention
  });
});

// ==================== 输出结果 ====================
const result = {
  month: targetMonthLabel,
  newGameNames: Array.from(newGameNameSet.values()),
  platform: platformTotals,
  topGamesByBet,
  newGames,
  meta: {
    generatedAt: new Date().toISOString(),
    period: newGameDateRange,
    usingAggregateFallback,
    monthKey: targetMonthKey
  }
};

return [{ json: result }];


