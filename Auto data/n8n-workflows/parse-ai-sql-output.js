// 解析AI3输出（查询文档内容并生成最终SQL）
// n8n Code节点：解析AI3输出（支持多SQL场景）

const rawOutput = $json.output || '';

if (!rawOutput) {
  throw new Error('AI 输出为空，无法解析');
}

console.log('📥 AI3原始输出:', rawOutput);

function extractJson(str) {
  // 去掉 Markdown 代码块
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  }
  
  // 🔧 修复：处理多个连续的 JSON 对象（没有分隔符）
  // 使用括号计数法提取第一个完整的 JSON 对象
  let braceCount = 0;
  let startIndex = cleaned.indexOf('{');
  let endIndex = -1;
  let jsonStr = '';
  
  if (startIndex !== -1) {
    // 从第一个 { 开始，找到匹配的 }
    let inString = false;
    let escapeNext = false;
    
    for (let i = startIndex; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      // 只在非字符串状态下计数括号
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }
    
    if (endIndex !== -1) {
      jsonStr = cleaned.substring(startIndex, endIndex + 1);
      console.log('✅ 提取第一个 JSON 对象，长度:', jsonStr.length);
      
      // 检查是否有多个 JSON 对象
      if (cleaned.length > endIndex + 1 && cleaned[endIndex + 1] === '{') {
        console.log('⚠️ 检测到多个连续的 JSON 对象，已只取第一个');
      }
    } else {
      // 如果没有找到匹配的 }，尝试使用正则匹配
      console.log('⚠️ 未找到匹配的 }，尝试使用正则匹配');
      const match = cleaned.match(/^\{[\s\S]*\}/);
      jsonStr = match ? match[0] : cleaned;
    }
  } else {
    // 如果没有找到 {，尝试匹配整个字符串
    jsonStr = cleaned;
  }
  
  // 🔧 关键修复：将 Python 的 None 替换为 JSON 的 null
  // 处理各种 None 的情况：
  // - "key": None
  // - "key": None,
  // - None
  jsonStr = jsonStr
    .replace(/:\s*None\s*([,}\]]|$)/g, ': null$1')  // 替换 : None 为 : null
    .replace(/,\s*None\s*([,}\]]|$)/g, ', null$1')   // 替换 , None 为 : null
    .replace(/\[\s*None\s*\]/g, '[null]')           // 替换 [None] 为 [null]
    .replace(/None\s*([,}\]]|$)/g, 'null$1');       // 替换独立的 None 为 null
  
  return jsonStr;
}

let parsed;
try {
  parsed = JSON.parse(extractJson(rawOutput));
  console.log('✅ JSON解析成功:', parsed);
} catch (error) {
  console.error('❌ JSON解析失败:', error.message);
  console.error('📝 处理后的JSON字符串:', extractJson(rawOutput).substring(0, 500));
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

// 检查是否为多SQL场景
const isMultiSQL = parsed.outputType === '套用模板（多SQL）' || 
                   parsed.finalSQL_new !== undefined || 
                   parsed.finalSQL_active !== undefined;

console.log('🔍 是否为多SQL场景:', isMultiSQL);
console.log('🔍 outputType:', parsed.outputType);
console.log('🔍 finalSQL_new:', parsed.finalSQL_new ? '存在' : '不存在');
console.log('🔍 finalSQL_active:', parsed.finalSQL_active ? '存在' : '不存在');

// 构建输出结果，保留所有字段
const result = {
  // 核心字段：SQL生成结果
  matchedScenarioId: parsed.matchedScenarioId || 'NEW',
  confidence: parsed.confidence ?? 1.0,
  isKnowledgeBaseMatch: parsed.isKnowledgeBaseMatch ?? true,
  outputType: parsed.outputType || '套用模板',
  
  // SQL字段：根据场景选择
  ...(isMultiSQL ? {
    // 多SQL场景：保留 finalSQL_new 和 finalSQL_active
    finalSQL_new: parsed.finalSQL_new || '',
    finalSQL_active: parsed.finalSQL_active || '',
    finalSQL: '', // 多SQL场景下 finalSQL 为空
  } : {
    // 单SQL场景：保留 finalSQL
    finalSQL: parsed.finalSQL || '',
    finalSQL_new: '', // 单SQL场景下 finalSQL_new 为空
    finalSQL_active: '', // 单SQL场景下 finalSQL_active 为空
  }),
  
  reason: parsed.reason || '',
  
  // 知识库相关字段
  knowledgeDocUrl: parsed.knowledgeDocUrl || '',
  hasUrl: parsed.hasUrl ?? false,
  
  // queryRequirement 必须是对象
  queryRequirement: queryRequirement,
  
  // 保留所有原始输入字段
  type: parsed.type || $json.type || 'unknown',
  senderid: parsed.senderid || $json.senderid || 0,
  messagid: parsed.messagid || $json.messagid || 0,
  chatid: parsed.chatid || $json.chatid || '',
  text: parsed.text || $json.text || '',
  id: parsed.id || $json.id || '',
  
  // 保留其他可能需要的字段
  row_number: $json.row_number,
  change_type: $json.change_type,
  time: $json.time,
  status: $json.status,
  status2: $json.status2,
  analysis: $json.analysis
};

console.log('📤 解析后的结果:', JSON.stringify(result, null, 2));
console.log('📤 outputType:', result.outputType);
console.log('📤 isMultiSQL:', isMultiSQL);
if (isMultiSQL) {
  console.log('📤 finalSQL_new:', result.finalSQL_new ? `存在（长度: ${result.finalSQL_new.length}）` : '不存在');
  console.log('📤 finalSQL_active:', result.finalSQL_active ? `存在（长度: ${result.finalSQL_active.length}）` : '不存在');
} else {
  console.log('📤 finalSQL:', result.finalSQL ? `存在（长度: ${result.finalSQL.length}）` : '不存在');
}
console.log('📤 queryRequirement 类型:', typeof result.queryRequirement);
console.log('📤 queryRequirement 内容:', JSON.stringify(result.queryRequirement, null, 2));

return {
  json: result
};
