# n8n 拆分查询 - 两阶段 AI 架构

## 📋 架构设计

> **知识库文档**：详细的拆分处理规则和示例请参考 [`ai-scenarios/SPLIT_QUERY_KNOWLEDGE_BASE.md`](../ai-scenarios/SPLIT_QUERY_KNOWLEDGE_BASE.md)

将拆分查询流程拆分为两个独立的 AI 节点：

```
输入数据
    ↓
[AI 节点 1：判断拆分维度]
    ├── 分析查询需求
    ├── 判断是否需要拆分
    ├── 确定拆分策略
    └── 输出拆分维度信息
    ↓
[Code 节点：解析 AI 输出]
    ↓
[条件判断]
    ├── canSplit = true → 继续
    └── canSplit = false → 返回错误
    ↓
[AI 节点 2：生成拆分 SQL]
    ├── 根据拆分维度
    ├── 生成具体 SQL
    └── 输出拆分计划
    ↓
[Code 节点：处理拆分计划]
    ↓
输出结果
```

---

## 🔍 AI 节点 1：判断拆分维度

### 功能
- 分析查询需求
- 判断是否需要拆分
- 确定拆分策略（按天/按小时/按其他维度）
- 提取查询条件（商户号、时间范围等）

### 配置

### 节点配置

**节点类型**：`@n8n/n8n-nodes-langchain.agent`  
**节点名称**：`判断拆分维度`  
**类型版本**：`2.2`

#### 参数配置

- **Prompt Type**: `define`
- **Has Output Parser**: `true`

#### Prompt 内容

```
请根据以下信息分析查询请求，判断是否需要拆分以及拆分策略。

输入数据：
- 原始查询文本：{{ $json.text }}
- 商户号：{{ $json.originalQuery?.merchant_id || '' }}
- 时间范围：{{ $json.originalQuery?.timeRange || '' }}
- 文件大小：{{ $json.estimatedFileSize || '' }}
- 上下文消息：{{ JSON.stringify($json.contextMessages || []) }}
- 上一条AI回复：{{ $json.context?.lastAiReply || '' }}
- 上一条用户消息：{{ $json.context?.previousMessage || '' }}
- last_sql：{{ $json.contextMessages?.[0]?.sql || '' }}
- type：{{ $json.type || 'unknown' }}
- senderid：{{ $json.senderid || 0 }}
- messagid：{{ $json.messagid || 0 }}
- chatid：{{ $json.chatid || '' }}

请按照以下步骤分析：

1. **分析查询需求**：
   - 提取查询意图（查什么）
   - 提取查询条件（商户号、时间范围、游戏ID、玩家ID等）
   - 如果 `last_sql` 不为空，分析其中的 WHERE 条件

2. **判断是否需要拆分**：
   - 如果文件大小超过 100MB，建议拆分
   - 如果时间范围超过 7 天，建议拆分
   - 如果查询条件复杂且数据量大，建议拆分
   - 如果信息不足（缺少时间范围、商户号），无法拆分

3. **确定拆分策略**（根据查询场景选择最合适的拆分维度）：

   **时间维度拆分**（适用于时间范围查询）：
   - 如果时间范围是"10月"（2025-10），按天拆分（date_range）
   - 如果时间范围是"最近7天"，按天拆分（date_range）
   - 如果时间范围是"上周"，按天拆分（date_range）
   - 如果时间范围是具体日期（单天），按小时拆分（hour_range）
   - 如果时间范围是具体时间段（如 10月1日-10月3日），按天拆分（date_range）
   - 如果时间范围超过 31 天，按天拆分（date_range）
   - 默认按天拆分（date_range）

   **商户维度拆分**（适用于多商户查询）：
   - 如果查询涉及多个商户（merchant_id 列表），按商户拆分（merchant_range）
   - 如果商户数量 > 10，建议按商户拆分

   **游戏维度拆分**（适用于多游戏查询）：
   - 如果查询涉及多个游戏（game_code 列表），按游戏拆分（game_range）
   - 如果游戏数量 > 10，建议按游戏拆分

   **提供商维度拆分**（适用于多提供商查询）：
   - 如果查询涉及多个 provider（如 'gp', 'popular', 'other'），按提供商拆分（provider_range）
   - 通常 provider 数量较少（2-5个），可以按提供商拆分

   **货币维度拆分**（适用于多币种查询）：
   - 如果查询涉及多个货币（currency 列表，如 'USD', 'PHP', 'THB'），按货币拆分（currency_range）
   - 如果货币数量 > 5，建议按货币拆分

   **用户维度拆分**（适用于大量用户查询）：
   - 如果查询涉及大量用户（uid 列表 > 50），按用户ID拆分（user_range）
   - 建议每批 50-100 个用户

   **组合拆分**（适用于多维度查询）：
   - 如果同时涉及多个维度（如时间 + 商户 + 游戏），优先按时间拆分，再按其他维度拆分
   - 如果时间范围很大且商户/游戏很多，可以组合拆分（time_range + merchant_range 或 game_range）

4. **计算拆分数量**：
   - **按天拆分**：计算天数（例如：10月 = 31天）
   - **按小时拆分**：计算小时数（通常 24 小时，或根据具体时间范围）
   - **按商户拆分**：计算商户数量（例如：5个商户 = 5个查询）
   - **按游戏拆分**：计算游戏数量（例如：10个游戏 = 10个查询）
   - **按提供商拆分**：计算提供商数量（通常 2-5 个）
   - **按货币拆分**：计算货币数量（通常 3-10 个）
   - **按用户拆分**：计算用户批次数量（每批 50-100 个用户）
   - 确保拆分数量合理（建议 2-50 个，最多不超过 100 个）

5. **输出格式**（必须是纯 JSON，不要用 markdown 代码块）：

如果**可以拆分**，输出：
{
  "canSplit": true,
  "splitStrategy": "date_range" | "hour_range" | "merchant_range" | "game_range" | "provider_range" | "currency_range" | "user_range" | "combined",
  "splitDimension": "day" | "hour" | "merchant" | "game" | "provider" | "currency" | "user" | "combined",
  "splitCount": 31,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958" | ["1716179958", "1716179959"] | null,
    "game_id": null | "gp_superace" | ["gp_superace", "gp_crash_73"],
    "game_code": null | "gp_superace" | ["gp_superace", "gp_crash_73"],
    "player_id": null | "123456" | ["123456", "789012"],
    "uid": null | "123456" | ["123456", "789012"],
    "provider": "gp,popular" | ["gp", "popular"] | null,
    "currency": null | "USD" | ["USD", "PHP", "THB"],
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": ["1716179958", "1716179959"] | null,
    "gameList": ["gp_superace", "gp_crash_73"] | null,
    "providerList": ["gp", "popular"] | null,
    "currencyList": ["USD", "PHP"] | null,
    "userBatchSize": 50 | null
  },
  "originalQuery": {
    "text": "原样保留",
    "merchant_id": "原样保留",
    "timeRange": "原样保留"
  },
  "reason": "说明拆分策略和拆分原因",
  "chatid": "原样保留",
  "senderid": "原样保留",
  "messagid": "原样保留",
  "type": "原样保留"
}

如果**无法拆分**，输出：
{
  "canSplit": false,
  "reason": "说明无法拆分的原因（缺少时间范围、商户号等）",
  "requiredFields": ["缺失的字段列表"],
  "suggestedQuestion": "建议用户补充的信息",
  "chatid": "原样保留",
  "senderid": "原样保留",
  "messagid": "原样保留",
  "type": "原样保留"
}
```

#### System Message

```
你是一个查询分析助手，熟悉 AWS Athena gmp.game_records 表。

你的任务是：
1. 分析查询请求，判断是否需要拆分
2. 确定最佳的拆分策略（按时间/按商户/按游戏/按提供商/按货币/按用户/组合拆分）
3. 提取查询条件（商户号、时间范围、游戏代码、货币类型、用户ID等）
4. 计算拆分数量

请参考拆分处理知识库（SPLIT_QUERY_KNOWLEDGE_BASE.md）了解详细的拆分规则和示例。

支持的拆分策略：
- date_range（按天拆分）：适用于时间范围查询（如"10月"、"最近7天"）
- hour_range（按小时拆分）：适用于单天查询，数据量大时按小时拆分
- merchant_range（按商户拆分）：适用于多商户查询（商户数量 > 5）
- game_range（按游戏拆分）：适用于多游戏查询（游戏数量 > 5）
- provider_range（按提供商拆分）：适用于多提供商查询（如 'gp', 'popular'）
- currency_range（按货币拆分）：适用于多币种查询（货币数量 > 3）
- user_range（按用户拆分）：适用于大量用户查询（用户数量 > 50，每批 50-100 个）
- combined（组合拆分）：适用于多维度查询（如时间 + 商户、时间 + 游戏）

关键要求：
- 必须保留所有上游字段（chatid、senderid、messagid、type等）
- 输出必须是纯 JSON 格式，不要使用 markdown 代码块
- 如果信息不足，必须明确说明缺少哪些字段
- 拆分策略要合理，避免拆分过细（> 100个）或过粗（< 2个）
- 优先选择数据量最大的维度进行拆分，以最大化减少单个查询的数据量
```

### 输出示例

**示例 1：按时间拆分（date_range）**
```json
{
  "canSplit": true,
  "splitStrategy": "date_range",
  "splitDimension": "day",
  "splitCount": 31,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958",
    "game_id": null,
    "game_code": null,
    "player_id": null,
    "uid": null,
    "provider": "gp,popular",
    "currency": null,
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": null,
    "gameList": null,
    "providerList": null,
    "currencyList": null,
    "userBatchSize": null
  },
  "originalQuery": {
    "text": "商户号: 1716179958\n查一下10月的游戏记录",
    "merchant_id": "1716179958",
    "timeRange": "2025-10"
  },
  "reason": "时间范围为10月（31天），文件大小预计超过100MB，建议按天拆分为31个查询",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**示例 2：按商户拆分（merchant_range）**
```json
{
  "canSplit": true,
  "splitStrategy": "merchant_range",
  "splitDimension": "merchant",
  "splitCount": 5,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-07",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-07 23:59:59"
  },
  "queryConditions": {
    "merchant_id": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "game_id": null,
    "game_code": null,
    "player_id": null,
    "uid": null,
    "provider": "gp,popular",
    "currency": null,
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "gameList": null,
    "providerList": null,
    "currencyList": null,
    "userBatchSize": null
  },
  "originalQuery": {
    "text": "查询多个商户10月1-7日的数据",
    "merchant_id": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "timeRange": "2025-10-01 到 2025-10-07"
  },
  "reason": "涉及5个商户，建议按商户拆分为5个查询，每个查询覆盖一个商户",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**示例 3：按游戏拆分（game_range）**
```json
{
  "canSplit": true,
  "splitStrategy": "game_range",
  "splitDimension": "game",
  "splitCount": 10,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958",
    "game_id": null,
    "game_code": ["gp_superace", "gp_crash_73", "gp_aviator", "popular_slots_1", "popular_slots_2", "popular_slots_3", "popular_slots_4", "popular_slots_5", "popular_slots_6", "popular_slots_7"],
    "player_id": null,
    "uid": null,
    "provider": "gp,popular",
    "currency": null,
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": null,
    "gameList": ["gp_superace", "gp_crash_73", "gp_aviator", "popular_slots_1", "popular_slots_2", "popular_slots_3", "popular_slots_4", "popular_slots_5", "popular_slots_6", "popular_slots_7"],
    "providerList": null,
    "currencyList": null,
    "userBatchSize": null
  },
  "originalQuery": {
    "text": "商户号: 1716179958\n查询10月所有游戏的数据",
    "merchant_id": "1716179958",
    "timeRange": "2025-10"
  },
  "reason": "涉及10个游戏，建议按游戏拆分为10个查询，每个查询覆盖一个游戏",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**示例 4：按货币拆分（currency_range）**
```json
{
  "canSplit": true,
  "splitStrategy": "currency_range",
  "splitDimension": "currency",
  "splitCount": 3,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958",
    "game_id": null,
    "game_code": null,
    "player_id": null,
    "uid": null,
    "provider": "gp,popular",
    "currency": ["USD", "PHP", "THB"],
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": null,
    "gameList": null,
    "providerList": null,
    "currencyList": ["USD", "PHP", "THB"],
    "userBatchSize": null
  },
  "originalQuery": {
    "text": "商户号: 1716179958\n查询10月所有币种的数据",
    "merchant_id": "1716179958",
    "timeRange": "2025-10"
  },
  "reason": "涉及3种货币（USD、PHP、THB），建议按货币拆分为3个查询，每个查询覆盖一种货币",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**示例 5：按用户拆分（user_range）**
```json
{
  "canSplit": true,
  "splitStrategy": "user_range",
  "splitDimension": "user",
  "splitCount": 5,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958",
    "game_id": null,
    "game_code": null,
    "player_id": null,
    "uid": ["user1", "user2", "user3", "user4", "user5", "user6", "user7", "user8", "user9", "user10", "user11", "user12", "user13", "user14", "user15", "user16", "user17", "user18", "user19", "user20", "user21", "user22", "user23", "user24", "user25", "user26", "user27", "user28", "user29", "user30", "user31", "user32", "user33", "user34", "user35", "user36", "user37", "user38", "user39", "user40", "user41", "user42", "user43", "user44", "user45", "user46", "user47", "user48", "user49", "user50", "user51", "user52", "user53", "user54", "user55", "user56", "user57", "user58", "user59", "user60", "user61", "user62", "user63", "user64", "user65", "user66", "user67", "user68", "user69", "user70", "user71", "user72", "user73", "user74", "user75", "user76", "user77", "user78", "user79", "user80", "user81", "user82", "user83", "user84", "user85", "user86", "user87", "user88", "user89", "user90", "user91", "user92", "user93", "user94", "user95", "user96", "user97", "user98", "user99", "user100"],
    "provider": "gp,popular",
    "currency": null,
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": null,
    "gameList": null,
    "providerList": null,
    "currencyList": null,
    "userBatchSize": 50
  },
  "originalQuery": {
    "text": "商户号: 1716179958\n查询100个用户的10月数据",
    "merchant_id": "1716179958",
    "timeRange": "2025-10"
  },
  "reason": "涉及100个用户，建议按用户拆分为5个查询，每批50个用户",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**示例 6：组合拆分（combined - 时间 + 商户）**
```json
{
  "canSplit": true,
  "splitStrategy": "combined",
  "splitDimension": "combined",
  "splitCount": 155,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "game_id": null,
    "game_code": null,
    "player_id": null,
    "uid": null,
    "provider": "gp,popular",
    "currency": null,
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "gameList": null,
    "providerList": null,
    "currencyList": null,
    "userBatchSize": null
  },
  "originalQuery": {
    "text": "查询5个商户10月的数据",
    "merchant_id": ["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"],
    "timeRange": "2025-10"
  },
  "reason": "涉及5个商户和31天，建议组合拆分：先按天拆分（31天），再按商户拆分（5个），共155个查询（31天 × 5商户）",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

**无法拆分**：
```json
{
  "canSplit": false,
  "reason": "缺少必要的时间范围信息，无法确定拆分策略",
  "requiredFields": ["timeRange"],
  "suggestedQuestion": "请提供查询的时间范围，例如：10月、最近7天、2025-10-01 到 2025-10-31",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

---

## 🔧 Code 节点：解析拆分维度判断结果

### 功能
- 解析 AI 输出
- 提取关键信息
- 为下一个 AI 节点准备数据

### 代码

```javascript
// n8n Code 节点：解析拆分维度判断结果

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const outputs = [];

items.forEach(item => {
  const json = item.json || {};
  
  // 解析 AI 输出（可能是字符串或对象）
  let analysisResult = json;
  
  // 如果 output 字段存在，尝试解析 JSON
  if (json.output) {
    try {
      // 移除可能的 markdown 代码块
      let outputStr = json.output;
      if (outputStr.includes('```json')) {
        outputStr = outputStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (outputStr.includes('```')) {
        outputStr = outputStr.replace(/```\n?/g, '').trim();
      }
      analysisResult = JSON.parse(outputStr);
    } catch (e) {
      console.log('解析 AI 输出失败，使用原始数据:', e.message);
    }
  }
  
  // 提取关键信息
  const canSplit = analysisResult.canSplit === true;
  const splitStrategy = analysisResult.splitStrategy || 'date_range';
  const splitDimension = analysisResult.splitDimension || 'day';
  const splitCount = analysisResult.splitCount || 0;
  const timeRange = analysisResult.timeRange || {};
  const queryConditions = analysisResult.queryConditions || {};
  const originalQuery = analysisResult.originalQuery || {};
  const reason = analysisResult.reason || '';
  const requiredFields = analysisResult.requiredFields || [];
  const suggestedQuestion = analysisResult.suggestedQuestion || '';
  
  // 保留所有原始字段
  const output = {
    json: {
      // 原始字段
      chatid: analysisResult.chatid || json.chatid || '',
      senderid: analysisResult.senderid || json.senderid || 0,
      messagid: analysisResult.messagid || json.messagid || 0,
      type: analysisResult.type || json.type || 'unknown',
      text: analysisResult.originalQuery?.text || json.text || '',
      
      // 拆分判断结果
      canSplit,
      splitStrategy,
      splitDimension,
      splitCount,
      timeRange,
      queryConditions,
      originalQuery,
      reason,
      requiredFields,
      suggestedQuestion,
      
      // 原始数据（保留）
      originalData: json
    }
  };
  
  outputs.push(output);
});

return outputs;
```

---

## 🎯 AI 节点 2：生成拆分 SQL

### 功能
- 根据拆分维度信息
- 生成具体的 SQL 拆分计划
- 确保所有拆分查询覆盖完整时间范围

### 配置

```json
{
  "parameters": {
    "promptType": "define",
    "text": "=请根据拆分维度信息，生成具体的 SQL 拆分计划。\n\n输入数据：\n- 拆分策略：{{ $json.splitStrategy }}\n- 拆分维度：{{ $json.splitDimension }}\n- 拆分数量：{{ $json.splitCount }}\n- 时间范围：{{ JSON.stringify($json.timeRange) }}\n- 查询条件：{{ JSON.stringify($json.queryConditions) }}\n- 拆分详情：{{ JSON.stringify($json.splitDetails) }}\n- 原始查询：{{ JSON.stringify($json.originalQuery) }}\n- last_sql：{{ $json.originalData?.contextMessages?.[0]?.sql || '' }}\n- chatid：{{ $json.chatid }}\n- senderid：{{ $json.senderid }}\n- messagid：{{ $json.messagid }}\n- type：{{ $json.type }}\n\n请按照以下要求生成拆分计划：\n\n1. **根据拆分维度生成拆分计划**：\n\n   **时间维度拆分**（date_range / hour_range）：\n   - 如果 `splitDimension` 是 \"day\"，按天拆分，每天一个查询\n   - 如果 `splitDimension` 是 \"hour\"，按小时拆分，每小时一个查询\n   - 确保所有拆分查询覆盖完整的时间范围，不遗漏任何数据\n\n   **商户维度拆分**（merchant_range）：\n   - 根据 `splitDetails.merchantList` 中的商户列表，每个商户生成一个查询\n   - 每个查询的 WHERE 条件包含 `merchant_id = 'xxx'`\n\n   **游戏维度拆分**（game_range）：\n   - 根据 `splitDetails.gameList` 中的游戏列表，每个游戏生成一个查询\n   - 每个查询的 WHERE 条件包含 `game_code = 'xxx'`\n\n   **提供商维度拆分**（provider_range）：\n   - 根据 `splitDetails.providerList` 或 `queryConditions.provider`，每个提供商生成一个查询\n   - 每个查询的 WHERE 条件包含 `provider = 'xxx'`（而不是 `IN`）\n\n   **货币维度拆分**（currency_range）：\n   - 根据 `splitDetails.currencyList` 中的货币列表，每种货币生成一个查询\n   - 每个查询的 WHERE 条件包含 `currency = 'xxx'`\n\n   **用户维度拆分**（user_range）：\n   - 根据 `queryConditions.uid` 和 `splitDetails.userBatchSize`，每批用户生成一个查询\n   - 每个查询的 WHERE 条件包含 `uid IN ('user1', 'user2', ...)`（每批 50-100 个用户）\n\n   **组合拆分**（combined）：\n   - 如果涉及多个维度（如时间 + 商户），生成所有组合的查询\n   - 例如：5个商户 × 31天 = 155个查询\n\n2. **生成 SQL 拆分计划**：\n   - 如果 `last_sql` 不为空，基于该 SQL 进行拆分\n   - 如果 `last_sql` 为空，根据查询条件生成新的 SQL\n   - 每个拆分查询必须包含：\n     * `hour` 分区条件（格式：YYYYMMDDHH，例如 '2025100100' 到 '2025100123'）\n     * `provider IN ('gp', 'popular')` 条件（除非是按提供商拆分，则使用 `provider = 'xxx'`）\n     * 其他查询条件（商户号、游戏代码、货币、用户ID等）\n   - 确保拆分后的 SQL 保留原始 SQL 的所有条件\n   - 根据拆分维度，在 WHERE 条件中添加对应的过滤条件\n\n3. **输出格式**（必须是纯 JSON，不要用 markdown 代码块）：\n\n{\n  \"canSplit\": true,\n  \"splitStrategy\": \"{{ $json.splitStrategy }}\",\n  \"splitCount\": {{ $json.splitCount }},\n  \"splitPlan\": [\n    {\n      \"part\": 1,\n      \"startDate\": \"2025-10-01\",\n      \"endDate\": \"2025-10-01\",\n      \"startTime\": \"2025-10-01 00:00:00\",\n      \"endTime\": \"2025-10-01 23:59:59\",\n      \"hourStart\": \"2025100100\",\n      \"hourEnd\": \"2025100123\",\n      \"description\": \"2025年10月1日的数据\",\n      \"sql\": \"SELECT ... FROM gmp.game_records WHERE hour BETWEEN '2025100100' AND '2025100123' AND provider IN ('gp', 'popular') AND merchant_id = '1716179958' ORDER BY created_at;\"\n    },\n    {\n      \"part\": 2,\n      \"startDate\": \"2025-10-02\",\n      \"endDate\": \"2025-10-02\",\n      \"startTime\": \"2025-10-02 00:00:00\",\n      \"endTime\": \"2025-10-02 23:59:59\",\n      \"hourStart\": \"2025100200\",\n      \"hourEnd\": \"2025100223\",\n      \"description\": \"2025年10月2日的数据\",\n      \"sql\": \"SELECT ... FROM gmp.game_records WHERE hour BETWEEN '2025100200' AND '2025100223' AND provider IN ('gp', 'popular') AND merchant_id = '1716179958' ORDER BY created_at;\"\n    }\n    // ... 更多拆分计划\n  ],\n  \"originalQuery\": {{ JSON.stringify($json.originalQuery) }},\n  \"reason\": \"说明拆分策略和拆分计划\",\n  \"chatid\": \"{{ $json.chatid }}\",\n  \"senderid\": \"{{ $json.senderid }}\",\n  \"messagid\": \"{{ $json.messagid }}\",\n  \"type\": \"{{ $json.type }}\"\n}\n\n关键要求：\n- 每个 splitPlan 项必须包含完整的 SQL 语句\n- SQL 中的 `hour` 分区必须使用 YYYYMMDDHH 格式\n- 必须包含 `provider IN ('gp', 'popular')` 条件\n- 必须保留原始 SQL 的所有 WHERE 条件\n- 确保所有拆分查询覆盖完整的时间范围",
    "hasOutputParser": true,
    "options": {
      "systemMessage": "你是一个 SQL 拆分生成助手，熟悉 AWS Athena gmp.game_records 表。\n\n你的任务是：\n1. 根据拆分维度信息生成具体的 SQL 拆分计划\n2. 确保每个拆分查询包含完整的 SQL 语句\n3. 确保所有拆分查询覆盖完整的数据范围（时间、商户、游戏、货币、用户等）\n\n**核心原则**：\n- **必须基于原始 SQL（`last_sql`）进行拆分，不要重新生成 SQL**\n- 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号、游戏代码等\n- **完全保留**原始 SQL 的 SELECT 字段列表\n- **完全保留**原始 SQL 的 ORDER BY 子句\n- **完全保留**原始 SQL 的所有其他 WHERE 条件\n- **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）\n- 如果原始 SQL 的时间范围不完整（如只覆盖1天，但用户查询的是整个月），需要扩展到完整的时间范围\n\n支持的拆分维度：\n- date_range（按天拆分）：每天一个查询，覆盖完整时间范围\n- hour_range（按小时拆分）：每小时一个查询，覆盖完整时间范围\n- merchant_range（按商户拆分）：每个商户一个查询\n- game_range（按游戏拆分）：每个游戏一个查询\n- provider_range（按提供商拆分）：每个提供商一个查询（使用 `provider = 'xxx'` 而不是 `IN`）\n- currency_range（按货币拆分）：每种货币一个查询\n- user_range（按用户拆分）：每批用户一个查询（每批 50-100 个用户，使用 `uid IN (...)`）\n- combined（组合拆分）：多个维度的组合（如时间 + 商户）\n\n关键要求：\n- SQL 中的 `hour` 分区必须使用 YYYYMMDDHH 格式（例如：'2025100100' 到 '2025100123'）\n- 必须保留原始 SQL 中的所有条件（除非是按提供商拆分，则修改 `provider` 条件）\n- 根据拆分维度，修改或添加对应的过滤条件（时间范围、merchant_id、game_code、currency、uid 等）\n- 输出必须是纯 JSON 格式，不要使用 markdown 代码块\n- 每个 splitPlan 项必须包含完整的 SQL 语句"
    }
  },
  "type": "@n8n/n8n-nodes-langchain.agent",
  "typeVersion": 2.2,
  "name": "生成拆分 SQL"
}
```

### 输出示例

```json
{
  "canSplit": true,
  "splitStrategy": "date_range",
  "splitCount": 31,
  "splitPlan": [
    {
      "part": 1,
      "startDate": "2025-10-01",
      "endDate": "2025-10-01",
      "startTime": "2025-10-01 00:00:00",
      "endTime": "2025-10-01 23:59:59",
      "hourStart": "2025100100",
      "hourEnd": "2025100123",
      "description": "2025年10月1日的数据",
      "sql": "SELECT id, uid, merchant_id, game_id, game_code, provider, result, currency, ROUND(CAST(amount AS DOUBLE), 2) AS amount, ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, multiplier, balance, detail, DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at FROM gmp.game_records WHERE hour BETWEEN '2025100100' AND '2025100123' AND provider IN ('gp', 'popular') AND merchant_id = '1716179958' ORDER BY created_at;"
    },
    {
      "part": 2,
      "startDate": "2025-10-02",
      "endDate": "2025-10-02",
      "startTime": "2025-10-02 00:00:00",
      "endTime": "2025-10-02 23:59:59",
      "hourStart": "2025100200",
      "hourEnd": "2025100223",
      "description": "2025年10月2日的数据",
      "sql": "SELECT id, uid, merchant_id, game_id, game_code, provider, result, currency, ROUND(CAST(amount AS DOUBLE), 2) AS amount, ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, multiplier, balance, detail, DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at FROM gmp.game_records WHERE hour BETWEEN '2025100200' AND '2025100223' AND provider IN ('gp', 'popular') AND merchant_id = '1716179958' ORDER BY created_at;"
    }
    // ... 更多拆分计划
  ],
  "originalQuery": {
    "text": "商户号: 1716179958\n查一下10月的游戏记录",
    "merchant_id": "1716179958",
    "timeRange": "2025-10"
  },
  "reason": "按天拆分为31个查询，每个查询覆盖一天的数据，确保完整覆盖10月的时间范围",
  "chatid": "-1003129050838",
  "senderid": "6681153969",
  "messagid": "58",
  "type": "message"
}
```

---

## 🔄 完整工作流结构

```
输入数据
    ↓
[AI 节点 1：判断拆分维度]
    ├── 分析查询需求
    ├── 判断是否需要拆分
    ├── 确定拆分策略
    └── 输出拆分维度信息
    ↓
[Code 节点：解析拆分维度判断结果]
    ├── 解析 AI 输出
    ├── 提取关键信息
    └── 准备下一阶段数据
    ↓
[IF 节点：条件判断]
    ├── canSplit = true → 继续
    └── canSplit = false → 返回错误消息
    ↓
[AI 节点 2：生成拆分 SQL]
    ├── 根据拆分维度
    ├── 生成具体 SQL
    └── 输出拆分计划
    ↓
[Code 节点：处理拆分计划]
    ├── 解析拆分计划
    ├── 生成批量查询请求
    └── 输出到批量查询 API
    ↓
输出结果
```

---

## 📊 优势对比

### 单阶段 AI（原方案）
- ❌ 职责不清晰，一个 AI 做太多事情
- ❌ 判断逻辑和 SQL 生成耦合
- ❌ 难以调试和优化
- ❌ 如果判断错误，整个流程失败

### 两阶段 AI（新方案）
- ✅ 职责清晰，每个 AI 专注一个任务
- ✅ 判断逻辑和 SQL 生成分离
- ✅ 易于调试和优化
- ✅ 可以在判断阶段就返回错误，避免不必要的 SQL 生成
- ✅ 可以复用拆分维度判断结果，生成不同的 SQL 格式

---

## 🛠️ 实现步骤

### 1. 创建 AI 节点 1：判断拆分维度
- 复制现有 AI 节点
- 修改 prompt，只关注判断逻辑
- 配置输出格式

### 2. 创建 Code 节点：解析拆分维度判断结果
- 解析 AI 输出
- 提取关键信息
- 准备下一阶段数据

### 3. 创建 IF 节点：条件判断
- 判断 `canSplit`
- 如果 `false`，返回错误消息
- 如果 `true`，继续到下一个节点

### 4. 创建 AI 节点 2：生成拆分 SQL
- 根据拆分维度信息
- 生成具体的 SQL 拆分计划
- 确保 SQL 格式正确

### 5. 创建 Code 节点：处理拆分计划
- 解析拆分计划
- 生成批量查询请求
- 输出到批量查询 API

---

## 📝 注意事项

1. **字段传递**：确保所有必要字段（chatid、senderid、messagid、type）在两个 AI 节点之间正确传递

2. **错误处理**：在 IF 节点中处理 `canSplit = false` 的情况，返回友好的错误消息

3. **SQL 格式验证**：在生成 SQL 后，可以添加一个验证节点，确保 SQL 格式正确

4. **性能优化**：如果拆分数量很大（> 50），可以考虑分批处理

5. **日志记录**：在每个节点添加日志，方便调试和追踪问题

---

## 🔗 相关文档

- `N8N_SPLIT_QUERY_REQUEST_SETUP.md` - 原始单阶段 AI 配置
- `n8n-workflows/parse-split-query-analysis.js` - 解析拆分分析结果的 Code 节点
- `n8n-workflows/generate-split-sql-queries.js` - 生成拆分 SQL 的 Code 节点

