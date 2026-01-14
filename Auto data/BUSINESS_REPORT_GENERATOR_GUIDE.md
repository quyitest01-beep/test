# 业务分析报告自动生成指南

## 📋 概述

本系统提供完整的多维度业务数据分析能力，自动生成日报/周报/月报HTML报告。

## 🎯 系统架构

```
[数据源] -> [业务分析器] -> [HTML生成器] -> [PDF渲染] -> [报告输出]
```

### 核心组件

| 组件 | 文件 | 功能 |
|------|------|------|
| **业务分析器** | `backend/business-report-analyzer.js` | 多维度数据分析、环比计算、智能结论生成 |
| **HTML生成器** | `backend/report-html-generator.js` | 美观HTML报告生成 |
| **PDF渲染服务** | `backend/pdf-service/server.js` | HTML转PDF |

## 📊 分析维度

### 1️⃣ 新游戏分析
- GGR贡献
- Top商户占比
- 核心币种结构
- 增长潜力评估

### 2️⃣ 商户维度分析
- Top增长/下滑商户
- GGR贡献结构
- 风险识别

### 3️⃣ 游戏维度分析
- 增长/下滑游戏Top5
- 结构变化分析
- 风险集中度

### 4️⃣ 投注量分析
- 总投注额环比
- 投注与GGR相关性
- RTP异常检测

### 5️⃣ 局数分析
- 活跃度变化
- 人均投注变化
- 用户粘性

### 6️⃣ 币种维度分析
- 区域市场表现
- 核心/新兴币种
- 增长贡献分析

### 7️⃣ 留存数据分析
- 新用户次留/7日留
- 老用户粘性
- 游戏/商户维度对比

### 8️⃣ 综合结论
- 整体表现总结
- 核心发现
- 改进建议

## 🔧 数据输入格式

### 业务分析器输入

#### 新游戏数据示例
```json
{
  "gametype": "new_game",
  "game_name": "Go Labubu!",
  "ggr": 15000,
  "top_merchants": [
    {"name": "betfiery", "ggr": 8000},
    {"name": "aajogo", "ggr": 5000}
  ],
  "currencies": [
    {"code": "MXN", "ggr": 10000},
    {"code": "INR", "ggr": 3000}
  ],
  "date": "2025-10-28"
}
```

#### 商户数据示例
```json
{
  "merchant_id": 1698202251,
  "merchant_name": "betfiery",
  "ggr": 50000,
  "period": "current",
  "date": "2025-10-28"
}
```

#### 上期对比数据
```json
{
  "merchant_id": 1698202251,
  "merchant_name": "betfiery",
  "ggr": 45000,
  "period": "previous",
  "date": "2025-10-21"
}
```

#### 游戏数据示例
```json
{
  "game_id": "1698217743228",
  "game_name": "Go Crybaby!",
  "ggr": 25000,
  "period": "current"
}
```

#### 投注数据示例
```json
{
  "bet_amount": 500000,
  "total_payout": 450000,
  "period": "current"
}
```

#### 局数数据示例
```json
{
  "rounds": 12000,
  "period": "current"
}
```

#### 币种数据示例
```json
{
  "currency": "MXN",
  "ggr": 200000,
  "period": "current"
}
```

#### 留存数据示例
```json
{
  "game_name": "Chicken Road",
  "merchant_name": "betfiery",
  "user_type": "new",
  "d1_retention_rate": 17,
  "d7_retention_rate": 0.8
}
```

## 🎨 HTML报告特点

- **美观设计**：渐变色头部、卡片式布局
- **响应式**：适配不同屏幕尺寸
- **数据可视化**：彩色指标、图标标识
- **专业排版**：表格、标签、层次清晰
- **打印友好**：适合PDF转换

## 🚀 使用流程

### n8n工作流配置

```
1. [数据查询节点]
   ↓
2. [业务分析器] ← Code: business-report-analyzer.js
   ↓
3. [HTML生成器] ← Code: report-html-generator.js
   ↓
4. [PDF渲染] ← HTTP Request to PDF Service
   ↓
5. [报告输出]
```

### 步骤1：数据准备

确保输入数据包含：
- ✅ 当前周期数据
- ✅ 对比周期数据（用于环比计算）
- ✅ 必要的维度标识字段

### 步骤2：配置业务分析器节点

**节点类型**: Code  
**代码**: 复制 `backend/business-report-analyzer.js` 的完整内容

**输入数据格式**:
- 混合输入：当前数据和对比数据一起传入
- 数据分类：分析器自动识别数据类型

**输出示例**:
```json
{
  "reportType": "weekly",
  "summary": {
    "overallGGR": {
      "current": 500000,
      "previous": 450000,
      "change": {
        "rate": 11.1,
        "isPositive": true,
        "display": "+11.1%"
      }
    }
  },
  "analyses": {
    "newGame": {...},
    "merchant": {...},
    "game": {...},
    "bet": {...},
    "rounds": {...},
    "currency": {...},
    "retention": {...}
  },
  "overallConclusion": "..."
}
```

### 步骤3：配置HTML生成器节点

**节点类型**: Code  
**代码**: 复制 `backend/report-html-generator.js` 的完整内容

**输入**: 来自业务分析器的输出

**输出示例**:
```json
{
  "html": "<!DOCTYPE html>...</html>",
  "reportType": "周报",
  "date": "2025年11月3日 星期日",
  "span": "每周"
}
```

### 步骤4：配置PDF渲染节点

**HTTP Request配置**:
```json
{
  "method": "POST",
  "url": "https://your-pdf-service-url/render",
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "html",
        "value": "={{ $json.html }}"
      },
      {
        "name": "filename",
        "value": "={{ $json.span }}数据报告.pdf"
      }
    ]
  },
  "options": {
    "response": {
      "responseFormat": "file",
      "outputPropertyName": "pdf"
    }
  }
}
```

## 📈 分析规则详解

### 环比计算

```javascript
环比 = (本期值 - 上期值) / 上期值 * 100%
```

**示例**:
- 本期GGR: $50,000
- 上期GGR: $45,000
- 环比: +11.1%

### Top N筛选

| 场景 | N值 | 排序 |
|------|-----|------|
| 增长商户 | 3 | 环比降序 |
| 下滑商户 | 3 | 环比升序 |
| 增长游戏 | 5 | 环比降序 |
| 下滑游戏 | 5 | 环比升序 |
| 新游戏 | 5 | GGR降序 |

### 智能结论生成

#### 投注vs GGR分析
```
IF 投注降幅 < GGR降幅 THEN
  结论 = "RTP波动放大收益变化，需复核高赔率段出奖"
ELSE
  结论 = "投注与GGR变化基本一致"
```

#### 局数vs投注分析
```
IF 局数降幅 < 投注降幅 THEN
  结论 = "活跃人数变化不大，但单局投注额下降"
ELSE
  结论 = "局数降幅反映活跃度变化"
```

## ⚙️ 配置选项

### 分析器配置

```javascript
// 自定义Top N数量
const TOP_MERCHANT = 3;
const TOP_GAME = 5;
const TOP_CURRENCY = 3;

// 自定义阈值
const MIN_CHANGE_THRESHOLD = 0.1; // 忽略<0.1%的变化
```

### HTML模板配置

修改 `report-html-generator.js` 中的样式：
- 主题色：`#667eea`, `#764ba2`
- 表格样式
- 打印样式

## 🔍 故障排查

### 问题1：没有输出分析结果

**检查**:
1. 输入数据格式是否正确
2. 是否包含必要的字段
3. 控制台日志查看数据分类统计

### 问题2：环比计算错误

**检查**:
1. 当前数据和对比数据是否匹配
2. ID字段是否正确对应
3. 数值字段是否为数字类型

### 问题3：HTML渲染异常

**检查**:
1. HTML字符串是否完整
2. PDF服务是否正常运行
3. 查看浏览器控制台错误

## 📝 输出报告示例

### 日报
```
📊 日报
2025年11月3日 星期日

核心指标：
- 总GGR: $500,000 (+11.1%)
- 投注总额: $5,000,000 (+8.5%)
- 总局数: 120,000 (+5.0%)

分析模块：
1. 新游戏分析
2. 商户维度分析
3. 投注量分析
4. 局数分析

总体结论：
本期整体GGR环比增长11.1%，主要由新增游戏贡献...
```

### 周报
```
📊 周报
2025年10月28日 至 2025年11月3日

核心指标：
- 总GGR: $3,500,000 (-5.2%)
- 新游戏GGR: $150,000 (占比4.3%)
- 投注总额: $35,000,000 (-3.8%)

完整分析模块：
1. 新游戏分析
2. 商户维度分析
3. 游戏维度分析
4. 投注量分析
5. 局数分析
6. 币种维度分析
7. 留存数据分析

总体结论：
本期整体GGR环比下降5.2%，主要由老游戏下滑导致...
```

### 月报
```
📊 月报
2025年10月

核心指标：
- 总GGR: $15,000,000 (+3.5%)
- 新游戏GGR: $1,500,000 (占比10.0%)
- 投注总额: $150,000,000 (+5.2%)

完整分析模块：
1. 新游戏分析（详细）
2. 商户维度分析（完整）
3. 游戏维度分析（完整）
4. 投注量分析
5. 局数分析
6. 币种维度分析
7. 留存数据分析（详细）
8. RTP分析

总体结论：
本月整体GGR环比增长3.5%，主要由新游戏贡献...
```

## 📚 相关文件

- `backend/business-report-analyzer.js` - 业务分析器
- `backend/report-html-generator.js` - HTML生成器
- `backend/pdf-service/server.js` - PDF服务
- `PDF_SERVICE_SETUP_GUIDE.md` - PDF服务配置
- `start-pdf-service.bat` - PDF服务启动脚本

## 🎯 下一步优化

- [ ] 支持自定义报告模板
- [ ] 添加图表可视化
- [ ] 支持多语言报告
- [ ] 数据验证增强
- [ ] 性能优化（大数据量）

