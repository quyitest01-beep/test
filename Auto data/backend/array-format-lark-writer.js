// n8n Function节点：处理数组格式的Lark子表创建器
// 专门处理数组格式的商户数据

async function execute() {
  try {
    console.log("=== 开始处理数组格式的子表创建 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    console.log(`输入数据项数: ${inputItems.length}`);

    // 从上游获取tenant_access_token
    let tenantAccessToken = null;
    const merchantData = [];

    // 分析输入数据结构
    inputItems.forEach((item, index) => {
      const data = item.json;
      console.log(`\n=== 分析输入项 ${index} ===`);
      console.log("数据类型:", typeof data);
      console.log("是否为数组:", Array.isArray(data));
      console.log("对象键:", Object.keys(data));
      
      // 检查是否是API响应格式
      if (data.code !== undefined && data.data !== undefined) {
        console.log(`输入项 ${index} 是API响应格式`);
        console.log(`code: ${data.code}, msg: ${data.msg}`);
        
        // 如果是成功的API响应，检查data字段
        if (data.code === 0 && data.data) {
          console.log("发现成功的API响应，检查data字段内容");
          
          // 检查data字段是否包含tenant_access_token
          if (data.data.tenant_access_token) {
            console.log("✅ 在API响应的data字段中发现tenant_access_token");
            tenantAccessToken = data.data.tenant_access_token;
          }
          // 检查data字段是否包含商户数据数组
          else if (Array.isArray(data.data) && data.data.length > 0) {
            console.log(`✅ 在API响应的data字段中发现商户数据数组，长度: ${data.data.length}`);
            // 处理数组格式的商户数据
            data.data.forEach((row, rowIndex) => {
              if (Array.isArray(row) && row.length >= 8) {
                // 将数组转换为对象格式
                const merchantObj = {
                  date_str: row[0] || '',
                  merchant: row[1] || '',
                  merchant_id: row[2] || '',
                  main_merchant_name: row[3] || '',
                  unique_users: row[4] || '',
                  dataType: row[5] || '',
                  isMatched: row[6] === '已匹配',
                  originalIndex: row[7] || '',
                  stat_type: 'merchant_daily', // 根据数据推断
                  month_str: row[0] ? row[0].substring(0, 6) : '202510' // 从日期推断月份
                };
                merchantData.push(merchantObj);
                console.log(`  处理行 ${rowIndex}: ${merchantObj.merchant} (${merchantObj.unique_users} 用户)`);
              }
            });
          }
        }
      }
      // 检查是否是直接的token数据
      else if (data.tenant_access_token) {
        tenantAccessToken = data.tenant_access_token;
        console.log("✅ 获取到tenant_access_token:", tenantAccessToken.substring(0, 20) + "...");
      }
      // 检查是否是直接的商户数据数组
      else if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ 发现直接的商户数据数组，长度: ${data.length}`);
        // 处理数组格式的商户数据
        data.forEach((row, rowIndex) => {
          if (Array.isArray(row) && row.length >= 8) {
            // 将数组转换为对象格式
            const merchantObj = {
              date_str: row[0] || '',
              merchant: row[1] || '',
              merchant_id: row[2] || '',
              main_merchant_name: row[3] || '',
              unique_users: row[4] || '',
              dataType: row[5] || '',
              isMatched: row[6] === '已匹配',
              originalIndex: row[7] || '',
              stat_type: 'merchant_daily', // 根据数据推断
              month_str: row[0] ? row[0].substring(0, 6) : '202510' // 从日期推断月份
            };
            merchantData.push(merchantObj);
            console.log(`  处理行 ${rowIndex}: ${merchantObj.merchant} (${merchantObj.unique_users} 用户)`);
          }
        });
      }
      // 检查是否是对象格式的商户数据
      else if (data.stat_type && data.merchant) {
        console.log("✅ 发现对象格式的商户数据");
        merchantData.push(data);
      }
    });

    console.log(`\n=== 数据提取结果 ===`);
    console.log(`tenant_access_token: ${tenantAccessToken ? '已获取' : '未获取'}`);
    console.log(`商户数据: ${merchantData.length} 条`);

    if (!tenantAccessToken) {
      console.error("❌ 缺少tenant_access_token");
      return [{
        json: {
          status: "error",
          error: "缺少tenant_access_token",
          timestamp: new Date().toISOString()
        }
      }];
    }

    if (merchantData.length === 0) {
      console.error("❌ 没有找到商户数据");
      return [{
        json: {
          status: "error",
          error: "没有找到商户数据",
          timestamp: new Date().toISOString()
        }
      }];
    }

    console.log(`\n=== 开始处理商户数据 ===`);
    console.log(`处理商户数据: ${merchantData.length} 条`);

    // 按stat_type和month_str分组数据
    const groupedData = new Map();
    let totalProcessed = 0;

    merchantData.forEach((data, index) => {
      console.log(`处理商户数据 ${index}:`, {
        stat_type: data.stat_type,
        month_str: data.month_str,
        merchant: data.merchant,
        unique_users: data.unique_users
      });
      
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
      
      console.log(`\n=== 处理 ${groupKey} 数据 ===`);
      console.log(`数据条数: ${data.length} 条`);
      
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

      // 只输出必要信息
      const result = {
        table_name: tableName,
        stat_type: stat_type,
        month_str: month_str,
        tenant_access_token: tenantAccessToken,
        spreadsheet_token: "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
        lark_data: larkData,
        create_sheet_request: createSheetRequest,
        write_data_request: writeDataRequest
      };
      
      results.push({
        json: result
      });
      
      console.log(`✅ ${groupKey} 数据处理完成，准备创建子表: ${tableName}`);
    });

    console.log(`\n=== 子表创建准备完成 ===`);
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
        timestamp: new Date().toISOString()
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
    case 'merchant_monthly':
      typeName = '商户活跃用户数';
      break;
    case 'game_daily':
    case 'game_monthly':
      typeName = '游戏活跃用户数';
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
