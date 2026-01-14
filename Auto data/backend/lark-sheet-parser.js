// n8n Function节点：Lark子表解析器
// 解析Lark API响应，检查子表是否存在并获取sheetId

async function execute() {
  try {
    console.log("=== 开始解析Lark子表信息 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 从上游获取数据
    const inputData = inputItems[0].json;
    if (!inputData || !inputData.table_name) {
      throw new Error("缺少必要的数据：table_name");
    }

    const tableName = inputData.table_name;
    console.log(`解析子表: ${tableName}`);

    // 检查API响应
    if (!inputData.data || !inputData.data.sheets) {
      throw new Error("API响应格式错误，缺少sheets信息");
    }

    const sheets = inputData.data.sheets;
    console.log(`表格中共有 ${sheets.length} 个子表`);

    // 查找目标子表
    let targetSheet = null;
    let sheetExists = false;
    let sheetId = null;

    for (const sheet of sheets) {
      console.log(`检查子表: ${sheet.title} (ID: ${sheet.sheetId})`);
      if (sheet.title === tableName) {
        targetSheet = sheet;
        sheetExists = true;
        sheetId = sheet.sheetId;
        console.log(`✅ 找到目标子表: ${tableName} (ID: ${sheetId})`);
        break;
      }
    }

    if (!sheetExists) {
      console.log(`❌ 未找到目标子表: ${tableName}`);
    }

    // 构建结果
    const result = {
      status: "success",
      message: "子表信息解析完成",
      timestamp: new Date().toISOString(),
      table_name: tableName,
      sheet_exists: sheetExists,
      sheet_id: sheetId,
      target_sheet: targetSheet,
      all_sheets: sheets.map(sheet => ({
        title: sheet.title,
        sheetId: sheet.sheetId,
        index: sheet.index,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount
      })),
      summary: {
        total_sheets: sheets.length,
        target_found: sheetExists,
        target_sheet_id: sheetId
      }
    };

    console.log("=== 子表信息解析完成 ===");
    console.log(`目标子表存在: ${sheetExists}`);
    console.log(`目标子表ID: ${sheetId || 'N/A'}`);

    return [{
      json: result
    }];

  } catch (error) {
    console.error("=== 解析子表信息时出错 ===");
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







