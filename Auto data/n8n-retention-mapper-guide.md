# N8N 留存数据映射器使用指南

## 功能说明

这个代码节点用于处理上游数据，将留存数据（retention data）转换为中文格式的输出，并自动匹配商户名和游戏名。

## 输入数据结构

输入数据应包含以下结构：

```json
{
  "status": "success",
  "timestamp": "2026-01-20T04:14:26.148Z",
  "filtered_merchants": [
    // 商户信息
    {
      "sub_merchant_name": "betfiery",
      "main_merchant_name": "RD1",
      "merchant_id": 1698202251
    },
    // 游戏信息
    {
      "game_id": "1698217736104",
      "game": "Fortune Tiger",
      "merchant": "1698203185"
    },
    // 留存数据（包含 dataType: "game_act"）
    {
      "merchant": "1698202251",
      "game_id": "1698217736104",
      "currency": "BRL",
      "cohort_date": "2025-12-05",
      "d0_users": "1",
      "d1_users": "0",
      "d1_retention_rate": "0.0",
      "d3_users": "0",
      "d3_retention_rate": "0.0",
      "d7_users": "0",
      "d7_retention_rate": "0.0",
      "d14_users": "0",
      "d14_retention_rate": "0.0",
      "d30_users": "0",
      "d30_retention_rate": "0.0",
      "dataType": "game_act"
    }
  ]
}
```

## 输出数据格式

```json
[
  {
    "游戏名": "Fortune Tiger",
    "商户名": "betfiery",
    "币种": "BRL",
    "日期": "2025-12-05",
    "数据类型": "留存数据",
    "当日用户数": 1,
    "次日用户数": 0,
    "次日留存率": "0%",
    "3日用户数": 0,
    "3日留存率": "0%",
    "7日用户数": 0,
    "7日留存率": "0%",
    "14日用户数": 0,
    "14日留存率": "0%",
    "30日用户数": 0,
    "30日留存率": "0%"
  }
]
```

## N8N 配置步骤

### 1. 添加 Code 节点

在 N8N 工作流中添加一个 **Code** 节点。

### 2. 粘贴代码

将 `n8n-retention-mapper-simple.js` 中的代码粘贴到 Code 节点中。

### 3. 配置节点

- **Mode**: Run Once for All Items
- **Language**: JavaScript

### 4. 连接节点

将上游数据源节点连接到此 Code 节点。

## 核心逻辑说明

### 1. 商户名匹配

```javascript
// 构建商户映射表: merchant_id -> sub_merchant_name
const merchantMap = {};
data.filtered_merchants.forEach(m => {
  if (m.merchant_id && m.sub_merchant_name) {
    merchantMap[m.merchant_id.toString()] = m.sub_merchant_name;
  }
});
```

- 从 `filtered_merchants` 数组中提取所有包含 `merchant_id` 和 `sub_merchant_name` 的记录
- 建立 merchant_id 到 sub_merchant_name 的映射关系
- 在处理留存数据时，通过 `merchant` 字段查找对应的商户名

### 2. 游戏名匹配

```javascript
// 构建游戏映射表: game_id -> game
const gameMap = {};
data.filtered_merchants.forEach(g => {
  if (g.game_id && g.game) {
    gameMap[g.game_id] = g.game;
  }
});
```

- 从 `filtered_merchants` 数组中提取所有包含 `game_id` 和 `game` 的记录
- 建立 game_id 到 game 的映射关系
- 在处理留存数据时，通过 `game_id` 字段查找对应的游戏名

### 3. 留存率格式化

```javascript
const formatRate = (rate) => {
  const num = parseFloat(rate);
  return isNaN(num) ? '0%' : `${Math.round(num * 100)}%`;
};
```

- 将小数格式的留存率（如 0.0）转换为百分比字符串（如 "0%"）
- 自动四舍五入到整数百分比

### 4. 数据筛选

```javascript
data.filtered_merchants.filter(item => item.dataType === 'game_act')
```

- 只处理 `dataType` 为 `"game_act"` 的记录
- 这些记录包含留存数据

## 测试

运行测试脚本验证逻辑：

```bash
node test-retention-mapper.js
```

预期输出：
- 成功匹配商户名和游戏名
- 正确格式化留存率为百分比
- 输出符合要求的中文字段格式

## 注意事项

1. **数据完整性**: 确保上游数据包含完整的商户信息、游戏信息和留存数据
2. **字段匹配**: merchant_id 必须能匹配到 merchant 字段，game_id 必须能匹配到游戏记录
3. **未匹配处理**: 如果找不到对应的商户名或游戏名，会显示"未知商户"或"未知游戏"
4. **数据类型**: 确保留存数据记录包含 `dataType: "game_act"` 字段

## 文件说明

- `n8n-retention-data-mapper.js`: 完整版代码（带详细注释）
- `n8n-retention-mapper-simple.js`: 简化版代码（适合直接在 N8N 中使用）
- `test-retention-mapper.js`: 测试脚本
- `n8n-retention-mapper-guide.md`: 使用指南（本文件）

## 故障排查

### 问题：商户名显示"未知商户"

**原因**: merchant_id 映射表中找不到对应的商户
**解决**: 检查 filtered_merchants 数组中是否包含该 merchant_id 的商户信息记录

### 问题：游戏名显示"未知游戏"

**原因**: game_id 映射表中找不到对应的游戏
**解决**: 检查 filtered_merchants 数组中是否包含该 game_id 的游戏信息记录

### 问题：没有输出数据

**原因**: 没有找到 dataType 为 "game_act" 的记录
**解决**: 检查输入数据中是否包含留存数据记录
