# n8n Compression 节点配置修复

## 问题

Compression 节点输出格式不正确：
- 输出文件扩展名仍然是 `.csv`，应该是 `.zip`
- 输出字段名是 `data`，但 Telegram 节点读取的是 `csv`
- Telegram 节点报错：`Cannot read properties of undefined (reading 'fileName')`

## 解决方案

### 1. 修复 Compression 节点配置

**当前配置问题**：
- `Put Output File in Field`: `data` ❌
- `File Name`: `{{ $json.fileName }}` ❌（没有改为 .zip）

**正确配置**：
```json
{
  "parameters": {
    "operation": "compress",
    "inputBinaryField": "csv",
    "outputFormat": "zip",
    "fileName": "={{ $json.fileName.replace(/\\.csv$/i, '.zip') }}",
    "putOutputFileInField": "zip"
  }
}
```

**配置步骤**：
1. **Input Binary Field(s)**: `csv`（与上游节点输出匹配）
2. **Output Format**: `Zip`
3. **File Name**: `={{ $json.fileName.replace(/\.csv$/i, '.zip') }}`
   - 这个表达式会将文件名从 `.csv` 改为 `.zip`
   - 例如：`商户1716179958_10月_1.csv` → `商户1716179958_10月_1.zip`
4. **Put Output File in Field**: `zip`（重要！必须与 Telegram 节点匹配）

### 2. 修复 Telegram 节点配置

**当前配置**：
```json
{
  "binaryPropertyName": "csv"  // ❌ 错误
}
```

**正确配置**：
```json
{
  "binaryPropertyName": "zip"  // ✅ 正确，与 Compress 节点输出字段匹配
}
```

### 3. 完整工作流结构

```
处理查询结果2
    ↓
Compress (压缩文件)
    - Input: csv
    - Output: zip
    - File Name: 自动改为 .zip
    ↓
发送文件2 (Telegram)
    - Binary Property Name: zip
```

## 验证步骤

1. **检查 Compression 节点输出**：
   - 切换到 "Binary" 标签页
   - 应该看到：
     - Type: `zip`
     - File Extension: `.zip`
     - Mime Type: `application/zip`
     - File Size: 应该比原始文件小很多

2. **检查 Telegram 节点输入**：
   - 切换到 "Binary" 标签页
   - 应该看到 `zip` 字段，而不是 `csv` 字段

## 常见错误

### 错误 1：字段名不匹配
- **症状**：Telegram 节点报错 `Cannot read properties of undefined`
- **原因**：Compression 节点的输出字段名与 Telegram 节点的 `binaryPropertyName` 不匹配
- **解决**：确保两者都是 `zip`

### 错误 2：文件扩展名不对
- **症状**：输出文件仍然是 `.csv`
- **原因**：`File Name` 表达式没有正确替换扩展名
- **解决**：使用 `={{ $json.fileName.replace(/\.csv$/i, '.zip') }}`

### 错误 3：压缩后文件仍然太大
- **症状**：压缩后仍然超过 50MB
- **原因**：数据压缩率低或文件本身太大
- **解决**：考虑进一步拆分文件，或使用其他发送方式

## 预期结果

压缩前：
- 文件大小：60-70 MB
- 文件格式：CSV

压缩后：
- 文件大小：15-35 MB（减少 50-80%）
- 文件格式：ZIP
- 文件扩展名：`.zip`
- Mime Type：`application/zip`

## 相关文档

- n8n Compress 节点文档：https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.compress/
- Telegram Bot API 文档：https://core.telegram.org/bots/api#senddocument

