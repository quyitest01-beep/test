# Merge1节点工作流分析

## 当前工作流结构

```
Schedule Trigger
    ├─→ 获取Lark Access Token1 ──┐
    │                            ├─→ Merge1 ──→ 匹配游戏对应的sheet
    └─→ Edit Fields1 ──→ 拆分游戏 ─┘
        获取表格id ────────────────┘
```

## Merge1节点输入分析

Merge1节点配置为**3个输入**（`numberInputs: 3`）：

1. **Input 0**: `获取Lark Access Token1`
   - 输出：`{ tenant_access_token: "...", ... }`
   - 用途：提供Lark API的访问token

2. **Input 1**: `获取表格id`
   - 输出：`{ data: { sheets: [...], spreadsheetToken: "...", ... }, ... }`
   - 用途：提供所有sheets列表和spreadsheet token

3. **Input 2**: `拆分游戏`
   - 输出：多个items，每个包含 `{ WeekStart, WeekEnd, game }`
   - 用途：提供游戏列表（52个游戏）

## Merge1节点输出格式

当Merge1使用"Append"模式时，输出格式应该是：
- **Item 0**: Token数据（来自Input 0）
- **Item 1**: Sheets数据（来自Input 1）
- **Item 2-53**: 游戏列表（来自Input 2，52个游戏）

## 代码处理逻辑

`匹配游戏对应的sheet`节点会：
1. 遍历所有输入项
2. 从第一个输入项提取`tenant_access_token`
3. 从第二个输入项提取`data.sheets`和`spreadsheet_token`
4. 从后续输入项提取游戏名称（`game`字段）

## 可能的问题

### 问题1：Merge1节点输出格式不正确
**症状**：`匹配游戏对应的sheet`节点只收到部分数据
**检查**：
1. 打开Merge1节点
2. 查看OUTPUT面板
3. 确认有3个输入的数据都被包含

### 问题2：数据字段名称不匹配
**症状**：代码找不到`data.sheets`或`tenant_access_token`
**检查**：
1. 查看`获取表格id`节点的输出，确认sheets数据的路径
2. 查看`获取Lark Access Token1`节点的输出，确认token字段名称

### 问题3：Merge1节点配置问题
**症状**：Merge1节点没有正确合并数据
**解决**：
- 确认Merge1节点的"Mode"设置为"Append"
- 确认"Number of Inputs"设置为3

## 调试步骤

1. **检查Merge1节点的OUTPUT**：
   - 打开Merge1节点
   - 查看OUTPUT面板
   - 确认：
     - Item 0包含`tenant_access_token`
     - Item 1包含`data.sheets`数组（52个sheets）
     - Item 2-53包含游戏列表（每个item有`game`字段）

2. **检查`匹配游戏对应的sheet`节点的INPUT**：
   - 打开`匹配游戏对应的sheet`节点
   - 查看INPUT面板
   - 确认收到的数据与Merge1的输出一致

3. **查看控制台日志**：
   - 运行工作流
   - 查看`匹配游戏对应的sheet`节点的控制台输出
   - 关注：
     - "输入项详情"部分，确认每个输入项的类型
     - "从 data.sheets 收集 X 个 sheets"日志
     - "总 sheets 数量"日志

## 预期输出

如果一切正常，控制台应该显示：
```
📥 开始处理 54 个输入项
输入项详情:
  [0] - 类型: Token数据, 有游戏: false, 有sheets: false, 有token: true, ...
  [1] - 类型: Sheets数据, 有游戏: false, 有sheets: true, 有token: false, ...
      → 包含 52 个sheets
  [2] - 类型: 游戏数据, 有游戏: true, 有sheets: false, 有token: false, game: "Turbo Fortune"
  [3] - 类型: 游戏数据, 有游戏: true, 有sheets: false, 有token: false, game: "Aero Rush"
  ...

📋 从 data.sheets 收集 52 个 sheets
总 sheets 数量: 52
游戏数量: 52
```

## 如果问题仍然存在

如果Merge1节点的输出格式不对，可以考虑：

### 方案1：修改Merge1节点配置
- 尝试使用"Combine"模式而不是"Append"
- 或者使用"Merge"模式（需要配置匹配字段）

### 方案2：在Merge1后添加Code节点
在Merge1和`匹配游戏对应的sheet`之间添加一个Code节点，手动整理数据格式：

```javascript
// 整理Merge1的输出数据
const inputs = $input.all();

let tokenData = null;
let sheetsData = null;
const gameItems = [];

inputs.forEach((item) => {
  const data = item.json;
  
  // 识别token数据
  if (data.tenant_access_token && !data.data?.sheets && !data.game) {
    tokenData = data;
  }
  // 识别sheets数据
  else if (data.data?.sheets || data.sheets) {
    sheetsData = data;
  }
  // 识别游戏数据
  else if (data.game || data.target_game || data.game_name) {
    gameItems.push(data);
  }
});

// 合并数据：为每个游戏项添加token和sheets
const merged = gameItems.map(gameItem => ({
  ...gameItem,
  tenant_access_token: tokenData?.tenant_access_token || tokenData?.tenant_token,
  spreadsheet_token: sheetsData?.spreadsheet_token || sheetsData?.data?.spreadsheetToken,
  data: {
    ...sheetsData?.data,
    sheets: sheetsData?.data?.sheets || sheetsData?.sheets || []
  }
}));

return merged.map(item => ({ json: item }));
```





