# Lark Sheets API 错误排查指南

## 问题分析

两个节点配置格式完全相同，但一个正常一个报错，说明问题不在 URL 格式，而可能在于：

### 可能原因

1. **Sheet 不存在**
   - Sheet ID `5mcFGW` 可能不存在于 spreadsheet `WZA6wM6PFitELDkYEu4lmI92gWh` 中
   - Sheet 可能已被删除或重命名

2. **权限问题**
   - Token 可能没有访问该 spreadsheet 的权限
   - 该 spreadsheet 的访问权限可能被更改

3. **Spreadsheet Token 错误**
   - `WZA6wM6PFitELDkYEu4lmI92gWh` 可能不正确或已过期

4. **Sheet ID 错误**
   - `5mcFGW` 可能不正确
   - Sheet 的 ID 可能发生了变化

## 排查步骤

### 步骤1：验证 Sheet 是否存在

先尝试获取整个 spreadsheet 的信息，查看所有 sheets：

**新的 HTTP Request 节点配置**：
```json
{
  "parameters": {
    "url": "https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh",
    "sendQuery": false,
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.tenant_access_token }}"
        }
      ]
    }
  }
}
```

这个接口会返回 spreadsheet 的所有 sheets 信息，查看 `5mcFGW` 是否在列表中。

### 步骤2：尝试获取整个 Sheet 的数据

如果只想测试 sheet 是否存在，可以尝试不指定 range，只获取 sheet：

```json
{
  "parameters": {
    "url": "https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/5mcFGW",
    "sendQuery": false,
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.tenant_access_token }}"
        }
      ]
    }
  }
}
```

### 步骤3：验证 Spreadsheet Token

确保 `WZA6wM6PFitELDkYEu4lmI92gWh` 是正确的：
- 从 Lark 表格的 URL 中提取
- 格式：`https://xxx.feishu.cn/sheets/WZA6wM6PFitELDkYEu4lmI92gWh` 或类似格式

### 步骤4：验证 Sheet ID

Sheet ID 的获取方式：
1. 打开 Lark 表格
2. 点击要访问的 sheet 标签
3. 从 URL 中获取，或者从步骤1的响应中获取

### 步骤5：检查权限

确保 token 有访问该 spreadsheet 的权限：
- 使用相同的 token 可以访问其他 spreadsheet，说明 token 有效
- 但可能没有访问这个特定 spreadsheet 的权限

## 调试建议

### 创建一个 Code 节点来调试

在 HTTP Request 节点之前添加一个 Code 节点：

```javascript
const token = $json.tenant_access_token;
const spreadsheetToken = 'WZA6wM6PFitELDkYEu4lmI92gWh';
const sheetId = '5mcFGW';

// 先尝试获取 spreadsheet 信息
const spreadsheetUrl = `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}`;

console.log('🔍 调试信息:');
console.log(`  Spreadsheet Token: ${spreadsheetToken}`);
console.log(`  Sheet ID: ${sheetId}`);
console.log(`  Token: ${token.substring(0, 20)}...`);

return [{
  json: {
    spreadsheetToken: spreadsheetToken,
    sheetId: sheetId,
    token: token,
    // 先测试获取 spreadsheet 信息
    testUrl: spreadsheetUrl,
    // 然后测试获取 sheet 数据
    sheetUrl: `https://open.larksuite.com/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:B30`
  }
}];
```

### 测试方案

1. **测试1**：获取 spreadsheet 信息
   ```
   GET /open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh
   ```
   查看响应中的 `data.sheets[]`，确认 sheet ID

2. **测试2**：获取整个 sheet（无 range）
   ```
   GET /open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/5mcFGW
   ```

3. **测试3**：获取指定 range
   ```
   GET /open-apis/sheets/v2/spreadsheets/WZA6wM6PFitELDkYEu4lmI92gWh/values/5mcFGW!A1:B30
   ```

## 常见解决方案

### 方案1：使用正确的 Sheet ID

如果 sheet 被重命名，ID 可能不变，但最好从 API 响应中获取准确的 ID。

### 方案2：检查 Spreadsheet 访问权限

确保：
1. Token 有访问该 spreadsheet 的权限
2. Spreadsheet 没有被删除或移动
3. Token 仍然有效（未过期）

### 方案3：使用完整的 API 路径

确保 URL 完全正确，包括：
- Protocol: `https://`
- Domain: `open.larksuite.com`
- Path: `/open-apis/sheets/v2/spreadsheets/{token}/values/{sheetId}!{range}`

## 快速检查清单

- [ ] Spreadsheet Token 是否正确
- [ ] Sheet ID 是否存在（通过获取 spreadsheet 信息确认）
- [ ] Token 是否有权限访问该 spreadsheet
- [ ] URL 格式是否正确
- [ ] 是否可以通过浏览器访问该 Lark 表格






