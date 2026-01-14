// n8n Function节点：处理Lark配置数据
// 专门处理已经处理过的Lark子表创建配置数据

async function execute() {
  try {
    console.log("=== 开始处理Lark配置数据 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 分析输入数据结构
    const larkConfigs = [];
    const apiResponses = [];
    const errorResponses = [];
    const sheetsInfo = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      console.log(`\n=== 分析输入项 ${index} ===`);
      console.log("数据类型:", typeof data);
      console.log("对象键:", Object.keys(data));
      
      // 检查是否是Lark配置数据
      if (data.status && data.table_name && data.tenant_access_token) {
        console.log(`✅ 输入项 ${index} 是Lark配置数据`);
        console.log(`表名: ${data.table_name}`);
        console.log(`统计类型: ${data.stat_type}`);
        console.log(`月份: ${data.month_str}`);
        console.log(`数据条数: ${data.data_count}`);
        
        larkConfigs.push({
          index: index,
          data: data,
          tableName: data.table_name,
          statType: data.stat_type,
          monthStr: data.month_str,
          dataCount: data.data_count,
          tenantAccessToken: data.tenant_access_token,
          spreadsheetToken: data.spreadsheet_token,
          larkData: data.lark_data,
          createSheetRequest: data.create_sheet_request,
          writeDataRequest: data.write_data_request
        });
      }
      // 检查是否是API响应
      else if (data.code !== undefined && data.data !== undefined) {
        console.log(`📊 输入项 ${index} 是API响应格式`);
        console.log(`code: ${data.code}, msg: ${data.msg}`);
        
        if (data.code === 0) {
          apiResponses.push({
            index: index,
            data: data,
            hasSheets: !!data.data.sheets,
            hasSpreadsheetToken: !!data.data.spreadsheetToken,
            sheetsCount: data.data.sheets ? data.data.sheets.length : 0
          });
          
          // 提取sheets信息
          if (data.data.sheets && Array.isArray(data.data.sheets)) {
            console.log(`✅ 从输入项 ${index} 提取到 ${data.data.sheets.length} 个工作表信息`);
            data.data.sheets.forEach((sheet, sheetIndex) => {
              sheetsInfo.push({
                title: sheet.title,
                sheetId: sheet.sheetId,
                index: sheet.index,
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount,
                source: `输入项 ${index}`
              });
              console.log(`  工作表 ${sheetIndex}: ${sheet.title} (ID: ${sheet.sheetId})`);
            });
          }
        } else {
          errorResponses.push({
            index: index,
            data: data,
            code: data.code,
            msg: data.msg
          });
        }
      }
      else {
        console.log(`⚠️ 输入项 ${index} 格式未知`);
      }
    });

    console.log(`\n=== 数据分类结果 ===`);
    console.log(`Lark配置数据: ${larkConfigs.length} 个`);
    console.log(`成功API响应: ${apiResponses.length} 个`);
    console.log(`错误API响应: ${errorResponses.length} 个`);
    console.log(`工作表信息: ${sheetsInfo.length} 个`);
    
    // 显示工作表信息
    if (sheetsInfo.length > 0) {
      console.log(`\n=== 工作表信息 ===`);
      sheetsInfo.forEach((sheet, index) => {
        console.log(`工作表 ${index}: ${sheet.title} (ID: ${sheet.sheetId})`);
      });
    }

    if (larkConfigs.length === 0) {
      console.error("❌ 没有找到Lark配置数据");
      return [{
        json: {
          status: "error",
          error: "没有找到Lark配置数据",
          timestamp: new Date().toISOString(),
          debug_info: {
            total_items: inputItems.length,
            lark_configs: 0,
            api_responses: apiResponses.length,
            error_responses: errorResponses.length
          }
        }
      }];
    }

    // 处理Lark配置数据
    const results = [];

    larkConfigs.forEach((config, index) => {
      console.log(`\n=== 处理Lark配置 ${index} ===`);
      console.log(`表名: ${config.tableName}`);
      console.log(`统计类型: ${config.statType}`);
      console.log(`月份: ${config.monthStr}`);
      console.log(`数据条数: ${config.dataCount}`);
      
      // 检查是否需要创建子表
      const needsCreateSheet = !apiResponses.some(api => 
        api.data.data.sheets && api.data.data.sheets.some(sheet => 
          sheet.title === config.tableName
        )
      );
      
      // 查找匹配的sheetId
      const matchingSheet = sheetsInfo.find(sheet => sheet.title === config.tableName);
      const sheetId = matchingSheet ? matchingSheet.sheetId : null;
      const sheetExists = !!matchingSheet;
      
      console.log(`需要创建子表: ${needsCreateSheet}`);
      console.log(`工作表存在: ${sheetExists}`);
      console.log(`工作表ID: ${sheetId || '未找到'}`);
      
      // 准备输出数据
      const result = {
        status: "success",
        message: "Lark配置数据处理完成",
        timestamp: new Date().toISOString(),
        table_name: config.tableName,
        stat_type: config.statType,
        month_str: config.monthStr,
        data_count: config.dataCount,
        tenant_access_token: config.tenantAccessToken,
        spreadsheet_token: config.spreadsheetToken,
        lark_data: {
          headers: config.larkData.headers,
          rows: config.larkData.rows,
          total_rows: config.larkData.total_rows,
          // 添加合并后的数据，用于HTTP Request
          combined_data: [config.larkData.headers, ...config.larkData.rows]
        },
        needs_create_sheet: needsCreateSheet,
        sheet_exists: sheetExists,
        sheet_id: sheetId,
        create_sheet_request: config.createSheetRequest,
        write_data_request: config.writeDataRequest,
        summary: {
          total_rows: config.dataCount,
          matched_count: config.larkData ? config.larkData.rows.filter(row => row[6] === '已匹配').length : 0,
          unmatched_count: config.larkData ? config.larkData.rows.filter(row => row[6] === '未匹配').length : 0,
          match_rate: config.larkData ? ((config.larkData.rows.filter(row => row[6] === '已匹配').length / config.larkData.rows.length) * 100).toFixed(1) + '%' : '0%'
        }
      };
      
      results.push({
        json: result
      });
      
      console.log(`✅ Lark配置 ${index} 处理完成`);
    });

    console.log(`\n=== Lark配置数据处理完成 ===`);
    console.log(`📊 总共处理 ${results.length} 个配置`);

    return results;

  } catch (error) {
    console.error("=== 处理Lark配置数据时出错 ===");
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);

    return [{
      json: {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }];
  }
}

return execute();
