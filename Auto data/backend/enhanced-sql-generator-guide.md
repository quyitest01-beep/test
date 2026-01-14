# 增强版SQL生成器使用指南

## 功能概述

这个增强版SQL生成器基于上游时间数据，动态生成8个核心SQL查询，支持上周和上月两种时间范围。

## 支持的查询类型

### 上周查询（8个）
1. **gameDailyLastWeek** - 上周游戏日统计
2. **merchantDailyLastWeek** - 上周商户日统计  
3. **gameWeeklyTotal** - 上周游戏周统计
4. **merchantWeeklyTotal** - 上周商户周统计
5. **gameRetentionLastWeek** - 上周游戏投注用户留存（D1,D3,D7）
6. **gameNewUserRetentionLastWeek** - 上周游戏新用户留存（D1,D3,D7）
7. **merchantRetentionLastWeek** - 上周商户投注用户留存（D1,D3,D7）
8. **merchantNewUserRetentionLastWeek** - 上周商户新用户留存（D1,D3,D7）

### 上月查询（8个）
1. **gameDailyLastMonth** - 上月游戏日统计
2. **merchantDailyLastMonth** - 上月商户日统计
3. **gameMonthlyTotal** - 上月游戏月统计
4. **merchantMonthlyTotal** - 上月商户月统计
5. **gameRetentionLastMonth** - 上月游戏投注用户留存（D1,D3,D7,D14,D30）
6. **gameNewUserRetentionLastMonth** - 上月游戏新用户留存（D1,D3,D7,D14,D30）
7. **merchantRetentionLastMonth** - 上月商户投注用户留存（D1,D3,D7,D14,D30）
8. **merchantNewUserRetentionLastMonth** - 上月商户新用户留存（D1,D3,D7,D14,D30）

## 输入数据格式

### 上周数据格式
```json
[
  {
    "lastWeekRange": "20251013-20251019",
    "lastWeekStart": "20251013",
    "lastWeekEnd": "20251019",
    "thisWeekRange": "20251020-20251026",
    "thisWeekStart": "20251020",
    "thisWeekEnd": "20251026",
    "lastWeekMonth": 202510,
    "thisWeekMonth": 202510,
    "today": "2025-10-23",
    "todayDayOfWeek": 4,
    "todayDayOfWeekName": "周四",
    "calculation": {
      "daysToLastMonday": 10,
      "lastMondayDate": "2025-10-13",
      "lastSundayDate": "2025-10-19"
    }
  }
]
```

### 上月数据格式
```json
[
  {
    "lastMonthRange": "20250901-20250930",
    "lastMonthStart": "20250901",
    "lastMonthEnd": "20250930",
    "lastMonthStr": "202509",
    "today": "2025-10-23",
    "currentYear": 2025,
    "currentMonth": 10,
    "lastMonthYear": 2025,
    "lastMonth": 9
  }
]
```

## 输出格式

```json
{
  "success": true,
  "timeData": {
    "lastWeek": {
      "start": "20251013",
      "end": "20251019", 
      "range": "20251013-20251019",
      "hasData": true
    },
    "lastMonth": {
      "start": "20250901",
      "end": "20250930",
      "range": "20250901-20250930", 
      "hasData": true
    }
  },
  "queries": {
    "gameDailyLastWeek": "SELECT ...",
    "merchantDailyLastWeek": "SELECT ...",
    // ... 其他查询
  },
  "queryCount": 16,
  "hasLastWeek": true,
  "hasLastMonth": true,
  "generatedAt": "2025-10-23T10:30:00.000Z"
}
```

## 关键特性

### 1. 智能时间范围检测
- 自动检测是否有上周数据（`lastWeekStart`, `lastWeekEnd`）
- 自动检测是否有上月数据（`lastMonthStart`, `lastMonthEnd`）
- 根据可用数据生成对应的查询

### 2. 差异化留存率计算
- **周度查询**：只计算D1, D3, D7留存率
- **月度查询**：计算D1, D3, D7, D14, D30留存率

### 3. 数据源统一
- 所有查询都基于`game_records`表
- 统一过滤条件：`provider IN ('gp', 'popular')` 和 `merchant <> '10001'`
- 使用`SUBSTR(hour, 1, 8)`提取日期，`SUBSTR(hour, 1, 6)`提取月份

### 4. 时间格式处理
- 输入时间格式：`YYYYMMDD`（如：`20251013`）
- 查询时间范围：`YYYYMMDD00` 到 `YYYYMMDD23`（覆盖整天）
- 日期比较：使用`SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN 'start' AND 'end'`

## 使用示例

### 场景1：只有上周数据
```javascript
// 输入：只有lastWeekStart, lastWeekEnd
// 输出：8个上周查询
```

### 场景2：只有上月数据  
```javascript
// 输入：只有lastMonthStart, lastMonthEnd
// 输出：8个上月查询
```

### 场景3：同时有上周和上月数据
```javascript
// 输入：同时包含上周和上月数据
// 输出：16个查询（8个上周 + 8个上月）
```

## 注意事项

1. **时间范围验证**：确保输入的时间数据格式正确
2. **查询性能**：留存率查询较复杂，建议在测试环境先验证
3. **数据完整性**：确保`game_records`表包含所需的时间范围数据
4. **索引优化**：建议在`hour`, `merchant`, `game_id`, `uid`字段上建立索引

## 调试信息

代码包含详细的console.log输出：
- 时间数据检查结果
- 查询生成过程
- 最终查询统计

可以通过n8n的执行日志查看详细的处理过程。



