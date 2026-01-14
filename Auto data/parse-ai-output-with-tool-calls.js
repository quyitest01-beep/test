// 解析AI输出（处理工具调用信息）
// n8n Code节点：处理AI输出

const items = $input.all();
if (items.length < 2) {
  throw new Error('缺少 AI 输出项，无法合并');
}

const original = items[0].json;
let aiRawOutput = items[1].json.output || '';

if (!aiRawOutput) {
  throw new Error('AI 输出为空，无法解析');
}

console.log('📥 AI原始输出:', aiRawOutput);

// 处理工具调用信息
// AI输出可能包含：
// 1. Call: tool_name(...) 
// 2. Output: {...}
// 3. ```json {...} ``` 或纯 JSON

// 方法1：尝试提取 Output: 后面的JSON
let jsonMatch = aiRawOutput.match(/Output:\s*(\{[\s\S]*\})/);
if (jsonMatch) {
  aiRawOutput = jsonMatch[1];
  console.log('✅ 从 Output: 中提取JSON');
} else {
  // 方法2：尝试提取 markdown 代码块中的JSON
  const codeBlockMatch = aiRawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    aiRawOutput = codeBlockMatch[1];
    console.log('✅ 从代码块中提取JSON');
  } else {
    // 方法3：尝试直接提取第一个完整的JSON对象
    const jsonObjectMatch = aiRawOutput.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      aiRawOutput = jsonObjectMatch[0];
      console.log('✅ 直接提取JSON对象');
    } else {
      // 方法4：去掉 ```json ... ``` 包裹
      aiRawOutput = aiRawOutput.trim();
      if (aiRawOutput.startsWith('```')) {
        const stripped = aiRawOutput.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '');
        aiRawOutput = stripped.trim();
        console.log('✅ 去掉代码块标记');
      }
    }
  }
}

console.log('📝 提取的JSON字符串:', aiRawOutput);

let analysis = {};
try {
  analysis = JSON.parse(aiRawOutput);
  console.log('✅ JSON解析成功:', analysis);
} catch (error) {
  console.error('❌ JSON解析失败:', error.message);
  console.error('原始内容:', aiRawOutput);
  
  // 尝试修复常见的JSON格式问题
  try {
    // 尝试修复单引号问题
    let fixedJson = aiRawOutput.replace(/'/g, '"');
    analysis = JSON.parse(fixedJson);
    console.log('✅ 修复单引号后解析成功');
  } catch (e2) {
    // 如果还是失败，尝试提取所有可能的JSON片段
    const allJsonMatches = aiRawOutput.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (allJsonMatches && allJsonMatches.length > 0) {
      try {
        analysis = JSON.parse(allJsonMatches[allJsonMatches.length - 1]);
        console.log('✅ 从多个JSON片段中提取最后一个成功');
      } catch (e3) {
        throw new Error('AI输出无法解析: ' + error.message + '\n尝试修复后仍失败: ' + e2.message + '\n原始内容: ' + aiRawOutput.substring(0, 500));
      }
    } else {
      throw new Error('AI输出无法解析: ' + error.message + '\n原始内容: ' + aiRawOutput.substring(0, 500));
    }
  }
}

return {
  json: {
    ...original,
    analysis,
  },
};

