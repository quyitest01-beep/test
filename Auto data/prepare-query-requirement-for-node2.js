// 准备节点二所需的数据格式
// n8n Code节点：准备节点二输入

const input = $input.first().json;

// 从第一个AI的输出中提取数据
// 第一个AI的输出可能在 output 字段中（如果是AI Agent节点）
let aiOutput = input.output || input;

// 如果 output 是字符串，尝试解析
if (typeof aiOutput === 'string') {
  try {
    // 尝试提取JSON（处理可能的markdown包裹）
    let jsonStr = aiOutput.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
    }
    aiOutput = JSON.parse(jsonStr);
  } catch (e) {
    console.error('解析AI输出失败:', e);
    // 如果解析失败，使用原始input
    aiOutput = input;
  }
}

// 提取 queryRequirement
const queryRequirement = aiOutput.queryRequirement || {};

// 确保 queryRequirement 是一个对象，不是字符串
let queryRequirementObj = queryRequirement;
if (typeof queryRequirement === 'string') {
  try {
    queryRequirementObj = JSON.parse(queryRequirement);
  } catch (e) {
    queryRequirementObj = { intent: queryRequirement };
  }
}

// 构建节点二需要的输入格式
const output = {
  // 核心字段：queryRequirement 必须是对象
  queryRequirement: queryRequirementObj,
  
  // 保留所有原始字段
  type: aiOutput.type || input.type || 'unknown',
  senderid: aiOutput.senderid || input.senderid || 0,
  messagid: aiOutput.messagid || input.messagid || 0,
  chatid: aiOutput.chatid || input.chatid || '',
  text: aiOutput.text || input.text || '',
  
  // 保留其他可能需要的字段
  row_number: input.row_number,
  change_type: input.change_type,
  time: input.time,
  status: input.status,
  status2: input.status2,
  analysis: input.analysis
};

console.log('📤 准备节点二输入:', JSON.stringify(output, null, 2));
console.log('📤 queryRequirement 类型:', typeof output.queryRequirement);
console.log('📤 queryRequirement 内容:', JSON.stringify(output.queryRequirement, null, 2));

return {
  json: output
};

