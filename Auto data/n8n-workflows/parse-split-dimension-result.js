// n8n Code 节点：解析拆分维度判断结果，为第二个 AI 节点准备数据

const items = $input.all();

if (!items.length) {
  throw new Error('未收到上游数据');
}

const outputs = [];

items.forEach(item => {
  const json = item.json || {};
  
  // 解析第一个 AI 的输出（可能是字符串或对象）
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
      console.log('原始 output:', json.output);
    }
  }
  
  // 提取原始数据（包含 contextMessages 和 originalQuery）
  // **关键**：优先从 json 本身获取，因为上游节点已经准备好了数据
  const originalData = json;
  
  // 获取原始 SQL（按优先级查找）
  // 1. 优先从 json.contextMessages[0].sql（上游节点直接传递的）
  // 2. 其次从 json.originalQuery.contextMessages[0].sql
  // 3. 最后从 originalData.contextMessages[0].sql
  const originalSQL = 
    json.contextMessages?.[0]?.sql ||
    json.originalQuery?.contextMessages?.[0]?.sql || 
    originalData.contextMessages?.[0]?.sql || 
    '';
  
  console.log('🔍 查找原始 SQL:');
  console.log('  - json.contextMessages[0]?.sql:', json.contextMessages?.[0]?.sql ? '存在' : '不存在');
  console.log('  - json.originalQuery?.contextMessages[0]?.sql:', json.originalQuery?.contextMessages?.[0]?.sql ? '存在' : '不存在');
  console.log('  - originalData.contextMessages[0]?.sql:', originalData.contextMessages?.[0]?.sql ? '存在' : '不存在');
  console.log('  - 最终 originalSQL:', originalSQL ? `存在 (${originalSQL.length} 字符)` : '不存在');
  
  // 提取关键信息
  const canSplit = analysisResult.canSplit === true;
  const splitStrategy = analysisResult.splitStrategy || 'date_range';
  const splitDimension = analysisResult.splitDimension || 'day';
  const splitCount = analysisResult.splitCount || 0;
  const timeRange = analysisResult.timeRange || {};
  const queryConditions = analysisResult.queryConditions || {};
  const splitDetails = analysisResult.splitDetails || {};
  const originalQuery = analysisResult.originalQuery || originalData.originalQuery || {};
  const reason = analysisResult.reason || '';
  
  // 构建输出，确保包含所有必要字段
  const output = {
    json: {
      // 原始字段（保留）
      chatid: analysisResult.chatid || originalData.chatid || json.chatid || '',
      senderid: analysisResult.senderid || originalData.senderid || json.senderid || 0,
      messagid: analysisResult.messagid || originalData.messagid || json.messagid || 0,
      type: analysisResult.type || originalData.type || json.type || 'unknown',
      text: originalQuery.text || originalData.text || json.text || '',
      
      // 拆分判断结果（来自第一个 AI）
      canSplit,
      splitStrategy,
      splitDimension,
      splitCount,
      timeRange,
      queryConditions,
      splitDetails,
      originalQuery,
      reason,
      
      // **关键**：原始 SQL（必须传递给第二个 AI）
      originalSQL: originalSQL,
      
      // 原始数据（保留，供第二个 AI 使用）
      // **关键**：确保 contextMessages 被正确传递
      originalData: {
        contextMessages: json.contextMessages || originalData.contextMessages || originalData.originalQuery?.contextMessages || [],
        originalQuery: json.originalQuery || originalData.originalQuery || originalQuery,
        // 保留所有原始字段
        ...json,
        ...originalData
      },
      
      // 第一个 AI 的原始输出（用于调试）
      firstAIOutput: analysisResult
    }
  };
  
  outputs.push(output);
});

console.log(`✅ 解析了 ${outputs.length} 个拆分维度判断结果`);
console.log(`✅ 原始 SQL 存在: ${outputs[0]?.json.originalSQL ? '是' : '否'}`);
console.log(`✅ 拆分策略: ${outputs[0]?.json.splitStrategy || '未知'}`);
console.log(`✅ 拆分数量: ${outputs[0]?.json.splitCount || 0}`);

return outputs;

