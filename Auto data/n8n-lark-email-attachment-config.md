# n8n 飞书/Lark 邮件节点附件配置指南

## 问题
如何在飞书邮件节点中添加多个CSV文件作为附件？

## ⚠️ 重要：飞书节点的附件配置方式

飞书邮件节点的 Attachments 配置有**两种模式**：

### 模式1: 简单字符串模式（推荐）

**不要点击 "Add option" 按钮！**

直接在 **Attachments** 字段中填写字符串：

```
binary:attachment_1,binary:attachment_2,binary:attachment_3
```

或者使用表达式（点击右侧fx按钮）：

```javascript
{{ Object.keys($json.binary || {}).filter(k => k.startsWith('attachment_')).map(k => 'binary:' + k).join(',') }}
```

### 模式2: 结构化配置模式（如果你点了Add option）

如果你已经点了 "Add option"，会看到一个表单，需要这样填写：

**对于每个附件**，点击 "Add Attachment"，然后：

1. **Property Name**: 填写 `attachment_1`（或 `attachment_2`, `attachment_3`）
2. **Input Data Field Name**: 留空或填写 `data`

**或者使用表达式模式**：

1. 点击 "Add Attachment" 旁边的 **fx** 按钮
2. 输入表达式：

```javascript
{{ Object.keys($json.binary || {}).filter(k => k.startsWith('attachment_')).map(k => ({ 'property': k })) }}
```

## 推荐配置步骤

### 步骤1: 清除现有配置

如果你已经添加了附件配置但报错，先删除它们：
1. 点击每个附件配置右侧的 ❌ 删除
2. 确保 Attachments 区域是空的

### 步骤2: 使用简单字符串模式

**不要点击 "Add option"！**

直接在 Attachments 字段中填写：

```
binary:attachment_1,binary:attachment_2,binary:attachment_3
```

### 步骤3: 测试

保存并运行工作流，检查邮件是否包含3个附件。

### 方法3: 使用Code节点动态生成附件列表

如果上面的表达式不工作，可以在文件处理节点后添加一个Code节点：

```javascript
const items = $input.all();

return items.map(item => {
  const binary = item.binary || {};
  
  // 找到所有 attachment_ 开头的key
  const attachmentKeys = Object.keys(binary).filter(k => k.startsWith('attachment_'));
  
  // 生成附件字符串
  const attachmentString = attachmentKeys.map(k => `binary:${k}`).join(',');
  
  return {
    json: {
      ...item.json,
      attachmentList: attachmentString,  // 添加这个字段
      attachmentKeys: attachmentKeys     // 调试用
    },
    binary: binary
  };
});
```

然后在飞书邮件节点的 Attachments 字段中填写：

```
{{ $json.attachmentList }}
```

## 验证配置

### 1. 检查文件处理节点输出

运行文件处理节点后，查看输出的 Binary 标签页，应该看到：
- `attachment_1`
- `attachment_2`
- `attachment_3`
- 可能还有 `data`（如果只有1个文件）

### 2. 检查邮件节点输入

在邮件节点的 INPUT 标签页，确认：
- Binary 数据包含所有 attachment_X
- JSON 中有 files 数组，包含所有文件信息

### 3. 测试发送

发送测试邮件，检查：
- 邮件中有3个附件
- 每个附件大小正常（不是9字节）
- 可以下载并打开

## 常见问题

### Q1: 附件字段不接受表达式？

**解决方案**：点击字段右侧的 **fx** 按钮，切换到表达式模式。

### Q2: 只发送了1个附件？

**原因**：可能是附件字符串格式不对。

**检查**：
1. 确保用英文逗号分隔
2. 确保每个附件都有 `binary:` 前缀
3. 确保没有多余的空格

### Q3: 附件还是9字节？

**原因**：文件处理节点的binary数据有问题。

**解决方案**：
1. 检查上游的 Convert to File 节点是否正确生成了CSV
2. 在文件处理节点前添加调试节点，检查binary数据
3. 确保使用了修复后的 `n8n-csv-passthrough-simple.js` 代码

## 完整配置示例

### 飞书邮件节点配置

```
收件人: {{ $json.recipient }}
主题: 每日数据报告 - {{ $json.period.yesterday_today }}
正文:
您好！

这是 {{ $json.period_text.yesterday_today }} 的数据报告。

附件包含以下文件：
{{#each $json.files}}
- {{ this.fileName }}
{{/each}}

请查收。

附件: {{ Object.keys($json.binary || {}).filter(k => k.startsWith('attachment_')).map(k => 'binary:' + k).join(',') }}
```

### 或者使用固定格式

```
收件人: user@example.com
主题: 每日数据报告
正文: 请查收附件
附件: binary:attachment_1,binary:attachment_2,binary:attachment_3
```

## 调试技巧

### 添加调试Code节点

在邮件节点前添加：

```javascript
const item = $input.first();
const binary = item.binary || {};

console.log('=== 邮件节点输入检查 ===');
console.log('Binary keys:', Object.keys(binary).join(', '));

Object.keys(binary).forEach(key => {
  const bin = binary[key];
  if (bin && bin.fileName) {
    console.log(`${key}:`);
    console.log(`  fileName: ${bin.fileName}`);
    console.log(`  data length: ${bin.data ? bin.data.length : 0}`);
  }
});

// 生成附件字符串
const attachmentKeys = Object.keys(binary).filter(k => k.startsWith('attachment_'));
const attachmentString = attachmentKeys.map(k => `binary:${k}`).join(',');

console.log('\n附件字符串:', attachmentString);

return $input.all();
```

查看日志，确认：
1. Binary keys 包含所有 attachment_X
2. 每个文件的 data length 都很大（不是9）
3. 附件字符串格式正确

## 总结

**最简单的配置**：

在飞书邮件节点的 **Attachments** 字段中，切换到表达式模式（点击fx），填写：

```
binary:attachment_1,binary:attachment_2,binary:attachment_3
```

如果文件数量不固定，使用：

```javascript
{{ Object.keys($json.binary || {}).filter(k => k.startsWith('attachment_')).map(k => 'binary:' + k).join(',') }}
```

这样就能发送所有附件了！
