# N8N 留存数据映射器 - 生产环境使用说明

## 📋 概述

这个代码节点用于处理实际的上游数据（shangy.json 和 xiayou.json），将留存数据转换为中文格式输出，并自动匹配商户名和游戏名。

## 🔄 数据流程

```
上游数据源 → N8N Code节点 → 格式化输出
   ↓
shangy.json (商户映射)
xiayou.json (留存数据)
```

## 📊 输入数据结构

### 1. shangy.json 格式
```json
{
  "status": "success",
  "statistics": {...},
  "filtered_merchants": [
    {
      "sub_merchant_name": "betfiery",
      "main_merchant_name": "RD1",
      "merchant_id": 1698202251
    }
  ]
}
```

### 2. xiayou.json 格式
```json
{
  "target_game": {
    "game_code": "gp_classic_22",
    "english_name": "Keno",
    "release_date": "2023/11"
  },
  "metrics": {
    "global": {
      "retention_new": [...],
      "retention_active": [...],
      "revenue": {
        "breakdown": [
          {
            "merchant_id": 1698202251,
            "currency": "BRL",
            "platform": "betfiery"
          }
        ]
      }
    }
  }
}
```

## 📤 输出数据格式

```json
{
  "游戏名": "Keno",
  "商户名": "betfiery",
  "主商户名": "RD1",
  "币种": "BRL, MXN",
  "日期": "2023/11",
  "数据类型": "新用户留存",
  "当日用户数": 1000,
  "次日用户数": 850,
  "次日留存率": "85%",
  "7日用户数": 600,
  "7日留存率": "60%"
}
```

## 🚀 N8N 配置步骤

### 1. 创建工作流

1. 添加两个 **HTTP Request** 节点或 **Read File** 节点
   - 节点1: 获取 shangy.json 数据
   - 节点2: 获取 xiayou.json 数据

2. 添加 **Merge** 节点
   - Mode: Combine
   - 将两个数据源合并

3. 添加 **Code** 节点
   - Mode: Run Once for All Items
   - Language: JavaScript
   - 粘贴 `n8n-retention-mapper-production.js` 的代码

### 2. 代码配置

直接复制 `n8n-retention-mapper-production.js` 文件中的完整代码到 N8N 的 Code 节点中。

### 3. 连接节点

```
[HTTP/File: shangy.json] ─┐
                          ├─→ [Merge] ─→ [Code] ─→ [输出]
[HTTP/File: xiayou.json] ─┘
```

## 🔍 核心功能说明

### 1. 智能数据识别

代码会自动识别两种数据格式：
- **shangy.json**: 通过 `status`、`statistics`、`filtered_merchants` 字段识别
- **xiayou.json**: 通过 `metrics.global` 结构识别

### 2. 商户名匹配

```javascript
// 优先使用 shangy.json 的商户映射
merchant_id → sub_merchant_name
1698202251 → "betfiery"
```

### 3. 币种匹配

```javascript
// 从 xiayou.json 的 revenue.breakdown 提取币种
merchant_id → currencies
1698202251 → ["BRL", "MXN"]
```

### 4. 留存数据类型

- **新用户留存**: `retention_new` → "新用户留存"
- **活跃用户留存**: `retention_active` → "活跃用户留存"

## 📈 输出字段说明

| 字段名 | 说明 | 数据来源 |
|--------|------|----------|
| 游戏名 | 游戏英文名 | xiayou.json: target_game.english_name |
| 商户名 | 子商户名 | shangy.json: sub_merchant_name |
| 主商户名 | 主商户名 | shangy.json: main_merchant_name |
| 币种 | 支持的币种列表 | xiayou.json: revenue.breakdown.currency |
| 日期 | 游戏发布日期 | xiayou.json: target_game.release_date |
| 数据类型 | 留存类型 | 新用户留存 / 活跃用户留存 |
| 当日用户数 | D0用户数 | xiayou.json: d0_users |
| 次日用户数 | D1用户数 | xiayou.json: d1_users |
| 次日留存率 | D1留存率 | xiayou.json: d1_retention_rate |
| 7日用户数 | D7用户数 | xiayou.json: d7_users |
| 7日留存率 | D7留存率 | xiayou.json: d7_retention_rate |

## 🔧 调试信息

代码会在 N8N 的执行日志中输出详细信息：

```
=== 留存数据映射器开始 ===
输入数据项数: 2
📊 识别到xiayou.json格式数据 (项目 0)
📊 找到新用户留存数据: 150 条
💰 找到营收数据: 80 条
🏪 识别到shangy.json格式数据，包含 219 个商户 (项目 1)
🏪 收集到商户映射数据: 219 条
📊 收集到留存数据: 150 条
💰 收集到营收数据（含币种）: 80 条
💰 构建商户币种映射表完成，共 80 个商户
🏪 构建商户映射表完成，共 219 个商户
=== 留存数据映射完成 ===
📊 总共处理留存数据: 150
🏪 商户映射成功: 145, 失败: 5
📈 商户映射率: 96.7%
📈 生成最终留存数据: 150 行
```

## ⚠️ 注意事项

1. **数据顺序**: shangy.json 和 xiayou.json 的输入顺序不重要，代码会自动识别
2. **商户匹配**: 如果 shangy.json 中没有某个商户的映射，会使用 xiayou.json 中的原始商户名
3. **币种信息**: 一个商户可能支持多种币种，会以逗号分隔显示
4. **百分比格式**: 留存率会自动格式化为百分比字符串（如 "85%"）

## 🐛 故障排查

### 问题1: 商户名显示"未知商户"
**原因**: shangy.json 中没有该商户的映射数据  
**解决**: 检查 shangy.json 的 filtered_merchants 数组是否包含该 merchant_id

### 问题2: 币种显示"未知币种"
**原因**: xiayou.json 的 revenue.breakdown 中没有该商户的营收数据  
**解决**: 检查 xiayou.json 的 metrics.global.revenue.breakdown 数组

### 问题3: 没有输出数据
**原因**: 没有找到留存数据  
**解决**: 检查 xiayou.json 是否包含 retention_new 或 retention_active 数组

## 📝 测试

使用提供的测试脚本验证逻辑：

```bash
node backend/test-fixed-retention-mapper.js
```

## 📞 支持

如有问题，请检查：
1. N8N 执行日志中的调试信息
2. 输入数据的格式是否正确
3. 商户映射表是否完整
