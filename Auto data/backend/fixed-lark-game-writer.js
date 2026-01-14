// n8n Function节点：Lark游戏数据写入器 (修复版)
// 处理游戏活跃用户数据，使用上游提供的合计数值，不重复计算

async function execute() {
  const inputItems = $input.all();
  
  try {
    console.log("=== 开始处理游戏数据写入Lark表格 (修复版) ===");

    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 获取API响应数据
    const apiResponse = getApiResponse(inputItems);
    // 获取游戏数据
    const gameData = getGameData(inputItems);
    // 获取tenant_access_token
    const tenantAccessToken = getTenantAccessToken(inputItems);
    // 获取表名
    const tableName = getTableName(inputItems);

    if (!apiResponse) {
      throw new Error("缺少API响应数据，无法获取sheet信息");
    }
    if (!gameData || !Array.isArray(gameData) || gameData.length === 0) {
      throw new Error("游戏数据无效或为空");
    }
    if (!tenantAccessToken) {
      throw new Error("缺少tenant_access_token，无法构建请求");
    }
    if (!tableName) {
      throw new Error("缺少表名，无法匹配sheet");
    }

    console.log("找到游戏数据，数量:", gameData.length);
    console.log("找到tenant_access_token:", tenantAccessToken ? `${tenantAccessToken.substring(0, 10)}...` : "未找到");
    console.log("找到表名:", tableName);

    // 获取fallback spreadsheetToken（有些replies没有返回token）
    const fallbackSpreadsheetToken = findSpreadsheetTokenInInputs(inputItems);

    // 获取sheet信息
    const sheetInfo = getSheetInfo(apiResponse, tableName, fallbackSpreadsheetToken);
    if (!sheetInfo) {
      throw new Error("无法获取sheet信息");
    }

    console.log("找到sheet信息:", sheetInfo.title, "(ID:", sheetInfo.sheetId + ")");

    // 构建优化版的Lark表格数据（使用上游合计值）
    const { tableData: larkTableData, detectedType } = buildOptimizedTableData(gameData);

    // 构建写入数据的HTTP请求配置
    const writeHttpRequest = buildLarkSheetsWriteRequest(
      larkTableData,
      sheetInfo.spreadsheetToken,
      sheetInfo.sheetId,
      tenantAccessToken
    );

    console.log("=== 构建完成 ===");
    console.log("检测到数据类型:", detectedType);
    console.log("表格行数:", larkTableData.length);
    console.log("写入HTTP请求配置已准备");

    return [{
      json: {
        status: "success",
        message: "Lark表格数据构建完成 (修复版)",
        timestamp: new Date().toISOString(),
        table_name: tableName,
        sheet_id: sheetInfo.sheetId,
        sheet_title: sheetInfo.title,
        spreadsheet_token: sheetInfo.spreadsheetToken,
        tenant_access_token: tenantAccessToken,
        data_type: detectedType,
        game_data: gameData,
        data_count: gameData.length,
        // Lark API需要的字段
        lark_request_body: writeHttpRequest.body,
        headers: larkTableData[0] || [],
        values: larkTableData,
        range: writeHttpRequest.range,
        http_request: writeHttpRequest,
        statistics: {
          total_rows: larkTableData.length,
          total_games: getUniqueGames(gameData).length,
          total_users: getTotalUsers(gameData, detectedType),
          data_type: detectedType
        },
        matched_at: new Date().toISOString()
      }
    }];

  } catch (error) {
    console.error("=== 处理游戏数据写入时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: inputItems ? inputItems.length : "无法获取",
          game_data_type: inputItems && inputItems[0] ? typeof inputItems[0].json : "无数据",
          game_data_keys: inputItems && inputItems[0] && inputItems[0].json ? Object.keys(inputItems[0].json) : "无数据"
        }
      }
    }];
  }
}

// 构建优化版的Lark表格数据，兼容活跃用户与留存数据
function buildOptimizedTableData(gameData) {
  const detectedType = determinePrimaryType(gameData);
  let tableData;

  if (detectedType === "game_new" || detectedType === "game_act") {
    tableData = buildRetentionTableData(gameData, detectedType);
  } else {
    tableData = buildActiveUserTableData(gameData);
  }

  console.log("=== 表格数据验证 ===");
  console.log("数据类型:", detectedType);
  console.log("总行数:", tableData.length);
  console.log("表头列数:", tableData[0] ? tableData[0].length : 0);

  return { tableData, detectedType };
}

function determinePrimaryType(gameData) {
  const counts = {
    game_users: 0,
    game_act: 0,
    game_new: 0,
  };

  gameData.forEach((item) => {
    const rawType = normalizeString(item.data_type || item.dataType || item.stat_type);
    const lowerType = rawType ? rawType.toLowerCase() : "";
    if (counts[lowerType] !== undefined) {
      counts[lowerType] += 1;
      return;
    }
    if (item.cohort_date !== undefined) {
      counts.game_act += 1;
      return;
    }
    if (
      item.d0_users !== undefined ||
      item.d1_users !== undefined ||
      item.d3_users !== undefined ||
      item.d7_users !== undefined
    ) {
      counts.game_new += 1;
      return;
    }
    if (
      item.metric_value !== undefined ||
      item.daily_unique_users !== undefined ||
      item.weekly_unique_users !== undefined ||
      item.monthly_unique_users !== undefined
    ) {
      counts.game_users += 1;
      return;
    }
  });

  const order = ["game_users", "game_act", "game_new"];
  let bestType = "game_users";
  let bestCount = -1;
  order.forEach((type) => {
    if (counts[type] > bestCount) {
      bestCount = counts[type];
      bestType = type;
    }
  });
  return bestType;
}

function buildActiveUserTableData(gameData) {
  const tableData = [];
  tableData.push(["游戏名", "日期", "投注用户数"]);

  const sortedGames = [...gameData].sort((a, b) => {
    const nameA = (a.game || a.game_id || "").toUpperCase();
    const nameB = (b.game || b.game_id || "").toUpperCase();
    return nameA.localeCompare(nameB);
  });

  console.log("游戏排序结果:", sortedGames.map((g) => g.game || g.game_id));

  const gameGroups = groupByGame(sortedGames);

  Object.keys(gameGroups).forEach((gameName) => {
    const series = gameGroups[gameName];
    const sortedSeries = [...series].sort((a, b) => {
      const dateA = getComparableDate(a);
      const dateB = getComparableDate(b);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const monthA = normalizeString(a.month_str) || "";
      const monthB = normalizeString(b.month_str) || "";
      return monthA.localeCompare(monthB);
    });

    sortedSeries.forEach((item) => {
      const display = formatMetricDate(item);
      tableData.push([gameName, display, getNumericMetric(item)]);
    });
  });

  return tableData;
}

function getComparableDate(item) {
  const dateStr = normalizeString(item.date_str);
  if (dateStr && /^\d{8}$/.test(dateStr)) {
    return dateStr;
  }
  const month = normalizeString(item.month_str);
  if (month && /^\d{6}$/.test(month)) {
    return `${month}01`;
  }
  return "99999999";
}

function formatMetricDate(item) {
  const dateStr = normalizeString(item.date_str);
  if (dateStr && /^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`;
  }
  const month = normalizeString(item.month_str);
  if (month && /^\d{6}$/.test(month)) {
    return `${month.slice(0, 4)}-${month.slice(4)}`;
  }
  if (item.original_date_value) {
    return item.original_date_value;
  }
  if (dateStr) return dateStr;
  if (month) return month;
  return "";
}

function buildRetentionTableData(gameData, detectedType) {
  const tableData = [
    [
      "游戏名",
      "日期",
      "D0用户",
      "D1用户",
      "D3用户",
      "D7用户",
      "D1留存率",
      "D3留存率",
      "D7留存率",
    ],
  ];

  const sorted = [...gameData].sort((a, b) => {
    const nameA = (a.game || a.game_id || "").toUpperCase();
    const nameB = (b.game || b.game_id || "").toUpperCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return (a.date_str || "").localeCompare(b.date_str || "");
  });

  sorted.forEach((item) => {
    if (item.date_str === "合计" || item.date_str === "总计") {
      return;
    }
    tableData.push([
      item.game || item.game_id || "",
      formatDisplayDate(item),
      toNumberOrEmpty(item.d0_users),
      toNumberOrEmpty(item.d1_users),
      toNumberOrEmpty(item.d3_users),
      toNumberOrEmpty(item.d7_users),
      item.d1_retention_rate || "",
      item.d3_retention_rate || "",
      item.d7_retention_rate || "",
    ]);
  });

  console.log(`留存数据构建完成（${detectedType}），行数:`, tableData.length);
  return tableData;
}

// 构建Lark电子表格写入数据的HTTP请求
function buildLarkSheetsWriteRequest(tableData, spreadsheetToken, targetSheetId, tenantAccessToken) {
  if (!tenantAccessToken) {
    throw new Error("缺少tenant_access_token，无法构建写入请求");
  }

  const columnCount = tableData[0] ? tableData[0].length : 1;
  const lastColumn = columnNumberToName(columnCount);
  const range = `${targetSheetId}!A1:${lastColumn}${tableData.length}`;

  console.log("Lark Sheets写入配置信息:", {
    spreadsheet_token: spreadsheetToken ? `${spreadsheetToken.substring(0, 10)}...` : "未找到",
    target_sheet_id: targetSheetId,
    tenant_access_token: tenantAccessToken ? `${tenantAccessToken.substring(0, 10)}...` : "未找到",
    range,
  });

  const httpRequest = {
    method: "POST",
    url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
    headers: {
      "Authorization": `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      valueRanges: [
        {
          range,
          values: tableData
        }
      ]
    })
  };
  httpRequest.range = range;
  return httpRequest;
}

// 辅助函数：从输入项中获取API响应
function getApiResponse(inputItems) {
  // 优先返回包含 sheets 的响应；若没有，再返回仅包含 replies 的响应
  let sheetsResp = null;
  let repliesResp = null;

  for (const item of inputItems) {
    if (!item || item.json == null) continue;

    // 1) 直接是对象 { code, data }
    if (!Array.isArray(item.json) && item.json.code === 0 && item.json.data) {
      const d = item.json.data;
      if (d && Array.isArray(d.sheets) && d.sheets.length > 0) {
        console.log("🔍 找到包含 sheets 的API响应(对象)");
        sheetsResp = item.json;
      } else if (d && Array.isArray(d.replies) && d.replies.length > 0) {
        console.log("🔍 找到包含 replies 的API响应(对象)");
        repliesResp = item.json;
      }
      continue;
    }

    // 2) json 是数组，取其中 code===0 的元素
    if (Array.isArray(item.json)) {
      const found = item.json.find(el => el && el.code === 0 && el.data);
      if (found) {
        const d = found.data;
        if (d && Array.isArray(d.sheets) && d.sheets.length > 0) {
          console.log("🔍 找到包含 sheets 的API响应(数组元素)");
          sheetsResp = found;
        } else if (d && Array.isArray(d.replies) && d.replies.length > 0) {
          console.log("🔍 找到包含 replies 的API响应(数组元素)");
          repliesResp = found;
        }
      }
    }

    // 3) 深度兜底：不带code，但内部包含 sheets/replies/spreadsheetToken
    const bundle = extractSheetBundleFromAny(item.json);
    if (bundle) {
      console.log("🔍 发现嵌套的sheet结构，构造兼容响应");
      // 兜底也可能有用作 sheetsResp
      if (bundle.sheets && bundle.sheets.length > 0) {
        sheetsResp = { code: 0, data: bundle, msg: "ok" };
      } else if (bundle.replies && bundle.replies.length > 0) {
        repliesResp = { code: 0, data: bundle, msg: "ok" };
      }
    }
  }

  // 如果有包含 sheets 的响应，直接返回
  if (sheetsResp) {
    try { console.log("API响应结构(sheets):", Object.keys(sheetsResp.data)); } catch {}
    return sheetsResp;
  }

  // 如果只有 replies，补齐 spreadsheetToken（从其它输入中找）
  if (repliesResp) {
    if (!repliesResp.data.spreadsheetToken) {
      const token = findSpreadsheetTokenInInputs(inputItems);
      if (token) {
        repliesResp.data.spreadsheetToken = token;
        console.log("ℹ️ 为 replies 响应补齐 spreadsheetToken");
      }
    }
    try { console.log("API响应结构(replies):", Object.keys(repliesResp.data)); } catch {}
    return repliesResp;
  }

  console.log("❌ 未找到API响应数据");
  return null;
}

// 在任意对象里提取 {sheets, replies, spreadsheetToken}
function extractSheetBundleFromAny(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // 直接命中
  if (Array.isArray(obj.sheets) || Array.isArray(obj.replies) || obj.spreadsheetToken) {
    return {
      sheets: Array.isArray(obj.sheets) ? obj.sheets : [],
      replies: Array.isArray(obj.replies) ? obj.replies : [],
      spreadsheetToken: obj.spreadsheetToken
    };
  }

  // 常见路径 data / data.data
  const paths = [
    obj.data,
    obj.data && obj.data.data,
    obj[0],
    obj[0] && obj[0].data,
    obj[0] && obj[0].data && obj[0].data.data
  ];

  for (const node of paths) {
    if (node && typeof node === 'object') {
      const hit = extractSheetBundleFromAny(node);
      if (hit) return hit;
    }
  }
  return null;
}

// 在所有输入项中搜索 spreadsheetToken
function findSpreadsheetTokenInInputs(items) {
  for (const it of items) {
    const j = it && it.json;
    if (!j) continue;
    // 直接字段
    if (typeof j.spreadsheet_token === 'string' && j.spreadsheet_token) return j.spreadsheet_token;
    if (typeof j.spreadsheetToken === 'string' && j.spreadsheetToken) return j.spreadsheetToken;
    const bundle = extractSheetBundleFromAny(j);
    if (bundle && bundle.spreadsheetToken) return bundle.spreadsheetToken;
  }
  return undefined;
}

// 辅助函数：从输入项中获取游戏数据
function getGameData(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.game_data && Array.isArray(item.json.game_data)) {
      return item.json.game_data;
    }
  }
  return null;
}

// 辅助函数：从输入项中获取tenant_access_token
function getTenantAccessToken(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.tenant_access_token) {
      return item.json.tenant_access_token;
    }
  }
  return null;
}

// 辅助函数：从输入项中获取表名
function getTableName(inputItems) {
  for (const item of inputItems) {
    if (item.json && item.json.table_name) {
      return item.json.table_name;
    }
  }
  return null;
}

// 辅助函数：规范化API响应中的data根节点，兼容不同返回结构
function getNormalizedDataRoot(apiResponse) {
  if (!apiResponse || !apiResponse.data) return { sheets: [], replies: [], spreadsheetToken: undefined };
  const root = apiResponse.data;
  // 有些接口会把实际数据再包一层 data
  const maybeNested = root && root.data && (root.data.sheets || root.data.replies || root.data.spreadsheetToken) ? root.data : null;
  const dataRoot = maybeNested || root;
  const sheets = Array.isArray(dataRoot.sheets) ? dataRoot.sheets : [];
  const replies = Array.isArray(dataRoot.replies) ? dataRoot.replies : [];
  const spreadsheetToken = dataRoot.spreadsheetToken || root.spreadsheetToken || apiResponse.spreadsheetToken;
  return { sheets, replies, spreadsheetToken };
}

function normalizeSheetTitle(value) {
  const str = normalizeString(value);
  if (!str) return null;
  return str.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function sheetTitleEquals(a, b) {
  const normA = normalizeSheetTitle(a);
  const normB = normalizeSheetTitle(b);
  if (!normA || !normB) return false;
  return normA === normB;
}

// 辅助函数：获取sheet信息
function getSheetInfo(apiResponse, tableName, fallbackSpreadsheetToken) {
  console.log("🔍 开始匹配sheet信息");
  console.log("表名:", tableName);
  console.log("API响应数据结构:", apiResponse && apiResponse.data ? Object.keys(apiResponse.data) : []);

  const { sheets, replies, spreadsheetToken } = getNormalizedDataRoot(apiResponse);
  const token = spreadsheetToken || fallbackSpreadsheetToken;
  console.log("规范化后: sheets数量=", sheets.length, "replies数量=", replies.length, "有无spreadsheetToken=", !!token);
  
  // 优先从replies中获取
  if (replies && replies.length > 0) {
    console.log("📋 检查replies字段，共", replies.length, "个");
    
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];
      console.log(`📋 检查reply ${i}:`, Object.keys(reply));
      
      if (reply.addSheet) {
        console.log("📋 找到addSheet:", reply.addSheet);
        console.log("addSheet标题:", reply.addSheet.title);
        console.log("addSheet ID:", reply.addSheet.sheetId);
        
        // 检查标题是否匹配
        if (sheetTitleEquals(reply.addSheet.title, tableName)) {
          console.log("✅ 在replies中找到匹配的sheet:", reply.addSheet.title);
          return {
            sheetId: reply.addSheet.sheetId,
            title: reply.addSheet.title,
            spreadsheetToken: token
          };
        }
      }
    }
  }
  
  // 从sheets中查找匹配的sheet
  if (sheets && sheets.length > 0) {
    console.log("📋 检查sheets字段，共", sheets.length, "个");
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      console.log(`📋 检查sheet ${i}:`, sheet.title, "(ID:", sheet.sheetId + ")");
      
      if (sheetTitleEquals(sheet.title, tableName)) {
        console.log("✅ 在sheets中找到匹配的sheet:", sheet.title);
        return {
          sheetId: sheet.sheetId,
          title: sheet.title,
          spreadsheetToken: token
        };
      }
    }
    
    // 如果没有找到匹配的，使用第一个
    console.log("⚠️ 没有找到匹配的sheet，使用第一个:", sheets[0].title);
    return {
      sheetId: sheets[0].sheetId,
      title: sheets[0].title,
      spreadsheetToken: token
    };
  }
  
  console.error("❌ 没有找到任何sheet信息");
  console.error("API响应data字段内容:", apiResponse && apiResponse.data);
  return null;
}

// 从输入中兜底提取 spreadsheetToken
// 兼容旧名称，内部复用增强版查找
function getSpreadsheetTokenFromInputs(inputItems) {
  return findSpreadsheetTokenInInputs(inputItems);
}

// 辅助函数：按游戏分组
function groupByGame(gameData) {
  const groups = {};
  gameData.forEach(item => {
    const gameName = item.game || item.game_id || "未知游戏";
    if (!groups[gameName]) {
      groups[gameName] = [];
    }
    groups[gameName].push(item);
  });
  return groups;
}

// 辅助函数：获取唯一游戏数量
function getUniqueGames(gameData) {
  const uniqueGames = new Set();
  gameData.forEach(item => {
    const name = item.game || item.game_id;
    if (name) uniqueGames.add(name);
  });
  return Array.from(uniqueGames);
}

// 辅助函数：获取总用户数
function getTotalUsers(gameData, detectedType) {
  if (detectedType === "game_new" || detectedType === "game_act") {
    return gameData.reduce((sum, item) => sum + (Number(item.d0_users) || 0), 0);
  }
  return gameData.reduce((sum, item) => sum + getNumericMetric(item), 0);
}

function getNumericMetric(item) {
  const raw =
    item.metric_value ??
    item.daily_unique_users ??
    item.weekly_unique_users ??
    item.monthly_unique_users ??
    item.bet_users ??
    item.value ??
    0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function toNumberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function formatDisplayDate(item) {
  const dateStr = item.date_str;
  if (dateStr === "合计" || dateStr === "总计") return "";
  if (item.original_date_value) return item.original_date_value;
  if (!dateStr) return "";
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`;
  }
  return dateStr;
}

function columnNumberToName(number) {
  let n = Number(number);
  if (!Number.isFinite(n) || n <= 0) return "A";
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

return execute();
