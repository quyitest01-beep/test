// n8n Function节点：Lark子表创建器
// 根据查询时间段和数据类型创建子表名，包含token值，对接下游创建子表节点

async function execute() {
  try {
    console.log("=== 开始处理子表创建 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 从上游获取tenant_access_token
    let tenantAccessToken = null;
    const merchantData = [];

    inputItems.forEach((item, index) => {
      const data = item.json;
      
      // 检查是否是token数据
      if (data.tenant_access_token) {
        tenantAccessToken = data.tenant_access_token;
        console.log("获取到tenant_access_token:", tenantAccessToken.substring(0, 20) + "...");
      }
      // 检查是否是商户数据
      else if (data.stat_type && data.merchant) {
        merchantData.push(data);
      }
    });

    if (!tenantAccessToken) {
      throw new Error("缺少tenant_access_token");
    }

    if (merchantData.length === 0) {
      throw new Error("没有找到商户数据");
    }

    console.log(`处理商户数据: ${merchantData.length} 条`);

    // 按stat_type和month_str分组数据
    const groupedData = new Map();
    let totalProcessed = 0;

    merchantData.forEach((data) => {
      const statType = data.stat_type;
      const monthStr = data.month_str;
      const groupKey = `${statType}_${monthStr}`;
      
      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, {
          stat_type: statType,
          month_str: monthStr,
          data: []
        });
      }
      
      groupedData.get(groupKey).data.push(data);
      totalProcessed++;
    });

    console.log(`处理完成，共 ${totalProcessed} 条数据`);
    console.log(`分组数量: ${groupedData.size}`);

    // 为每个分组创建子表
    const results = [];

    groupedData.forEach((groupData, groupKey) => {
      const { stat_type, month_str, data } = groupData;
      
      console.log(`处理 ${groupKey} 数据，共 ${data.length} 条`);
      
      // 根据stat_type和month_str生成子表名
      const tableName = generateTableName(stat_type, month_str);
      console.log(`生成子表名: ${tableName}`);
      
      // 准备写入Lark的数据
      const larkData = prepareLarkData(data, stat_type);
      
      // 构建创建工作表的请求
      const createSheetRequest = {
        method: "POST",
        url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/CKMvwOH4GiUtHhkYTW9lkW3RgGh/sheets_batch_update`,
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

      // 构建写入数据的请求
      const writeDataRequest = {
        method: "POST",
        url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/CKMvwOH4GiUtHhkYTW9lkW3RgGh/values_batch_update`,
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

      // 创建子表结果
      const result = {
        status: "success",
        message: "子表创建配置完成",
        timestamp: new Date().toISOString(),
        stat_type: stat_type,
        month_str: month_str,
        table_name: tableName,
        data_count: data.length,
        tenant_access_token: tenantAccessToken,
        spreadsheet_token: "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
        lark_data: larkData,
        create_sheet_request: createSheetRequest,
        write_data_request: writeDataRequest,
        summary: {
          total_rows: data.length,
          matched_count: data.filter(d => d.isMatched).length,
          unmatched_count: data.filter(d => !d.isMatched).length,
          match_rate: data.length > 0 ? ((data.filter(d => d.isMatched).length / data.length) * 100).toFixed(1) + '%' : '0%'
        }
      };
      
      results.push({
        json: result
      });
      
      console.log(`✅ ${groupKey} 数据处理完成，准备创建子表: ${tableName}`);
    });

    console.log(`=== 子表创建准备完成 ===`);
    console.log(`📊 总共创建 ${results.length} 个子表`);

    return results;

  } catch (error) {
    console.error("=== 处理子表创建时出错 ===");
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

// 根据stat_type和month_str生成子表名
function generateTableName(statType, monthStr) {
  // 将month_str转换为更易读的格式
  const year = monthStr.substring(0, 4);
  const month = monthStr.substring(4, 6);
  
  // 根据stat_type生成对应的中文名称
  let typeName = '';
  switch (statType) {
    case 'merchant_daily':
      typeName = '商户日活跃用户数';
      break;
    case 'merchant_monthly':
      typeName = '商户月活跃用户数';
      break;
    case 'game_daily':
      typeName = '游戏日活跃用户数';
      break;
    case 'game_monthly':
      typeName = '游戏月活跃用户数';
      break;
    default:
      typeName = statType.replace('_', '');
  }
  
  return `${year}${month}${typeName}`;
}

// 准备写入Lark的数据格式
function prepareLarkData(dataList, statType) {
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
  
  const rows = dataList.map(data => [
    data.date_str || '',
    data.merchant || '',
    data.merchant_id || '',
    data.main_merchant_name || '',
    data.unique_users || '',
    data.dataType || '',
    data.isMatched ? '已匹配' : '未匹配',
    data.originalIndex || ''
  ]);
  
  return {
    headers: headers,
    rows: rows,
    total_rows: rows.length
  };
}

return execute();







