# Lark Wiki 表格 API 修复指南

## 问题诊断

您提供的链接是 Wiki 页面：
- URL: `https://d4ft1c7bo4f.sg.larksuite.com/wiki/WZA6wM6PFitELDkYEu4lmI92gWh?sheet=5mcFGW`
- `WZA6wM6PFitELDkYEu4lmI92gWh` 是 **Wiki 页面 ID**，不是 Spreadsheet Token
- `5mcFGW` 是 Wiki 页面中的表格 Sheet ID

**问题**：Wiki 中的表格不能使用 `/sheets/v2/spreadsheets/` API，需要使用 **Wiki API**。

## 解决方案

### 方案1：使用 Wiki 表格 API（推荐）

Wiki 中的表格需要使用 Wiki API 来访问：

**API 端点**：
```
GET /open-apis/wiki/v2/spaces/{space_id}/nodes/{node_token}/tables/{table_id}/records
```

但是，更简单的方法是先获取 Wiki 页面的内容，然后提取表格数据。

### 方案2：使用 Wiki 内容 API

**获取 Wiki 页面内容**：
```json
{
  "parameters": {
    "url": "https://open.larksuite.com/open-apis/wiki/v2/spaces/get_node",
    "method": "POST",
    "sendQuery": false,
    "sendHeaders": true,
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "token",
          "value": "WZA6wM6PFitELDkYEu4lmI92gWh"
        }
      ]
    },
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.tenant_access_token }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "options": {
      "response": {
        "response": {
          "fullResponse": false,
          "responseFormat": "json"
        }
      }
    }
  }
}
```

### 方案3：直接在浏览器中导出或使用 Sheets API（如果表格已关联到 Spreadsheet）

如果 Wiki 中的表格背后对应一个独立的 Spreadsheet，需要找到对应的 Spreadsheet Token。

## 快速检查：确认表格类型

在 Wiki 页面中：
1. 点击表格
2. 查看是否有"作为独立表格打开"或"在新窗口中打开"的选项
3. 如果有，可以获取到独立的 Spreadsheet URL 和 Token

## 推荐的 API 调用方式

### 如果表格是嵌入在 Wiki 中的独立 Spreadsheet

如果 Wiki 表格背后有一个独立的 Spreadsheet（通过嵌入的方式），那么：

1. **尝试获取 Wiki 页面信息**，找到关联的 Spreadsheet Token
2. **或者**，直接在 Wiki 页面中找到"在新窗口打开"表格的选项，获取真实的 Spreadsheet URL

### 使用 Wiki API 获取表格数据

如果必须通过 Wiki API 访问，可以使用以下方式：

```json
{
  "parameters": {
    "url": "https://open.larksuite.com/open-apis/wiki/v2/spaces/get_node",
    "method": "POST",
    "sendQuery": false,
    "sendHeaders": true,
    "sendBody": true,
    "bodyContentType": "json",
    "jsonBody": "={\n  \"token\": \"WZA6wM6PFitELDkYEu4lmI92gWh\"\n}",
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.tenant_access_token }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    }
  }
}
```

这会返回 Wiki 节点的详细信息，包括其中的表格数据。

## 最实用的解决方案

**建议**：
1. 在 Lark Wiki 页面中，找到表格右上角的"更多"菜单（三个点）
2. 选择"作为独立表格打开"或"在新窗口打开"
3. 从新窗口的 URL 中获取真实的 Spreadsheet Token
4. 使用获取到的真实 Spreadsheet Token 调用 Sheets API

例如，新窗口的 URL 可能是：
```
https://xxx.feishu.cn/sheets/真实SpreadsheetToken
```

然后使用这个真实的 Spreadsheet Token 替换原来的 `WZA6wM6PFitELDkYEu4lmI92gWh`。






