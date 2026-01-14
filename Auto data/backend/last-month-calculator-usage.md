# 上月日期计算器使用指南

## 📋 概述

这个Code节点用于根据今日日期计算上月的日期范围，输出格式为 `YYYYMMDD-YYYYMMDD`。

## 🎯 功能特点

- **自动计算上月日期范围**：根据今日日期自动计算上月第一天到最后一天的日期范围
- **支持多种日期格式**：支持 `2025.10.21`、`2025-10-21`、`20251021` 等格式
- **智能跨年处理**：正确处理跨年的情况（如1月的上月是去年12月）
- **闰年支持**：正确处理闰年2月的天数
- **标准输出格式**：输出 `YYYYMMDD-YYYYMMDD` 格式的日期范围

## 🔧 使用方法

### 1. 在n8n中使用

1. 添加一个 **Code** 节点
2. 将 `simple-last-month-calculator.js` 的代码复制到Code节点中
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

### 3. 输出结果

```javascript
{
  "lastMonthRange": "20250901-20250930",  // 上月日期范围
  "lastMonthStart": "20250901",           // 上月第一天
  "lastMonthEnd": "20250930",             // 上月最后一天
  "lastMonthStr": "202509",               // 上月月份字符串 (YYYYMM)
  "today": "2025-10-21",                  // 今日日期
  "currentYear": 2025,                    // 当前年份
  "currentMonth": 10,                     // 当前月份 (1-12)
  "lastMonthYear": 2025,                  // 上月年份
  "lastMonth": 9                          // 上月月份 (1-12)
}
```

## 📊 计算逻辑

### 算法说明

1. **获取今日日期**：从输入参数或当前系统时间获取
2. **计算当前年月**：提取当前年份和月份
3. **计算上月年月**：
   - 如果当前是1月，上月是去年12月
   - 其他月份，上月是当前年份的前一个月
4. **计算上月第一天**：上月1日
5. **计算上月最后一天**：使用 `new Date(year, month + 1, 0)` 获取上月最后一天
6. **格式化输出**：转换为 `YYYYMMDD` 格式

### 计算示例

| 今日日期 | 当前月份 | 上月月份 | 上月范围 | 上月天数 |
|----------|----------|----------|----------|----------|
| 2025.10.21 | 10月 | 9月 | 20250901-20250930 | 30天 |
| 2025.01.15 | 1月 | 12月 | 20241201-20241231 | 31天 |
| 2025.03.31 | 3月 | 2月 | 20250201-20250228 | 28天 |
| 2024.03.31 | 3月 | 2月 | 20240201-20240229 | 29天 (闰年) |

## 🚀 实际应用场景

### 1. 在商户分析工作流中使用

```javascript
// 在n8n工作流中，可以这样使用：
// 1. 获取上月日期范围
const lastMonthRange = $json.lastMonthRange; // "20250901-20250930"
const lastMonthStr = $json.lastMonthStr; // "202509"

// 2. 分割日期范围
const [startDate, endDate] = lastMonthRange.split('-');
// startDate = "20250901", endDate = "20250930"

// 3. 用于Athena查询
const sqlQuery = `
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

### 2. 在Telegram Bot中使用

```javascript
// 发送上月统计报告
const message = `📊 **上月商户统计报告** (${lastMonthRange})
• 统计月份: ${lastMonthStr} (${lastMonth}月)
• 统计时间: ${lastMonthStart} 至 ${lastMonthEnd}
• 今日: ${today} (${currentMonth}月)
• 数据已更新，请查看详细报告`;
```

### 3. 在数据导出中使用

```javascript
// 生成文件名
const filename = `merchant_analytics_${lastMonthStr}.csv`;

// 设置查询参数
const queryParams = {
  startDate: lastMonthStart,
  endDate: lastMonthEnd,
  monthStr: lastMonthStr,
  statType: 'merchant_monthly'
};
```

## 🔍 测试验证

### 测试用例

```javascript
// 测试用例1: 2025.10.21 (10月)
// 期望结果: 20250901-20250930
// 实际结果: 20250901-20250930 ✅

// 测试用例2: 2025.01.15 (1月)  
// 期望结果: 20241201-20241231
// 实际结果: 20241201-20241231 ✅

// 测试用例3: 2025.03.31 (3月)
// 期望结果: 20250201-20250228
// 实际结果: 20250201-20250228 ✅

// 测试用例4: 2024.03.31 (闰年3月)
// 期望结果: 20240201-20240229
// 实际结果: 20240201-20240229 ✅
```

### 运行测试

```bash
# 运行测试脚本
node test-last-month-calculator.js
```

## 📝 注意事项

1. **时区处理**：所有计算基于本地时区
2. **日期格式**：支持多种输入格式，输出统一为 `YYYYMMDD` 格式
3. **跨年处理**：正确处理1月的上月是去年12月的情况
4. **闰年支持**：自动处理闰年2月的29天
5. **月份天数**：自动处理不同月份的天数差异

## 🚀 扩展功能

### 1. 添加更多时间范围

```javascript
// 可以扩展支持：
// - 上月
// - 上季度
// - 去年
// - 自定义月份范围
```

### 2. 添加工作日计算

```javascript
// 可以添加：
// - 上月工作日数量
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
// 错误: 上月范围计算错误
// 解决: 检查今日日期是否正确，确认时区设置
```

### 3. 跨年处理问题

```javascript
// 错误: 1月的上月计算错误
// 解决: 检查跨年逻辑是否正确实现
```

## 📚 相关文件

- `simple-last-month-calculator.js` - 简化生产版本
- `last-month-calculator.js` - 完整版本
- `test-last-month-calculator.js` - 测试脚本
- `last-month-calculator-usage.md` - 使用说明文档

## 🔄 与上周计算器的区别

| 功能 | 上周计算器 | 上月计算器 |
|------|------------|------------|
| 时间范围 | 7天 | 28-31天 |
| 计算复杂度 | 简单 | 中等 |
| 跨年处理 | 无 | 有 |
| 闰年处理 | 无 | 有 |
| 输出格式 | YYYYMMDD-YYYYMMDD | YYYYMMDD-YYYYMMDD |
| 额外输出 | 星期信息 | 月份信息 |









