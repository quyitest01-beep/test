# Merge节点连接修复指南

## 问题分析

当前工作流配置中，**Merge节点只连接了一个输入**（Input 0），但Merge节点需要**两个输入**才能正确合并数据。

### 当前连接情况

```
Loop Over Items
    ├─ main[0] (Done分支) ──→ Merge (Input 0) ✅
    └─ main[1] (循环分支) ──→ 拉取Lark表数据 ──→ Loop Over Items (循环) ❌
```

**问题**：
- Merge节点只收到Input 0（Loop Over Items的Done分支输出）
- 缺少Input 1（应该包含sheets数据或其他需要合并的数据）
- `拉取Lark表数据`的输出回到了Loop Over Items，形成循环，而不是连接到Merge

## 解决方案

### 方案1：修改Merge节点配置（如果只需要一个输入）

如果Merge节点实际上只需要一个输入（即Loop Over Items的Done分支输出），可以：

1. **删除Merge节点**，直接使用Loop Over Items的输出
2. **或者**将Merge节点改为"Pass-through"模式（如果有的话）

### 方案2：正确连接两个输入（推荐）

如果Merge节点确实需要两个输入，需要：

1. **确定第二个输入源**：
   - 如果第二个输入应该是`拉取Lark表数据`的输出，需要修改连接
   - 如果第二个输入应该是其他节点（如`获取表格id`），需要连接那个节点

2. **修改连接**：
   ```
   Loop Over Items
       ├─ main[0] (Done分支) ──→ Merge (Input 0) ✅
       └─ main[1] (循环分支) ──→ 拉取Lark表数据
   
   拉取Lark表数据 ──→ Merge (Input 1) ✅
   ```

3. **配置Merge节点**：
   - Mode: `Append` 或 `Combine`
   - Number of Inputs: `2`

### 方案3：使用Code节点替代Merge节点

如果Merge节点的连接逻辑复杂，可以使用Code节点手动合并：

```javascript
// n8n Code节点：合并Loop Over Items和拉取Lark表数据
const inputs = $input.all();

// 分离两个输入源
const loopOutput = []; // Loop Over Items的Done分支输出
const larkData = []; // 拉取Lark表数据的输出

inputs.forEach((item) => {
  const data = item.json;
  
  // 根据数据特征判断来源
  // Loop Over Items的输出通常包含 game, WeekStart, WeekEnd 等字段
  if (data.game || data.WeekStart || data.WeekEnd) {
    loopOutput.push(data);
  }
  // 拉取Lark表数据的输出通常包含 values, data 等字段
  else if (data.values || data.data) {
    larkData.push(data);
  }
});

console.log(`Loop输出: ${loopOutput.length} 项`);
console.log(`Lark数据: ${larkData.length} 项`);

// 合并逻辑（根据实际需求调整）
// 例如：为每个游戏项添加对应的Lark数据
const merged = loopOutput.map(gameItem => {
  // 找到对应的Lark数据（如果有匹配逻辑）
  const matchingLarkData = larkData.find(lark => {
    // 根据实际匹配逻辑判断
    // 例如：根据sheetId或其他字段匹配
    return true; // 临时：匹配所有
  });
  
  return {
    ...gameItem,
    larkData: matchingLarkData || null
  };
});

return merged.map(item => ({ json: item }));
```

## 当前工作流结构建议

根据你的完整工作流，建议的结构应该是：

```
[获取Lark Access Token1] ──┐
                            ├─→ [Merge1] ──→ [匹配游戏对应的sheet]
[获取表格id] ───────────────┘
[拆分游戏] ──→ [Loop Over Items] ──→ [Merge] ──→ [下游节点]
                │
                └─→ [拉取Lark表数据] ──→ [Loop Over Items] (循环)
```

**Merge节点的两个输入应该是**：
- **Input 0**: Loop Over Items的Done分支（游戏列表）
- **Input 1**: 其他需要合并的数据（可能是`匹配游戏对应的sheet`的输出，或者其他节点）

## 修复步骤

1. **检查Merge节点的配置**：
   - 打开Merge节点
   - 查看"Parameters"标签
   - 确认"Number of Inputs"设置为`2`

2. **检查连接**：
   - 在画布上查看Merge节点的连接
   - 确认有两个输入线连接到Merge节点
   - 如果没有，需要添加第二个输入连接

3. **确定第二个输入源**：
   - 查看工作流的其他节点
   - 确定哪个节点的输出应该作为Merge的Input 1
   - 常见情况：
     - 如果Merge应该合并游戏列表和sheets数据，Input 1应该是包含sheets数据的节点
     - 如果Merge应该合并游戏列表和查询结果，Input 1应该是查询结果的节点

4. **修改连接**：
   - 将第二个输入源的输出连接到Merge节点的Input 1
   - 如果`拉取Lark表数据`的输出应该连接到Merge，需要：
     - 断开`拉取Lark表数据` → `Loop Over Items`的连接
     - 添加`拉取Lark表数据` → `Merge (Input 1)`的连接
     - 注意：这可能会影响Loop Over Items的循环逻辑

5. **测试**：
   - 运行工作流
   - 检查Merge节点的OUTPUT
   - 确认两个输入的数据都被正确合并

## 注意事项

- **Loop Over Items的循环逻辑**：
  - 如果`拉取Lark表数据`的输出需要回到Loop Over Items形成循环，不能同时连接到Merge
  - 这种情况下，可能需要：
    - 使用`拉取Lark表数据`的输出作为Merge的Input 1（但会破坏循环）
    - 或者在Loop Over Items的Done分支中收集所有循环的结果，然后连接到Merge

- **Merge节点的模式**：
  - `Append`: 简单追加两个输入的数据
  - `Combine`: 组合两个输入的数据（可能需要配置匹配字段）
  - 根据实际需求选择合适的模式





