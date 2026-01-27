# N8N shangy.json 留存数据映射器 - 使用说明

## ✅ 测试成功

代码已通过测试，可以正确处理 shangy.json 格式的数据！

## 📊 数据结构说明

**shangy.json** 包含三种类型的数据，全部在 `filtered_merchants` 数组中：

### 1. 商户映射数据
```json
{
  "sub_merchant_name": "betfiery",
  "main_merchant_name": "RD1",
  "merchant_id": 1698202251
}
```

### 2. 游戏映射数据
```json
{
  "id": 1,
  "game_id": "1698217736104",
  "game": "Fortune Tiger",
  "merchant": "1698203185"
}
```

### 3. 留存数据（关键标识：`dataType: "game_act"`）
```json
{
  "merchant": "1698202251",
  "game_id": "1698217736104",
  "currency": "BRL",
  "cohort_date": "2025-12-05",
  "d0_users": "100",
  "d1_users": "85",
  "d1_retention_rate": "85.0",
  "d3_users": "70",
  "d3_retention_rate": "70.0",
  "d7_users": "60",
  "d7_retention_rate": "60.0",
  "d14_users": "50",
  "d14_retention_rate": "50.0",
  "d30_users": "40",
  "d30_retention_rate": "40.0",
  "dataType": "game_act",
  "originalIndex": 1
}
```

## 🚀 N8N 配置步骤

### 步骤 1: 添加数据源节点
- 添加 **HTTP Request** 节点或 **Read File** 节点
- 配置读取 shangy.json 数据

### 步骤 2: 添加 Code 节点
- Mode: **Run Once for All Items**
- Language: **JavaScript**
- 复制 `n8n-shangy-retention-mapper.js` 的代码

### 步骤 3: 连接节点
```
[读取 shangy.json] ─→ [Code节点] ─→ [输出]
```

## 📤 输出格式

```json
{
  "游戏名": "Fortune Tiger",
  "商户名": "betfiery",
  "主商户名": "RD1",
  "币种": "BRL",
  "日期": "2025-12-05",
  "数据类型": "留存数据",
  "当日用户数": 100,
  "次日用户数": 85,
  "次日留存率": "85%",
  "3日用户数": 70,
  "3日留存率": "70%",
  "7日用户数": 60,
  "7日留存率": "60%",
  "14日用户数": 50,
  "14日留存率": "50%",
  "30日用户数": 40,
  "30日留存率": "40%"
}
```

## 🔍 代码工作原理

### 第一步：数据收集
代码会遍历 `filtered_merchants` 数组，分别收集：
1. **商户映射**: `merchant_id` → `sub_merchant_name`
2. **游戏映射**: `game_id` → `game`
3. **留存数据**: 所有包含 `dataType: "game_act"` 的记录

### 第二步：数据匹配
对每条留存数据：
1. 通过 `merchant` 字段查找商户名
2. 通过 `game_id` 字段查找游戏名
3. 格式化留存率为百分比

### 第三步：输出生成
生成包含中文字段名的格式化数据

## 📝 完整代码

使用文件：**n8n-shangy-retention-mapper.js**

```javascript
// 复制 n8n-shangy-retention-mapper.js 的完整代码到 N8N Code 节点
```

## ✅ 测试结果

测试数据：
- 商户映射: 2 个
- 游戏映射: 2 个
- 留存数据: 2 条

输出示例：
1. Fortune Tiger / betfiery / BRL / 85% 次日留存
2. Chicken Road Zombie / mexlucky / MXN / 75% 次日留存

## 🐛 故障排查

### 问题：No output data returned

**可能原因**：
1. `filtered_merchants` 数组中没有 `dataType: "game_act"` 的记录
2. 留存数据缺少 `merchant` 或 `game_id` 字段

**解决方案**：
1. 检查输入数据是否包含留存数据
2. 查看 N8N 执行日志中的调试信息
3. 确认留存数据包含 `dataType: "game_act"` 标识

### 问题：商户名显示为 merchant_id

**原因**: `filtered_merchants` 中没有对应的商户映射数据

**解决方案**: 确保 `filtered_merchants` 数组包含商户映射记录

### 问题：游戏名显示为 game_id

**原因**: `filtered_merchants` 中没有对应的游戏映射数据

**解决方案**: 确保 `filtered_merchants` 数组包含游戏映射记录

## 📊 执行日志示例

```
=== shangy.json 留存数据映射器开始 ===
输入数据项数: 1
📊 处理 shangy.json 数据 (项目 0)
   包含 6 个数据项
🏪 收集到商户映射: 2 个
🎮 收集到游戏映射: 2 个
📊 收集到留存数据: 2 条
=== 处理完成 ===
📈 生成留存数据: 2 行
```

## 🎯 关键要点

1. ✅ **单一数据源**: 只需要 shangy.json，所有数据都在里面
2. ✅ **自动匹配**: 自动匹配商户名和游戏名
3. ✅ **格式化输出**: 自动格式化为中文字段和百分比
4. ✅ **错误提示**: 清晰的错误信息和调试日志

## 📞 下一步

1. 复制 `n8n-shangy-retention-mapper.js` 的代码
2. 粘贴到 N8N 的 Code 节点
3. 连接 shangy.json 数据源
4. 运行工作流
5. 查看输出结果

代码已经过测试，可以直接使用！🎉
