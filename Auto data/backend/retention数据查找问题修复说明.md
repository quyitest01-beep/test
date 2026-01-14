# Retention数据查找问题修复说明

## 问题描述

在n8n中执行数据清洗脚本时，retention数据输出为空数组：
```json
"retention": {
  "newUserD1": [],
  "newUserD7": [],
  "activeUserD1": [],
  "activeUserD7": []
}
```

但在本地测试时，retention数据能正确提取。

## 问题原因

原代码中有一个限制条件：
```javascript
if (!currentRetention && inputs.length === 1) {
  // 查找retention数据的逻辑
}
```

这个条件要求`inputs.length === 1`才会去查找retention数据。在n8n环境中，如果输入数据格式不同，或者inputs的长度不是1，这个逻辑就不会执行，导致retention数据无法找到。

## 修复方案

### 1. 使用步骤1中找到的retentionDataObject

在步骤1中，代码已经找到了包含retention数据的对象（`retentionDataObject`），但在步骤8中没有使用它。现在优先使用这个对象来查找retention数据。

### 2. 放宽inputs.length限制

移除了`inputs.length === 1`的限制，改为遍历所有输入项来查找retention数据。

### 3. 改进的查找逻辑

新的查找逻辑分为两个方法：

**方法1**：使用步骤1中找到的`retentionDataObject`
- 如果步骤1中已经找到了包含retention数据的对象，直接使用它
- 遍历该对象的periods数组，匹配当前期和上期的retention数据

**方法2**：从所有输入中查找
- 如果方法1没找到，遍历所有输入项
- 支持数组格式和单个对象格式的输入
- 遍历所有对象的periods数组，匹配当前期和上期的retention数据

## 修复后的代码逻辑

```javascript
// 直接从所有输入中查找retention数据（改进逻辑）
// 优先使用步骤1中找到的retentionDataObject
if (!currentRetention) {
  // 方法1：使用步骤1中找到的retentionDataObject
  if (retentionDataObject && retentionDataObject.periods && Array.isArray(retentionDataObject.periods)) {
    // 从retentionDataObject中查找
  }
  
  // 方法2：如果方法1没找到，从所有输入中查找
  if (!currentRetention) {
    // 遍历所有输入项
    for (let inputIdx = 0; inputIdx < inputs.length; inputIdx++) {
      // 查找逻辑
    }
  }
}
```

## 测试建议

1. **在n8n中重新执行脚本**，查看控制台输出：
   - 应该能看到"使用步骤1中找到的retentionDataObject"或"方法1未找到，从所有输入中查找"的日志
   - 应该能看到"✅ 从retentionDataObject中找到当前期retention数据"或类似的成功日志

2. **检查retention数据**：
   - 确认`retention.newUserD1`、`retention.newUserD7`、`retention.activeUserD1`、`retention.activeUserD7`都有数据
   - 每条记录应该包含：`rank`、`merchantName`、`gameName`、`dailyUsers`、`retention`、`retentionFormatted`、`retainedUsers`

3. **如果仍然为空**：
   - 检查控制台日志，确认是否找到了retention数据
   - 检查周期匹配是否成功（查看"匹配检查"的日志）
   - 确认输入数据中是否包含retention数据

## 预期输出

修复后，retention数据应该正确提取，例如：
```json
"retention": {
  "newUserD1": [
    {
      "rank": 1,
      "merchantName": "Mxlobo(MXN)",
      "gameName": "Super Ace",
      "dailyUsers": 191,
      "retention": 20.94,
      "retentionFormatted": "20.94%",
      "retainedUsers": 40
    },
    ...
  ],
  "newUserD7": [...],
  "activeUserD1": [...],
  "activeUserD7": [...]
}
```

## 注意事项

1. **数据过滤**：只保留`dailyUsers >= 50`的记录
2. **周期匹配**：使用`normalizePeriodKey`函数标准化周期标识，支持多种格式（如"20251027-1102"和"10.27-11.02"）
3. **日志输出**：增加了详细的日志输出，方便排查问题












