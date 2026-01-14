// n8n Function节点：Lark子表检查器
// 检查目标表是否存在指定的子表名，如果存在则获取sheetId

async function execute() {
  try {
    console.log("=== 开始检查Lark子表是否存在 ===");

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

    console.log(`检查子表: ${tableName}`);
    console.log(`Spreadsheet Token: ${spreadsheetToken}`);

    // 构建获取表格元数据的请求
    const getMetaInfoRequest = {
      method: "GET",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/metainfo`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    };

    console.log("准备调用Lark API获取表格元数据...");

    // 这里需要实际调用API，但在n8n中我们返回配置给下游HTTP Request节点
    const result = {
      status: "success",
      message: "子表检查配置完成",
      timestamp: new Date().toISOString(),
      table_name: tableName,
      tenant_access_token: tenantAccessToken,
      spreadsheet_token: spreadsheetToken,
      get_meta_info_request: getMetaInfoRequest,
      // 为了兼容下游节点，提供多种格式
      method: "GET",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/metainfo`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    };

    console.log("=== 子表检查配置完成 ===");
    console.log(`目标子表名: ${tableName}`);
    console.log("API请求配置已准备");

    return [{
      json: result
    }];

  } catch (error) {
    console.error("=== 处理子表检查时出错 ===");
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







