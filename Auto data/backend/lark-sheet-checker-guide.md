# Lark子表检查器使用指南

## 🎯 **功能说明**

检查目标表是否存在指定的子表名，如果存在则获取sheetId。

## 📋 **工作流结构**

```
子表创建配置 → 检查子表是否存在 → 获取表格元数据 → 解析子表信息 → 创建或更新子表
```

## 🔧 **n8n节点配置**

### **1. 子表检查器节点 (Code)**

**节点名称**: `子表检查器`

**代码**:
```javascript
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
```

### **2. HTTP Request节点 - 获取表格元数据**

**节点名称**: `获取表格元数据`

**配置参数**:

#### **基本设置**
- **Method**: `GET`
- **URL**: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/{{ $json.spreadsheet_token }}/metainfo`
- **Authentication**: `None`

#### **Headers配置**
- **Send Headers**: `ON`
- **Header Parameters**:
  - **Name**: `Authorization`
    - **Value**: `Bearer {{ $json.tenant_access_token }}`
  - **Name**: `Content-Type`
    - **Value**: `application/json; charset=utf-8`

### **3. 子表解析器节点 (Code)**

**节点名称**: `子表解析器`

**代码**:
```javascript
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
```

## 📊 **输出数据格式**

### **子表检查器输出**
```json
{
  "status": "success",
  "message": "子表检查配置完成",
  "timestamp": "2025-10-21T08:45:43.139Z",
  "table_name": "202510商户活跃用户数",
  "tenant_access_token": "t-g206al7tEJKWVSBJKVKHWDW3MXKUD4GEIF4375V3",
  "spreadsheet_token": "CKMvwOH4GiUtHhkYTW9lkW3RgGh",
  "method": "GET",
  "url": "https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/CKMvwOH4GiUtHhkYTW9lkW3RgGh/metainfo",
  "headers": {
    "Authorization": "Bearer t-g206al7tEJKWVSBJKVKHWDW3MXKUD4GEIF4375V3",
    "Content-Type": "application/json; charset=utf-8"
  }
}
```

### **子表解析器输出**
```json
{
  "status": "success",
  "message": "子表信息解析完成",
  "timestamp": "2025-10-21T08:45:43.139Z",
  "table_name": "202510商户活跃用户数",
  "sheet_exists": true,
  "sheet_id": "sht_1234567890",
  "target_sheet": {
    "sheetId": "sht_1234567890",
    "title": "202510商户活跃用户数",
    "index": 0,
    "rowCount": 1000,
    "columnCount": 10
  },
  "all_sheets": [
    {
      "title": "202510商户活跃用户数",
      "sheetId": "sht_1234567890",
      "index": 0,
      "rowCount": 1000,
      "columnCount": 10
    }
  ],
  "summary": {
    "total_sheets": 1,
    "target_found": true,
    "target_sheet_id": "sht_1234567890"
  }
}
```

## 🎯 **关键特性**

✅ **智能检查**：自动检查子表是否存在  
✅ **获取ID**：如果存在则获取sheetId  
✅ **完整信息**：提供所有子表的详细信息  
✅ **错误处理**：完善的错误提示和调试信息  
✅ **灵活配置**：支持不同的spreadsheet token  

## 🔧 **工作流连接**

```
子表创建配置 → 子表检查器 → 获取表格元数据 → 子表解析器 → 条件判断 → 创建或更新子表
```

现在你可以使用这个完整的方案来检查Lark子表是否存在并获取sheetId了！🎉







