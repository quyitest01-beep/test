# Merge节点缺少sheets数据修复指南

## 问题分析

从Merge节点的OUTPUT看，只有52个游戏项（包含`WeekStart`, `WeekEnd`, `game`），但缺少：
- `sheets` 数组（52个sheets的数据）
- `tenant_access_token` 或 `tenant_token`
- `spreadsheet_token`

## 解决方案

### 方案1：检查Merge节点的输入源

Merge节点应该接收**两个输入**：
1. **Input 1**: Loop节点的输出（游戏列表）
2. **Input 2**: 包含sheets数据的节点输出

**检查步骤**：
1. 打开Merge节点
2. 查看INPUT面板
3. 检查是否有包含`data.sheets`或`sheets`数组的输入项
4. 如果没有，需要将包含sheets数据的节点也连接到Merge节点

### 方案2：修改Merge节点配置

如果sheets数据在另一个节点中，需要确保Merge节点也接收那个输入：

**工作流结构应该是**：
```
[获取表格id/获取sheets] ──┐
                          ├──→ [Merge] ──→ [匹配游戏对应的sheet]
[Loop Over Items] ─────────┘
```

**Merge节点配置**：
- Mode: `Append` 或 `Combine`
- Number of Inputs: `2`

### 方案3：使用Code节点手动合并（如果Merge节点无法正确合并）

如果Merge节点的"Append"模式无法正确合并数据，可以在Merge节点后添加一个Code节点来手动合并：

```javascript
// n8n Code节点：合并游戏列表和sheets数据
const inputs = $input.all();

// 分离数据
let sheetsData = null; // 包含sheets数组的数据
const gameItems = []; // 游戏列表

inputs.forEach((item) => {
  const data = item.json;
  
  // 查找包含sheets的数据
  if (data.data?.sheets || data.sheets) {
    sheetsData = data;
  }
  
  // 收集游戏项
  if (data.game || data.target_game || data.game_name) {
    gameItems.push(data);
  }
});

if (!sheetsData) {
  throw new Error('❌ 未找到包含sheets的数据');
}

// 合并数据：为每个游戏项添加sheets数据和token
const merged = gameItems.map(gameItem => ({
  ...gameItem,
  tenant_access_token: sheetsData.tenant_access_token || sheetsData.tenant_token,
  spreadsheet_token: sheetsData.spreadsheet_token || sheetsData.data?.spreadsheetToken,
  data: {
    ...sheetsData.data,
    sheets: sheetsData.data?.sheets || sheetsData.sheets
  }
}));

console.log(`✅ 合并完成：${merged.length} 个游戏项，${merged[0]?.data?.sheets?.length || 0} 个sheets`);

return merged.map(item => ({ json: item }));
```

### 方案4：修改工作流结构（推荐）

如果sheets数据来自"获取表格id"节点，建议的工作流结构：

```
[获取表格id] ──→ [Merge1] ──┐
                            ├──→ [匹配游戏对应的sheet]
[拆分游戏] ──→ [Loop] ──────┘
```

**Merge1节点配置**：
- Mode: `Append`
- Number of Inputs: `2`
- Input 1: 获取表格id（包含sheets数据）
- Input 2: Loop Over Items（游戏列表）

这样Merge1的输出会包含：
- 来自Input 1的sheets数据和token
- 来自Input 2的游戏列表

### 检查清单

- [ ] Merge节点配置了"Number of Inputs: 2"
- [ ] 包含sheets数据的节点已连接到Merge节点
- [ ] Merge节点的INPUT面板显示两个输入都有数据
- [ ] Merge节点的OUTPUT包含sheets数据和游戏列表
- [ ] 下游"匹配游戏对应的sheet"节点能正确读取sheets数据

