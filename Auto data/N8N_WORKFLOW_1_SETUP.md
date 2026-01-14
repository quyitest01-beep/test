# n8n 工作流配置教程 - 智能查询

## 📋 概述

本教程将手把手教你在 n8n 中配置"智能查询"工作流。

**功能**：用户输入自然语言 → 转换为 SQL → 查询 Athena → 返回 Excel 结果

**预计配置时间**：15-20 分钟

---

## 🎯 最终效果

```
用户发送请求
  ↓
POST http://your-n8n/webhook/intelligent-query
Body: {"query": "查询最近7天的用户数"}
  ↓
n8n 工作流自动执行
  ↓
返回查询结果和Excel下载链接
```

---

## 📝 前置准备

### 1. 确保后端服务运行中

```bash
# 测试后端API
curl -H "X-API-Key: your-api-key" \
  http://localhost:8000/api/webhook/health
```

### 2. 准备 API 密钥

- 你的 Athena API Key（从 `.env` 文件获取）
- 记录后端服务器地址（如 `http://localhost:8000`）

### 3. 登录 n8n

- n8n Cloud: https://app.n8n.cloud
- 自建: http://your-server:5678

---

## 🚀 配置步骤

### 步骤 1: 创建新工作流

1. 在 n8n 中，点击左侧 **"Workflows"**
2. 点击右上角 **"+ Add workflow"**
3. 工作流名称改为：`智能查询 - 自然语言转SQL`

---

### 步骤 2: 添加 Webhook 触发器

#### 2.1 添加节点

1. 点击画布上的 **"+"** 按钮
2. 搜索 `Webhook`
3. 选择 **"Webhook"** 节点

#### 2.2 配置 Webhook 节点

**基本设置**:
- **Node Name**: `Webhook触发` （可自定义）
- **HTTP Method**: `POST`
- **Path**: `intelligent-query` （这将是你的 webhook 路径）
- **Response Mode**: `When Last Node Finishes` （默认）

**高级设置** (可选):
- **Response Code**: `200`
- **Response Data**: `All Entries`

#### 2.3 测试 Webhook

配置完成后，你会看到两个 URL：

- **Test URL**: 用于测试（临时）
  ```
  https://your-n8n-instance.app.n8n.cloud/webhook-test/intelligent-query
  ```

- **Production URL**: 用于生产（永久）
  ```
  https://your-n8n-instance.app.n8n.cloud/webhook/intelligent-query
  ```

**测试命令**:
```bash
curl -X POST https://your-n8n-instance.app.n8n.cloud/webhook-test/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询最近7天的用户数",
    "user_id": "test_user",
    "channel": "web"
  }'
```

---

### 步骤 3: 添加 HTTP Request 节点（调用查询 API）

#### 3.1 添加节点

1. 点击 Webhook 节点后面的 **"+"**
2. 搜索 `HTTP Request`
3. 选择 **"HTTP Request"** 节点

#### 3.2 配置 HTTP Request 节点

**基本设置**:
- **Node Name**: `调用查询API`
- **Method**: `POST`
- **URL**: `http://your-server:8000/api/webhook/query/natural`
  > ⚠️ 替换为你的实际服务器地址

**认证设置**:
1. 点击 **Authentication** 下拉框
2. 选择 **Predefined Credential Type**
3. 在 **Credential Type** 选择 **Header Auth**
4. 点击 **Create New Credential**

**配置 Header Auth 凭证**:
- **Credential Name**: `Athena API Key`
- **Name**: `X-API-Key`
- **Value**: `你的API密钥`（从 backend/.env 获取）
- 点击 **Save**

**Headers 设置**:
1. 打开 **Send Headers** 开关
2. 点击 **Add Header**
3. 配置：
   - **Name**: `Content-Type`
   - **Value**: `application/json`

**Body 设置**:
1. 打开 **Send Body** 开关
2. 打开 **Specify Body** 开关
3. 在 **Body Content Type** 选择 **JSON**
4. 点击 **JSON** 标签
5. 输入以下内容：

```json
{
  "query": "={{ $json.body.query }}",
  "maxRows": "={{ $json.body.maxRows || 10000 }}",
  "timeout": 120000
}
```

> 💡 **表达式说明**:
> - `={{ $json.body.query }}` - 从 Webhook 接收的请求体中获取 `query` 字段
> - `={{ $json.body.maxRows || 10000 }}` - 获取 `maxRows`，如果没有则默认 10000

**Options 设置**:
1. 展开 **Options**
2. 设置 **Timeout**: `120000` （120秒）

---

### 步骤 4: 添加 Code 节点（处理查询结果）

#### 4.1 添加节点

1. 点击 HTTP Request 节点后面的 **"+"**
2. 搜索 `Code`
3. 选择 **"Code"** 节点

#### 4.2 配置 Code 节点

**基本设置**:
- **Node Name**: `处理查询结果`
- **Mode**: `Run Once for All Items` （默认）

**代码**:

点击 **JavaScript** 标签，输入以下代码：

```javascript
// 处理查询结果
const response = $input.item.json;

// 检查查询是否成功
if (!response.success) {
  throw new Error('查询失败: ' + (response.message || response.error));
}

// 提取数据
const rows = response.data.rows || [];
const columns = response.data.columns || [];
const rowCount = response.data.rowCount || 0;
const generatedSQL = response.data.generatedSQL || '';
const executionTime = response.data.executionTime || 0;

// 获取原始请求信息
const originalQuery = $node['Webhook触发'].json.body.query;
const userId = $node['Webhook触发'].json.body.user_id || 'unknown';
const channel = $node['Webhook触发'].json.body.channel || 'web';

// 返回处理后的数据
return {
  json: {
    success: true,
    query: originalQuery,
    userId: userId,
    channel: channel,
    result: {
      rows: rows,
      columns: columns,
      rowCount: rowCount,
      generatedSQL: generatedSQL,
      executionTime: executionTime
    },
    timestamp: new Date().toISOString()
  }
};
```

> 💡 **代码说明**:
> - `$input.item.json` - 获取上一个节点（HTTP Request）的输出
> - `$node['Webhook触发'].json` - 获取 Webhook 节点的数据
> - 这段代码将 API 返回的数据整理成统一格式

---

### 步骤 5: 添加 IF 节点（判断来源渠道）

#### 5.1 添加节点

1. 点击 Code 节点后面的 **"+"**
2. 搜索 `IF`
3. 选择 **"IF"** 节点

#### 5.2 配置 IF 节点

**基本设置**:
- **Node Name**: `判断来源渠道`

**条件设置**:
1. 在 **Conditions** 区域
2. 设置第一个条件：
   - **Value 1**: `={{ $json.channel }}`
   - **Operation**: `Equal`
   - **Value 2**: `lark`

> 💡 这个条件判断请求是否来自 Lark，决定后续如何返回结果

---

### 步骤 6: 添加 Convert to File 节点（生成 Excel）

#### 6.1 添加节点

1. 点击 IF 节点 **true** 输出后的 **"+"**
2. 搜索 `Convert to File`
3. 选择 **"Convert to File"** 节点

#### 6.2 配置 Convert to File 节点

**基本设置**:
- **Node Name**: `生成Excel`
- **Operation**: `Convert to File`
- **Mode**: `JSON to Spreadsheet`

**Options 设置**:
1. 展开 **Options**
2. 设置：
   - **File Name**: `={{ "query_result_" + $now.format('YYYY-MM-DD_HHmmss') + ".xlsx" }}`
   - **File Format**: `xlsx`
   - **Include Headers in Output**: 勾选 ✓

> 💡 **文件名说明**:
> - `$now.format('YYYY-MM-DD_HHmmss')` - 当前时间戳
> - 生成的文件名示例: `query_result_2025-10-10_143052.xlsx`

**数据映射**:
1. 在 **Input Data Field Name** 输入: `result.rows`
   - 这告诉节点从哪里获取要转换的数据

---

### 步骤 7: 添加 Respond to Webhook 节点（Web 响应）

#### 7.1 添加节点

1. 点击 IF 节点 **false** 输出后的 **"+"**
2. 搜索 `Respond to Webhook`
3. 选择 **"Respond to Webhook"** 节点

#### 7.2 配置 Respond to Webhook 节点

**基本设置**:
- **Node Name**: `Web响应`
- **Respond With**: `JSON`

**响应数据**:

点击 **Response Body** 的表达式按钮（fx），输入：

```json
{
  "success": true,
  "message": "查询完成",
  "data": {
    "query": "={{ $node['处理查询结果'].json.query }}",
    "generatedSQL": "={{ $node['处理查询结果'].json.result.generatedSQL }}",
    "rowCount": "={{ $node['处理查询结果'].json.result.rowCount }}",
    "executionTime": "={{ $node['处理查询结果'].json.result.executionTime }}",
    "rows": "={{ $node['处理查询结果'].json.result.rows }}"
  }
}
```

> ⚠️ **注意**: 在实际配置中，点击字段右边的 **表达式按钮 (fx)** 进入表达式模式

---

### 步骤 8: 添加 Lark 节点（可选，发送通知）

如果你想支持 Lark 通知，可以添加此节点。

#### 8.1 添加节点

1. 点击 `生成Excel` 节点后面的 **"+"**
2. 搜索 `Lark`
3. 选择 **"Lark"** 节点

#### 8.2 配置 Lark 凭证

**创建 Lark 凭证**:
1. 在 Lark 节点中，点击 **Credential to connect with**
2. 点击 **Create New Credential**
3. 填写：
   - **Credential Name**: `Lark Bot`
   - **App ID**: 你的飞书应用 ID
   - **App Secret**: 你的飞书应用密钥
4. 点击 **Save**

#### 8.3 配置 Lark 节点

**基本设置**:
- **Node Name**: `发送Lark消息`
- **Resource**: `Message`
- **Operation**: `Send`

**消息设置**:
1. **Receive Type**: `Chat ID`
2. **Chat ID**: `你的群聊ID` （或使用表达式获取）
3. **Message Type**: `Text`
4. **Content**:

```
✅ 查询完成

查询内容: {{ $node['处理查询结果'].json.query }}

生成的SQL:
```
{{ $node['处理查询结果'].json.result.generatedSQL }}
```

结果统计:
- 返回行数: {{ $node['处理查询结果'].json.result.rowCount }}
- 执行时间: {{ $node['处理查询结果'].json.result.executionTime }}ms

查询时间: {{ $now.format('YYYY-MM-DD HH:mm:ss') }}
```

---

### 步骤 9: 添加错误处理（可选但推荐）

#### 9.1 启用错误工作流

在工作流设置中：
1. 点击右上角的 **"..."** → **Settings**
2. 找到 **Error Workflow**
3. 可以选择一个错误处理工作流

#### 9.2 或在节点上设置错误处理

在每个关键节点上：
1. 点击节点
2. 点击 **Settings** 标签
3. 展开 **Error Handling**
4. 设置：
   - **On Error**: `Continue`
   - 这样即使某个节点失败，工作流也会继续执行

---

## 🎨 工作流可视化布局

```
┌─────────────┐
│ Webhook触发 │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 调用查询API │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│处理查询结果 │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│判断来源渠道 │
└──┬───────┬──┘
   │       │
 true    false
   │       │
   ↓       ↓
┌──────┐ ┌──────┐
│生成  │ │Web   │
│Excel │ │响应  │
└──┬───┘ └──────┘
   │
   ↓
┌──────┐
│Lark  │
│消息  │
└──────┘
```

---

## ✅ 测试工作流

### 测试 1: 手动执行

1. 点击工作流右上角的 **Execute Workflow** 按钮
2. 选择 **Using Test Webhook**
3. 在 Webhook 节点会看到一个 **Listen for Test Event** 按钮
4. 点击后，使用以下命令测试：

```bash
curl -X POST https://your-n8n-instance/webhook-test/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询最近7天的用户数",
    "user_id": "test_user",
    "channel": "web"
  }'
```

5. 查看每个节点的输出，确认数据流转正确

### 测试 2: 生产环境测试

1. 点击工作流右上角的 **Active** 开关，激活工作流
2. 复制 **Production URL**
3. 使用 production URL 测试：

```bash
curl -X POST https://your-n8n-instance/webhook/intelligent-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "查询最近30天的活跃用户数",
    "maxRows": 100,
    "user_id": "prod_user",
    "channel": "web"
  }'
```

---

## 🔧 常见问题排查

### 问题 1: HTTP Request 返回 401

**原因**: API Key 不正确

**解决**:
1. 检查 Header Auth 凭证中的 API Key
2. 确认后端 `.env` 文件中的 `API_KEYS` 配置
3. 测试后端 API:
   ```bash
   curl -H "X-API-Key: your-key" http://your-server:8000/api/webhook/health
   ```

### 问题 2: 查询超时

**原因**: SQL 查询时间过长

**解决**:
1. 在 HTTP Request 节点增加 timeout
2. 优化 SQL 查询（添加 WHERE、LIMIT）
3. 检查 Athena 服务状态

### 问题 3: Excel 生成失败

**原因**: 数据格式不正确

**解决**:
1. 检查 `处理查询结果` 节点的输出
2. 确认 `result.rows` 是一个数组
3. 查看节点执行日志

### 问题 4: 表达式错误

**常见错误**:
- `$json.body.query` 获取不到数据
  → 检查 Webhook 节点是否收到数据
  
- `$node['节点名'].json` 报错
  → 确认节点名称拼写正确（区分大小写）

**调试技巧**:
1. 在 Code 节点中添加 `console.log()`
2. 查看节点的 **Input** 和 **Output** 标签
3. 使用 **Execute Node** 单独测试节点

---

## 📊 监控和优化

### 查看执行历史

1. 打开工作流
2. 点击右上角的 **Executions** 标签
3. 查看每次执行的详情：
   - 执行时间
   - 成功/失败状态
   - 每个节点的输入输出

### 优化建议

#### 1. 缓存查询结果
添加 Redis 节点，缓存频繁查询的结果

#### 2. 异步处理
对于长时间查询，可以：
- 立即返回 "处理中" 状态
- 完成后通过 Webhook 回调通知

#### 3. 错误告警
配置错误时发送通知到 Lark/Slack

---

## 💡 高级配置

### 自定义响应格式

在 `Respond to Webhook` 节点，可以自定义返回格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "queryId": "={{ $runId }}",
    "query": "={{ $node['处理查询结果'].json.query }}",
    "results": "={{ $node['处理查询结果'].json.result.rows }}",
    "meta": {
      "rowCount": "={{ $node['处理查询结果'].json.result.rowCount }}",
      "executionTime": "={{ $node['处理查询结果'].json.result.executionTime }}ms",
      "timestamp": "={{ $now.toISO() }}"
    }
  }
}
```

### 添加数据验证

在 `处理查询结果` 节点前添加验证逻辑：

```javascript
const query = $json.body.query;

// 验证查询不为空
if (!query || query.trim().length === 0) {
  throw new Error('查询内容不能为空');
}

// 验证查询长度
if (query.length > 500) {
  throw new Error('查询内容过长，请简化查询');
}

// 验证是否包含危险关键词（可选）
const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE'];
const upperQuery = query.toUpperCase();
for (const keyword of dangerousKeywords) {
  if (upperQuery.includes(keyword)) {
    throw new Error(`查询包含不允许的关键词: ${keyword}`);
  }
}

return $input.item;
```

### 添加查询日志

在 `处理查询结果` 节点后添加日志节点：

```javascript
// 记录查询日志
const logData = {
  timestamp: new Date().toISOString(),
  userId: $json.userId,
  query: $json.query,
  resultCount: $json.result.rowCount,
  executionTime: $json.result.executionTime,
  success: true
};

// 可以发送到日志系统或数据库
console.log('Query Log:', JSON.stringify(logData));

return $input.item;
```

---

## 🎓 学习资源

### n8n 表达式语法

- 访问前一个节点: `$json.fieldName`
- 访问指定节点: `$node['节点名'].json.fieldName`
- 当前时间: `$now` 或 `$today`
- 执行ID: `$runId`
- 条件判断: `{{ $json.value > 100 ? 'high' : 'low' }}`

### 常用表达式示例

```javascript
// 格式化日期
$now.format('YYYY-MM-DD HH:mm:ss')

// 字符串操作
$json.name.toUpperCase()
$json.text.substring(0, 100)

// 数组操作
$json.items.length
$json.items.filter(item => item.price > 100)
$json.items.map(item => item.name)

// 数学运算
$json.price * 0.8
Math.round($json.value)

// JSON 转字符串
JSON.stringify($json)
```

---

## ✅ 配置完成检查清单

- [ ] Webhook 节点已配置，可以接收请求
- [ ] HTTP Request 节点已配置 API Key
- [ ] HTTP Request 节点的 URL 已替换为实际地址
- [ ] Code 节点代码已输入且无语法错误
- [ ] IF 节点条件已正确设置
- [ ] Convert to File 节点已配置文件名
- [ ] Respond to Webhook 节点已配置响应格式
- [ ] （可选）Lark 节点已配置凭证
- [ ] 工作流已保存
- [ ] 工作流已激活（Active 开关）
- [ ] 已测试 Test URL
- [ ] 已测试 Production URL

---

## 🎉 恭喜！

你已经成功配置了智能查询工作流！

**下一步**:
1. 配置[定时报表工作流](./N8N_WORKFLOW_2_SETUP.md)
2. 配置[游戏评级工作流](./N8N_WORKFLOW_3_SETUP.md)
3. 查看[工作流使用说明](./n8n-workflows/README.md)

---

**需要帮助？**
- 查看 [n8n 官方文档](https://docs.n8n.io)
- 查看后端日志: `backend/logs/combined.log`
- 查看 n8n 执行日志: 工作流 → Executions

**配置完成时间**: ___________  
**配置人员**: ___________

