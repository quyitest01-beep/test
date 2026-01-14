// 游戏表格名称生成器（兼容中文字段上游格式）
// 输入可能包含：
// 1) { code: 0, tenant_access_token: "..." }
// 2) { 日期: "合计"|"YYYYMMDD", 游戏名: "...", 投注用户数: 123 }
// 3) 旧格式：{ date_str: "YYYYMMDD"|"合计", game: "...", daily_unique_users: "123" }

const inputs = $input.all();
console.log("=== 游戏表格名称生成器开始（兼容中文字段） ===");
console.log(`输入数据项数: ${inputs.length}`);

if (inputs.length === 0) {
  console.error("❌ 没有输入数据");
  return [];
}

let tenantAccessToken = null;
const buckets = {
  game_users: [],
  game_act: [],
  game_new: [],
};
let primaryType = null;
const dateSet = new Set();
const monthSet = new Set();

const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const normalizeDate = (raw) => {
  const str = normalizeString(raw);
  if (!str) return null;
  if (str === "合计" || str === "总计") return str;
  if (/^\d{8}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str.replace(/-/g, "");
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
    return str.replace(/\//g, "");
  }
  return null;
};

const normalizeCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  const str = String(value).replace(/[,，\s]/g, "");
  if (!str.length) return null;
  const num = Number(str);
  if (Number.isFinite(num)) {
    return String(Math.round(num));
  }
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? null : String(parsed);
};

const normalizeRate = (value) => {
  const str = normalizeString(value);
  if (!str) return null;
  if (str.includes("%")) return str;
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return `${str}%`;
  }
  return str;
};

const possibleGameNameKeys = [
  "游戏名",
  "游戏名称",
  "game",
  "game_name",
  "english_name",
  "gameName",
  "game_title",
];

const possibleDateKeys = [
  "日期",
  "date_str",
  "date",
  "stat_date",
  "dt",
  "day",
  "record_date",
  "new_date",
  "cohort_date",
  "start_date",
  "end_date",
  "month_str",
  "period_range",
  "week_start",
  "weekEnd",
  "week_end",
  "week",
  "dateStr",
];

const possibleCountKeys = [
  "投注用户数",
  "投注用户",
  "daily_unique_users",
  "daily_users",
  "unique_users",
  "active_users",
  "users",
  "value",
  "count",
  "d0_users",
  "weekly_unique_users",
  "monthly_unique_users",
  "total_amount",
  "ggr",
];

const allowedDataTypes = new Set([
  "game_daily",
  "game_users",
  "game_act",
  "game_new",
]);

const normalizePeriod = (record) => {
  const raw = normalizeString(
    record.period_range ||
      record.period ||
      record.range ||
      record.week_range ||
      record.week_period,
  );
  if (!raw) return null;
  const match = raw.match(/(20\d{6})/g);
  if (match && match.length > 0) {
    return match[0];
  }
  return null;
};

const normalizeMonth = (value) => {
  const str = normalizeString(value);
  if (!str) return null;
  if (/^\d{6}$/.test(str)) {
    return `${str}01`;
  }
  return null;
};

const detectRecordType = (record, lowerDataType) => {
  if (lowerDataType && allowedDataTypes.has(lowerDataType)) {
    return lowerDataType;
  }
  if (record.d0_users !== undefined || record.d1_users !== undefined) {
    if (record.cohort_date !== undefined || lowerDataType === "game_act") {
      return "game_act";
    }
    return "game_new";
  }
  if (
    record.daily_unique_users !== undefined ||
    record.weekly_unique_users !== undefined ||
    record.monthly_unique_users !== undefined ||
    record.bet_users !== undefined
  ) {
    return "game_users";
  }
  return null;
};

const pushRecord = (type, record) => {
  if (!type) return;
  if (!primaryType) {
    primaryType = type;
  }
  buckets[type].push(record);
};

const collectRecord = (record) => {
  if (!record || typeof record !== "object") return;

  if (record.code === 0 && record.tenant_access_token) {
    tenantAccessToken = record.tenant_access_token;
    console.log(
      `🔑 识别到token: ${tenantAccessToken.substring(0, 16)}...`,
    );
  }

  const gameName = possibleGameNameKeys.reduce((acc, key) => {
    if (acc) return acc;
    return normalizeString(record[key]);
  }, null);

  let rawDate;
  for (const key of possibleDateKeys) {
    if (record[key] !== undefined) {
      rawDate = record[key];
      break;
    }
  }

  const explicitMonth = normalizeString(record.month_str);
  if (explicitMonth && /^\d{6}$/.test(explicitMonth)) {
    monthSet.add(explicitMonth);
  }

  let dateStr = normalizeDate(rawDate);
  if (!dateStr) {
    dateStr = normalizeMonth(rawDate);
  }
  if (!dateStr) {
    const derived = normalizePeriod(record);
    if (derived) {
      dateStr = derived;
    }
  }

  let countValue = null;
  let metricKey = null;
  for (const key of possibleCountKeys) {
    if (record[key] !== undefined) {
      countValue = record[key];
      metricKey = key;
      break;
    }
  }

  const dataType = normalizeString(record.dataType || record.stat_type);
  const lowerType = dataType?.toLowerCase();
  const recordType = detectRecordType(record, lowerType);

  const validDate =
    dateStr === "合计" ||
    dateStr === "总计" ||
    (dateStr && /^\d{8}$/.test(dateStr));

  if (!gameName || !validDate || !recordType) {
    return;
  }

  if (dateStr && /^\d{8}$/.test(dateStr)) {
    monthSet.add(dateStr.slice(0, 6));
    dateSet.add(dateStr);
  }

if (recordType === "game_users") {
    const metricRaw =
      record.daily_unique_users !== undefined
        ? record.daily_unique_users
        : record.weekly_unique_users !== undefined
        ? record.weekly_unique_users
        : record.monthly_unique_users !== undefined
        ? record.monthly_unique_users
        : record.bet_users !== undefined
        ? record.bet_users
        : countValue;
    const metric = normalizeCount(metricRaw);
    if (metric === null) return;
    const normalized = {
      date_str: dateStr,
      month_str: explicitMonth || (dateStr ? dateStr.slice(0, 6) : null),
      game_id: normalizeString(record.game_id),
      game: gameName,
      data_type: recordType,
      metric_key:
        (record.daily_unique_users !== undefined && "daily_unique_users") ||
        (record.weekly_unique_users !== undefined && "weekly_unique_users") ||
        (record.monthly_unique_users !== undefined && "monthly_unique_users") ||
        (record.bet_users !== undefined && "bet_users") ||
        (countValue !== null && "value") ||
        null,
      metric_value: metric,
      raw_metric_field: metricKey || null,
      daily_unique_users: metric,
    };
    pushRecord(recordType, normalized);
    return;
  }

  if (recordType === "game_new" || recordType === "game_act") {
    const d0 = normalizeCount(record.d0_users);
    const d1 = normalizeCount(record.d1_users);
    const d3 = normalizeCount(record.d3_users);
    const d7 = normalizeCount(record.d7_users);
    const hasAny = d0 !== null || d1 !== null || d3 !== null || d7 !== null;
    if (!hasAny) return;
    const normalized = {
      date_str: dateStr,
      month_str: explicitMonth || (dateStr ? dateStr.slice(0, 6) : null),
      game_id: normalizeString(record.game_id),
      data_type: recordType,
      original_date_field:
        (record.new_date && "new_date") ||
        (record.cohort_date && "cohort_date") ||
        (record.date_str && "date_str") ||
        null,
      original_date_value:
        record.new_date ?? record.cohort_date ?? record.date_str ?? null,
      game: gameName,
      d0_users: d0,
      d1_users: d1,
      d3_users: d3,
      d7_users: d7,
      d1_retention_rate: normalizeRate(record.d1_retention_rate),
      d3_retention_rate: normalizeRate(record.d3_retention_rate),
      d7_retention_rate: normalizeRate(record.d7_retention_rate),
    };
    pushRecord(recordType, normalized);
    return;
  }
};

const traverse = (node) => {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach(traverse);
    return;
  }
  if (typeof node !== "object") return;

  collectRecord(node);
  Object.values(node).forEach(traverse);
};

inputs.forEach((inputItem, index) => {
  const payload = inputItem?.json;
  console.log(
    `🔍 处理输入项 ${index}:`,
    JSON.stringify(payload, null, 2).substring(0, 200) + "...",
  );
  traverse(payload);
});

console.log(`🔑 收集到token: ${tenantAccessToken ? "是" : "否"}`);
console.log(
  "🎮 数据分类统计:",
  Object.fromEntries(
    Object.entries(buckets).map(([key, arr]) => [key, arr.length]),
  ),
);

if (!tenantAccessToken) {
  console.error("❌ 没有找到tenant_access_token，无法继续处理");
  return [];
}
if (!primaryType || buckets[primaryType].length === 0) {
  console.error("❌ 没有找到可用的游戏数据，无法继续处理");
  return [];
}

const sortedDates = Array.from(dateSet).sort();
const sortedMonths = Array.from(monthSet).sort();
console.log("📅 发现的日期:", sortedDates);
console.log("📆 发现的月份:", sortedMonths);

let tableName = "";
let dateRangeValue = null;
if (sortedMonths.length > 0) {
  if (sortedMonths.length === 1) {
    tableName = `${sortedMonths[0]}游戏活跃用户数`;
    dateRangeValue = sortedMonths[0];
  } else {
    tableName = `${sortedMonths[0]}-${sortedMonths[sortedMonths.length - 1]}游戏活跃用户数`;
    dateRangeValue = `${sortedMonths[0]}-${sortedMonths[sortedMonths.length - 1]}`;
  }
} else if (sortedDates.length > 0) {
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  tableName = `${startDate}-${endDate.substring(6)}游戏活跃用户数`;
  dateRangeValue = `${startDate}-${endDate}`;
} else {
  const today = new Date();
  let year = today.getFullYear();
  let monthIndex = today.getMonth(); // 当前月份（0-11）
  monthIndex -= 1; // 账单期间为当前月份的前一个自然月
  if (monthIndex < 0) {
    year -= 1;
    monthIndex = 11;
  }
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  };
  const start = formatDate(firstDay);
  const end = formatDate(lastDay);
  tableName = `${start}-${end.substring(6)}游戏活跃用户数`;
  dateRangeValue = `${start}-${end}`;
}

const deduped = [];
const seen = new Set();
const selected = buckets[primaryType];
selected.forEach((row) => {
  const key = `${row.date_str || "合计"}__${row.game_id || row.game}__${row.metric_key || ""}`;
  if (!seen.has(key)) {
    seen.add(key);
    deduped.push(row);
  }
});

const tableSuffixMap = {
  game_users: "游戏活跃用户数",
  game_act: "游戏活跃留存",
  game_new: "游戏新用户留存",
};

const suffix = tableSuffixMap[primaryType] || "游戏数据";
tableName = tableName.replace(/游戏活跃用户数$/, suffix);
tableName = tableName.replace(/游戏数据$/, suffix);

console.log(`📋 生成表名: ${tableName}（类型: ${primaryType}）`);

const outputData = {
  table_name: tableName,
  tenant_access_token: tenantAccessToken,
  data_type: primaryType,
  game_data: deduped,
  data_count: deduped.length,
  date_range: dateRangeValue,
  generated_at: new Date().toISOString(),
};

console.log("输出数据概览:", {
  table_name: outputData.table_name,
  data_count: outputData.data_count,
  date_range: outputData.date_range,
});

return [{ json: outputData }];


