# Lark Sheets API 获取值接口修复指南

## 问题诊断

**错误信息**：`Bad request - please check your parameters`

**可能原因**：
1. Range 参数未进行 URL 编码（`5mcFGW!A1:B30` 中的 `!` 需要编码）
2. 使用了不支持的查询参数 `page_size`
3. Authorization header 格式问题

## 正确的 API 格式

### Lark Sheets API v2 获取单元格值

**接口**：`GET /open-apis/sheets/v2/spreadsheets/{spreadsheetToken}/values/{range}`

**正确的 URL 格式**：
```
https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/5mcFGW%21A1%3AB30
```

**Range 需要 URL 编码**：
- `!` → `%21`
- `:` → `%3A`
- 所以 `5mcFGW!A1:B30` 应该编码为 `5mcFGW%21A1%3AB30`

## 修复方案

### 方案1：在 n8n HTTP Request 节点中修复（推荐）

**参数配置**：

1. **Method**: `GET`

2. **URL** (使用 JavaScript 表达式)：
```javascript
={{ `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/${encodeURIComponent('5mcFGW!A1:B30')}` }}
```

或者直接写完整的 URL（手动编码）：
```
https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/5mcFGW%21A1%3AB30
```

3. **移除 Query Parameters**：
   - 删除 `page_size` 参数（这个接口不支持分页参数）

4. **Headers**：
   - `Authorization`: `Bearer {{ $json.tenant_access_token }}`
   - `Content-Type`: `application/json`（GET 请求可能不需要，但保留也可以）

### 方案2：使用 Code 节点处理

如果 URL 需要动态处理，可以在 Code 节点中先处理：

```javascript
const token = $json.tenant_access_token;
const spreadsheetToken = 'WZA6wM6PFitELDkYEu4lmI92gWh';
const sheetId = '5mcFGW';
const range = 'A1:B30';

// URL 编码 range
const encodedRange = encodeURIComponent(`${sheetId}!${range}`);

const url = `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodedRange}`;

return [{
  json: {
    url: url,
    token: token,
    spreadsheetToken: spreadsheetToken,
    range: `${sheetId}!${range}`
  }
}];
```

然后在 HTTP Request 节点中使用：
- **URL**: `={{ $json.url }}`
- **Authorization**: `Bearer {{ $json.token }}`

## 完整的 n8n 节点配置（JSON 格式）

```json
{
  "parameters": {
    "url": "={{ `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/${encodeURIComponent('5mcFGW!A1:B30')}` }}",
    "sendQuery": false,
    "sendHeaders": true,
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
    "options": {}
  }
}
```

## 注意事项

1. **Range 格式**：
   - 简单格式：`sheetId!A1:B30`（需要 URL 编码）
   - 或者只写 sheetId：`5mcFGW`（获取整个 sheet）

2. **Token 格式**：
   - 必须是 `Bearer {token}`，不能有多余的空格

3. **API 权限**：
   - 确保 token 有读取对应 sheet 的权限
   - 确保 sheet 存在且可以被访问

4. **测试建议**：
   - 先用简单的 range（如 `5mcFGW`）测试
   - 确认 token 有效后再测试具体 range

## 常见错误对照

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| Bad request | Range 未编码 | 使用 `encodeURIComponent()` |
| Bad request | 使用了不支持的参数 | 移除 `page_size` 等查询参数 |
| 401 Unauthorized | Token 格式错误 | 确保是 `Bearer {token}` |
| 403 Forbidden | 无权限 | 检查 token 权限 |
| 404 Not Found | Sheet 不存在 | 检查 spreadsheetToken 和 sheetId |






