// n8n Code节点：格式化数据供AI评级分析使用
// 功能：将game-rating-data-processor.js的输出格式化为AI易于理解的文本格式

const input = $input.first().json;

// 如果没有输入数据，返回错误
if (!input) {
  console.error("❌ 没有输入数据");
  return [];
}

// 提取数据
const gameName = input.gameName || "未知游戏";
const dataPeriod = input.dataPeriod || "未知周期";
const gameData = input.gameData || {};
const platformData = input.platformData || {};
const metrics = input.metrics || {};
const retentionDetails = input.retentionDetails || {};
const ratingCriteria = input.ratingCriteria || {};
const weights = input.weights || {};

// 格式化数据为文本
const formattedData = `
# 游戏评级分析数据

## 游戏基本信息
- **游戏名称**：${gameName}
- **数据周期**：${dataPeriod}

## 核心指标数据

### 1. 下注人数指标
- **游戏投注用户数**：${gameData.userCount || 0}人
- **全平台用户数**：${platformData.totalUserCount || 0}人
- **下注人数全平台占比**：${(metrics.userCountPlatformRatio || 0).toFixed(2)}%
- **评级标准**：
  - 100分：> 10%
  - 80分：5%-9%
  - 60分：3%-4%
  - 40分：1%-2%
  - 20分：< 1%
- **当前指标对比**：${getComparisonText(metrics.userCountPlatformRatio, [10, 5, 3, 1, 0])}

### 2. 留存指标
- **新用户D1留存率**：${(retentionDetails.newUser?.d1Retention || 0).toFixed(2)}%
- **新用户D7留存率**：${(retentionDetails.newUser?.d7Retention || 0).toFixed(2)}%
- **活跃用户D1留存率**：${(retentionDetails.activeUser?.d1Retention || 0).toFixed(2)}%
- **活跃用户D7留存率**：${(retentionDetails.activeUser?.d7Retention || 0).toFixed(2)}%
- **留存占比（主要指标，使用新用户D7留存率）**：${(metrics.retentionRate || 0).toFixed(2)}%
- **评级标准**：
  - 100分：> 30%
  - 80分：25-29%
  - 60分：21-24%
  - 40分：15-20%
  - 20分：< 14%
- **当前指标对比**：${getComparisonText(metrics.retentionRate, [30, 25, 21, 15, 0])}

### 3. 投注金额指标
- **游戏总投注USD**：$${(gameData.totalBetUSD || 0).toFixed(2)}
- **全平台总投注USD**：$${(platformData.totalBetUSD || 0).toFixed(2)}
- **下注金额全平台占比**：${(metrics.betAmountPlatformRatio || 0).toFixed(2)}%
- **人均下注金额**：$${(gameData.avgBetPerUser || 0).toFixed(2)}
- **评级标准**：
  - 100分：> 10%
  - 80分：5%-9%
  - 60分：3%-4%
  - 40分：1%-2%
  - 20分：< 1%
- **当前指标对比**：${getComparisonText(metrics.betAmountPlatformRatio, [10, 5, 3, 1, 0])}

### 4. GGR指标
- **游戏总GGR-USD**：$${(gameData.totalGGRUSD || 0).toFixed(2)}
- **游戏人均GGR**：$${(metrics.avgGGRPerUser || 0).toFixed(2)}
- **评级标准**：
  - 100分：> 40
  - 80分：25-39
  - 60分：15-24
  - 40分：5-14
  - 20分：< 5
- **当前指标对比**：${getComparisonText(metrics.avgGGRPerUser, [40, 25, 15, 5, 0])}

## 评级标准详细说明

### 100分 - 首页第一位
- 下注人数全平台占比 > 10%
- 留存占比 > 30%
- 下注金额全平台占比 > 10%
- 游戏人均GGR > 40

### 80分 - 首页2-6位
- 下注人数全平台占比：5%-9%
- 留存占比：25-29%
- 下注金额全平台占比：5%-9%
- 游戏人均GGR：25-39

### 60分 - 分组页1-6位
- 下注人数全平台占比：3%-4%
- 留存占比：21-24%
- 下注金额全平台占比：3%-4%
- 游戏人均GGR：15-24

### 40分 - 分组页7-12位
- 下注人数全平台占比：1%-2%
- 留存占比：15-20%
- 下注金额全平台占比：1%-2%
- 游戏人均GGR：5-14

### 20分 - 分组页13位以后
- 下注人数全平台占比 < 1%
- 留存占比 < 14%
- 下注金额全平台占比 < 1%
- 游戏人均GGR < 5

## 指标权重

- **人数**：${(weights.userCount || 0) * 100}%
- **人均下注金额**：${(weights.avgBetPerUser || 0) * 100}%
- **人均GGR**：${(weights.avgGGRPerUser || 0) * 100}%
- **留存**：${(weights.retention || 0) * 100}%

## 详细数据（JSON格式）

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## 分析要求

请根据以上数据，完成以下任务：

1. **综合评分**：根据四个核心指标与评级标准对比，给出最终评分（100/80/60/40/20分）

2. **推荐资源位**：根据评分推荐相应资源位

3. **详细分析**：
   - 逐项分析四个核心指标（下注人数占比、留存占比、下注金额占比、人均GGR）
   - 列出优势和不足
   - 说明评级依据

4. **改进建议**：根据分析结果提供具体改进建议

## 注意事项

- 如果某个指标为null或0，需要说明原因
- 如果全平台数据缺失，需要在报告中说明占比计算可能不准确
- 严格按照评级标准进行对比，选择最符合的档位
- 如果某个高权重指标明显不足，可以适当降档
`;

// 辅助函数：生成对比文本
function getComparisonText(value, thresholds) {
  if (!value && value !== 0) return "数据缺失";
  
  const [t100, t80, t60, t40, t20] = thresholds;
  
  if (value >= t100) return `✅ 达到100分标准（>= ${t100}）`;
  if (value >= t80) return `✅ 达到80分标准（${t80}-${t100-0.01}）`;
  if (value >= t60) return `✅ 达到60分标准（${t60}-${t80-0.01}）`;
  if (value >= t40) return `✅ 达到40分标准（${t40}-${t60-0.01}）`;
  if (value >= t20) return `⚠️ 仅达到20分标准（${t20}-${t40-0.01}）`;
  return `❌ 低于20分标准（< ${t20}）`;
}

console.log("📊 数据格式化完成");
console.log(`游戏名称：${gameName}`);
console.log(`数据周期：${dataPeriod}`);

return [{
  json: {
    content: formattedData,
    gameName: gameName,
    dataPeriod: dataPeriod,
    rawData: input
  }
}];












