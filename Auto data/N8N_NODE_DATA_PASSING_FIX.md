# n8n 节点间数据传递修复指南

## 问题：节点一没有输出内容给节点二

### 症状
- 节点二收到的 `queryRequirement` 显示为 `"[object Object]"`
- 节点二无法正确读取 `queryRequirement` 的内容
- 节点二输出中所有对象类型字段都显示为 `"[object Object]"`

### 原因
1. 节点一（AI Agent）的输出中，`queryRequirement` 是对象类型
2. n8n 在传递对象类型数据时，如果没有正确序列化，会显示为 `"[object Object]"`
3. 节点二的 User Message 中使用 `{{ $json.queryRequirement || {} }}` 无法正确解析对象

## 解决方案

### 方案1：添加 Code 节点（强烈推荐）

在节点一（生成SQL）和节点二（查现有场景）之间添加一个 Code 节点。

#### 步骤1：添加 Code 节点

1. 在 n8n 工作流中，在节点一和节点二之间添加一个 Code 节点
2. 节点名称：`准备节点二输入`

#### 步骤2：配置 Code 节点

**Code 代码**：
```javascript
// 准备节点二所需的数据格式
// n8n Code节点：准备节点二输入

const input = $input.first().json;

// 从第一个AI的输出中提取数据
// 第一个AI的输出可能在 output 字段中（如果是AI Agent节点）
let aiOutput = input.output || input;

// 如果 output 是字符串，尝试解析
if (typeof aiOutput === 'string') {
  try {
    // 尝试提取JSON（处理可能的markdown包裹）
    let jsonStr = aiOutput.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }
    aiOutput = JSON.parse(jsonStr);
  } catch (e) {
    console.error('解析AI输出失败:', e);
    // 如果解析失败，使用原始input
    aiOutput = input;
  }
}

// 提取 queryRequirement
const queryRequirement = aiOutput.queryRequirement || {};

// 确保 queryRequirement 是一个对象，不是字符串
let queryRequirementObj = queryRequirement;
if (typeof queryRequirement === 'string') {
  try {
    queryRequirementObj = JSON.parse(queryRequirement);
  } catch (e) {
    queryRequirementObj = { intent: queryRequirement };
  }
}

// 构建节点二需要的输入格式
const output = {
  // 核心字段：queryRequirement 必须是对象
  queryRequirement: queryRequirementObj,
  
  // 保留所有原始字段
  type: aiOutput.type || input.type || 'unknown',
  senderid: aiOutput.senderid || input.senderid || 0,
  messagid: aiOutput.messagid || input.messagid || 0,
  chatid: aiOutput.chatid || input.chatid || '',
  text: aiOutput.text || input.text || '',
  
  // 保留其他可能需要的字段
  row_number: input.row_number,
  change_type: input.change_type,
  time: input.time,
  status: input.status,
  status2: input.status2,
  analysis: input.analysis
};

console.log('📤 准备节点二输入:', JSON.stringify(output, null, 2));
console.log('📤 queryRequirement 类型:', typeof output.queryRequirement);
console.log('📤 queryRequirement 内容:', JSON.stringify(output.queryRequirement, null, 2));

return {
  json: output
};
```

#### 步骤3：更新节点连接

```
节点一（生成SQL）
    ↓
Code节点（准备节点二输入）← 新添加
    ↓
节点二（查现有场景）
```

#### 步骤4：更新节点二的 User Message

将节点二的 User Message 更新为：

```
请判断节点一发送的查数需求是否存在匹配的知识库场景。

输入数据（必须使用这些值，不得改动）：
- queryRequirement（查数需求）：{{ JSON.stringify($json.queryRequirement || {}) }}
- queryRequirement.intent：{{ $json.queryRequirement?.intent || '' }}
- queryRequirement.extractedParams：{{ JSON.stringify($json.queryRequirement?.extractedParams || {}) }}
- queryRequirement.keywords：{{ JSON.stringify($json.queryRequirement?.keywords || []) }}
- type：{{ $json.type || 'unknown' }}
- senderid：{{ $json.senderid || 0 }}
- messagid：{{ $json.messagid || 0 }}
- chatid：{{ $json.chatid || '' }}
- text：{{ $json.text || '' }}

请调用工具"获取知识库场景"，传入查询需求（queryRequirement），判断是否存在匹配的场景。

如果不存在匹配场景（返回 "NEW"），设置 scenarioExists = false，直接返回给节点一。
如果存在匹配场景（返回 S1~S10），设置 scenarioExists = true，matchedScenarioId = 场景ID，然后将场景信息发送给节点三AI查询知识库内容。

输出纯 JSON 格式（不要用 markdown 包裹）。
```

### 方案2：修改节点一的输出格式（不推荐）

如果不想添加 Code 节点，可以修改节点一的 System Message，要求输出时将 `queryRequirement` 序列化为字符串：

```
5. 输出格式（必须是纯 JSON，不可使用 markdown 代码块）：
{
  "queryRequirement": "JSON字符串格式的查数需求",
  ...
}
```

然后在节点二的 Code 节点中解析。但这种方法会增加复杂性，不推荐。

## 验证步骤

修复后，按以下步骤验证：

1. **执行节点一**：
   - 检查输出中是否有 `queryRequirement` 字段
   - 确认 `queryRequirement` 是对象类型

2. **执行 Code 节点**：
   - 检查输出中 `queryRequirement` 是否正确
   - 查看日志，确认 `queryRequirement` 类型为 `object`

3. **执行节点二**：
   - 检查输入中 `queryRequirement` 是否正确显示
   - 确认不再是 `"[object Object]"`
   - 确认可以正确读取 `queryRequirement.intent`、`queryRequirement.extractedParams` 等

## 常见问题

### Q1: Code 节点报错 "Cannot read property 'queryRequirement' of undefined"

**A**: 检查节点一的输出格式。如果节点一输出在 `output` 字段中，Code 节点已经处理了这种情况。如果仍然报错，检查节点一的实际输出结构。

### Q2: 节点二仍然显示 "[object Object]"

**A**: 
1. 确认 Code 节点已正确添加到工作流中
2. 确认节点二的输入来自 Code 节点，而不是直接来自节点一
3. 检查 Code 节点的输出，确认 `queryRequirement` 是对象类型

### Q3: 如何调试数据传递问题？

**A**: 
1. 在每个节点后添加一个 Code 节点，打印输出：
   ```javascript
   console.log('节点输出:', JSON.stringify($json, null, 2));
   return { json: $json };
   ```
2. 查看执行日志，检查每个节点的实际输出
3. 确认数据在每个步骤中是否正确传递

## 完整工作流结构

```
上游数据
    ↓
节点一：生成SQL（AI Agent）
    - 输出：queryRequirement（对象）
    ↓
Code节点：准备节点二输入
    - 处理：确保 queryRequirement 是对象类型
    - 输出：格式化的数据
    ↓
节点二：查现有场景（AI Agent Tool）
    - 输入：queryRequirement（对象）
    - 输出：scenarioExists, matchedScenarioId
    ↓
后续节点...
```

## 注意事项

1. **对象类型字段**：在 n8n 中传递对象类型字段时，建议使用 Code 节点确保正确序列化
2. **数据验证**：在 Code 节点中添加数据验证，确保数据格式正确
3. **日志记录**：在 Code 节点中添加 console.log，方便调试
4. **错误处理**：在 Code 节点中添加 try-catch，处理可能的解析错误





