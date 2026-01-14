// n8n Function节点：调试版Lark子表创建器
// 专门用于调试数据结构问题

async function execute() {
  try {
    console.log("=== 调试版Lark子表创建器开始 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 详细分析每个输入项
    inputItems.forEach((item, index) => {
      console.log(`\n=== 详细分析输入项 ${index} ===`);
      const data = item.json;
      
      console.log("数据类型:", typeof data);
      console.log("是否为数组:", Array.isArray(data));
      console.log("对象键:", Object.keys(data));
      
      // 检查是否是API响应格式
      if (data.code !== undefined && data.data !== undefined) {
        console.log(`✅ 输入项 ${index} 是API响应格式`);
        console.log(`code: ${data.code}`);
        console.log(`msg: ${data.msg}`);
        console.log(`data字段类型: ${typeof data.data}`);
        console.log(`data字段是否为数组: ${Array.isArray(data.data)}`);
        
        if (data.data && typeof data.data === 'object') {
          console.log(`data字段键: ${Object.keys(data.data)}`);
          
          // 检查是否包含sheets信息
          if (data.data.sheets && Array.isArray(data.data.sheets)) {
            console.log(`✅ 发现sheets信息，包含 ${data.data.sheets.length} 个工作表`);
            data.data.sheets.forEach((sheet, sheetIndex) => {
              console.log(`  工作表 ${sheetIndex}: ${sheet.title} (ID: ${sheet.sheetId})`);
            });
          }
          
          // 检查是否包含spreadsheetToken
          if (data.data.spreadsheetToken) {
            console.log(`✅ 发现spreadsheetToken: ${data.data.spreadsheetToken}`);
          }
          
          // 检查是否包含其他有用信息
          if (data.data.title) {
            console.log(`✅ 发现表格标题: ${data.data.title}`);
          }
        }
      }
      else {
        console.log(`⚠️ 输入项 ${index} 不是API响应格式`);
        console.log("数据内容:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
      }
    });

    // 尝试提取有用的信息
    let tenantAccessToken = null;
    let spreadsheetToken = null;
    const sheets = [];
    const merchantData = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      
      // 检查是否是API响应格式
      if (data.code === 0 && data.data) {
        // 检查是否包含tenant_access_token
        if (data.data.tenant_access_token) {
          tenantAccessToken = data.data.tenant_access_token;
          console.log(`✅ 从输入项 ${index} 获取到tenant_access_token`);
        }
        
        // 检查是否包含spreadsheetToken
        if (data.data.spreadsheetToken) {
          spreadsheetToken = data.data.spreadsheetToken;
          console.log(`✅ 从输入项 ${index} 获取到spreadsheetToken: ${spreadsheetToken}`);
        }
        
        // 检查是否包含sheets信息
        if (data.data.sheets && Array.isArray(data.data.sheets)) {
          console.log(`✅ 从输入项 ${index} 获取到 ${data.data.sheets.length} 个工作表信息`);
          sheets.push(...data.data.sheets);
        }
        
        // 检查是否包含商户数据
        if (data.data.stat_type && data.data.merchant) {
          console.log(`✅ 从输入项 ${index} 获取到商户数据`);
          merchantData.push(data.data);
        }
      }
    });

    console.log(`\n=== 信息提取结果 ===`);
    console.log(`tenant_access_token: ${tenantAccessToken ? '已获取' : '未获取'}`);
    console.log(`spreadsheetToken: ${spreadsheetToken || '未获取'}`);
    console.log(`sheets信息: ${sheets.length} 个工作表`);
    console.log(`商户数据: ${merchantData.length} 条`);

    // 输出调试信息
    const debugResult = {
      status: "debug",
      message: "数据结构分析完成",
      timestamp: new Date().toISOString(),
      input_analysis: {
        total_items: inputItems.length,
        tenant_access_token_found: !!tenantAccessToken,
        spreadsheet_token_found: !!spreadsheetToken,
        sheets_found: sheets.length,
        merchant_data_found: merchantData.length
      },
      extracted_info: {
        tenant_access_token: tenantAccessToken ? tenantAccessToken.substring(0, 20) + "..." : null,
        spreadsheet_token: spreadsheetToken,
        sheets: sheets.map(sheet => ({
          title: sheet.title,
          sheetId: sheet.sheetId
        })),
        merchant_data_count: merchantData.length
      },
      recommendations: []
    };

    // 添加建议
    if (!tenantAccessToken) {
      debugResult.recommendations.push("需要从上游节点获取tenant_access_token");
    }
    if (!spreadsheetToken) {
      debugResult.recommendations.push("需要从上游节点获取spreadsheetToken");
    }
    if (merchantData.length === 0) {
      debugResult.recommendations.push("需要从上游节点获取商户数据");
    }

    return [{
      json: debugResult
    }];

  } catch (error) {
    console.error("=== 调试时出错 ===");
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






