// n8n Code节点：Lark 游戏评级表写入器
// 作用：
// 1. 从输入中收集 tenant_token、表名、lark_tables、Sheet 列表
// 2. 精确匹配 lark_tables 中每个表对应的 Sheet（根据 sheet_name）
// 3. 将 lark_tables 中的数据写入到对应的 Sheet
// 4. 构建 Lark values_batch_update HTTP 请求配置

const inputs = $input.all();
if (!inputs?.length) {
  throw new Error("❌ 未收到任何输入数据");
}

// ------------------------------------------------------------------
// 基础工具函数
const normalizeString = (value) =>
  value === null || value === undefined ? null : String(value).trim();

const normalizeTitle = (value) => {
  const str = normalizeString(value);
  if (!str) return null;
  return str.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
};

const sheetTitleEquals = (a, b) => {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  return normA && normB && normA === normB;
};

const columnNumberToName = (number) => {
  let n = Number(number);
  if (!Number.isFinite(n) || n <= 0) return "A";
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

// ------------------------------------------------------------------
// 收集关键输入
let tenantToken = null;
let ratingPayload = null;
let spreadsheetToken = null;
const sheetBundles = [];

const extractSheetBundle = (node) => {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.sheets) || Array.isArray(node.replies) || node.spreadsheetToken) {
    return {
      sheets: Array.isArray(node.sheets) ? node.sheets : [],
      replies: Array.isArray(node.replies) ? node.replies : [],
      spreadsheetToken: node.spreadsheetToken || null,
    };
  }
  const candidates = [
    node.data,
    node.data && node.data.data,
    node[0],
    node[0] && node[0].data,
    node[0] && node[0].data && node[0].data.data,
  ];
  for (const child of candidates) {
    if (child && typeof child === "object") {
      const hit = extractSheetBundle(child);
      if (hit) return hit;
    }
  }
  return null;
};

inputs.forEach((wrapper) => {
  const item = wrapper?.json;
  if (!item) return;

  // 收集 tenant_token
  const tokenCandidate = item.tenant_token || item.tenant_access_token;
  if (!tenantToken && tokenCandidate) {
    tenantToken = tokenCandidate;
  }

  // 收集游戏评级数据（包含 lark_tables）
  if (!ratingPayload && item.lark_tables && item.game_level_table) {
    ratingPayload = item;
  }

  // 收集 Sheet 信息
  if (item.code === 0 && item.data) {
    const bundle =
      Array.isArray(item.data.sheets) || Array.isArray(item.data.replies) || item.data.spreadsheetToken
        ? {
            sheets: item.data.sheets || [],
            replies: item.data.replies || [],
            spreadsheetToken: item.data.spreadsheetToken || null,
          }
        : extractSheetBundle(item);
    if (bundle) sheetBundles.push(bundle);
  } else {
    const fallback = extractSheetBundle(item);
    if (fallback) sheetBundles.push(fallback);
  }
});

if (!tenantToken) {
  throw new Error("❌ 未找到 tenant_token");
}
if (!ratingPayload) {
  throw new Error("❌ 未找到 lark_tables 数据");
}

// ------------------------------------------------------------------
// 找到 spreadsheetToken 和所有 Sheet 信息
const sheetMap = new Map(); // sheet_name -> { sheetId, title }

for (const bundle of sheetBundles) {
  if (!bundle) continue;

  if (!spreadsheetToken && bundle.spreadsheetToken) {
    spreadsheetToken = bundle.spreadsheetToken;
  }

  // 从 sheets 中收集所有 Sheet 信息
  if (bundle.sheets && Array.isArray(bundle.sheets)) {
    bundle.sheets.forEach((sheet) => {
      if (sheet.sheetId && sheet.title) {
        const normalizedTitle = normalizeTitle(sheet.title);
        if (normalizedTitle && !sheetMap.has(normalizedTitle)) {
          sheetMap.set(normalizedTitle, {
            sheetId: sheet.sheetId,
            title: sheet.title,
          });
        }
      }
    });
  }

  // 从 replies 中收集 Sheet 信息
  if (bundle.replies && Array.isArray(bundle.replies)) {
    bundle.replies.forEach((reply) => {
      if (reply.addSheet && reply.addSheet.properties) {
        const props = reply.addSheet.properties;
        if (props.sheetId && props.title) {
          const normalizedTitle = normalizeTitle(props.title);
          if (normalizedTitle && !sheetMap.has(normalizedTitle)) {
            sheetMap.set(normalizedTitle, {
              sheetId: props.sheetId,
              title: props.title,
            });
          }
        }
      }
    });
  }
}

if (!spreadsheetToken) {
  throw new Error("❌ 未找到 spreadsheetToken");
}

// ------------------------------------------------------------------
// 匹配 lark_tables 中的每个表到对应的 Sheet
const larkTables = ratingPayload.lark_tables || {};
const tableMappings = [];

// 需要写入的表列表
const tableKeys = [
  "game_level_table",
  "platform_game_level_table",
  "platform_level_table",
  "game_platform_ratio_table",
];

tableKeys.forEach((tableKey) => {
  const tableData = larkTables[tableKey];
  if (!tableData || !tableData.values || !Array.isArray(tableData.values)) {
    console.warn(`⚠️ 表 "${tableKey}" 数据无效或为空，跳过`);
    return;
  }

  const sheetName = tableData.sheet_name || tableKey;
  const normalizedSheetName = normalizeTitle(sheetName);
  
  // 查找匹配的 Sheet
  let matchedSheet = null;
  if (normalizedSheetName && sheetMap.has(normalizedSheetName)) {
    matchedSheet = sheetMap.get(normalizedSheetName);
  } else {
    // 尝试模糊匹配
    for (const [normalizedTitle, sheetInfo] of sheetMap.entries()) {
      if (sheetTitleEquals(sheetName, sheetInfo.title)) {
        matchedSheet = sheetInfo;
        break;
      }
    }
  }

  if (!matchedSheet) {
    console.warn(`⚠️ 未找到标题为 "${sheetName}" 的 Sheet，跳过表 "${tableKey}"`);
    return;
  }

  // 计算列数和范围
  const values = tableData.values;
  const rowCount = values.length;
  const colCount = rowCount > 0 ? values[0].length : 0;
  
  if (rowCount === 0 || colCount === 0) {
    console.warn(`⚠️ 表 "${tableKey}" 数据为空，跳过`);
    return;
  }

  const range = `${matchedSheet.sheetId}!A1:${columnNumberToName(colCount)}${rowCount}`;

  tableMappings.push({
    table_key: tableKey,
    sheet_name: sheetName,
    sheet_id: matchedSheet.sheetId,
    sheet_title: matchedSheet.title,
    values: values,
    range: range,
    row_count: rowCount,
    col_count: colCount,
  });
});

if (tableMappings.length === 0) {
  throw new Error("❌ 没有找到任何可写入的表");
}

// ------------------------------------------------------------------
// 构建 Lark 写入请求
// 可以批量写入多个表，或者分别写入
const valueRanges = tableMappings.map((mapping) => ({
  range: mapping.range,
  values: mapping.values,
}));

const httpRequest = {
  method: "POST",
  url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
  headers: {
    Authorization: `Bearer ${tenantToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    valueRanges: valueRanges,
  }),
};

// ------------------------------------------------------------------
// 输出结果
console.log("=== Lark 游戏评级表写入数据准备完成 ===");
console.log("表名:", ratingPayload.table_name);
console.log("目标游戏:", ratingPayload.target_game?.english_name || ratingPayload.target_game?.game_code || "未知");
console.log("匹配到 Sheet 数量:", tableMappings.length);
tableMappings.forEach((mapping) => {
  console.log(`  - ${mapping.sheet_name}: ${mapping.sheet_title} (ID: ${mapping.sheet_id}, 行数: ${mapping.row_count})`);
});

const output = {
  status: "success",
  table_name: ratingPayload.table_name,
  target_game: ratingPayload.target_game,
  spreadsheet_token: spreadsheetToken,
  tenant_token: tenantToken,
  table_mappings: tableMappings,
  http_request: httpRequest,
  lark_request_body: httpRequest.body,
  meta: {
    total_tables: tableMappings.length,
    total_rows: tableMappings.reduce((sum, m) => sum + m.row_count, 0),
    game_level_table_rows: tableMappings.find((m) => m.table_key === "game_level_table")?.row_count || 0,
    platform_game_level_table_rows: tableMappings.find((m) => m.table_key === "platform_game_level_table")?.row_count || 0,
    platform_level_table_rows: tableMappings.find((m) => m.table_key === "platform_level_table")?.row_count || 0,
    game_platform_ratio_table_rows: tableMappings.find((m) => m.table_key === "game_platform_ratio_table")?.row_count || 0,
    stat_date: ratingPayload.meta?.stat_date,
    week_start: ratingPayload.meta?.week_start,
    week_end: ratingPayload.meta?.week_end,
  },
};

return [
  {
    json: output,
  },
];

