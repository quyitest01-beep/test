# n8n Google Docs节点配置方案

## 问题说明

数据清洗节点输出的是JSON格式，没有`html`字段。需要将JSON数据写入Google Docs，供后续AI读取。

## 解决方案

### 方案一：直接使用JSON字符串（最简单）

**工作流结构**：
```
数据清洗节点 → Google Docs节点
```

**Google Docs节点配置**：

1. **操作类型**：`Update`

2. **Actions配置**：
   - **Action 1**: `insertPageBreak`
     - **Location**: `endOfDocument`
   
   - **Action 2**: `insert`
     - **Location**: `endOfDocument`
     - **Text**: 
     ```javascript
     ={{ JSON.stringify($json, null, 2) }}
     ```

### 方案二：添加文本格式化节点（推荐）

**工作流结构**：
```
数据清洗节点 → JSON转文本节点 → Google Docs节点
```

**步骤1：添加Code节点（JSON转文本）**

使用 `json-to-text-for-google-docs.js` 中的代码。

**步骤2：Google Docs节点配置**

- **Action 1**: `insertPageBreak`, `endOfDocument`
- **Action 2**: `insert`, `endOfDocument`, `={{ $json.text }}` 或 `={{ $json.jsonText }}` 或 `={{ $json.markdownText }}`

### 方案三：使用表达式直接格式化（无需额外节点）

**Google Docs节点配置**：

- **Action 1**: `insertPageBreak`, `endOfDocument`
- **Action 2**: `insert`, `endOfDocument`, **Text字段使用以下表达式**：

```javascript
={{ '\n\n# ' + $json.periodInfo.currentPeriod + ($json.periodInfo.periodType === 'weekly' ? '周度' : '月度') + '数据报告\n\n' + '报告周期: ' + $json.periodInfo.currentPeriodFull + ($json.periodInfo.previousPeriodFull ? ' vs ' + $json.periodInfo.previousPeriodFull : '') + '\n\n---\n\n' + '## 完整数据（JSON格式）\n\n```json\n' + JSON.stringify($json, null, 2) + '\n```\n' }}
```

## 推荐配置（最简单）

### 直接配置Google Docs节点

**操作类型**：`Update`

**Actions配置**：

1. **第一个Action**：
   - **Action**: `insertPageBreak`
   - **Location**: `endOfDocument`

2. **第二个Action**：
   - **Action**: `insert`
   - **Location**: `endOfDocument`
   - **Text**: 
   ```javascript
   ={{ JSON.stringify($json, null, 2) }}
   ```

这样会将整个JSON数据格式化为可读的字符串写入Google Docs，AI可以直接读取和解析。

## 完整配置JSON

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
        "text": "={{ JSON.stringify($json, null, 2) }}"
      }
    ]
  }
}
```

## 如果Text字段仍然显示undefined

### 检查步骤

1. **确认上游节点输出**：
   - 检查数据清洗节点的输出，确保有数据
   - 在Google Docs节点前添加一个"Set"节点，查看数据格式

2. **使用Set节点预处理**：
   ```
   数据清洗节点 → Set节点 → Google Docs节点
   ```
   
   **Set节点配置**：
   - 添加字段：`text`
   - 值：`{{ JSON.stringify($json, null, 2) }}`

3. **Google Docs节点配置**：
   - **Text**: `={{ $json.text }}`

## 最佳实践

1. **使用Set节点**：在Google Docs节点前添加Set节点，将JSON转换为文本
2. **添加标题**：在文本前添加周期信息，便于识别
3. **格式化输出**：使用`JSON.stringify($json, null, 2)`格式化JSON，提高可读性












