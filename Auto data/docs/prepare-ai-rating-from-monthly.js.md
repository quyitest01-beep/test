# prepare-ai-rating-from-monthly.js

```javascript
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

// ==================== 逐行解析（Sheet + Legacy）====================
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
  const headerIndex = findHeaderRowIndex(values, row => row.includes("时间") && row.includes("总投注usd"));
  if (headerIndex === -1) return;

  const headerRow = values[headerIndex].map(cell => cleanString(cell).toLowerCase());
  const dateIdx = headerRow.findIndex(cell => cell === "时间" || cell.includes("time"));
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

  if (dateIdx === -1 || gameIdx === -1 || totalBetUSDIdx === -1 || totalPayoutUSDIdx === -1 || ggrUSDIdx === -1) return;
  if (sheetMonthKey) noteMonthKey(sheetMonthKey);

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;

    const gameName = cleanString(row[gameIdx]);
    if (!gameName || /合计/i.test(gameName) || gameName.toLowerCase() === "游戏名") continue;
    const lowerGame = gameName.toLowerCase();

    const dateRaw = row[dateIdx];
    const monthKey = extractMonthKeyFromValue(dateRaw) || sheetMonthKey;
    if (!monthKey) continue;
    noteMonthKey(monthKey);

    const stats = ensurePlatformStats(monthKey, gameName);
    if (stats) {
      stats.totalBet += toNumber(row[totalBetIdx]);
      stats.totalBetUSD += toNumber(row[totalBetUSDIdx]);
      stats.totalPayoutUSD += toNumber(row[totalPayoutUSDIdx]);
      stats.totalRounds += toNumber(row[totalRoundsIdx]);
      stats.ggrUSD += toNumber(row[ggrUSDIdx]);
    }

    if (newGameNameSet.has(lowerGame)) {
      const entry = ensureNewGame(gameName);
      const isoDate = excelSerialToISO(dateRaw);
      if (isoDate) {
        updateDateRange(newGameDateRange, isoDate);
        noteMonthKey(toMonthKeyFromISO(isoDate));
      }

      const totalBetVal = toNumber(row[totalBetIdx]);
      const totalBetUSDVal = toNumber(row[totalBetUSDIdx]);
      const totalPayoutVal = toNumber(row[totalPayoutIdx]);
      const totalPayoutUSDVal = toNumber(row[totalPayoutUSDIdx]);
      const totalRoundsVal = toNumber(row[totalRoundsIdx]);
      const ggrVal = toNumber(row[ggrIdx]);
      const ggrUSDVal = toNumber(row[ggrUSDIdx]);
      const rtpVal = toNumber(row[rtpIdx]);

      entry.revenueRecords.push({
        date: isoDate,
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
  const headerIndex = findHeaderRowIndex(values, row => row.includes("数据类型") && row.some(cell => cell.includes("留存")));
  if (headerIndex === -1) return;

  const headerRow = values[headerIndex].map(cell => cleanString(cell).toLowerCase());
  const gameIdx = headerRow.findIndex(cell => cell.includes("游戏"));
  const merchantIdx = headerRow.findIndex(cell => cell.includes("商户"));
  const dateIdx = headerRow.findIndex(cell => cell.includes("日期"));
  const dataTypeIdx = headerRow.findIndex(cell => cell.includes("数据类型") || cell.includes("类型"));
  if (gameIdx === -1 || dateIdx === -1 || dataTypeIdx === -1) return;

  const retentionColumns = {
    day0Users: headerRow.findIndex(cell => cell.includes("当日用户") || cell.includes("day0")),
    day0Retention: headerRow.findIndex(cell => cell.includes("当日留存") || cell.includes("day0留存")),
    day1Users: headerRow.findIndex(cell => cell.includes("1日用户") || cell.includes("day1")),
    day1Retention: headerRow.findIndex(cell => cell.includes("1日留存") || cell.includes("day1留存")),
    day3Users: headerRow.findIndex(cell => cell.includes("3日用户") || cell.includes("day3")),
    day3Retention: headerRow.findIndex(cell => cell.includes("3日留存") || cell.includes("day3留存")),
    day7Users: headerRow.findIndex(cell => cell.includes("7日用户") || cell.includes("day7")),
    day7Retention: headerRow.findIndex(cell => cell.includes("7日留存") || cell.includes("day7留存")),
    day14Users: headerRow.findIndex(cell => cell.includes("14日用户") || cell.includes("day14")),
    day14Retention: headerRow.findIndex(cell => cell.includes("14日留存") || cell.includes("day14留存")),
    day30Users: headerRow.findIndex(cell => cell.includes("30日用户") || cell.includes("day30")),
    day30Retention: headerRow.findIndex(cell => cell.includes("30日留存") || cell.includes("day30留存"))
  };

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

    const sectionKey = cleanString(row[dataTypeIdx]).includes("新用户") ? "newUser" : "activeUser";

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

function normalizeCell(header, value) {
  if (value === null || value === undefined) return null;
  const headerKey = cleanString(header).toLowerCase();
  if (headerKey.includes("日期") || headerKey.includes("date")) {
    const iso = excelSerialToISO(value);
    if (iso) return iso;
  }
  const numeric = toNumber(value, null);
  if (numeric !== null) return numeric;
  const str = cleanString(value);
  return str === "" ? null : str;
}

function processSheetEntry(entry) {
  const values = entry?.values;
  if (!Array.isArray(values) || values.length === 0) return;

  const sheetTitle = cleanString(values[0]?.[0]) || "";
  const sheetMonthKey = extractMonthKeyFromTitle(sheetTitle);

  const headerIndex = findHeaderRowIndex(values, row => row.includes("游戏名") || row.includes("game name"));
  if (headerIndex !== -1) {
    const headers = values[headerIndex].map(header => cleanString(header) || null);
    const rows = [];
    const newGameRows = [];
    for (let i = headerIndex + 1; i < values.length; i++) {
      const row = values[i];
      if (!Array.isArray(row)) continue;
      const record = {};
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        if (!header) continue;
        const cellValue = normalizeCell(header, row[c]);
        if (cellValue !== null && cellValue !== "") {
          record[header] = cellValue;
        }
      }
      if (Object.keys(record).length === 0) continue;
      rows.push(record);
      const gameName = cleanString(record["游戏名"] || record["Game Name"]);
      if (gameName && newGameNameSet.has(gameName.toLowerCase())) {
        newGameRows.push(record);
      }
    }
    if (rows.length > 0) {
      normalizedTables.push({
        tableTitle: sheetTitle,
        rows,
        newGameRows
      });
    }
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

// ==================== legacy 数据兼容 ====================
legacyRows.forEach(item => {
  if (item && typeof item === "object" && item.targetMonth) {
    aggregateCandidate = item;
    return;
  }

  const values = Array.isArray(item?.values) ? item.values : null;
  if (!values || values.length === 0) return;

  if (item.is_header) {
    const headerStr = values.map(cell => String(cell || "").toLowerCase()).join("|");
    if (headerStr.includes("投注用户数") && headerStr.includes("日期")) {
      currentSection = "user";
      return;
    }
    if (headerStr.includes("总投注") && headerStr.includes("usd")) {
      currentSection = "revenue";
      return;
    }
    if (headerStr.includes("数据类型") && headerStr.includes("留存")) {
      currentSection = "retention";
      return;
    }
    currentSection = null;
    return;
  }

  if (!currentSection) return;

  if (currentSection === "user") {
    const dateRaw = values[0];
    const gameNameRaw = values[1] ?? item.game_name;
    const userValue = values[2];
    const gameName = cleanString(gameNameRaw);
    if (!gameName) return;

    const lowerGame = gameName.toLowerCase();

    const monthKey = extractMonthKeyFromValue(dateRaw);
    noteMonthKey(monthKey);
    const stats = ensurePlatformStats(monthKey, gameName);

    const flag = cleanString(dateRaw);
    if (/合计|total/.test(flag.toLowerCase())) {
      if (stats) stats.userTotal = toNumber(userValue);
      if (newGameNameSet.has(lowerGame)) {
        const entry = ensureNewGame(gameName);
        entry.monthlyUserTotal = toNumber(userValue);
      }
      return;
    }

    if (stats) stats.userDailySum += toNumber(userValue);

    if (newGameNameSet.has(lowerGame)) {
      const isoDate = excelSerialToISO(dateRaw);
      if (isoDate) {
        const entry = ensureNewGame(gameName);
        entry.dailyUsers.push({ date: isoDate, users: toNumber(userValue) });
        updateDateRange(newGameDateRange, isoDate);
        noteMonthKey(toMonthKeyFromISO(isoDate));
      }
    }
  } else if (currentSection === "revenue") {
    if (values.length < 13) return;
    const [
      timeRaw,
      merchantName,
      currency,
      usdRate,
      gameNameRaw,
      totalBet,
      totalBetUSD,
      totalPayout,
      totalPayoutUSD,
      totalRounds,
      rtp,
      ggr,
      ggrUSD
    ] = values;

    const gameName = cleanString(gameNameRaw);
    if (!gameName) return;
    const lowerGame = gameName.toLowerCase();

    const monthKey = extractMonthKeyFromValue(timeRaw);
    noteMonthKey(monthKey);
    const stats = ensurePlatformStats(monthKey, gameName);
    if (stats) {
      stats.totalBet += toNumber(totalBet);
      stats.totalBetUSD += toNumber(totalBetUSD);
      stats.totalPayoutUSD += toNumber(totalPayoutUSD);
      stats.totalRounds += toNumber(totalRounds);
      stats.ggrUSD += toNumber(ggrUSD);
    }

    if (newGameNameSet.has(lowerGame)) {
      const isoDate = excelSerialToISO(timeRaw);
      const entry = ensureNewGame(gameName);
      entry.revenueRecords.push({
        date: isoDate,
        merchantName: cleanString(merchantName),
        currency: cleanString(currency),
        usdRate: toNumber(usdRate),
        totalBet: toNumber(totalBet),
        totalBetUSD: Number(toNumber(totalBetUSD).toFixed(4)),
        totalPayout: toNumber(totalPayout),
        totalPayoutUSD: Number(toNumber(totalPayoutUSD).toFixed(4)),
        totalRounds: Math.round(toNumber(totalRounds)),
        rtp: Number(toNumber(rtp).toFixed(4)),
        ggr: toNumber(ggr),
        ggrUSD: Number(toNumber(ggrUSD).toFixed(4))
      });
      if (isoDate) {
        updateDateRange(newGameDateRange, isoDate);
        noteMonthKey(toMonthKeyFromISO(isoDate));
      }
    }
  } else if (currentSection === "retention") {
    if (values.length < 5) return;
    const [
      gameNameRaw,
      merchantName,
      dateRaw,
      dataType,
      day0Users,
      day1Users,
      day1Retention,
      day3Users,
      day3Retention,
      day7Users,
      day7Retention,
      day14Users,
      day14Retention,
      day30Users,
      day30Retention
    ] = values;

    const gameName = cleanString(gameNameRaw);
    if (!gameName) return;
    const lowerGame = gameName.toLowerCase();
    if (!newGameNameSet.has(lowerGame)) return;

    const entry = ensureNewGame(gameName);
    const isoDate = excelSerialToISO(dateRaw);
    const sectionKey = cleanString(dataType).includes("新用户") ? "newUser" : "activeUser";

    entry.retention[sectionKey].push({
      date: isoDate,
      merchantName: cleanString(merchantName),
      day0Users: toNumber(day0Users),
      day1Users: toNumber(day1Users),
      day1Retention: Number(toNumber(day1Retention).toFixed(4)),
      day3Users: toNumber(day3Users),
      day3Retention: Number(toNumber(day3Retention).toFixed(4)),
      day7Users: toNumber(day7Users),
      day7Retention: Number(toNumber(day7Retention).toFixed(4)),
      day14Users: toNumber(day14Users),
      day14Retention: Number(toNumber(day14Retention).toFixed(4)),
      day30Users: toNumber(day30Users),
      day30Retention: Number(toNumber(day30Retention).toFixed(4))
    });

    if (isoDate) {
      updateDateRange(newGameDateRange, isoDate);
      noteMonthKey(toMonthKeyFromISO(isoDate));
    }
  }
});

// ==================== 确定目标月份 ====================
function pickMonthKey() {
  if (aggregateCandidate?.targetMonth) return cleanString(aggregateCandidate.targetMonth);

  const startMonthKey = toMonthKeyFromISO(newGameDateRange.start);
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

  return startMonthKey || null;
}

let targetMonthKey = pickMonthKey();
if (!targetMonthKey) {
  throw new Error("❌ 无法确定新游戏的数据月份（缺少日期或发行月信息）");
}
let targetMonthLabel = `${targetMonthKey.slice(0, 4)}-${targetMonthKey.slice(4)}`;

// ==================== 月度数据聚合 ====================
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
  const fallbackUserCount = entry.monthlyUserTotal ?? entry.dailyUsers.reduce((sum, row) => sum + row.users, 0);

  const summary = {
    userCount: aggGame ? aggGame.userCount : Number(fallbackUserCount.toFixed ? fallbackUserCount.toFixed(4) : fallbackUserCount),
    userCountDailySum: aggGame ? aggGame.userCountDailySum : Number(entry.dailyUsers.reduce((sum, row) => sum + row.users, 0).toFixed(4)),
    totalBetUSD: aggGame ? aggGame.totalBetUSD : Number(entry.revenueRecords.reduce((sum, row) => sum + row.totalBetUSD, 0).toFixed(4)),
    ggrUSD: aggGame ? aggGame.ggrUSD : Number(entry.revenueRecords.reduce((sum, row) => sum + row.ggrUSD, 0).toFixed(4)),
    totalRounds: aggGame ? aggGame.totalRounds : entry.revenueRecords.reduce((sum, row) => sum + row.totalRounds, 0),
    avgBetPerUser: aggGame ? aggGame.avgBetPerUser : 0,
    avgGGRPerUser: aggGame ? aggGame.avgGGRPerUser : 0,
    ggrMargin: aggGame ? aggGame.ggrMargin : 0
  };

  if (!aggGame) {
    summary.avgBetPerUser = summary.userCount ? Number((summary.totalBetUSD / summary.userCount).toFixed(4)) : 0;
    summary.avgGGRPerUser = summary.userCount ? Number((summary.ggrUSD / summary.userCount).toFixed(4)) : 0;
    summary.ggrMargin = summary.totalBetUSD ? Number((summary.ggrUSD / summary.totalBetUSD).toFixed(4)) : 0;
  }

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
  rawTables: normalizedTables,
  meta: {
    generatedAt: new Date().toISOString(),
    period: newGameDateRange,
    usingAggregateFallback,
    monthKey: targetMonthKey
  }
};

return [{ json: result }];
```
