# n8n Google Docs节点配置指南

## 问题说明

Google Docs API本身不支持直接创建"标签页"（tabs），但可以通过以下方式实现类似效果：

## 方案一：使用分页符和标题分隔（推荐）

### 配置步骤

1. **操作类型**：选择 `Update`（更新文档）

2. **文档URL**：使用完整的文档URL
   ```
   https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit
   ```

3. **Actions配置**：
   - **Action**: `Insert`
   - **Location**: `End of Document`（文档末尾）
   - **Text**: 使用以下格式
   ```javascript
   ={{ "\n\n" + "=".repeat(80) + "\n\n" + "## " + $json.periodInfo.currentPeriod + " 数据报告\n\n" + $json.html }}
   ```

### 完整配置示例

```json
{
  "operation": "update",
  "documentURL": "https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit",
  "actionsUi": {
    "actionFields": [
      {
        "action": "insert",
        "location": "endOfDocument",
        "text": "={{ '\\n\\n' + '='.repeat(80) + '\\n\\n' + '## ' + $json.periodInfo.currentPeriod + ' 数据报告\\n\\n' + $json.html }}"
      }
    ]
  }
}
```

## 方案二：使用Code节点预处理HTML内容

如果您的数据清洗节点输出的是JSON格式，需要先转换为HTML，然后再插入到Google Docs。

### 工作流结构

```
数据清洗节点 → HTML转换节点 → Google Docs节点
```

### HTML转换节点代码

```javascript
// n8n Code节点：将清洗后的数据转换为HTML格式
const input = $input.first().json;

// 提取周期信息
const currentPeriod = input.periodInfo?.currentPeriod || '未知周期';
const periodType = input.periodInfo?.periodType === 'weekly' ? '周度' : '月度';

// 构建HTML内容
let htmlContent = `
<div style="page-break-before: always;">
  <h1>${currentPeriod}${periodType}数据报告</h1>
  <hr>
  
  <h2>一、总体运营概览</h2>
  <p>总GGR: $${input.overall?.current?.totalGGRUSD?.toLocaleString('en-US') || 0}</p>
  <p>总投注: $${input.overall?.current?.totalBetUSD?.toLocaleString('en-US') || 0}</p>
  <p>总局数: ${input.overall?.current?.totalRounds?.toLocaleString('en-US') || 0}</p>
  
  <!-- 添加更多内容 -->
</div>
`;

return [{
  json: {
    html: htmlContent,
    periodInfo: input.periodInfo
  }
}];
```

### Google Docs节点配置

```json
{
  "operation": "update",
  "documentURL": "https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit",
  "actionsUi": {
    "actionFields": [
      {
        "action": "insert",
        "location": "endOfDocument",
        "text": "={{ $json.html }}"
      }
    ]
  }
}
```

## 方案三：使用分页符创建新页面

### 配置示例

```json
{
  "operation": "update",
  "documentURL": "https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit",
  "actionsUi": {
    "actionFields": [
      {
        "action": "insertPageBreak",
        "location": "endOfDocument"
      },
      {
        "action": "insert",
        "location": "endOfDocument",
        "text": "={{ '## ' + $json.periodInfo.currentPeriod + ' 数据报告\\n\\n' + $json.html }}"
      }
    ]
  }
}
```

## 方案四：如果必须使用标签页（需要Google Apps Script）

如果确实需要使用Google Docs的"标签页"功能，需要通过Google Apps Script来实现：

### 1. 创建Google Apps Script

在Google Docs中，点击"扩展程序" → "Apps Script"，添加以下代码：

```javascript
function createNewTab(tabName) {
  // 注意：Google Docs API可能不支持直接创建标签页
  // 这个功能可能需要使用Google Workspace API
  // 或者通过其他方式实现
}

function insertContentToTab(tabName, content) {
  // 插入内容到指定标签页
}
```

### 2. 在n8n中调用Apps Script

使用HTTP Request节点调用Apps Script的Web App URL。

## 推荐配置（基于您的需求）

### 步骤1：确保数据清洗节点输出HTML

修改数据清洗节点，在最后添加HTML转换：

```javascript
// 在data-cleaner-for-business-report-final.js的最后添加
const htmlContent = `
<div style="page-break-before: always;">
  <h1>${output.periodInfo.currentPeriod}数据报告</h1>
  <p>报告周期: ${output.periodInfo.currentPeriodFull}</p>
  <!-- 更多HTML内容 -->
</div>
`;

return [{
  json: {
    ...output,
    html: htmlContent
  }
}];
```

### 步骤2：配置Google Docs节点

```json
{
  "operation": "update",
  "documentURL": "https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit",
  "actionsUi": {
    "actionFields": [
      {
        "action": "insertPageBreak",
        "location": "endOfDocument"
      },
      {
        "action": "insert",
        "location": "endOfDocument",
        "text": "={{ $json.html }}"
      }
    ]
  }
}
```

## 注意事项

1. **分页符**：使用`insertPageBreak`可以在文档中创建新页面，虽然不是标签页，但可以实现内容分隔
2. **HTML格式**：Google Docs支持基本的HTML格式，但样式支持有限
3. **内容大小**：如果内容很大，可能需要分批插入
4. **权限**：确保Google Docs OAuth2凭据有写入权限

## 最佳实践

1. **使用标题分隔**：每次插入内容时，使用大标题（H1/H2）标识周期
2. **添加分隔线**：使用水平线（`<hr>`）或等号分隔不同周期的报告
3. **格式化内容**：使用HTML格式化内容，提高可读性
4. **错误处理**：添加错误处理节点，确保写入失败时能够重试












