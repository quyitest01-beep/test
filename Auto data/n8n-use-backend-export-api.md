# 使用后端Export API的n8n配置方案

## 方案概述

不使用n8n的"Convert to XLSX"节点，而是直接调用后端的`/api/export`接口，这个接口已经过充分测试，使用ExcelJS库生成标准的xlsx文件。

## 优势

- ✅ 使用经过测试的后端代码
- ✅ 支持大数据量（自动分片）
- ✅ 支持中文文件名
- ✅ 更好的错误处理
- ✅ 统一的导出逻辑

## n8n工作流配置

### 方案A：直接下载文件

```
[查询节点] → [HTTP Request节点] → [Respond to Webhook]
```

#### HTTP Request节点配置

```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/export",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": []
  },
  "jsonBody": "={{ JSON.stringify({\n  data: $json.data || [$json],\n  format: 'excel',\n  options: {\n    filename: 'query_result_' + new Date().getTime(),\n    sheetName: '查询结果',\n    includeMetadata: true\n  }\n}) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "file",
        "outputPropertyName": "data"
      }
    }
  }
}
```

#### Respond to Webhook节点配置

```json
{
  "respondWith": "binary",
  "binaryProperty": "data",
  "responseCode": 200,
  "responseHeaders": {
    "entries": [
      {
        "name": "Content-Type",
        "value": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      {
        "name": "Content-Disposition",
        "value": "attachment; filename=\"query_result.xlsx\""
      }
    ]
  }
}
```

### 方案B：使用Code节点准备数据

如果你的数据需要预处理，可以在HTTP Request之前添加Code节点：

```
[查询节点] → [Code节点] → [HTTP Request节点] → [Respond to Webhook]
```

#### Code节点代码

```javascript
// 提取和格式化数据
const items = $input.all();
let data = [];

// 提取数据数组
for (const item of items) {
  const json = item.json;
  
  if (Array.isArray(json)) {
    data = json;
    break;
  } else if (json.data && Array.isArray(json.data)) {
    data = json.data;
    break;
  } else if (typeof json === 'object') {
    data.push(json);
  }
}

// 数据清洗（可选）
data = data.map(row => {
  const cleanRow = {};
  for (const [key, value] of Object.entries(row)) {
    // 移除null/undefined
    if (value != null) {
      cleanRow[key] = value;
    }
  }
  return cleanRow;
});

console.log(`准备导出 ${data.length} 行数据`);

// 返回格式化后的数据
return [{
  json: {
    data: data,
    exportOptions: {
      filename: `query_result_${new Date().toISOString().split('T')[0]}`,
      sheetName: '查询结果',
      includeMetadata: true
    }
  }
}];
```

#### HTTP Request节点配置（使用Code节点输出）

```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/export",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
      }
    ]
  },
  "sendBody": true,
  "jsonBody": "={{ JSON.stringify({\n  data: $json.data,\n  format: 'excel',\n  options: $json.exportOptions\n}) }}",
  "options": {
    "response": {
      "response": {
        "responseFormat": "file"
      }
    }
  }
}
```

### 方案C：保存到服务器文件系统

如果你想保存文件而不是直接下载：

```
[查询节点] → [HTTP Request节点] → [Move Binary Data节点] → [Write Binary File节点]
```

#### Write Binary File节点配置

```json
{
  "fileName": "={{ $json.filename || 'query_result.xlsx' }}",
  "dataPropertyName": "data",
  "options": {
    "append": false
  }
}
```

## 完整的n8n工作流JSON

```json
{
  "name": "查询结果导出到Excel",
  "nodes": [
    {
      "parameters": {},
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "jsCode": "// 你的查询逻辑\nconst data = [\n  { \"工作日\": \"2026225\", \"游戏名\": \"Acme Bash\", \"花费金额\": 155 },\n  { \"工作日\": \"2026226\", \"游戏名\": \"Maze World\", \"花费金额\": 1834 }\n];\n\nreturn [{ json: { data: data } }];"
      },
      "name": "查询数据",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:8000/api/export",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-api-key",
              "value": "f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3414f18c03d0b83d"
            }
          ]
        },
        "sendBody": true,
        "contentType": "json",
        "body": "={{ JSON.stringify({ data: $json.data, format: 'excel', options: { filename: 'query_result', sheetName: '查询结果' } }) }}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        }
      },
      "name": "调用导出API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [650, 300]
    },
    {
      "parameters": {
        "respondWith": "binary",
        "binaryProperty": "data",
        "responseHeaders": {
          "entries": [
            {
              "name": "Content-Type",
              "value": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            },
            {
              "name": "Content-Disposition",
              "value": "attachment; filename=\\\"query_result.xlsx\\\""
            }
          ]
        }
      },
      "name": "返回文件",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "查询数据", "type": "main", "index": 0 }]]
    },
    "查询数据": {
      "main": [[{ "node": "调用导出API", "type": "main", "index": 0 }]]
    },
    "调用导出API": {
      "main": [[{ "node": "返回文件", "type": "main", "index": 0 }]]
    }
  }
}
```

## 测试步骤

1. **导入工作流**：
   - 在n8n中创建新工作流
   - 复制上面的JSON
   - 点击"Import from JSON"

2. **配置API Key**：
   - 在"调用导出API"节点中
   - 确认x-api-key的值正确

3. **测试工作流**：
   - 点击"Execute Workflow"
   - 检查每个节点的输出
   - 下载生成的xlsx文件

4. **验证文件**：
   - 用Excel或WPS打开文件
   - 确认数据正确显示
   - 检查中文字符是否正常

## 故障排查

### 问题1：API返回401错误
**原因**：API Key不正确
**解决**：检查x-api-key header的值

### 问题2：API返回400错误
**原因**：请求body格式不正确
**解决**：确保data字段是数组格式

### 问题3：文件下载但无法打开
**原因**：响应格式设置不正确
**解决**：确保HTTP Request节点的responseFormat设置为"file"

### 问题4：中文文件名乱码
**原因**：Content-Disposition header编码问题
**解决**：使用英文文件名或URL编码

## 后端API文档

### 请求格式

```http
POST /api/export
Content-Type: application/json
x-api-key: your-api-key

{
  "data": [
    { "列1": "值1", "列2": "值2" },
    { "列1": "值3", "列2": "值4" }
  ],
  "format": "excel",
  "options": {
    "filename": "result",
    "sheetName": "Sheet1",
    "strategy": "auto",
    "includeMetadata": true
  }
}
```

### 响应格式

成功时返回xlsx文件的二进制流：
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="result.xlsx"

[二进制数据]
```

失败时返回JSON错误：
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 需要帮助？

如果遇到问题，请提供：
1. n8n工作流的完整JSON
2. HTTP Request节点的错误信息
3. 后端服务器的日志（backend/logs/）
