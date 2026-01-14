# 时间计算器工具集使用指南

## 📋 概述

本工具集提供了三个时间计算器，用于根据今日日期计算不同时间范围的日期范围，输出格式为 `YYYYMMDD-YYYYMMDD`。

## 🛠️ 工具列表

### 1. 上周日期计算器
- **文件**: `final-last-week-calculator.js`
- **功能**: 计算上周一到上周日的日期范围
- **适用场景**: 周报、周统计、短期数据分析

### 2. 上月日期计算器
- **文件**: `simple-last-month-calculator.js`
- **功能**: 计算上月第一天到最后一天的日期范围
- **适用场景**: 月报、月统计、月度数据分析

### 3. 综合时间计算器
- **文件**: `comprehensive-time-calculator.js`
- **功能**: 同时计算上周和上月的日期范围
- **适用场景**: 综合报告、多维度数据分析

## 🎯 功能特点

### 通用特点
- **支持多种日期格式**: `2025.10.21`、`2025-10-21`、`20251021`
- **标准输出格式**: `YYYYMMDD-YYYYMMDD`
- **智能边界处理**: 正确处理跨年、跨月、闰年等情况
- **n8n集成**: 专为n8n工作流设计

### 上周计算器特点
- **智能星期计算**: 正确处理一周内不同日期的上周计算
- **避免重复匹配**: 每个转账记录只能匹配一次
- **星期信息**: 提供今日星期几信息

### 上月计算器特点
- **跨年处理**: 正确处理1月的上月是去年12月
- **闰年支持**: 正确处理闰年2月的29天
- **月份信息**: 提供上月月份字符串 (YYYYMM格式)

### 综合计算器特点
- **一次计算**: 同时获取上周和上月信息
- **完整信息**: 提供所有相关的时间信息
- **高效处理**: 避免重复计算

## 🔧 使用方法

### 1. 在n8n中使用

1. 添加一个 **Code** 节点
2. 选择对应的计算器代码复制到Code节点中
3. 运行节点

### 2. 输入参数（可选）

```javascript
// 可以通过输入数据提供今日日期
{
  "todayDate": "2025.10.21",  // 可选，不提供则使用当前日期
  "date": "2025.10.21",       // 可选，同todayDate
  "today": "2025.10.21"       // 可选，同todayDate
}
```

### 3. 输出结果对比

#### 上周计算器输出
```javascript
{
  "lastWeekRange": "20251013-20251019",
  "lastWeekStart": "20251013",
  "lastWeekEnd": "20251019",
  "today": "2025-10-21",
  "todayDayOfWeek": 2,
  "todayDayOfWeekName": "周二"
}
```

#### 上月计算器输出
```javascript
{
  "lastMonthRange": "20250901-20250930",
  "lastMonthStart": "20250901",
  "lastMonthEnd": "20250930",
  "lastMonthStr": "202509",
  "today": "2025-10-21",
  "currentYear": 2025,
  "currentMonth": 10,
  "lastMonthYear": 2025,
  "lastMonth": 9
}
```

#### 综合计算器输出
```javascript
{
  "today": "2025-10-21",
  "todayDayOfWeek": 2,
  "todayDayOfWeekName": "周二",
  "currentYear": 2025,
  "currentMonth": 10,
  "lastWeekRange": "20251013-20251019",
  "lastWeekStart": "20251013",
  "lastWeekEnd": "20251019",
  "lastMonthRange": "20250901-20250930",
  "lastMonthStart": "20250901",
  "lastMonthEnd": "20250930",
  "lastMonthStr": "202509",
  "lastMonthYear": 2025,
  "lastMonth": 9
}
```

## 📊 计算示例

### 测试用例验证

| 今日日期 | 今日星期 | 上周范围 | 上月范围 | 上月月份 |
|----------|----------|----------|----------|----------|
| 2025.10.21 | 周二 | 20251013-20251019 | 20250901-20250930 | 202509 |
| 2025.01.15 | 周三 | 20250106-20250112 | 20241201-20241231 | 202412 |
| 2025.03.31 | 周一 | 20250324-20250330 | 20250201-20250228 | 202502 |
| 2024.03.31 | 周日 | 20240324-20240330 | 20240201-20240229 | 202402 |

## 🚀 实际应用场景

### 1. 商户分析工作流

```javascript
// 使用综合计算器获取时间范围
const { lastWeekRange, lastMonthRange, lastMonthStr } = $json;

// 分割日期范围
const [lastWeekStart, lastWeekEnd] = lastWeekRange.split('-');
const [lastMonthStart, lastMonthEnd] = lastMonthRange.split('-');

// 构建SQL查询
const weeklyQuery = `
SELECT 
    date_str,
    merchant,
    unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
ORDER BY date_str, merchant;
`;

const monthlyQuery = `
SELECT 
    month_str,
    merchant,
    unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '${lastMonthStr}'
ORDER BY merchant;
`;
```

### 2. Telegram Bot报告

```javascript
// 发送综合统计报告
const message = `📊 **商户统计报告**

📅 **时间信息**
• 今日: ${today} (${todayDayOfWeekName})
• 上周: ${lastWeekRange}
• 上月: ${lastMonthRange} (${lastMonthStr})

📈 **数据统计**
• 上周数据已更新
• 上月数据已更新
• 请查看详细报告`;
```

### 3. 数据导出

```javascript
// 生成文件名
const weeklyFilename = `merchant_analytics_weekly_${lastWeekRange}.csv`;
const monthlyFilename = `merchant_analytics_monthly_${lastMonthStr}.csv`;

// 设置查询参数
const weeklyParams = {
  startDate: lastWeekStart,
  endDate: lastWeekEnd,
  statType: 'merchant_daily'
};

const monthlyParams = {
  monthStr: lastMonthStr,
  statType: 'merchant_monthly'
};
```

## 🔍 测试验证

### 运行测试

```bash
# 测试上周计算器
node test-corrected-calculator.js

# 测试上月计算器
node test-last-month-calculator.js

# 测试综合计算器
node test-comprehensive-calculator.js
```

### 测试结果

所有测试用例均通过验证：
- ✅ 上周计算器: 正确计算上周日期范围
- ✅ 上月计算器: 正确计算上月日期范围
- ✅ 综合计算器: 同时正确计算上周和上月

## 📝 注意事项

1. **时区处理**: 所有计算基于本地时区
2. **日期格式**: 支持多种输入格式，输出统一为 `YYYYMMDD` 格式
3. **边界情况**: 正确处理月初、月末、跨年、闰年等情况
4. **性能考虑**: 计算简单，性能开销很小
5. **n8n兼容**: 专为n8n工作流设计，输出格式符合n8n要求

## 🚀 扩展功能

### 1. 添加更多时间范围

```javascript
// 可以扩展支持：
// - 上季度
// - 去年
// - 自定义时间范围
```

### 2. 添加工作日计算

```javascript
// 可以添加：
// - 工作日数量
// - 排除周末的日期范围
```

### 3. 添加节假日处理

```javascript
// 可以添加：
// - 排除节假日的计算
// - 自定义工作日历
```

## 🔧 故障排除

### 1. 日期格式错误

```javascript
// 错误: 无效的日期格式
// 解决: 检查输入日期格式是否正确
// 支持格式: "2025.10.21", "2025-10-21", "20251021"
```

### 2. 计算结果不正确

```javascript
// 错误: 时间范围计算错误
// 解决: 检查今日日期是否正确，确认时区设置
```

### 3. n8n集成问题

```javascript
// 错误: n8n节点输出格式错误
// 解决: 确保输出格式符合n8n要求，使用 { json: {...} } 格式
```

## 📚 相关文件

### 核心文件
- `final-last-week-calculator.js` - 上周计算器
- `simple-last-month-calculator.js` - 上月计算器
- `comprehensive-time-calculator.js` - 综合计算器

### 测试文件
- `test-corrected-calculator.js` - 上周计算器测试
- `test-last-month-calculator.js` - 上月计算器测试
- `test-comprehensive-calculator.js` - 综合计算器测试

### 文档文件
- `last-week-calculator-usage.md` - 上周计算器使用说明
- `last-month-calculator-usage.md` - 上月计算器使用说明
- `time-calculators-summary.md` - 工具集总览

## 🎯 选择建议

### 使用上周计算器的情况
- 需要周报、周统计
- 短期数据分析
- 只需要上周信息

### 使用上月计算器的情况
- 需要月报、月统计
- 月度数据分析
- 只需要上月信息

### 使用综合计算器的情况
- 需要综合报告
- 多维度数据分析
- 需要同时获取上周和上月信息
- 希望减少节点数量

## 🔄 版本更新

### v1.0 (当前版本)
- 基础功能实现
- 支持上周和上月计算
- 通过所有测试用例
- n8n集成优化

### 计划功能
- 上季度计算器
- 去年计算器
- 工作日计算
- 节假日处理









