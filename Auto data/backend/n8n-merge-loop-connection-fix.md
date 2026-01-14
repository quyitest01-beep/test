# n8n Merge节点接收Loop输出配置指南

## 问题描述
Loop节点有输出，但Merge节点没有收到数据。

## 解决方案

### 1. 检查连接
确保Loop节点的输出正确连接到Merge节点：
- **Loop节点** → **Merge节点**（Input 1 或 Input 2）

### 2. Merge节点配置

#### 配置1：使用"Append"模式（推荐，简单合并）
```json
{
  "parameters": {
    "mode": "append",
    "numberOfInputs": 2
  }
}
```

**说明**：
- `mode: "append"` - 简单地将两个输入的数据追加在一起
- `numberOfInputs: 2` - 指定需要2个输入源

#### 配置2：使用"Combine"模式
```json
{
  "parameters": {
    "mode": "combine",
    "numberOfInputs": 2
  }
}
```

**说明**：
- `mode: "combine"` - 组合两个输入的数据
- `numberOfInputs: 2` - 指定需要2个输入源

### 3. 检查Loop节点的输出格式

确保Loop节点的输出是数组格式，例如：
```json
[
  {
    "game": "Turbo Fortune",
    "WeekStart": "20251020",
    "WeekEnd": "20251118"
  },
  {
    "game": "Aero Rush",
    "WeekStart": "20251020",
    "WeekEnd": "20251118"
  }
]
```

### 4. 常见问题排查

#### 问题1：Merge节点显示"等待输入"
**原因**：Loop节点的输出没有正确连接
**解决**：
1. 检查Loop节点的连接线是否连接到Merge节点
2. 确保Merge节点的"Number of Inputs"设置为2（如果确实需要2个输入）

#### 问题2：Merge节点只收到一个输入的数据
**原因**：另一个输入源没有连接或没有数据
**解决**：
1. 检查两个输入源是否都正确连接
2. 检查每个输入源是否有数据输出
3. 在Merge节点中，可以查看"INPUT"面板，检查每个输入的数据

#### 问题3：Loop节点输出为空数组
**原因**：Loop节点没有正确执行或没有数据
**解决**：
1. 检查Loop节点的配置
2. 检查Loop节点的输入数据
3. 在Loop节点中查看"OUTPUT"面板，确认有数据输出

### 5. 调试步骤

1. **检查Loop节点输出**：
   - 打开Loop节点
   - 查看"OUTPUT"面板
   - 确认有数据输出

2. **检查Merge节点输入**：
   - 打开Merge节点
   - 查看"INPUT"面板
   - 选择不同的输入源（Input 1, Input 2）
   - 确认每个输入都有数据

3. **检查连接**：
   - 在画布上查看连接线
   - 确保Loop节点的输出连接到Merge节点
   - 确保Merge节点的"Number of Inputs"配置正确

### 6. 替代方案：使用Code节点合并数据

如果Merge节点仍然有问题，可以使用Code节点手动合并：

```javascript
// n8n Code节点：手动合并Loop输出和其他数据
const inputs = $input.all();

// 分离两个输入源
// 假设Input 1是Loop节点的输出（游戏列表）
// Input 2是其他数据（如sheets数据）

const loopOutput = []; // Loop节点的输出
const otherData = []; // 其他数据

inputs.forEach((item, index) => {
  const data = item.json;
  
  // 根据数据特征判断来源
  if (data.game || data.WeekStart || data.WeekEnd) {
    // 这是Loop节点的输出
    loopOutput.push(data);
  } else if (data.sheets || data.spreadsheetToken) {
    // 这是其他数据
    otherData.push(data);
  }
});

console.log(`Loop输出: ${loopOutput.length} 项`);
console.log(`其他数据: ${otherData.length} 项`);

// 合并数据
const merged = [];
loopOutput.forEach(gameItem => {
  otherData.forEach(otherItem => {
    merged.push({
      ...gameItem,
      ...otherItem
    });
  });
});

return merged.map(item => ({ json: item }));
```

### 7. 工作流结构建议

```
[数据源1] ──┐
            ├──→ [Merge] ──→ [匹配游戏对应的sheet]
[Loop节点] ──┘
```

确保：
- 数据源1（包含sheets数据）连接到Merge的Input 1
- Loop节点连接到Merge的Input 2
- Merge节点配置为"Append"模式，Number of Inputs = 2





