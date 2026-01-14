// n8n Function节点：调试输入数据结构
// 专门用于分析输入数据，找出问题所在

async function execute() {
  try {
    console.log("=== 调试输入数据结构 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 详细分析每个输入项
    const analysisResults = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      console.log(`\n=== 分析输入项 ${index} ===`);
      
      const analysis = {
        index: index,
        dataType: typeof data,
        isArray: Array.isArray(data),
        keys: Object.keys(data),
        hasCode: !!data.code,
        hasData: !!data.data,
        hasMsg: !!data.msg,
        codeValue: data.code,
        msgValue: data.msg,
        dataContent: null
      };

      // 检查是否是API响应格式
      if (data.code !== undefined && data.data !== undefined) {
        console.log(`✅ 输入项 ${index} 是API响应格式`);
        console.log(`code: ${data.code}, msg: ${data.msg}`);
        
        if (data.data && typeof data.data === 'object') {
          analysis.dataContent = {
            dataType: typeof data.data,
            isArray: Array.isArray(data.data),
            keys: Object.keys(data.data),
            hasSheets: !!data.data.sheets,
            hasSpreadsheetToken: !!data.data.spreadsheetToken,
            hasTitle: !!data.data.title,
            sheetsCount: data.data.sheets ? data.data.sheets.length : 0
          };
          
          console.log("data字段内容:", JSON.stringify(data.data, null, 2).substring(0, 500) + "...");
          
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

      analysisResults.push(analysis);
    });

    // 总结分析结果
    const summary = {
      totalItems: inputItems.length,
      apiResponseItems: analysisResults.filter(r => r.hasCode && r.hasData).length,
      successItems: analysisResults.filter(r => r.codeValue === 0).length,
      errorItems: analysisResults.filter(r => r.codeValue !== 0).length,
      itemsWithSheets: analysisResults.filter(r => r.dataContent && r.dataContent.hasSheets).length,
      itemsWithSpreadsheetToken: analysisResults.filter(r => r.dataContent && r.dataContent.hasSpreadsheetToken).length
    };

    console.log(`\n=== 分析总结 ===`);
    console.log(`总输入项: ${summary.totalItems}`);
    console.log(`API响应项: ${summary.apiResponseItems}`);
    console.log(`成功项: ${summary.successItems}`);
    console.log(`错误项: ${summary.errorItems}`);
    console.log(`包含sheets的项: ${summary.itemsWithSheets}`);
    console.log(`包含spreadsheetToken的项: ${summary.itemsWithSpreadsheetToken}`);

    // 检查是否有商户数据
    let hasMerchantData = false;
    let merchantDataSources = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      
      // 检查是否包含商户数据
      if (data.stat_type && data.merchant) {
        hasMerchantData = true;
        merchantDataSources.push(`输入项 ${index}`);
      }
      // 检查是否包含商户数据数组
      else if (Array.isArray(data) && data.length > 0 && data[0].merchant) {
        hasMerchantData = true;
        merchantDataSources.push(`输入项 ${index} (数组格式)`);
      }
      // 检查API响应中是否包含商户数据
      else if (data.code === 0 && data.data && data.data.stat_type && data.data.merchant) {
        hasMerchantData = true;
        merchantDataSources.push(`输入项 ${index} (API响应中的data字段)`);
      }
    });

    console.log(`\n=== 商户数据检查 ===`);
    console.log(`发现商户数据: ${hasMerchantData ? '是' : '否'}`);
    if (hasMerchantData) {
      console.log(`商户数据来源: ${merchantDataSources.join(', ')}`);
    } else {
      console.log("❌ 没有找到商户数据");
      console.log("可能的原因:");
      console.log("1. 上游节点没有正确输出商户数据");
      console.log("2. 商户数据被包装在API响应中，需要正确提取");
      console.log("3. 工作流配置问题，商户数据没有传递到这个节点");
    }

    // 输出调试结果
    const debugResult = {
      status: "debug",
      message: "输入数据结构分析完成",
      timestamp: new Date().toISOString(),
      summary: summary,
      hasMerchantData: hasMerchantData,
      merchantDataSources: merchantDataSources,
      detailedAnalysis: analysisResults,
      recommendations: []
    };

    // 添加建议
    if (!hasMerchantData) {
      debugResult.recommendations.push("检查上游节点是否正确输出了商户数据");
      debugResult.recommendations.push("确认工作流连接是否正确");
      debugResult.recommendations.push("检查商户数据是否被包装在API响应中");
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
