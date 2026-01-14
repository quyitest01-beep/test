# n8n Merge 节点配置说明 - 保留数据1中不在数据2中的数据

## 问题描述

你想要匹配两个数据源，输出**数据1中没有出现在数据2中的数据**。

当前配置问题：
- `mode: "combine"` - 这个模式不对
- `joinMode: "keepNonMatches"` - 在 combine 模式下可能不起作用
- 结果：输出了数据1的所有数据，而不是过滤后的数据

## 解决方案

### 方案1：修改 Merge 节点配置（推荐）

**正确的配置**：

```json
{
  "parameters": {
    "mode": "merge",           // 改为 "merge"，不是 "combine"
    "fieldsToMatchString": "game_id",
    "joinMode": "left",        // 改为 "left"
    "options": {
      "keepNonMatches": true   // 保留不匹配的数据
    }
  }
}
```

**或者使用更明确的配置**：

```json
{
  "parameters": {
    "mode": "merge",
    "fieldsToMatchString": "game_id",
    "joinMode": "outer",       // 外连接
    "options": {}
  }
}
```

**n8n Merge 节点的模式说明**：
- `merge`: 合并模式，支持 JOIN 操作
- `combine`: 组合模式，简单合并所有数据
- `join`: 连接模式（类似 SQL JOIN）

**joinMode 选项**：
- `inner`: 只保留两个数据源都匹配的数据
- `left`: 保留左侧（input1）的所有数据，匹配右侧的字段
- `right`: 保留右侧（input2）的所有数据
- `outer`: 保留两个数据源的所有数据
- `keepNonMatches`: 保留不匹配的数据（需要配合其他选项）

### 方案2：使用 Code 节点实现过滤逻辑

如果 Merge 节点无法满足需求，可以使用 Code 节点手动实现：

**工作流结构**：
1. **Input1** → **Code Node 1**（处理数据1）
2. **Input2** → **Code Node 2**（处理数据2，收集 game_id）
3. **Code Node 2** → **Code Node 3**（过滤数据1）

**Code Node 3（过滤逻辑）**：

```javascript
// 从 Code Node 2 获取 data2 的 game_id 集合
const data2GameIds = new Set();
// 假设 data2 的数据通过某种方式传递（如通过变量、HTTP请求等）

// 处理 data1
const inputs = $input.all();
const results = [];

inputs.forEach((inputItem) => {
  const item = inputItem.json;
  const gameId = String(item.game_id);
  
  // 如果 game_id 不在 data2 中，保留
  if (!data2GameIds.has(gameId)) {
    results.push(inputItem);
  }
});

return results;
```

### 方案3：使用两个 Code 节点 + 变量传递

**工作流结构**：
1. **Input2** → **Code Node A**（收集所有 game_id，存储到变量）
2. **Input1** → **Code Node B**（读取变量，过滤数据）

**Code Node A（收集 game_id）**：

```javascript
const inputs = $input.all();
const gameIds = new Set();

inputs.forEach((inputItem) => {
  const item = inputItem.json;
  if (item && item.game_id) {
    gameIds.add(String(item.game_id));
  }
});

// 存储到变量（需要 n8n 变量功能）
// 或者输出一个包含所有 game_id 的对象
return [{
  json: {
    gameIds: Array.from(gameIds),
    count: gameIds.size
  }
}];
```

**Code Node B（过滤数据1）**：

```javascript
const inputs = $input.all();
// 从 Code Node A 的输出或变量中获取 gameIds
const data2GameIds = new Set(/* 从变量或上游获取 */);

const results = [];

inputs.forEach((inputItem) => {
  const item = inputItem.json;
  const gameId = String(item.game_id);
  
  if (!data2GameIds.has(gameId)) {
    results.push(inputItem);
  }
});

return results;
```

### 方案4：使用 Filter 节点（最简单）

**工作流结构**：
1. **Input1** → **Set Node**（添加标记字段，如 `_source: "data1"`）
2. **Input2** → **Set Node**（添加标记字段，如 `_source: "data2"`）
3. **Merge Node** → **Filter Node**（过滤逻辑）

**Filter Node 配置**：
- 条件：`game_id` 不在 data2 中
- 实现方式：使用表达式或 Code 节点

## 推荐方案

**最简单的方法**：修改 Merge 节点配置

1. 将 `mode` 改为 `"merge"`
2. 将 `joinMode` 改为 `"left"`
3. 在 `options` 中添加 `keepNonMatches: true`

如果还是不行，使用**方案4（Filter 节点）**或**方案2（Code 节点）**。

## 调试建议

1. **检查 Merge 节点输出**：
   - 查看 Merge 节点的输出数据
   - 确认是否包含匹配标记字段

2. **检查字段匹配**：
   - 确认 `game_id` 字段在两个数据源中都存在
   - 确认 `game_id` 的数据类型一致（都是字符串或都是数字）

3. **测试数据**：
   - 使用少量测试数据验证配置
   - 确认匹配逻辑是否正确

4. **查看日志**：
   - 在 Merge 节点后添加 Code 节点，打印输出数据
   - 检查数据的结构和内容

## 示例配置（JSON）

```json
{
  "parameters": {
    "mode": "merge",
    "fieldsToMatchString": "game_id",
    "joinMode": "left",
    "options": {
      "keepNonMatches": true
    }
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.2
}
```

如果问题仍然存在，请检查 n8n 版本，某些版本的 Merge 节点选项可能不同。












