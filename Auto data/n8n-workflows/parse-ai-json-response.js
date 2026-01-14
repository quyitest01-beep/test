// n8n Code 节点：解析 AI 返回的 JSON 响应
// 修复：处理多个输入项，合并所有解析结果，支持 markdown 代码块格式

const items = $input.all();

if (!items.length) throw new Error('未收到数据');

const allParsed = [];

// 提取 markdown 代码块中的 JSON 内容
function extractJsonFromMarkdown(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  // 尝试提取 ```json ... ``` 或 ``` ... ``` 代码块中的内容
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // 如果没有代码块，尝试提取 {...} 对象
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  
  // 如果没有对象，尝试提取 [...] 数组
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }
  
  // 如果都没有，返回原内容（可能是纯 JSON）
  return content.trim();
}

items.forEach((item) => {
  const content = item.json.output || item.json.content || '';
  
  if (!content || typeof content !== 'string') {
    return; // 跳过空内容
  }
  
  // 提取 JSON 内容（可能来自 markdown 代码块）
  const jsonContent = extractJsonFromMarkdown(content);
  
  if (!jsonContent) {
    console.error('无法提取 JSON 内容');
    console.error('原始内容:', content);
    return;
  }
  
  let parsed = null;
  
  try {
    // 解析 JSON
    parsed = JSON.parse(jsonContent);
  } catch (parseError) {
    console.error('解析 JSON 失败:', parseError.message);
    console.error('提取的内容:', jsonContent);
    return; // 跳过无法解析的项
  }
  
  // 确保 parsed 是数组
  if (!Array.isArray(parsed)) {
    // 如果不是数组，包装成数组
    parsed = [parsed];
  }
  
  // 将解析结果添加到总结果中
  allParsed.push(...parsed);
});

// 返回所有解析结果的扁平数组
return allParsed.map(item => ({ json: item }));

