# Athena S3 文件未找到错误修复指南

## 错误信息
```
The resource you are requesting could not be found
```

## 可能的原因

### 1. 查询还在执行中（最可能）

从输入数据看，`result` 字段是 `"查询已启动,正在执行中..."`，说明查询可能还在执行中，文件还没有生成。

**检查方法**：
- 查看 `result` 字段
- 如果包含 "执行中"、"正在执行"、"启动" 等字样，说明查询还在运行

**解决方案**：
- 等待查询完成后再下载文件
- 或者添加等待逻辑，轮询查询状态直到完成

---

### 2. 文件路径不正确

**检查 S3 文件路径**：
- Bucket: `aws-athena-query-results-us-west-2-034986963036`
- File Key: `{queryId}.csv`
- 完整路径: `s3://aws-athena-query-results-us-west-2-034986963036/{queryId}.csv`

**验证方法**：
- 在 AWS Console 中检查 S3 bucket
- 确认文件是否存在
- 确认文件名是否正确（包括扩展名）

---

### 3. 文件还没有写入完成

即使查询状态显示 "SUCCEEDED"，文件写入 S3 可能需要几秒钟时间。

**解决方案**：
- 在查询完成后，等待几秒钟再下载
- 或者添加重试逻辑

---

### 4. 权限问题

确保 AWS 凭证有权限访问 S3 bucket 和文件。

---

## 解决方案

### 方案1：添加查询状态检查节点（推荐）

在 HTTP Request 节点之前添加 Code 节点，检查查询状态：

```javascript
// n8n Code节点：检查查询状态
const item = $input.first().json;

const queryId = item.queryId;
const result = item.result || '';

// 检查查询是否完成
const isQueryRunning = result.includes('执行中') || 
                       result.includes('正在执行') || 
                       result.includes('启动');

const isQueryCompleted = result.includes('完成') || 
                        result.includes('成功');

if (isQueryRunning) {
  throw new Error(`⏳ 查询还在执行中，请等待查询完成后再下载文件。当前状态: ${result}`);
}

if (!isQueryCompleted) {
  console.warn(`⚠️ 查询状态未知: ${result}`);
}

return [{
  json: {
    ...item,
    canDownload: isQueryCompleted && !isQueryRunning
  }
}];
```

**工作流结构**：
```
[上游节点] 
  ↓ (输出: { queryId, result })
[Code 节点 - 检查查询状态]
  ↓ (如果查询完成，继续)
[HTTP Request - 下载文件]
  ↓ (输出: binary.data)
```

---

### 方案2：添加等待和重试逻辑

在 HTTP Request 节点中添加重试逻辑，或者使用 Loop 节点等待查询完成。

**使用 IF 节点**：
1. 添加 IF 节点检查 `result` 是否包含 "完成" 或 "成功"
2. 如果完成，继续到 HTTP Request
3. 如果未完成，等待后重试或报错

---

### 方案3：使用 AWS Athena API 检查查询状态

如果 n8n 支持 AWS SDK，可以使用 Athena API 检查查询状态：

```javascript
// 注意：n8n Code 节点不支持 require('aws-sdk')
// 这个方法需要其他方式实现
```

---

### 方案4：修改 HTTP Request 节点配置

确保 HTTP Request 节点配置正确：

**URL**：
```
https://aws-athena-query-results-us-west-2-034986963036.s3.us-west-2.amazonaws.com/{{ $json.queryId }}.csv
```

**Authentication**：
- 选择 AWS 凭证
- 确保区域是 `us-west-2`

**Options**：
- Response Format: `File`
- Output Property Name: `data`
- Timeout: `300000` (5分钟)

**Error Handling**：
- 启用 "Continue On Fail"
- 或者添加错误处理逻辑

---

## 快速诊断步骤

1. **检查查询状态**：
   - 查看 `result` 字段
   - 如果包含 "执行中"，说明查询还在运行

2. **检查 S3 文件**：
   - 在 AWS Console 中打开 S3
   - 导航到 bucket: `aws-athena-query-results-us-west-2-034986963036`
   - 查找文件: `{queryId}.csv`
   - 如果文件不存在，说明查询还没完成或失败了

3. **检查文件路径**：
   - 确认 queryId 是否正确
   - 确认文件扩展名是 `.csv`
   - 确认 bucket 名称正确

4. **检查权限**：
   - 确认 AWS 凭证有 S3 读取权限
   - 确认可以访问该 bucket

---

## 推荐工作流

```
[上游节点] 
  ↓ (输出: { queryId, result })
[Code 节点 - 检查查询状态]
  ↓ (如果查询完成)
[IF 节点 - 判断是否可以下载]
  ↓ (True: 查询完成)
[HTTP Request - 下载文件]
  ↓ (输出: binary.data)
  ↓ (False: 查询未完成)
[等待或报错]
```

---

## 临时解决方案

如果查询还在执行中，可以：

1. **手动等待**：等待几分钟后重新运行 HTTP Request 节点
2. **使用 AWS Console**：在 Athena Console 中查看查询状态，确认完成后手动下载
3. **添加延迟**：在 HTTP Request 之前添加延迟节点，等待一段时间




