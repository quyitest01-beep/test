# n8n 新游戏评级AI配置指南

## 工作流配置

### 1. 工作流节点顺序

```
上游数据 → filter-new-game-data.js → game-rating-data-processor.js → AI Agent → 输出
```

### 2. 节点配置步骤

#### 步骤1：数据过滤节点（filter-new-game-data.js）
- **节点类型**：Code
- **代码**：使用 `filter-new-game-data.js` 的代码
- **功能**：过滤出新游戏的数据

#### 步骤2：数据处理节点（game-rating-data-processor.js）
- **节点类型**：Code
- **代码**：使用 `game-rating-data-processor.js` 的代码
- **功能**：处理数据并计算评级所需的所有指标
- **输出**：结构化的JSON数据

#### 步骤3：数据格式化节点（可选）
- **节点类型**：Code
- **功能**：将处理后的数据格式化为适合AI读取的文本格式
- **代码示例**：

```javascript
const input = $input.first().json;

const formattedData = `
# 游戏评级分析数据

## 游戏基本信息
- 游戏名称：${input.gameName}
- 数据周期：${input.dataPeriod}

## 核心指标数据

### 1. 下注人数指标
- 游戏投注用户数：${input.gameData.userCount}人
- 全平台用户数：${input.platformData.totalUserCount}人
- 下注人数全平台占比：${input.metrics.userCountPlatformRatio}%
- 评级标准：需要 > 10%（100分）、5-9%（80分）、3-4%（60分）、1-2%（40分）、<1%（20分）

### 2. 留存指标
- 新用户D1留存率：${input.retentionDetails.newUser.d1Retention}%
- 新用户D7留存率：${input.retentionDetails.newUser.d7Retention}%
- 留存占比（主要指标）：${input.metrics.retentionRate}%
- 评级标准：需要 > 30%（100分）、25-29%（80分）、21-24%（60分）、15-20%（40分）、<14%（20分）

### 3. 投注金额指标
- 游戏总投注USD：$${input.gameData.totalBetUSD.toFixed(2)}
- 全平台总投注USD：$${input.platformData.totalBetUSD.toFixed(2)}
- 下注金额全平台占比：${input.metrics.betAmountPlatformRatio}%
- 人均下注金额：$${input.gameData.avgBetPerUser.toFixed(2)}
- 评级标准：需要 > 10%（100分）、5-9%（80分）、3-4%（60分）、1-2%（40分）、<1%（20分）

### 4. GGR指标
- 游戏总GGR-USD：$${input.gameData.totalGGRUSD.toFixed(2)}
- 游戏人均GGR：$${input.metrics.avgGGRPerUser.toFixed(2)}
- 评级标准：需要 > 40（100分）、25-39（80分）、15-24（60分）、5-14（40分）、<5（20分）

## 评级标准参考

${JSON.stringify(input.ratingCriteria, null, 2)}

## 指标权重

${JSON.stringify(input.weights, null, 2)}

## 详细数据

${JSON.stringify(input, null, 2)}
`;

return [{
  json: {
    content: formattedData,
    gameData: input
  }
}];
```

#### 步骤4：AI Agent节点配置

**方式1：使用 System Message + Prompt**

1. **节点类型**：AI Agent（LangChain Agent）
2. **Credentials**：配置你的AI服务凭证（OpenAI、Anthropic等）
3. **System Message**：复制 `ai-prompt-game-rating-n8n.txt` 的全部内容
4. **Prompt**：使用以下代码获取数据：

```javascript
const input = $input.first().json;
return input.content || JSON.stringify(input.gameData || input, null, 2);
```

**方式2：使用 Chat Trigger + AI Agent**

1. **Chat Trigger节点**：
   - 配置聊天触发器
   - 在触发时传入格式化后的数据

2. **AI Agent节点**：
   - System Message：使用 `ai-prompt-game-rating-n8n.txt` 的内容
   - Prompt：使用 `{{ $json.content }}` 或 `{{ $json }}`

#### 步骤5：输出节点

- **节点类型**：可以是指定输出、Google Docs、HTTP Request等
- **功能**：保存AI生成的评级报告

## 完整工作流示例

### 节点1：HTTP Request（获取原始数据）
- 从数据源获取原始数据

### 节点2：Code（filter-new-game-data.js）
- 过滤新游戏数据

### 节点3：Code（game-rating-data-processor.js）
- 处理数据并计算指标

### 节点4：Code（数据格式化）
- 将数据格式化为文本格式

### 节点5：Set节点（准备AI输入）
- 创建 `chatInput` 字段：
  ```json
  {
    "chatInput": "{{ $json.content }}"
  }
  ```

### 节点6：AI Agent
- **Mode**：Agent
- **System Message**：使用 `ai-prompt-game-rating-n8n.txt` 的内容
- **Prompt**：`{{ $json.chatInput }}`
- **Output Parser**：Markdown（如果需要结构化输出，可以使用JSON Schema）

### 节点7：Code（处理AI输出）
- 提取评级结果
- 格式化输出

### 节点8：输出节点
- 保存评级报告

## AI Agent节点详细配置

### System Message配置

将 `ai-prompt-game-rating-n8n.txt` 的全部内容复制到 System Message 字段。

### Prompt配置

如果使用 `chatInput` 字段：
```
{{ $json.chatInput }}
```

如果直接使用数据：
```javascript
const input = $input.first().json;
return input.content || JSON.stringify(input, null, 2);
```

### Output Parser配置（可选）

如果需要结构化输出，可以使用JSON Schema：

```json
{
  "type": "object",
  "properties": {
    "score": {
      "type": "number",
      "description": "综合评分（100/80/60/40/20）"
    },
    "resource": {
      "type": "string",
      "description": "推荐资源位"
    },
    "analysis": {
      "type": "string",
      "description": "详细分析报告（Markdown格式）"
    }
  },
  "required": ["score", "resource", "analysis"]
}
```

## 测试步骤

1. **测试数据处理**：
   - 运行 `game-rating-data-processor.js` 节点
   - 检查输出数据是否包含所有必要字段
   - 验证指标计算是否正确

2. **测试数据格式化**：
   - 运行数据格式化节点
   - 检查格式化后的文本是否清晰易读

3. **测试AI分析**：
   - 运行AI Agent节点
   - 检查AI是否理解了数据
   - 验证输出格式是否符合要求

4. **测试完整流程**：
   - 运行整个工作流
   - 检查最终输出是否完整

## 常见问题

### 问题1：AI Agent报错 "No prompt specified"
**解决方案**：
- 确保在Set节点中创建了 `chatInput` 字段
- 或者在AI Agent节点的Prompt字段中使用 `{{ $json.content }}`

### 问题2：AI输出不符合格式要求
**解决方案**：
- 检查System Message是否完整
- 在System Message中强调输出格式要求
- 使用Output Parser（JSON Schema）约束输出格式

### 问题3：AI没有使用提供的数据
**解决方案**：
- 确保数据格式化节点输出的文本清晰
- 在System Message中明确要求AI使用提供的数据
- 检查Prompt是否正确传递了数据

### 问题4：评级结果不准确
**解决方案**：
- 检查数据处理节点的计算是否正确
- 验证全平台数据是否准确
- 检查评级标准是否清晰传达给AI

## 优化建议

1. **数据验证**：
   - 在数据处理节点中添加数据验证
   - 确保所有必要字段都存在
   - 检查数据合理性

2. **错误处理**：
   - 添加错误处理逻辑
   - 记录处理过程中的错误
   - 提供友好的错误提示

3. **性能优化**：
   - 如果数据量大，考虑分批处理
   - 缓存全平台数据
   - 优化数据格式化过程

4. **输出优化**：
   - 保存AI输出的原始数据
   - 提取关键信息（评分、资源位）用于后续处理
   - 格式化输出以便阅读和分享

## 示例输出

成功运行后，AI应该输出类似以下格式的报告：

```markdown
# Aero Rush 游戏评级分析报告

## 一、基本信息
- **游戏名称**：Aero Rush
- **数据周期**：20251028 - 20251102
- **综合评分**：40分
- **推荐资源位**：分组页7-12位

## 二、核心指标数据
...
```












