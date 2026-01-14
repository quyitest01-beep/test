// n8n Function节点：Lark数据转换为DataTable格式
// 处理Lark表格读取的数据，转换为DataTable写入格式

async function execute() {
  try {
    console.log("=== 开始处理Lark数据转换为DataTable格式 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 分析输入数据结构
    const results = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      console.log(`\n=== 分析输入项 ${index} ===`);
      console.log("数据类型:", typeof data);
      console.log("对象键:", Object.keys(data));
      
      // 检查是否是Lark API响应
      if (data.code === 0 && data.data && data.data.valueRanges) {
        console.log(`✅ 输入项 ${index} 是Lark API响应`);
        console.log(`code: ${data.code}, msg: ${data.msg || 'success'}`);
        console.log(`valueRanges数量: ${data.data.valueRanges.length}`);
        
        // 处理每个valueRange
        data.data.valueRanges.forEach((valueRange, rangeIndex) => {
          console.log(`\n--- 处理valueRange ${rangeIndex} ---`);
          console.log(`range: ${valueRange.range}`);
          console.log(`values数量: ${valueRange.values ? valueRange.values.length : 0}`);
          
          if (valueRange.values && Array.isArray(valueRange.values) && valueRange.values.length > 0) {
            // 获取表头（第一行）
            const headers = valueRange.values[0];
            console.log(`表头: ${JSON.stringify(headers)}`);
            
            // 处理数据行（从第二行开始）
            const dataRows = valueRange.values.slice(1);
            console.log(`数据行数: ${dataRows.length}`);
            
            // 转换为DataTable格式
            dataRows.forEach((row, rowIndex) => {
              // 创建DataTable行对象
              const dataTableRow = {};
              
              // 根据表头映射数据
              headers.forEach((header, headerIndex) => {
                const value = row[headerIndex];
                
                // 根据表头名称映射到DataTable字段
                switch (header) {
                  case 'id':
                    dataTableRow.game_id = value;
                    break;
                  case 'merchant_id':
                    dataTableRow.merchant = value;
                    break;
                  case 'name':
                    dataTableRow.game_name = value;
                    break;
                  default:
                    // 如果表头不匹配，使用原始表头名作为字段名
                    dataTableRow[header] = value;
                    break;
                }
              });
              
              console.log(`处理行 ${rowIndex}:`, JSON.stringify(dataTableRow));
              
              // 添加到结果中
              results.push({
                json: dataTableRow
              });
            });
          }
        });
      } else {
        console.log(`⚠️ 输入项 ${index} 不是Lark API响应格式`);
        console.log("数据内容:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
      }
    });

    console.log(`\n=== 数据转换完成 ===`);
    console.log(`📊 总共转换 ${results.length} 行数据`);

    if (results.length === 0) {
      console.warn("⚠️ 没有找到可转换的数据");
      return [{
        json: {
          status: "warning",
          message: "没有找到可转换的数据",
          timestamp: new Date().toISOString()
        }
      }];
    }

    // 显示转换结果的统计信息
    const sampleResult = results[0].json;
    console.log(`\n=== 转换结果示例 ===`);
    console.log("字段:", Object.keys(sampleResult));
    console.log("示例数据:", JSON.stringify(sampleResult, null, 2));

    return results;

  } catch (error) {
    console.error("=== 处理Lark数据转换时出错 ===");
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
