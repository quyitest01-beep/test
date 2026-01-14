// n8n Code节点：AI评级留存指标标准化器
// 作用：
//  1. 从 Lark/Excel 行级数据中提取“范围 - 指标 - 数值”结构
//  2. 识别全游戏/目标游戏范围，解析 D1/D7 等周期与用户/留存率数值
//  3. 输出便于后续 AI 评级提示词使用的结构化 JSON（层级结构 + 平铺列表）

const inputs = $input.all();

if (!inputs || inputs.length === 0) {
  throw new Error("❌ 未收到任何输入数据");
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value).replace(/[,，\s]/g, "");
  if (!normalized.length) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePercent = (value) => {
  const str = cleanString(value);
  if (!str) return null;
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const percent = Number(match[0]);
  if (!Number.isFinite(percent)) return null;
  return {
    percent,
    ratio: Number((percent / 100).toFixed(6)),
    display: str.endsWith("%") ? str : `${percent}%`,
  };
};

const looksLikeHeader = (row) => {
  if (!Array.isArray(row)) return false;
  const joined = row.map((cell) => cleanString(cell)).join("|");
  return /范围|指标|数值|类型/i.test(joined);
};

const categoryCatalog = [
  { key: "new_user_retention", label: "新用户留存", keywords: ["新用户留存", "新留存"] },
  { key: "active_user_retention", label: "活跃用户留存", keywords: ["活跃留存", "活跃用户留存"] },
  { key: "active_users", label: "活跃用户", keywords: ["活跃用户", "活跃人数", "活跃用户数"] },
  { key: "new_users", label: "新用户", keywords: ["新用户", "新增用户"] },
];

const metricCatalog = [
  { key: "users", label: "用户数", keywords: ["用户", "人数", "数量"] },
  { key: "retentionRate", label: "留存率", keywords: ["留存率", "Retention"] },
  { key: "amount", label: "金额", keywords: ["金额", "投注额", "流水"] },
  { key: "payout", label: "派奖", keywords: ["派奖", "Payout"] },
];

const identifyFromCatalog = (catalog, value, fallbackKey = "unknown", fallbackLabel = "未知") => {
  const text = cleanString(value);
  if (!text) return { key: fallbackKey, label: fallbackLabel };
  const lower = text.toLowerCase();

  for (const item of catalog) {
    if (item.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return { key: item.key, label: item.label, original: text };
    }
  }

  return { key: fallbackKey, label: fallbackLabel, original: text };
};

const parseMetricLabel = (rawLabel) => {
  const full = cleanString(rawLabel);
  if (!full) return null;

  // 支持 “新用户留存 - D7 用户” / “新用户留存-D1 留存率”
  const parts = full.split(/\s*-\s*/);
  if (parts.length < 2) return null;

  const categoryPart = cleanString(parts[0]);
  const remainder = cleanString(parts.slice(1).join("-"));

  const tokens = remainder.split(/\s+/).filter(Boolean);
  let period = null;
  let metricPart = null;

  if (tokens.length >= 2) {
    period = tokens.shift();
    metricPart = tokens.join(" ");
  } else if (tokens.length === 1) {
    metricPart = tokens[0];
  }

  const periodMatch = period ? period.match(/^D?\d+/i) : null;
  const normalizedPeriod = periodMatch ? periodMatch[0].toUpperCase() : null;

  const category = identifyFromCatalog(categoryCatalog, categoryPart, "misc", categoryPart || "未识别类别");
  const metric = identifyFromCatalog(metricCatalog, metricPart || "", "value", metricPart || "指标");

  return {
    raw: full,
    category,
    period: normalizedPeriod,
    periodLabel: period || null,
    metric,
  };
};

const normalizeScope = (rawScope) => {
  const text = cleanString(rawScope);
  if (!text) {
    return { key: "unknown", label: "", original: rawScope };
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (/^(all|全部|全游戏)$/i.test(normalized) || normalized === "全游戏") {
    return { key: "global", label: "全游戏", original: text };
  }
  return {
    key: normalized.toLowerCase().replace(/[^\w]+/g, "_"),
    label: normalized,
    original: text,
  };
};

const rows = [];
const periodCandidates = [];

const normalizeDateDigits = (value) => {
  const str = cleanString(value).replace(/\D/g, "");
  if (/^20\d{6}$/.test(str)) {
    return str;
  }
  return null;
};

const toISODate = (yyyymmdd) => {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}`;
};

const collectPeriod = (node, path = []) => {
  if (!node || typeof node !== "object") return;
  const weekStart = node.WeekStart ?? node.weekStart ?? node.week_start ?? null;
  const weekEnd = node.WeekEnd ?? node.weekEnd ?? node.week_end ?? null;
  if (weekStart && weekEnd) {
    const startDigits = normalizeDateDigits(weekStart);
    const endDigits = normalizeDateDigits(weekEnd);
    if (startDigits && endDigits) {
      periodCandidates.push({
        start: startDigits,
        end: endDigits,
        source: path.join(".") || "root",
      });
    }
  }
  Object.entries(node).forEach(([key, value]) => {
    if (value && typeof value === "object") {
      collectPeriod(value, path.concat(key));
    }
  });
};

const collectRows = (node, path = []) => {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    if (node.length && node.every((cell) => !Array.isArray(cell) && typeof cell !== "object")) {
      rows.push({ row: node, source: path.join(".") || "array" });
    } else {
      node.forEach((child, index) => collectRows(child, path.concat(index)));
    }
    return;
  }

  if (typeof node === "object") {
    if (Array.isArray(node.values)) {
      collectRows(node.values, path.concat("values"));
    }
    if (Array.isArray(node.value)) {
      collectRows(node.value, path.concat("value"));
    }
    if (Array.isArray(node.rows)) {
      collectRows(node.rows, path.concat("rows"));
    }
    if (node.data?.valueRange?.values) {
      collectRows(node.data.valueRange.values, path.concat("data.valueRange.values"));
    }
    if (node.valueRange?.values) {
      collectRows(node.valueRange.values, path.concat("valueRange.values"));
    }
    Object.entries(node).forEach(([key, child]) => {
      if (["values", "value", "rows", "data", "valueRange"].includes(key)) return;
      collectRows(child, path.concat(key));
    });
  }
};

inputs.forEach((item, index) => {
  if (item?.json) {
    collectPeriod(item.json, [`input[${index}].json`]);
    collectRows(item.json, [`input[${index}].json`]);
  } else {
    collectPeriod(item, [`input[${index}]`]);
    collectRows(item, [`input[${index}]`]);
  }
});

const structured = {};
const flatMetrics = [];
const invalidRows = [];

const ensureStructuredPath = (scopeKey, categoryKey, period) => {
  if (!structured[scopeKey]) {
    structured[scopeKey] = {};
  }
  if (!structured[scopeKey][categoryKey]) {
    structured[scopeKey][categoryKey] = {};
  }
  if (period && !structured[scopeKey][categoryKey][period]) {
    structured[scopeKey][categoryKey][period] = {};
  }
  return structured[scopeKey][categoryKey][period || "aggregate"];
};

rows.forEach(({ row, source }, index) => {
  if (!Array.isArray(row)) return;
  if (row.length === 0) return;
  if (looksLikeHeader(row)) return;

  const [scopeCell, labelCell, valueCell, remarkCell] = row;
  const scope = normalizeScope(scopeCell);
  const parsedLabel = parseMetricLabel(labelCell);

  if (!parsedLabel) {
    invalidRows.push({
      index,
      source,
      row,
      reason: "无法解析指标标签",
    });
    return;
  }

  const remark = cleanString(remarkCell);
  const numberValue = toNumber(valueCell);
  const percentValue = parsePercent(valueCell);

  const valuePayload = (() => {
    if (percentValue) {
      return {
        value: percentValue.ratio,
        percent: percentValue.percent,
        display: percentValue.display,
        raw: cleanString(valueCell),
        type: "percentage",
      };
    }
    if (numberValue !== null) {
      return {
        value: numberValue,
        display: String(numberValue),
        raw: cleanString(valueCell),
        type: "number",
      };
    }
    const text = cleanString(valueCell);
    return {
      value: null,
      display: text || null,
      raw: text,
      type: "text",
    };
  })();

  const record = {
    scopeKey: scope.key,
    scopeLabel: scope.label,
    categoryKey: parsedLabel.category.key,
    categoryLabel: parsedLabel.category.label,
    period: parsedLabel.period,
    periodLabel: parsedLabel.periodLabel,
    metricKey: parsedLabel.metric.key,
    metricLabel: parsedLabel.metric.label,
    value: valuePayload.value,
    valueType: valuePayload.type,
    percent: valuePayload.percent ?? null,
    display: valuePayload.display,
    rawValue: valuePayload.raw,
    remark: remark || null,
    sourceRow: row,
    sourcePath: source,
  };

  flatMetrics.push(record);

  const container = ensureStructuredPath(scope.key, parsedLabel.category.key, parsedLabel.period);
  const metricKey = parsedLabel.metric.key;

  container[metricKey] = {
    value: record.value,
    percent: record.percent,
    display: record.display,
    raw: record.rawValue,
    remark: record.remark,
  };
});

if (flatMetrics.length === 0) {
  throw new Error("❌ 未能提取到任何有效的留存指标数据");
}

let periodRange = null;
if (periodCandidates.length > 0) {
  const first = periodCandidates[0];
  periodRange = {
    start: first.start,
    end: first.end,
    startISO: toISODate(first.start),
    endISO: toISODate(first.end),
    label: `${first.start}-${first.end}`,
    source: first.source,
  };
}

const summary = {
  rowCount: rows.length,
  validMetrics: flatMetrics.length,
  invalidRows: invalidRows.length,
  scopes: Array.from(new Set(flatMetrics.map((item) => item.scopeKey))),
  categories: Array.from(new Set(flatMetrics.map((item) => item.categoryKey))),
  periodRange,
};

return [
  {
    json: {
      summary,
      structuredMetrics: structured,
      flatMetrics,
      invalidRows,
      meta: {
        generatedAt: new Date().toISOString(),
        excelEpochUtc: EXCEL_EPOCH_UTC,
        periodRange,
      },
    },
  },
];

