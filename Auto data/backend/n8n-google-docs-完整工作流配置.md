# n8n Google Docs完整工作流配置指南

## 工作流结构

```
数据清洗节点 → HTML格式化节点 → Google Docs节点
```

## 步骤1：数据清洗节点

使用 `data-cleaner-for-business-report-final.js`，输出格式化的JSON数据。

## 步骤2：HTML格式化节点（可选，如果数据清洗节点已输出HTML可跳过）

### 节点类型
Code节点

### 代码
使用 `google-docs-html-formatter.js` 中的代码，或者如果数据清洗节点已经输出了HTML，可以直接使用。

## 步骤3：Google Docs节点配置

### 配置说明

#### 方法一：使用分页符创建新页面（推荐）

**操作类型**：`Update`

**文档URL**：
```
https://docs.google.com/document/d/1IUMB1GX2A0j76745LMdXG81pclMLJk6eyWd3uKQxYUo/edit
```

**Actions配置**：

1. **第一个Action**：插入分页符
   - **Action**: `insertPageBreak`
   - **Location**: `endOfDocument`

2. **第二个Action**：插入内容
   - **Action**: `insert`
   - **Location**: `endOfDocument`
   - **Text**: 
   ```javascript
   ={{ '\n\n# ' + $json.periodInfo.currentPeriod + ($json.periodInfo.periodType === 'weekly' ? '周度' : '月度') + '数据报告\n\n' + '报告周期: ' + $json.periodInfo.currentPeriodFull + ($json.periodInfo.previousPeriodFull ? ' vs ' + $json.periodInfo.previousPeriodFull : '') + '\n\n' + '---\n\n' + $json.html }}
   ```

#### 方法二：如果数据清洗节点输出的是JSON，需要先转换为HTML

**工作流**：
```
数据清洗节点 → HTML格式化节点 → Google Docs节点
```

**HTML格式化节点**（Code节点）：
```javascript
const input = $input.first().json;

// 如果数据清洗节点已经输出了HTML，直接使用
if (input.html) {
  return [{
    json: {
      html: input.html,
      periodInfo: input.periodInfo
    }
  }];
}

// 否则，需要从JSON生成HTML
// 这里可以使用google-docs-html-formatter.js中的代码
```

**Google Docs节点配置**：
- **Action 1**: `insertPageBreak`, `endOfDocument`
- **Action 2**: `insert`, `endOfDocument`, `={{ $json.html }}`

## 完整配置示例

### 方案A：数据清洗节点直接输出HTML

如果您的数据清洗节点已经输出了HTML格式的内容，Google Docs节点配置如下：

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

### 方案B：数据清洗节点输出JSON，需要转换为HTML

**工作流**：
1. 数据清洗节点（输出JSON）
2. HTML格式化节点（Code节点，将JSON转换为HTML）
3. Google Docs节点（插入HTML）

**HTML格式化节点代码**：
```javascript
// 使用google-docs-html-formatter.js中的完整代码
```

**Google Docs节点配置**：
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

## 关于"标签页"的说明

Google Docs API不支持直接创建"标签页"（tabs），但可以通过以下方式实现类似效果：

1. **使用分页符**：每次插入内容前插入分页符，创建新页面
2. **使用标题分隔**：使用大标题（H1/H2）标识不同周期的报告
3. **使用分隔线**：使用水平线或等号分隔不同内容

## 注意事项

1. **HTML格式支持**：Google Docs支持基本的HTML格式，但样式支持有限
2. **内容大小**：如果内容很大，可能需要分批插入
3. **权限**：确保Google Docs OAuth2凭据有写入权限
4. **错误处理**：建议添加错误处理节点，确保写入失败时能够重试

## 推荐配置

基于您的需求，推荐使用以下配置：

1. **数据清洗节点**：输出包含`html`字段的JSON
2. **Google Docs节点**：
   - Action 1: `insertPageBreak`（创建新页面）
   - Action 2: `insert`（插入HTML内容）

这样每次运行工作流时，都会在文档末尾创建新页面并插入新周期的报告内容。












