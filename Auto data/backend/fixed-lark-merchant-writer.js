// n8n Function节点：Lark商户数据写入器 (修复版)
// 处理商户活跃用户数据，使用上游提供的合计数值，不重复计算

async function execute() {
  const inputItems = $input.all();
  
  try {
    console.log("=== 开始处理商户数据写入Lark表格 (修复版) ===");

    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 获取API响应数据
    const apiResponse = getApiResponse(inputItems);
    // 识别：留存格式行（本节点仅处理留存格式）
    const retentionRows = getRetentionRowsFromInputs(inputItems);
    // 获取tenant_access_token
    const tenantAccessToken = getTenantAccessToken(inputItems);
    // 获取表名
    const tableName = getTableName(inputItems);

    if (!apiResponse) {
      throw new Error("缺少API响应数据，无法获取sheet信息");
    }
    if (!retentionRows || retentionRows.length === 0) {
      throw new Error("未找到留存格式数据");
    }
    if (!tenantAccessToken) {
      throw new Error("缺少tenant_access_token，无法构建请求");
    }
    if (!tableName) {
      throw new Error("缺少表名，无法匹配sheet");
    }

    console.log("找到留存格式行数量:", retentionRows ? retentionRows.length : 0);
    
    // 打印前几行留存数据示例用于调试
    if (retentionRows && retentionRows.length > 0) {
      console.log("留存数据示例（前3行）:");
      retentionRows.slice(0, 3).forEach((row, idx) => {
        console.log(`  行${idx + 1}:`, Object.keys(row).slice(0, 10).join(", "));
      });
    }
    
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

    // 构建表格数据：仅留存格式
    const larkTableData = buildRetentionTableData(retentionRows);

    // 验证表格数据有效性
    if (!larkTableData || larkTableData.length === 0) {
      throw new Error("生成的表格数据为空，无法写入Lark表格");
    }
    if (!larkTableData[0] || larkTableData[0].length === 0) {
      throw new Error("生成的表格表头为空，无法写入Lark表格");
    }

    console.log("=== 构建完成 ===");
    console.log("表格行数:", larkTableData.length);
    console.log("表格列数:", larkTableData[0].length);
    
    // Lark API建议每次不超过1000行数据，超过则分批处理
    const LARK_MAX_ROWS_PER_BATCH = 1000;
    const needsBatching = larkTableData.length > LARK_MAX_ROWS_PER_BATCH;
    
    if (needsBatching) {
      console.log(`⚠️ 数据量过大(${larkTableData.length}行)，将分批处理，每批${LARK_MAX_ROWS_PER_BATCH}行`);
      return buildBatchedRequests(larkTableData, sheetInfo, tenantAccessToken, tableName, retentionRows);
    }
    
    // 数据量不大，正常处理
    console.log("表格范围:", `A1:${excelColLetter(larkTableData[0].length)}${larkTableData.length}`);
    const writeHttpRequest = buildLarkSheetsWriteRequest(larkTableData, sheetInfo.spreadsheetToken, sheetInfo.sheetId, tenantAccessToken);
    console.log("写入HTTP请求配置已准备");

    // 计算最终的range，避免重复计算
    const finalRange = `${sheetInfo.sheetId}!A1:${excelColLetter(larkTableData[0].length)}${larkTableData.length}`;
    console.log("最终输出range:", finalRange);

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
        data_count: retentionRows.length,
        // Lark API需要的字段
        lark_request_body: writeHttpRequest.body,  // JSON字符串版本（供检查用）
        lark_request_body_obj: writeHttpRequest.body_obj,  // 对象版本（供n8n HTTP Request使用）
        headers: larkTableData[0] || [],
        values: larkTableData,
        range: finalRange,
        http_request: writeHttpRequest,
        statistics: {
          total_rows: larkTableData.length,
          total_merchants: getUniqueMerchantsFromRetention(retentionRows).length,
          total_users: getTotalUsersFromRetention(retentionRows)
        },
        matched_at: new Date().toISOString()
      }
    }];

  } catch (error) {
    console.error("=== 处理商户数据写入时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: inputItems ? inputItems.length : "无法获取",
          merchant_data_type: inputItems && inputItems[0] ? typeof inputItems[0].json : "无数据",
          merchant_data_keys: inputItems && inputItems[0] && inputItems[0].json ? Object.keys(inputItems[0].json) : "无数据"
        }
      }
    }];
  }
}

// 已移除三列表逻辑，本节点仅输出留存表结构

// 构建分批请求（用于大数据量场景）
function buildBatchedRequests(larkTableData, sheetInfo, tenantAccessToken, tableName, retentionRows) {
  const LARK_MAX_ROWS_PER_BATCH = 1000;
  const header = larkTableData[0];
  const dataRows = larkTableData.slice(1); // 除去表头
  
  const batches = [];
  const totalBatches = Math.ceil(dataRows.length / LARK_MAX_ROWS_PER_BATCH);
  
  console.log(`开始构建${totalBatches}个分批请求，每批约${LARK_MAX_ROWS_PER_BATCH}行数据`);
  
  for (let i = 0; i < dataRows.length; i += LARK_MAX_ROWS_PER_BATCH) {
    const batchIndex = Math.floor(i / LARK_MAX_ROWS_PER_BATCH) + 1;
    const batchData = dataRows.slice(i, i + LARK_MAX_ROWS_PER_BATCH);
    
    // 第一批包含表头，后续批次只包含数据
    const isFirstBatch = batchIndex === 1;
    const batchTable = isFirstBatch ? [header, ...batchData] : batchData;
    
    let startRow, endRow;
    if (isFirstBatch) {
      // 第一批：写入表头和第一批数据
      // 表头占第1行，数据从第2行开始写batchData.length行
      startRow = 1;
      endRow = 1 + batchData.length; // 表头1行 + 数据行数
    } else {
      // 后续批次：只写入数据
      // 从i+2行开始（因为第1行是表头，第2行开始是第一批数据）
      startRow = i + 2;
      endRow = startRow + batchData.length - 1;
    }
    
    console.log(`批次${batchIndex}/${totalBatches}: 行${startRow}到${endRow}，共${batchData.length}行数据${isFirstBatch ? '（含表头）' : ''}`);
    
    const httpRequest = buildLarkSheetsWriteRequest(
      batchTable, 
      sheetInfo.spreadsheetToken, 
      sheetInfo.sheetId, 
      tenantAccessToken,
      startRow,
      isFirstBatch
    );
    
    const batchRange = `${sheetInfo.sheetId}!A${startRow}:${excelColLetter(header.length)}${endRow}`;
    
    batches.push({
      json: {
        status: "success",
        message: `Lark表格数据分批${batchIndex}/${totalBatches}构建完成`,
        timestamp: new Date().toISOString(),
        table_name: tableName,
        sheet_id: sheetInfo.sheetId,
        sheet_title: sheetInfo.title,
        spreadsheet_token: sheetInfo.spreadsheetToken,
        tenant_access_token: tenantAccessToken,
        batch_info: {
          batch_index: batchIndex,
          total_batches: totalBatches,
          start_row: startRow,
          end_row: endRow,
          data_rows: batchData.length,
          includes_header: isFirstBatch
        },
        lark_request_body: httpRequest.body,
        lark_request_body_obj: httpRequest.body_obj,
        range: batchRange,
        http_request: httpRequest,
        statistics: {
          batch_rows: batchData.length,
          batch_merchants: getUniqueMerchantsFromRetention(
            retentionRows.slice(i, i + batchData.length)
          ).length
        },
        matched_at: new Date().toISOString()
      }
    });
  }
  
  console.log(`分批请求构建完成，共${batches.length}个批次`);
  return batches;
}

// 构建Lark电子表格写入数据的HTTP请求
function buildLarkSheetsWriteRequest(tableData, spreadsheetToken, targetSheetId, tenantAccessToken, startRow = 1, includeHeader = true) {
  if (!tenantAccessToken) {
    throw new Error("缺少tenant_access_token，无法构建写入请求");
  }

  // 验证输入参数
  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    throw new Error("tableData 必须是包含至少一行数据的数组");
  }
  if (!tableData[0] || !Array.isArray(tableData[0]) || tableData[0].length === 0) {
    throw new Error("tableData 的第一行（表头）必须是非空数组");
  }
  if (!targetSheetId || typeof targetSheetId !== 'string') {
    throw new Error("targetSheetId 必须是非空字符串");
  }
  if (!spreadsheetToken || typeof spreadsheetToken !== 'string') {
    throw new Error("spreadsheetToken 必须是非空字符串");
  }

  // 计算有效的列号和行号
  const colCount = tableData[0].length;
  const rowCount = tableData.length;
  
  // 验证所有行的列数一致
  for (let i = 0; i < tableData.length; i++) {
    if (!Array.isArray(tableData[i])) {
      throw new Error(`第 ${i + 1} 行不是数组类型`);
    }
    if (tableData[i].length !== colCount) {
      console.warn(`第 ${i + 1} 行列数不匹配：期望 ${colCount}，实际 ${tableData[i].length}`);
    }
  }
  
  const lastCol = excelColLetter(colCount);
  // 使用传入的startRow参数计算range
  const endRow = startRow + rowCount - 1;
  const range = `${targetSheetId}!A${startRow}:${lastCol}${endRow}`;

  console.log("Lark Sheets写入配置信息:", {
    spreadsheet_token: spreadsheetToken ? `${spreadsheetToken.substring(0, 10)}...` : "未找到",
    target_sheet_id: targetSheetId,
    tenant_access_token: tenantAccessToken ? `${tenantAccessToken.substring(0, 10)}...` : "未找到",
    range: range,
    start_row: startRow,
    end_row: endRow,
    row_count: rowCount,
    col_count: colCount,
    include_header: includeHeader
  });

    const requestBodyObj = {
      valueRanges: [
        {
          range: range,
          values: tableData
        }
      ]
    };
    
    const httpRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBodyObj),
      body_obj: requestBodyObj  // 同时提供对象版本供n8n使用
    };

  console.log("生成的请求Body:", JSON.stringify({
    valueRanges: [{
      range: range,
      values_count: tableData.length
    }]
  }));

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

// 辅助函数：从输入项中获取商户数据
// 已不需要 merchant_data 路径

// 从输入中提取留存格式行（保持上游字段不变）
function getRetentionRowsFromInputs(inputItems) {
  const collected = [];

  function isRetentionShape(o) {
    if (!o || typeof o !== 'object') return false;
    const hasMerchant = o.商户名 != null || o.merchant_name != null;
    const hasDate = o.日期 != null || o.new_date != null || o.cohort_date != null;
    const hasD0 = o.当日用户数 != null || o.d0_users != null;
    return !!(hasMerchant && hasDate && hasD0);
  }

  function normalizeRow(o) {
    const 商户名 = o.商户名 || o.merchant_name || o.merchant || '';
    const 日期 = o.日期 || o.new_date || o.cohort_date || '';
    const 数据类型 = o.数据类型 || (o.dataType === 'game_new' ? '新用户留存' : o.dataType === 'game_act' ? '活跃用户留存' : (o.data_type || ''));
    // 保留原上游字段与留存率字符串
    return {
      ...o,
      商户名,
      日期,
      数据类型
    };
  }

  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      if (isRetentionShape(node)) {
        collected.push(normalizeRow(node));
      }
      // 递归遍历所有子属性，适配嵌套 { data: { results: [...] } } 等结构
      Object.keys(node).forEach(k => {
        const v = node[k];
        if (v && (typeof v === 'object' || Array.isArray(v))) walk(v);
      });
    }
  }

  inputItems.forEach(it => walk(it && it.json));

  return collected;
}

// Excel 列号转字母
function excelColLetter(n) {
  // 验证输入
  const num = Number(n);
  if (isNaN(num) || num < 1) {
    console.error("无效的列号:", n, "类型:", typeof n);
    throw new Error(`无效的列号: ${n}，必须是大于等于1的整数`);
  }
  
  let s = "";
  let remaining = Math.floor(num);
  while (remaining > 0) {
    const m = (remaining - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    remaining = Math.floor((remaining - 1) / 26);
  }
  
  if (!s) {
    s = "A";  // 至少返回 A
  }
  
  return s;
}

// 留存格式表格数据（保持上游格式，不修改留存率字符串）
function buildRetentionTableData(rows) {
  if (!rows || rows.length === 0) return [];

  const hasD14 = rows.some(r => r["14日用户数"] != null || r["14日留存率"] != null);
  const hasD30 = rows.some(r => r["30日用户数"] != null || r["30日留存率"] != null);

  const headers = [
    "商户名",
    "日期",
    "数据类型",
    "当日用户数",
    "次日用户数",
    "次日留存率",
    "3日用户数",
    "3日留存率",
    "7日用户数",
    "7日留存率"
  ];
  if (hasD14) { headers.push("14日用户数", "14日留存率"); }
  if (hasD30) { headers.push("30日用户数", "30日留存率"); }

  const table = [headers];

  // 排序：商户名 A→Z，日期升序
  const sorted = [...rows].sort((a, b) => {
    const na = String(a.商户名 || '').toUpperCase();
    const nb = String(b.商户名 || '').toUpperCase();
    if (na !== nb) return na.localeCompare(nb);
    return String(a.日期 || '').localeCompare(String(b.日期 || ''));
  });

  sorted.forEach(r => {
    const row = [
      r.商户名 || '',
      r.日期 || '',
      r.数据类型 || (r.dataType === 'game_new' ? '新用户留存' : r.dataType === 'game_act' ? '活跃用户留存' : ''),
      Number(r.当日用户数 != null ? r.当日用户数 : r.d0_users || 0) || 0,
      Number(r.次日用户数 != null ? r.次日用户数 : r.d1_users || 0) || 0,
      r.次日留存率 != null ? String(r.次日留存率) : (r.d1_retention_rate != null ? String(r.d1_retention_rate) : ''),
      Number(r["3日用户数"] != null ? r["3日用户数"] : r.d3_users || 0) || 0,
      r["3日留存率"] != null ? String(r["3日留存率"]) : (r.d3_retention_rate != null ? String(r.d3_retention_rate) : ''),
      Number(r["7日用户数"] != null ? r["7日用户数"] : r.d7_users || 0) || 0,
      r["7日留存率"] != null ? String(r["7日留存率"]) : (r.d7_retention_rate != null ? String(r.d7_retention_rate) : '')
    ];
    if (hasD14) {
      row.push(
        Number(r["14日用户数"] != null ? r["14日用户数"] : r.d14_users || 0) || 0,
        r["14日留存率"] != null ? String(r["14日留存率"]) : (r.d14_retention_rate != null ? String(r.d14_retention_rate) : '')
      );
    }
    if (hasD30) {
      row.push(
        Number(r["30日用户数"] != null ? r["30日用户数"] : r.d30_users || 0) || 0,
        r["30日留存率"] != null ? String(r["30日留存率"]) : (r.d30_retention_rate != null ? String(r.d30_retention_rate) : '')
      );
    }
    table.push(row);
  });

  return table;
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
        if (reply.addSheet.title === tableName) {
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
      
      if (sheet.title === tableName) {
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

// 辅助函数：按商户分组
// 已移除：按商户分组（仅保留留存路径不需要分组）

// 辅助函数：获取唯一商户数量
function getUniqueMerchantsFromRetention(rows) {
  const uniqueMerchants = new Set();
  rows.forEach(item => {
    if (item.商户名) uniqueMerchants.add(item.商户名);
  });
  return Array.from(uniqueMerchants);
}

// 辅助函数：获取总用户数
function getTotalUsersFromRetention(rows) {
  return rows.reduce((sum, item) => {
    const n = (item.当日用户数 != null ? item.当日用户数 : item.d0_users);
    return sum + (Number(n) || 0);
  }, 0);
}

return execute();
