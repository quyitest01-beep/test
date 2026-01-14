# n8n 邮件发送附件配置修复

## 问题诊断

**错误信息**：`The item has no binary field 'data' [item 0]`

**原因**：邮件节点配置中 `attachments: "data"` 期望找到名为 `data` 的 binary 字段，但上游输出的字段名是 `attachment_1`、`attachment_2` 等。

## 解决方案

### 方案1：修改邮件节点配置（推荐）

根据上游代码的输出，binary 字段名可能是：
- `attachment_1`、`attachment_2`、`attachment_3`（如果有多个文件）
- 或者基于文件名的 key（如 `商户投注用户数据`）

**如果只有单个文件**，修改配置为：

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - 2025-11-03 至 2025-11-09",
    "emailFormat": "text",
    "text": "统计周期：2025-11-03 至 2025-11-09\n请查收附件中的周度用户数据报表\n祝好！",
    "options": {
      "appendAttribution": false,
      "attachments": "attachment_1"
    }
  }
}
```

**如果有多个文件**，需要设置为支持多个附件：

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - 2025-11-03 至 2025-11-09",
    "emailFormat": "text",
    "text": "统计周期：2025-11-03 至 2025-11-09\n请查收附件中的周度用户数据报表\n祝好！",
    "options": {
      "appendAttribution": false,
      "attachments": "={{ [$binary.attachment_1, $binary.attachment_2, $binary.attachment_3].filter(Boolean) }}"
    }
  }
}
```

### 方案2：修改上游代码，输出统一的 `data` 字段

如果希望使用统一的 `data` 字段名，可以修改 `xlsx-email-preparer.js`：

在输出部分，添加一个 `data` 字段指向第一个文件：

```javascript
// 在 xlsx-email-preparer.js 的返回部分
return [{
  json: output,
  binary: {
    ...binaryOutput,
    data: fileData[0] || null  // 添加 data 字段指向第一个文件
  }
}];
```

### 方案3：使用表达式动态获取所有附件（最佳）

**重要**：n8n 邮件节点的 `attachments` 参数期望的是**逗号分隔的字段名字符串**（如 `"attachment_1,attachment_2"`），不是数组！

使用 n8n 表达式动态获取所有 binary 字段名（用逗号连接）：

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - 2025-11-03 至 2025-11-09",
    "emailFormat": "text",
    "text": "统计周期：2025-11-03 至 2025-11-09\n请查收附件中的周度用户数据报表\n祝好！",
    "options": {
      "appendAttribution": false,
      "attachments": "={{ $json.attachment_keys.join(',') }}"
    }
  }
}
```

或者使用：

```json
{
  "options": {
    "appendAttribution": false,
    "attachments": "={{ Object.keys($binary).filter(key => key.startsWith('attachment_')).join(',') }}"
  }
}
```

这个表达式会：
1. 获取所有 binary 字段名
2. 过滤出以 `attachment_` 开头的字段
3. 用逗号连接成字符串，如 `"attachment_1,attachment_2,attachment_3"`
4. 邮件节点会解析这个字符串，自动找到对应的 binary 对象（包含 fileName、mimeType 等）

## 推荐配置（完整版 - 支持多个文件）

### 配置1：使用 json 中的 attachment_keys（最推荐）

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - {{ $json.period.last_week }}",
    "emailFormat": "text",
    "text": "={{ `统计周期：${$json.period_text.last_week}\n请查收附件中的周度用户数据报表（共${$json.attachment_count}个文件）\n祝好！` }}",
    "options": {
      "appendAttribution": false,
      "attachments": "={{ $json.attachment_keys.join(',') }}"
    }
  }
}
```

### 配置2：自动获取所有附件

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - {{ $json.period.last_week }}",
    "emailFormat": "text",
    "text": "={{ `统计周期：${$json.period_text.last_week}\n请查收附件中的周度用户数据报表\n祝好！` }}",
    "options": {
      "appendAttribution": false,
      "attachments": "={{ Object.keys($binary).filter(key => key.startsWith('attachment_')).join(',') }}"
    }
  }
}
```

### 配置3：明确指定所有附件（适用于固定数量文件）

如果有6个固定文件，可以明确指定：

```json
{
  "parameters": {
    "fromEmail": "poon@gaming-panda.com",
    "toEmail": "=poon@gaming-panda.com",
    "subject": "=周度用户数据报表 - {{ $json.period.last_week }}",
    "emailFormat": "text",
    "text": "={{ `统计周期：${$json.period_text.last_week}\n请查收附件中的周度用户数据报表\n祝好！` }}",
    "options": {
      "appendAttribution": false,
      "attachments": "attachment_1,attachment_2,attachment_3,attachment_4,attachment_5,attachment_6"
    }
  }
}
```

这样配置的优势：
1. 自动使用周期信息（来自上游代码的输出）
2. 自动获取所有附件（不管有多少个文件）
3. 动态生成邮件主题和正文
4. 显示附件数量（配置2）

