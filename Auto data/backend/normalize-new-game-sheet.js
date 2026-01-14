// n8n Code节点：新游戏表格清洗器
// 功能：
//   1. 识别 english_name 列表中的新游戏（当前示例为 "Aero Rush"）
//   2. 遍历 sheet valueRange 数据，读取第一行第一列作为表名
//   3. 自动定位表头行，清除 null/空值，并输出“列名 -> 值”的映射结构
//   4. 仅保留匹配新游戏的行，常见字段会默认转换（如日期 Excel 序号 -> ISO 日期）

const inputs = $input.all();
if (!inputs || inputs.length === 0) {
  throw new Error("❌ 未收到任何输入数据");
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = cleanString(value).replace(/,/g, "");
  if (cleaned === "") return null;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeCell(header, value) {
  if (value === null || value === undefined) return null;
  const headerKey = cleanString(header).toLowerCase();

  if (headerKey.includes("日期") || headerKey.includes("date")) {
    const iso = excelSerialToISO(value);
    if (iso) return iso;
  }

  const numeric = toNumber(value);
  if (numeric !== null) return numeric;

  const str = cleanString(value);
  return str === "" ? null : str;
}

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
newGameEntries.forEach(entry => {
  const name = cleanString(entry.english_name);
  if (!name) return;
  newGameNameSet.add(name.toLowerCase());
});

const sheetEntries = rawItems.slice(newGameEntries.length);

function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const lower = row.map(cell => cleanString(cell).toLowerCase());
    if (lower.includes("游戏名") || lower.includes("game name")) {
      return i;
    }
  }
  return -1;
}

function parseTitleMeta(title) {
  const cleaned = cleanString(title);
  if (!cleaned) return { title: "", period: null, dataType: null };

  const periodMatch = cleaned.match(/(20\d{6})-(\d{4})/);
  let period = null;
  if (periodMatch) {
    const start = periodMatch[1];
    const endSuffix = periodMatch[2];
    const end = `${start.slice(0, 4)}${endSuffix}`;
    if (start.length === 8 && end.length === 8) {
      period = {
        start: `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6)}`,
        end: `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6)}`
      };
    }
  }

  let dataType = null;
  const typeMatch = cleaned.replace(/[0-9\-]/g, "").trim();
  if (typeMatch) dataType = typeMatch;

  return { title: cleaned, period, dataType };
}

const results = [];

sheetEntries.forEach(entry => {
  const values = entry?.data?.valueRange?.values || entry?.valueRange?.values;
  if (!Array.isArray(values) || values.length === 0) return;

  const { title, period, dataType } = parseTitleMeta(values?.[0]?.[0]);

  const headerIndex = findHeaderRowIndex(values);
  if (headerIndex === -1) return;

  const headerRow = values[headerIndex].map(header => cleanString(header));

  const cleanedHeaders = headerRow.map(header => header || null);

  const allRows = [];
  const newGameRows = [];

  for (let i = headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;

    const record = {};
    for (let col = 0; col < cleanedHeaders.length; col++) {
      const header = cleanedHeaders[col];
      if (!header) continue;
      const cellValue = normalizeCell(header, row[col]);
      if (cellValue === null || cellValue === "") continue;
      record[header] = cellValue;
    }

    if (Object.keys(record).length === 0) continue;
    allRows.push(record);

    const gameName = cleanString(record["游戏名"] || record["Game Name"]);
    if (!gameName) continue;
    if (!newGameNameSet.has(gameName.toLowerCase())) continue;

    newGameRows.push(record);
  }

  if (allRows.length === 0) return;

  results.push({
    tableTitle: title,
    dataType,
    period,
    headers: cleanedHeaders.filter(Boolean),
    rows: allRows,
    newGameRows
  });
});

if (results.length === 0) {
  throw new Error("❌ 未在任何表中找到匹配的新游戏数据");
}

return results.map(result => ({ json: result }));
