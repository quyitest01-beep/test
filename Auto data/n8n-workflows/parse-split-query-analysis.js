// n8n Code 节点：解析拆分查数请求分析结果
// 处理AI节点"分析拆分查数请求"的输出

const items = $input.all();

if (!items.length) throw new Error('未收到数据');

const outputs = [];

items.forEach((item) => {
  const rawOutput = item.json.output || item.json.content || '';
  
  if (!rawOutput || typeof rawOutput !== 'string') {
    console.error('AI输出为空或格式错误');
    return;
  }
  
  console.log('📥 AI原始输出:', rawOutput);
  
  // 提取JSON（去掉markdown代码块等）
  function extractJson(str) {
    let cleaned = str.trim();
    
    // 去掉 Markdown 代码块
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
    console.error('原始内容:', rawOutput.substring(0, 500));
    
    // 尝试修复常见的JSON格式问题
    try {
      let fixedJson = rawOutput.replace(/'/g, '"');
      parsed = JSON.parse(extractJson(fixedJson));
      console.log('✅ 修复单引号后解析成功');
    } catch (e2) {
      // 如果还是失败，尝试提取所有可能的JSON片段
      const allJsonMatches = rawOutput.match(/\{[\s\S]*?\}/g);
      if (allJsonMatches && allJsonMatches.length > 0) {
        try {
          parsed = JSON.parse(allJsonMatches[allJsonMatches.length - 1]);
          console.log('✅ 从多个JSON片段中提取最后一个成功');
        } catch (e3) {
          throw new Error('AI输出无法解析: ' + error.message + '\n尝试修复后仍失败: ' + e2.message + '\n原始内容: ' + rawOutput.substring(0, 500));
        }
      } else {
        throw new Error('AI输出无法解析: ' + error.message + '\n原始内容: ' + rawOutput.substring(0, 500));
      }
    }
  }
  
  // 合并原始输入和解析结果
  const original = item.json;
  
  // 构建输出结果
  const result = {
    // 解析后的AI输出
    canSplit: parsed.canSplit ?? false,
    splitStrategy: parsed.splitStrategy || 'date_range',
    splitCount: parsed.splitCount || 0,
    splitPlan: parsed.splitPlan || [],
    reason: parsed.reason || '',
    requiredFields: parsed.requiredFields || [],
    suggestedQuestion: parsed.suggestedQuestion || '',
    
    // 原始查询信息
    originalQuery: parsed.originalQuery || original.originalQuery || {
      text: original.text,
      merchant_id: original.originalQuery?.merchant_id,
      timeRange: original.originalQuery?.timeRange,
      chatid: original.chatid,
      senderid: original.senderid,
      messagid: original.messagid,
      type: original.type
    },
    
    // 保留所有原始字段
    chatid: parsed.chatid || original.chatid,
    senderid: parsed.senderid || original.senderid,
    messagid: parsed.messagid || original.messagid,
    type: parsed.type || original.type || 'telegram',
    text: parsed.text || original.text || '',
    
    // 文件大小信息（如果有）
    fileSizeMB: original.fileSizeMB,
    fileSizeGB: original.fileSizeGB,
    estimatedFileSize: original.estimatedFileSize,
    
    // 其他字段
    needsSplit: original.needsSplit,
    splitReason: original.splitReason,
    contextMessages: original.contextMessages,
    context: original.context,
    
    // 时间戳
    createdAt: new Date().toISOString()
  };
  
  outputs.push({
    json: result
  });
});

return outputs;

