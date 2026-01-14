// n8n Code 节点：构建月度工作表数据
// 功能：计算上月月份，构建创建子表的请求数据

async function execute() {
  try {
    console.log("=== 开始处理月度工作表创建 ===");

    const inputItems = $input.all();
    if (!inputItems || inputItems.length === 0) {
      throw new Error("没有输入数据");
    }

    // 从上游获取tenant_access_token
    const tokenData = inputItems[0].json;
    if (!tokenData || !tokenData.tenant_access_token) {
      throw new Error("缺少tenant_access_token");
    }

    const tenantAccessToken = tokenData.tenant_access_token;
    console.log("获取到tenant_access_token:", tenantAccessToken.substring(0, 20) + "...");

    // 1. 计算上月月份 (YYYY年MM月格式)
    const now = new Date();
    let lastYear = now.getFullYear();
    let lastMonth = now.getMonth() + 1; // 当前月份（1-12）

    // 计算上月
    if (lastMonth === 1) {
      // 如果当前是1月，上月是去年12月
      lastMonth = 12;
      lastYear = lastYear - 1;
    } else {
      // 否则就是上个月
      lastMonth = lastMonth - 1;
    }

    // 格式化为两位数
    const lastMonthStr = String(lastMonth).padStart(2, '0');
    const targetSheetName = `${lastYear}年${lastMonthStr}月`;
    
    console.log(`目标工作表名称: ${targetSheetName}`);
    console.log(`计算逻辑: 当前日期=${now.toISOString()}, 上月=${lastYear}年${lastMonthStr}月`);

    // 2. 构建创建工作表的请求
    const createSheetRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg/sheets_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        requests: [
          {
            addSheet: {
              properties: {
                title: targetSheetName,
                index: 0 // 插入到第一个位置
              }
            }
          }
        ]
      }
    };

    // 3. 构建完整的http_request对象，供下游节点使用
    const httpRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg/sheets_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        requests: [
          {
            addSheet: {
              properties: {
                title: targetSheetName,
                index: 0
              }
            }
          }
        ]
      }
    };

    // 4. 构建create_request对象，供下游节点使用
    const createRequest = {
      method: "POST",
      url: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg/sheets_batch_update`,
      headers: {
        "Authorization": `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: {
        requests: [
          {
            addSheet: {
              properties: {
                title: targetSheetName,
                index: 0
              }
            }
          }
        ]
      }
    };

    console.log("=== 构建完成 ===");
    console.log("目标工作表名称:", targetSheetName);
    console.log("HTTP请求配置已准备");
    console.log("create_request配置已准备");

    return [{
      json: {
        status: "success",
        message: "月度工作表创建配置完成",
        timestamp: new Date().toISOString(),
        target_sheet_name: targetSheetName,
        target_sheet_id: targetSheetName, // 工作表ID就是工作表名称
        last_year: lastYear,
        last_month: lastMonthStr,
        tenant_access_token: tenantAccessToken,
        spreadsheet_token: "Pz6CsWLUKhlDwrtJeUHlZZ1Lgdg",
        http_request: httpRequest,
        create_request: createRequest,
        // 为了兼容下游节点的不同引用方式，提供多种格式
        requests: createRequest.body.requests,
        headers: {
          Authorization: `Bearer ${tenantAccessToken}`,
          "Content-Type": "application/json; charset=utf-8"
        }
      }
    }];

  } catch (error) {
    console.error("=== 处理月度工作表创建时出错 ===");
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

