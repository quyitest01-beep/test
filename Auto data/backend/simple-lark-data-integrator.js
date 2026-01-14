// n8n Function节点：简化版Lark数据整合器
// 整合sheetId和匹配数据，准备写入Lark表格

async function execute() {
  try {
    console.log("=== 开始整合Lark数据 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 从上游获取数据
    const inputData = inputItems[0].json;
    if (!inputData || !inputData.table_name || !inputData.tenant_access_token) {
      throw new Error("缺少必要的数据：table_name 或 tenant_access_token");
    }

    const tableName = inputData.table_name;
    const tenantAccessToken = inputData.tenant_access_token;
    const spreadsheetToken = inputData.spreadsheet_token || "CKMvwOH4GiUtHhkYTW9lkW3RgGh";

    console.log(`目标子表名: ${tableName}`);
    console.log(`Spreadsheet Token: ${spreadsheetToken}`);

    // 检查是否有sheetId信息
    let sheetId = null;
    let sheetExists = false;

    if (inputData.sheet_id) {
      sheetId = inputData.sheet_id;
      sheetExists = true;
      console.log(`✅ 找到现有子表ID: ${sheetId}`);
    } else if (inputData.target_sheet && inputData.target_sheet.sheetId) {
      sheetId = inputData.target_sheet.sheetId;
      sheetExists = true;
      console.log(`✅ 从target_sheet获取ID: ${sheetId}`);
    } else {
      console.log(`❌ 未找到子表ID，需要创建新子表`);
    }

    // 准备写入Lark的数据
    const larkData = prepareLarkData(inputData, tableName);

    // 构建写入数据的请求
    const writeDataRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        valueRange: {
          range: `${tableName}!A1:H${larkData.total_rows + 1}`,
          values: [larkData.headers, ...larkData.rows]
        }
      }
    };

    // 构建创建子表的请求（如果需要）
    const createSheetRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tableName,
                index: 0
              }
            }
          }
        ]
      }
    };

    // 构建结果
    const result = {
      status: "success",
      message: "Lark数据整合完成",
      timestamp: new Date().toISOString(),
      table_name: tableName,
      sheet_exists: sheetExists,
      sheet_id: sheetId,
      tenant_access_token: tenantAccessToken,
      spreadsheet_token: spreadsheetToken,
      lark_data: larkData,
      write_data_request: writeDataRequest,
      create_sheet_request: createSheetRequest,
      summary: {
        total_rows: larkData.total_rows,
        matched_count: larkData.rows.filter(row => row[6] === '已匹配').length,
        unmatched_count: larkData.rows.filter(row => row[6] === '未匹配').length,
        match_rate: larkData.total_rows > 0 ? ((larkData.rows.filter(row => row[6] === '已匹配').length / larkData.total_rows) * 100).toFixed(1) + '%' : '0%'
      }
    };

    console.log("=== Lark数据整合完成 ===");
    console.log(`子表存在: ${sheetExists}`);
    console.log(`子表ID: ${sheetId || 'N/A'}`);
    console.log(`数据行数: ${larkData.total_rows}`);

    return [{
      json: result
    }];

  } catch (error) {
    console.error("=== 整合Lark数据时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
        debug_info: {
          input_items_count: $input.all ? $input.all().length : "无法获取",
          input_data_type: typeof $input.all()[0]?.json,
          input_data_keys: $input.all()[0]?.json ? Object.keys($input.all()[0].json) : "无数据"
        }
      }
    }];
  }
}

// 准备写入Lark的数据格式
function prepareLarkData(inputData, tableName) {
  const headers = [
    '日期',
    '商户名称',
    '商户ID',
    '主商户名称',
    '唯一用户数',
    '数据类型',
    '匹配状态',
    '原始索引'
  ];

  // 从inputData中提取数据
  let dataRows = [];
  
  // 如果inputData是数组，直接处理
  if (Array.isArray(inputData)) {
    dataRows = inputData.map(data => [
      data.date_str || '',
      data.merchant || '',
      data.merchant_id || '',
      data.main_merchant_name || '',
      data.unique_users || '',
      data.dataType || '',
      data.isMatched ? '已匹配' : '未匹配',
      data.originalIndex || ''
    ]);
  }
  // 如果inputData包含lark_data，使用它
  else if (inputData.lark_data && inputData.lark_data.rows) {
    dataRows = inputData.lark_data.rows;
  }
  // 如果inputData包含data字段，处理它
  else if (inputData.data && Array.isArray(inputData.data)) {
    dataRows = inputData.data.map(data => [
      data.date_str || '',
      data.merchant || '',
      data.merchant_id || '',
      data.main_merchant_name || '',
      data.unique_users || '',
      data.dataType || '',
      data.isMatched ? '已匹配' : '未匹配',
      data.originalIndex || ''
    ]);
  }

  return {
    headers: headers,
    rows: dataRows,
    total_rows: dataRows.length
  };
}

return execute();







