// n8n Function节点：修复版Lark写入数据整合器
// 根据上游数据整合写入Lark表格的配置

async function execute() {
  try {
    console.log("=== 开始整合Lark写入数据 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 从上游获取数据
    const inputData = inputItems[0].json;
    console.log("输入数据结构:", JSON.stringify(inputData, null, 2).substring(0, 500) + "...");

    // 检查输入数据格式
    if (!inputData) {
      throw new Error("输入数据为空");
    }

    // 如果输入数据包含嵌套结构，提取实际数据
    let actualData = inputData;
    if (inputData.data) {
      actualData = inputData.data;
      console.log("从嵌套结构中提取数据");
    }

    // 检查必要字段
    if (!actualData.table_name || !actualData.tenant_access_token) {
      console.error("缺少必要字段:");
      console.error("table_name:", actualData.table_name);
      console.error("tenant_access_token:", actualData.tenant_access_token ? "存在" : "不存在");
      console.error("可用字段:", Object.keys(actualData));
      
      // 尝试从其他字段获取数据
      if (actualData.table_name || actualData.tenant_access_token) {
        console.log("部分字段存在，继续处理");
      } else {
        throw new Error("缺少必要的数据：table_name 或 tenant_access_token");
      }
    }

    const tableName = actualData.table_name;
    const tenantAccessToken = actualData.tenant_access_token;
    const spreadsheetToken = actualData.spreadsheet_token || "CKMvwOH4GiUtHhkYTW9lkW3RgGh";
    const larkData = actualData.lark_data;

    console.log(`目标子表名: ${tableName}`);
    console.log(`Spreadsheet Token: ${spreadsheetToken}`);
    console.log(`数据行数: ${larkData ? larkData.rows.length : 0}`);

    // 检查是否有sheetId信息
    let sheetId = null;
    let sheetExists = false;

    if (actualData.sheet_id) {
      sheetId = actualData.sheet_id;
      sheetExists = true;
      console.log(`✅ 找到现有子表ID: ${sheetId}`);
    } else if (actualData.target_sheet && actualData.target_sheet.sheetId) {
      sheetId = actualData.target_sheet.sheetId;
      sheetExists = true;
      console.log(`✅ 从target_sheet获取ID: ${sheetId}`);
    } else {
      console.log(`❌ 未找到子表ID，需要创建新子表`);
    }

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
          range: `${tableName}!A1:H${larkData.rows.length + 1}`,
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
      message: "Lark写入数据整合完成",
      timestamp: new Date().toISOString(),
      table_name: tableName,
      sheet_exists: sheetExists,
      sheet_id: sheetId,
      tenant_access_token: tenantAccessToken,
      spreadsheet_token: spreadsheetToken,
      lark_data: larkData,
      write_data_request: writeDataRequest,
      create_sheet_request: createSheetRequest,
      // 为了兼容下游节点，提供多种格式
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        valueRange: {
          range: `${tableName}!A1:H${larkData.rows.length + 1}`,
          values: [larkData.headers, ...larkData.rows]
        }
      },
      summary: {
        total_rows: larkData.rows.length,
        matched_count: larkData.rows.filter(row => row[6] === '已匹配').length,
        unmatched_count: larkData.rows.filter(row => row[6] === '未匹配').length,
        match_rate: larkData.rows.length > 0 ? ((larkData.rows.filter(row => row[6] === '已匹配').length / larkData.rows.length) * 100).toFixed(1) + '%' : '0%'
      }
    };

    console.log("=== Lark写入数据整合完成 ===");
    console.log(`子表存在: ${sheetExists}`);
    console.log(`子表ID: ${sheetId || 'N/A'}`);
    console.log(`数据行数: ${larkData.rows.length}`);
    console.log(`写入范围: ${tableName}!A1:H${larkData.rows.length + 1}`);

    return [{
      json: result
    }];

  } catch (error) {
    console.error("=== 整合Lark写入数据时出错 ===");
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

return execute();







