// 解析AI1输出（处理查数需求并判断场景）
// n8n Code节点：解析AI1输出

const rawOutput = $json.output || '';
if (!rawOutput) {
  throw new Error('AI 输出为空，无法解析');
}

console.log('📥 AI1原始输出:', rawOutput);

function extractJson(str) {
  // 去掉 Markdown 代码块
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }
  // 如果仍存在额外文字，尝试匹配JSON对象
  const match = cleaned.match(/\{[\s\S]*\}$/);
  return match ? match[0] : cleaned;
}

let parsed;
try {
  parsed = JSON.parse(extractJson(rawOutput));
  console.log('✅ JSON解析成功:', parsed);
} catch (error) {
  console.error('❌ JSON解析失败:', error.message);
  throw new Error('AI输出无法解析: ' + error.message + '\n原始内容: ' + rawOutput.substring(0, 500));
}

// 确保 queryRequirement 是对象类型
let queryRequirement = parsed.queryRequirement || {};
if (typeof queryRequirement === 'string') {
  try {
    queryRequirement = JSON.parse(queryRequirement);
  } catch (e) {
    queryRequirement = { intent: queryRequirement };
  }
}

// 构建输出结果，保留所有字段
const result = {
  // 核心字段：场景判断结果
  hasScenario: parsed.hasScenario ?? false,
  matchedScenarioId: parsed.matchedScenarioId || 'NEW',
  
  // queryRequirement 必须是对象
  queryRequirement: queryRequirement,
  
  // 如果不存在场景（hasScenario = false），包含这些字段
  finalSQL: parsed.finalSQL || '',
  outputType: parsed.outputType || (parsed.hasScenario === false ? '自主生成' : ''),
  scenarioRecord: parsed.scenarioRecord || {
    scenarioName: '',
    triggerKeywords: [],
    riskLevel: '',
    userRequirement: '',
    generatedSQL: '',
    notes: ''
  },
  
  // 其他字段
  reason: parsed.reason || '',
  confidence: parsed.confidence ?? 0,
  isKnowledgeBaseMatch: parsed.isKnowledgeBaseMatch ?? false,
  
  // 保留所有原始输入字段
  type: parsed.type || $json.type || 'unknown',
  senderid: parsed.senderid || $json.senderid || 0,
  messagid: parsed.messagid || $json.messagid || 0,
  chatid: parsed.chatid || $json.chatid || '',
  text: parsed.text || $json.text || '',
  
  // 保留其他可能需要的字段
  row_number: $json.row_number,
  change_type: $json.change_type,
  time: $json.time,
  status: $json.status,
  status2: $json.status2,
  analysis: $json.analysis
};

console.log('📤 解析后的结果:', JSON.stringify(result, null, 2));
console.log('📤 hasScenario:', result.hasScenario);
console.log('📤 matchedScenarioId:', result.matchedScenarioId);
console.log('📤 queryRequirement 类型:', typeof result.queryRequirement);

return {
  json: result
};

